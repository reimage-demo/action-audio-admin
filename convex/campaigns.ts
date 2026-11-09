import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  internalAction,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAdmin } from "./lib/requireAdmin";
import { encrypt, decrypt } from "./lib/encryption";
import { readCustomer, setSuppression } from "./lib/customers";
import {
  customerEligibility,
  promotionEmail,
  validatePromotion,
} from "../shared/promotions.js";
import { EMAIL_DAILY_LIMIT, validEmail } from "../shared/estimate-email.js";
import type { QueryCtx } from "./_generated/server";
import type { Id, Doc } from "./_generated/dataModel";
const content = v.object({
  template: v.string(),
  subject: v.string(),
  headline: v.string(),
  offer: v.string(),
  body: v.string(),
  button: v.string(),
  url: v.string(),
  store: v.string(),
  expires: v.string(),
  terms: v.string(),
});
type Content = {
  template: string;
  subject: string;
  headline: string;
  offer: string;
  body: string;
  button: string;
  url: string;
  store: string;
  expires: string;
  terms: string;
};
type Payload = { content: Content; customerIds: Id<"customers">[] };
const aad = (key: string) => JSON.stringify(["promotion", key]);
const read = (row: Doc<"campaigns">) =>
  decrypt<Payload>(row.encrypted, aad(row.key));
const enabled = () =>
  process.env.PROMOTIONS_ENABLED === "true" &&
  Boolean(
    process.env.BREVO_MARKETING_API_KEY &&
    process.env.BREVO_PROMOTION_SENDER_EMAIL?.endsWith(
      "@actionaudiostorellc.com",
    ) &&
    Number(process.env.BREVO_MARKETING_FOLDER_ID) > 0,
  );
