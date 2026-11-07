import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  internalAction,
  internalMutation,
} from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import type { Estimate } from "./estimates";
import { encrypt, decrypt } from "./lib/encryption";
import { requireAdmin } from "./lib/requireAdmin";
import {
  EMAIL_DAILY_LIMIT,
  estimateEmail,
  validEmail,
} from "../shared/estimate-email.js";
type Payload = {
  email: string;
  name: string;
  service: string;
  store: string;
  body: string;
};
const context = (key: string) => JSON.stringify(["estimate-email", key]);
export async function enqueueEmail(
  ctx: MutationCtx,
  estimateId: Id<"estimates">,
  kind: "thanks" | "estimate",
  key: string,
  payload: Payload,
) {
  const id = await ctx.db.insert("emailDeliveries", {
    estimateId,
    kind,
    key,
    encrypted: await encrypt(payload, context(key)),
    status: "pending",
    attempts: 0,
    nextAttemptAt: Date.now(),
  });
  await ctx.scheduler.runAfter(0, internal.emails.deliver, { id });
  return id;
}
export const sendEstimate = mutation({
  args: {
    id: v.id("estimates"),
    email: v.string(),
    body: v.string(),
    requestKey: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const email = args.email.trim().toLowerCase(),
      body = args.body.trim();
    if (!validEmail(email))
      throw new ConvexError("Enter a valid customer email address.");
    if (body.length < 10 || body.length > 10000)
      throw new ConvexError(
        "Write an estimate between 10 and 10,000 characters.",
      );
    if (!/^[a-f0-9-]{36}$/.test(args.requestKey))
      throw new ConvexError("Invalid send request.");
    const key = `estimate:${args.id}:${args.requestKey}`;
    const existing = await ctx.db
      .query("emailDeliveries")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (existing) {
      const prior = await decrypt<Payload>(existing.encrypted, context(key));
      if (prior.email !== email || prior.body !== body)
        throw new ConvexError(
          "This message was already queued. Open a new email to make changes.",
        );
      return existing._id;
    }
    const row = await ctx.db.get(args.id);
    if (!row) throw new ConvexError("Estimate request not found.");
    const aad = JSON.stringify(["estimate", row.requestHash, row.phoneHash]);
    const data = await decrypt<Estimate>(row.encrypted, aad);
    await ctx.db.patch(row._id, {
      encrypted: await encrypt({ ...data, email, updatedAt: Date.now() }, aad),
    });
    return enqueueEmail(ctx, row._id, "estimate", key, {
      email,
      body,
      name: data.name,
      service: data.service,
      store: data.store,
    });
  },
});
export const history = query({
  args: { id: v.id("estimates") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("emailDeliveries")
      .withIndex("by_estimate", (q) => q.eq("estimateId", id))
      .order("desc")
      .collect();
    return Promise.all(
      rows.map(async (r) => ({
        id: r._id,
        kind: r.kind,
        status: r.status,
        sentAt: r.sentAt,
        createdAt: r._creationTime,
        errorCode: r.errorCode,
        ...(await decrypt<Payload>(r.encrypted, context(r.key))),
      })),
    );
  },
});
export const retry = mutation({
  args: { id: v.id("emailDeliveries") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const row = await ctx.db.get(id);
    if (!row || row.status !== "failed")
      throw new ConvexError(
        "Only messages confirmed as not sent can be retried. Check Brevo logs for uncertain deliveries.",
      );
    await ctx.db.patch(id, {
      status: "pending",
      nextAttemptAt: Date.now(),
      errorCode: undefined,
    });
    await ctx.scheduler.runAfter(0, internal.emails.deliver, { id });
  },
});
export const usage = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const attempts = await ctx.db
      .query("emailAttempts")
      .withIndex("by_at", (q) => q.gt("at", Date.now() - 86400000))
      .collect();
    return {
      used: attempts.length,
      limit: EMAIL_DAILY_LIMIT,
      enabled:
        process.env.BREVO_ENABLED === "true" &&
        Boolean(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL),
    };
  },
});
// A transaction reserves capacity before the external request. Failed and uncertain
// attempts also consume capacity, so concurrent actions cannot overshoot the cap.
export const claim = internalMutation({
  args: { id: v.id("emailDeliveries") },
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get(id),
      now = Date.now();
    if (!row || row.status !== "pending" || row.nextAttemptAt > now)
      return null;
    if (
      process.env.BREVO_ENABLED !== "true" ||
      !process.env.BREVO_API_KEY ||
      !process.env.BREVO_SENDER_EMAIL
    )
      return null;
    const attempts = await ctx.db
      .query("emailAttempts")
      .withIndex("by_at", (q) => q.gt("at", now - 86400000))
      .collect();
    if (attempts.length >= EMAIL_DAILY_LIMIT) {
      await ctx.db.patch(id, {
        nextAttemptAt: attempts[0].at + 86400001,
        errorCode: "daily_limit",
      });
      return null;
    }
    await ctx.db.insert("emailAttempts", { at: now });
    await ctx.db.patch(id, {
      status: "sending",
      attempts: row.attempts + 1,
      attemptedAt: now,
      errorCode: undefined,
    });
    return {
      ...row,
      payload: await decrypt<Payload>(row.encrypted, context(row.key)),
    };
  },
});
export const recordResult = internalMutation({
  args: {
    id: v.id("emailDeliveries"),
    status: v.union(
      v.literal("sent"),
      v.literal("pending"),
      v.literal("failed"),
      v.literal("review"),
    ),
    errorCode: v.optional(v.string()),
    messageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row || row.status !== "sending") return;
    await ctx.db.patch(row._id, {
      status: args.status,
      errorCode: args.errorCode,
      messageId: args.messageId,
      sentAt: args.status === "sent" ? Date.now() : undefined,
      nextAttemptAt: Date.now() + 3600000,
    });
    if (args.status === "sent" && row.kind === "estimate") {
      const estimate = await ctx.db.get(row.estimateId);
      if (estimate) {
        const aad = JSON.stringify([
          "estimate",
          estimate.requestHash,
          estimate.phoneHash,
        ]);
        const data = await decrypt<Estimate>(estimate.encrypted, aad);
        await ctx.db.patch(estimate._id, {
          encrypted: await encrypt(
            {
              ...data,
              status: data.status === "closed" ? "closed" : "quoted",
              updatedAt: Date.now(),
            },
            aad,
          ),
        });
      }
    }
  },
});
export const deliver = internalAction({
  args: { id: v.id("emailDeliveries") },
  handler: async (ctx, { id }): Promise<void> => {
    const row = await ctx.runMutation(internal.emails.claim, { id });
    if (!row) return;
    const record = (
      status: "sent" | "pending" | "failed" | "review",
      errorCode?: string,
      messageId?: string,
    ) =>
      ctx.runMutation(internal.emails.recordResult, {
        id,
        status,
        errorCode,
        messageId,
      });
    const headers = {
      "api-key": process.env.BREVO_API_KEY!,
      "Content-Type": "application/json",
      accept: "application/json",
    };
    // Inspect account credits too: campaigns or other integrations may share the account.
    try {
      const response = await fetch("https://api.brevo.com/v3/account", {
        headers,
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        await record(
          response.status === 429 || response.status >= 500
            ? "pending"
            : "failed",
          "account_check_failed",
        );
        return;
      }
      const account = await response.json();
      if (account.relay?.enabled === false) {
        await record("failed", "transactional_email_not_active");
        return;
      }
      const credits = (account.plan || [])
        .filter((p: { type: string; credits?: number }) =>
          ["free", "subscription", "payAsYouGo"].includes(p.type),
        )
        .map((p: { credits?: number }) => p.credits)
        .filter((n: unknown): n is number => typeof n === "number");
      if (!credits.length || Math.max(...credits) <= 10) {
        await record("pending", "brevo_credit_buffer");
        return;
      }
    } catch {
      await record("pending", "account_check_unavailable");
      return;
    }
    let response: Response;
    try {
      response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers,
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({
          sender: {
            name: "Action Audio",
            email: process.env.BREVO_SENDER_EMAIL,
          },
          replyTo: {
            name: "Action Audio",
            email:
              process.env.BREVO_REPLY_TO_EMAIL ||
              process.env.BREVO_SENDER_EMAIL,
          },
          to: [{ email: row.payload.email, name: row.payload.name }],
          ...estimateEmail({ ...row.payload, kind: row.kind }),
          headers: { idempotencyKey: row._id },
          tags: ["action-audio-estimates", row.kind],
        }),
      });
    } catch {
      await record("review", "delivery_unknown_check_brevo");
      return;
    }
    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      await record(
        "sent",
        undefined,
        typeof data.messageId === "string" ? data.messageId : undefined,
      );
    } else if (response.status === 429)
      await record("pending", "brevo_rate_limit");
    else if (response.status >= 500)
      await record("review", "delivery_unknown_check_brevo");
    else await record("failed", `brevo_http_${response.status}`);
  },
});
export const drain = internalMutation({
  args: {},
  handler: async (ctx) => {
    const pending = await ctx.db
      .query("emailDeliveries")
      .withIndex("by_status_next", (q) =>
        q.eq("status", "pending").lte("nextAttemptAt", Date.now()),
      )
      .take(25);
    for (const row of pending)
      await ctx.scheduler.runAfter(0, internal.emails.deliver, { id: row._id });
    const sending = await ctx.db
      .query("emailDeliveries")
      .withIndex("by_status_next", (q) => q.eq("status", "sending"))
      .collect();
    for (const row of sending)
      if ((row.attemptedAt || 0) < Date.now() - 600000)
        await ctx.db.patch(row._id, {
          status: "review",
          errorCode: "delivery_unknown_check_brevo",
        });
    const expired = await ctx.db
      .query("emailAttempts")
      .withIndex("by_at", (q) => q.lt("at", Date.now() - 172800000))
      .take(1000);
    for (const row of expired) await ctx.db.delete(row._id);
  },
});