const requireEnabled = () => {
  if (!enabled())
    throw new ConvexError(
      "Promotion sending is disabled. Finish the authenticated sender and campaign API setup before enabling it.",
    );
};
const dailyRoom = async (ctx: QueryCtx) => {
  const attempts = await ctx.db
    .query("emailAttempts")
    .withIndex("by_at", (q) => q.gt("at", Date.now() - 86400000))
    .collect();
  return Math.max(0, EMAIL_DAILY_LIMIT - 50 - attempts.length);
};
export const settings = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return { enabled: enabled(), available: await dailyRoom(ctx), reserve: 50 };
  },
});
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("campaigns").order("desc").take(100);
    return Promise.all(
      rows.map(async (row) => ({
        id: row._id,
        status: row.status,
        updatedAt: row.updatedAt,
        revision: row.revision,
        ...(await read(row)),
        totals: row.totals,
        error: row.error,
      })),
    );
  },
});
export const save = mutation({
  args: {
    id: v.optional(v.id("campaigns")),
    key: v.string(),
    content,
    customerIds: v.array(v.id("customers")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const error = validatePromotion(args.content);
    if (error) throw new ConvexError(error);
    if (!/^[a-f0-9-]{36}$/.test(args.key) || args.customerIds.length > 5000)
      throw new ConvexError("Select up to 5,000 customers per campaign.");
    const prior = args.id
      ? await ctx.db.get(args.id)
      : await ctx.db
          .query("campaigns")
          .withIndex("by_key", (q) => q.eq("key", args.key))
          .unique();
    if (prior && prior.status !== "draft")
      throw new ConvexError(
        "This campaign is already queued. Create a new draft to change it.",
      );
    const payload = {
      content: args.content,
      customerIds: [...new Set(args.customerIds)],
    };
    const key = prior?.key || args.key;
    if (prior) {
      await ctx.db.patch(prior._id, {
        encrypted: await encrypt(payload, aad(key)),
        revision: prior.revision + 1,
        updatedAt: Date.now(),
      });
      return { id: prior._id, revision: prior.revision + 1 };
    }
    const id = await ctx.db.insert("campaigns", {
      key,
      encrypted: await encrypt(payload, aad(key)),
      status: "draft",
      revision: 1,
      updatedAt: Date.now(),
    });
    return { id, revision: 1 };
  },
});
export const queue = mutation({
  args: {
    id: v.id("campaigns"),
    revision: v.number(),
    eligibleCount: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    requireEnabled();
    const row = await ctx.db.get(args.id);
    if (!row) throw new ConvexError("Campaign not found.");
    if (row.status !== "draft") return;
    if (row.revision !== args.revision)
      throw new ConvexError(
        "The draft changed. Review it again before sending.",
      );
    const data = await read(row);
    if (
      data.content.expires &&
      data.content.expires <
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/New_York",
        }).format(new Date())
    )
      throw new ConvexError("The offer has expired. Update the draft.");
    const recipients = [];
    let eligible = 0;
    const emails = new Set<string>();
    for (const id of data.customerIds) {
      const c = await ctx.db.get(id);
      const customer = c ? await readCustomer(c) : null;
      let reason = customer
        ? customerEligibility(customer)
        : "Customer no longer exists";
      if (customer && !reason && emails.has(customer.email))
        reason = "Duplicate email";
      if (customer && !reason) {
        emails.add(customer.email);
        eligible++;
      }
      recipients.push({ customerId: id, reason });
    }
    if (!eligible)
      throw new ConvexError(
        "Select at least one subscribed customer with a valid email.",
      );
    if (eligible !== args.eligibleCount)
      throw new ConvexError(
        "Recipient eligibility changed. Refresh and review the recipient count again.",
      );
    for (const r of recipients)
      await ctx.db.insert("campaignRecipients", {
        campaignId: row._id,
        customerId: r.customerId,
        status: r.reason ? "skipped" : "pending",
        reason: r.reason,
      });
    await ctx.db.patch(row._id, { status: "queued", updatedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.campaigns.deliver, {
      id: row._id,
    });
  },
});
export const cancel = mutation({
  args: { id: v.id("campaigns") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const row = await ctx.db.get(id);
    if (!row || row.status !== "queued")
      throw new ConvexError("Only a queued campaign can be stopped.");
    const recipients = await ctx.db
      .query("campaignRecipients")
      .withIndex("by_campaign", (q) => q.eq("campaignId", id))
      .collect();
    if (recipients.some((r) => r.status === "sending"))
      throw new ConvexError(
        "A batch is sending. Wait for it to finish before stopping.",
      );
    for (const r of recipients)
      if (r.status === "pending")
        await ctx.db.patch(r._id, {
          status: "skipped",
          reason: "Campaign stopped by staff",
        });
    await ctx.db.patch(id, { status: "cancelled", updatedAt: Date.now() });
  },
});
export const history = query({
  args: { id: v.id("campaigns") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    return ctx.db
      .query("campaignRecipients")
      .withIndex("by_campaign", (q) => q.eq("campaignId", id))
      .collect();
  },
});
export const claim = internalMutation({
  args: { id: v.id("campaigns"), providerRoom: v.number() },
  handler: async (ctx, { id, providerRoom }) => {
    if (!enabled()) return null;
    const campaign = await ctx.db.get(id);
    if (!campaign || campaign.status !== "queued") return null;
    const recipients = await ctx.db
      .query("campaignRecipients")
      .withIndex("by_campaign", (q) => q.eq("campaignId", id))
      .collect();
    if (recipients.some((r) => r.status === "sending")) return null;
    const payload = await read(campaign);
    if (
      payload.content.expires &&
      payload.content.expires <
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/New_York",
        }).format(new Date())
    ) {
      for (const r of recipients)
        if (r.status === "pending")
          await ctx.db.patch(r._id, {
            status: "skipped",
            reason: "Offer expired before sending",
          });
      await ctx.db.patch(id, {
        status: "cancelled",
        error: "Offer expired before all batches could send.",
        updatedAt: Date.now(),
      });
      return null;
    }

    const room = Math.min(
      50,
      await dailyRoom(ctx),
      Math.max(0, Math.floor(providerRoom) - 50),
    );
    if (!room) return null;
    const picked = [];
    for (const r of recipients.filter((r) => r.status === "pending")) {
      const c = await ctx.db.get(r.customerId);
      const value = c ? await readCustomer(c) : null;
      const reason = value
        ? customerEligibility(value)
        : "Customer no longer exists";
      if (reason) {
        await ctx.db.patch(r._id, { status: "skipped", reason });
        continue;
      }
      picked.push({ ...r, email: value!.email });
      if (picked.length >= room) break;
    }
    if (!picked.length) {
      await ctx.db.patch(id, { status: "completed", updatedAt: Date.now() });
      return null;
    }
    const batchId = await ctx.db.insert("campaignBatches", {
      campaignId: id,
      status: "sending",
      startedAt: Date.now(),
    });
    for (const r of picked) {
      await ctx.db.patch(r._id, { status: "sending", batchId });
      await ctx.db.insert("emailAttempts", { at: Date.now() });
    }
    return { batchId, recipients: picked, ...(await read(campaign)) };
  },
});
export const suppress = internalMutation({
  args: { id: v.id("customers") },
  handler: (ctx, { id }) =>
    setSuppression(ctx, id, "Brevo reports this contact is blocklisted."),
});
export const batchRecord = internalMutation({
  args: {
    id: v.id("campaignBatches"),
    providerId: v.optional(v.number()),
    listId: v.optional(v.number()),
    status: v.optional(
      v.union(v.literal("submitted"), v.literal("failed"), v.literal("review")),
    ),
    skipped: v.optional(v.array(v.id("customers"))),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.id);
    if (!batch || batch.status !== "sending") return;
    const patch: any = {};
    if (args.providerId !== undefined) patch.providerId = args.providerId;
    if (args.listId !== undefined) patch.listId = args.listId;
    if (args.status) patch.status = args.status;
    if (args.error) patch.error = args.error;
    await ctx.db.patch(args.id, patch);
    if (!args.status) return;
    const recipients = await ctx.db
      .query("campaignRecipients")
      .withIndex("by_campaign", (q) => q.eq("campaignId", batch.campaignId))
      .collect();
    for (const r of recipients.filter((r) => r.batchId === batch._id))
      await ctx.db.patch(r._id, {
        status: args.skipped?.includes(r.customerId) ? "skipped" : args.status,
        reason: args.skipped?.includes(r.customerId)
          ? "No longer eligible"
          : args.error,
      });
    await ctx.db.patch(batch.campaignId, {
      status:
        args.status === "submitted"
          ? recipients.some((r) => r.status === "pending")
            ? "queued"
            : "completed"
          : "review",
      error: args.error,
      updatedAt: Date.now(),
    });
  },
});
async function brevo(path: string, method = "GET", body?: unknown) {
  const response = await fetch("https://api.brevo.com/v3/" + path, {
    method,
    headers: {
      "api-key": process.env.BREVO_MARKETING_API_KEY!,
      "content-type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20000),
  });
  if (response.status === 404 && method === "GET") return null;
  if (!response.ok) throw new Error(`Brevo HTTP ${response.status}`);
  if (response.status === 204) return {};
  return response.json();
}
export const freshRecipient = internalQuery({
  args: { id: v.id("customers") },
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get(id);
    if (!row) return null;
    const c = await readCustomer(row);
    return customerEligibility(c) ? null : { email: c.email };
  },
});
export const deliver = internalAction({
  args: { id: v.id("campaigns") },
  handler: async (ctx, { id }): Promise<void> => {
    if (!enabled()) return;
    let account;
    try {
      account = await brevo("account");
    } catch {
      return;
    }
    const providerRoom =
      account?.plan
        ?.filter((p: any) =>
          ["free", "subscription", "payAsYouGo"].includes(p.type),
        )
        .reduce((n: number, p: any) => n + (Number(p.credits) || 0), 0) || 0;
    const batch = await ctx.runMutation(internal.campaigns.claim, {
      id,
      providerRoom,
    });
    if (!batch) return;
    let dispatched = false;
    const skipped: Id<"customers">[] = [];
    try {
      const list = await brevo("contacts/lists", "POST", {
        name: `AA ${String(batch.batchId)}`,
        folderId: Number(process.env.BREVO_MARKETING_FOLDER_ID),
      });
      await ctx.runMutation(internal.campaigns.batchRecord, {
        id: batch.batchId,
        listId: list.id,
      });
      const accepted: { customerId: Id<"customers">; email: string }[] = [];
      for (const r of batch.recipients) {
        const fresh = await ctx.runQuery(internal.campaigns.freshRecipient, {
          id: r.customerId,
        });
        if (!fresh || fresh.email !== r.email) {
          skipped.push(r.customerId);
          continue;
        }
        const contact = await brevo("contacts/" + encodeURIComponent(r.email));
        if (contact?.emailBlacklisted) {
          await ctx.runMutation(internal.campaigns.suppress, {
            id: r.customerId,
          });
          skipped.push(r.customerId);
          continue;
        }
        // Never set emailBlacklisted=false: this must not resubscribe an opt-out.
        await brevo("contacts", "POST", {
          email: r.email,
          updateEnabled: true,
          listIds: [list.id],
        });
        accepted.push({ customerId: r.customerId, email: r.email });
      }
      // Recheck local opt-outs after synchronization, immediately before dispatch.
      for (let i = accepted.length - 1; i >= 0; i--) {
        const r = accepted[i];
        const fresh = await ctx.runQuery(internal.campaigns.freshRecipient, {
          id: r.customerId,
        });
        if (!fresh || fresh.email !== r.email) {
          await brevo("contacts/" + encodeURIComponent(r.email), "PUT", {
            unlinkListIds: [list.id],
          });
          skipped.push(r.customerId);
          accepted.splice(i, 1);
        }
      }
      if (accepted.length) {
        const html = promotionEmail(batch.content);
        const campaign = await brevo("emailCampaigns", "POST", {
          name: `Action Audio ${String(batch.batchId)}`,
          type: "classic",
          sender: {
            name: "Action Audio",
            email: process.env.BREVO_PROMOTION_SENDER_EMAIL,
          },
          replyTo: process.env.BREVO_REPLY_TO_EMAIL,
          ...html,
          recipients: { listIds: [list.id] },
        });
        await ctx.runMutation(internal.campaigns.batchRecord, {
          id: batch.batchId,
          providerId: campaign.id,
        });
        dispatched = true;
        await brevo(`emailCampaigns/${campaign.id}/sendNow`, "POST");
      }
      await ctx.runMutation(internal.campaigns.batchRecord, {
        id: batch.batchId,
        status: "submitted",
        skipped,
      });
    } catch {
      await ctx.runMutation(internal.campaigns.batchRecord, {
        id: batch.batchId,
        status: dispatched ? "review" : "failed",
        error: dispatched
          ? "Delivery uncertain — check Brevo before sending again."
          : "Batch preparation failed. No campaign send was attempted.",
        skipped,
      });
    }
  },
});
export const drain = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (!enabled()) return;
    const stale = await ctx.db
      .query("campaignBatches")
      .withIndex("by_status", (q) => q.eq("status", "sending"))
      .collect();
    for (const b of stale)
      if (b.startedAt < Date.now() - 600000) {
        await ctx.db.patch(b._id, {
          status: "review",
          error: "Worker interrupted; check Brevo before sending again.",
        });
        await ctx.db.patch(b.campaignId, {
          status: "review",
          error: "Worker interrupted; check Brevo before sending again.",
        });
      }
    const rows = await ctx.db
      .query("campaigns")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .take(10);
    for (const row of rows)
      await ctx.scheduler.runAfter(0, internal.campaigns.deliver, {
        id: row._id,
      });
  },
});
export const refresh = mutation({
  args: { id: v.id("campaigns") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    requireEnabled();
    await ctx.scheduler.runAfter(0, internal.campaigns.reports, { id });
  },
});
export const reportBatches = internalQuery({
  args: { id: v.id("campaigns") },
  handler: async (ctx, { id }) =>
    ctx.db
      .query("campaignBatches")
      .withIndex("by_campaign", (q) => q.eq("campaignId", id))
      .collect(),
});
export const reportResult = internalMutation({
  args: {
    id: v.id("campaigns"),
    totals: v.object({
      sent: v.number(),
      delivered: v.number(),
      bounced: v.number(),
      unsubscribed: v.number(),
    }),
  },
  handler: async (ctx, { id, totals }) => {
    if (await ctx.db.get(id))
      await ctx.db.patch(id, { totals, updatedAt: Date.now() });
  },
});
export const reports = internalAction({
  args: { id: v.id("campaigns") },
  handler: async (ctx, { id }): Promise<void> => {
    if (!enabled()) return;
    const batches = await ctx.runQuery(internal.campaigns.reportBatches, {
      id,
    });
    const totals = { sent: 0, delivered: 0, bounced: 0, unsubscribed: 0 };
    try {
      for (const b of batches) {
        if (!b.providerId) continue;
        const result = await brevo(`emailCampaigns/${b.providerId}`);
        const s = result?.statistics?.globalStats || {};
        totals.sent += s.sent || 0;
        totals.delivered += s.delivered || 0;
        totals.bounced += (s.hardBounces || 0) + (s.softBounces || 0);
        totals.unsubscribed += s.unsubscriptions || 0;
      }
      await ctx.runMutation(internal.campaigns.reportResult, { id, totals });
    } catch {
      /* Preserve the last successful report. */
    }
  },
});
// Test sends have their own idempotent queue and use the same quota ledger.
export const sendTest = mutation({
  args: { id: v.id("campaigns"), email: v.string(), key: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    requireEnabled();
    if (!validEmail(args.email) || !/^[a-f0-9-]{36}$/.test(args.key))
      throw new ConvexError("Enter a valid test address.");
    const existing = await ctx.db
      .query("campaignTests")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    if (existing) return existing._id;
    const row = await ctx.db.get(args.id);
    if (!row) throw new ConvexError("Save the draft first.");
    if (!(await dailyRoom(ctx)))
      throw new ConvexError("No promotion capacity is available today.");
    const todayTests = await ctx.db
      .query("campaignTests")
      .filter((q) => q.gt(q.field("_creationTime"), Date.now() - 86400000))
      .collect();
    if (todayTests.length >= 50)
      throw new ConvexError(
        "The daily limit of 50 test emails has been reached.",
      );
    const value = await read(row);
    const id = await ctx.db.insert("campaignTests", {
      key: args.key,
      status: "queued",
      encrypted: await encrypt(
        { email: args.email, content: value.content },
        aad(args.key),
      ),
    });
    await ctx.db.insert("emailAttempts", { at: Date.now() });
    await ctx.scheduler.runAfter(0, internal.campaigns.deliverTest, { id });
    return id;
  },
});
export const claimTest = internalMutation({
  args: { id: v.id("campaignTests") },
  handler: async (ctx, { id }) => {
    if (!enabled()) return null;
    const row = await ctx.db.get(id);
    if (!row || row.status !== "queued") return null;
    await ctx.db.patch(id, { status: "sending" });
    return decrypt<{ email: string; content: Content }>(
      row.encrypted,
      aad(row.key),
    );
  },
});
export const finishTest = internalMutation({
  args: { id: v.id("campaignTests"), status: v.string() },
  handler: async (ctx, { id, status }) => {
    await ctx.db.patch(id, { status });
  },
});
export const testStatus = query({
  args: { id: v.id("campaignTests") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    return (await ctx.db.get(id))?.status;
  },
});
export const deliverTest = internalAction({
  args: { id: v.id("campaignTests") },
  handler: async (ctx, { id }): Promise<void> => {
    const data = await ctx.runMutation(internal.campaigns.claimTest, { id });
    if (!data) return;
    try {
      const result = await brevo("emailCampaigns", "POST", {
        name: `Action Audio test ${id}`,
        type: "classic",
        sender: {
          name: "Action Audio",
          email: process.env.BREVO_PROMOTION_SENDER_EMAIL,
        },
        replyTo: process.env.BREVO_REPLY_TO_EMAIL,
        ...promotionEmail(data.content, { test: true }),
      });
      await brevo(`emailCampaigns/${result.id}/sendTest`, "POST", {
        emailTo: [data.email],
      });
      await ctx.runMutation(internal.campaigns.finishTest, {
        id,
        status: "submitted",
      });
    } catch {
      await ctx.runMutation(internal.campaigns.finishTest, {
        id,
        status: "review",
      });
    }
  },
});
