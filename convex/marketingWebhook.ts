import { v } from "convex/values";
import { httpAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { blindIndex } from "./lib/encryption";
import { setSuppression } from "./lib/customers";
import { validEmail } from "../shared/estimate-email.js";
const statuses: Record<string, string> = {
  delivered: "delivered",
  soft_bounce: "soft bounce",
  hard_bounce: "hard bounce",
  hardBounce: "hard bounce",
  unsubscribed: "unsubscribed",
  spam: "spam complaint",
};
export const receive = httpAction(async (ctx, request) => {
  const secret = process.env.BREVO_MARKETING_WEBHOOK_SECRET;
  if (
    !secret ||
    secret.length < 32 ||
    request.headers.get("x-action-audio-webhook-key") !== secret
  )
    return new Response("Unauthorized", { status: 401 });
  const raw = await request.text();
  if (raw.length > 65536)
    return new Response("Payload too large", { status: 413 });
  let events;
  try {
    const value = JSON.parse(raw);
    events = Array.isArray(value) ? value : [value];
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  if (events.length > 100)
    return new Response("Too many events", { status: 400 });
  for (const e of events) {
    if (
      !e ||
      !validEmail(e.email) ||
      typeof e.event !== "string" ||
      !statuses[e.event]
    )
      continue;
    await ctx.runMutation(internal.marketingWebhook.record, {
      email: e.email.trim().toLowerCase(),
      event: e.event,
      ...(Number.isSafeInteger(e.camp_id) ? { providerId: e.camp_id } : {}),
    });
  }
  return new Response(null, { status: 204 });
});
export const record = internalMutation({
  args: {
    email: v.string(),
    event: v.string(),
    providerId: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!statuses[args.event]) return;
    const customer = await ctx.db
      .query("customers")
      .withIndex("by_identity", (q) =>
        q.eq(
          "identityHash",
          blindIndex(
            "customer-identity",
            `email:${args.email.trim().toLowerCase()}`,
          ),
        ),
      )
      .unique();
    if (!customer) return;
    if (
      ["hard_bounce", "hardBounce", "spam", "unsubscribed"].includes(args.event)
    )
      await setSuppression(
        ctx,
        customer._id,
        `Brevo marketing event: ${args.event}`,
      );
    if (args.providerId === undefined) return;
    const batch = await ctx.db
      .query("campaignBatches")
      .withIndex("by_provider", (q) => q.eq("providerId", args.providerId))
      .unique();
    if (!batch) return;
    const recipients = await ctx.db
      .query("campaignRecipients")
      .withIndex("by_campaign", (q) => q.eq("campaignId", batch.campaignId))
      .collect();
    for (const r of recipients.filter(
      (r) => r.customerId === customer._id && r.batchId === batch._id,
    )) {
      // Late delivery events must not hide an unsubscribe or complaint.
      if (
        ["unsubscribed", "spam complaint", "hard bounce"].includes(
          r.deliveryStatus || "",
        ) &&
        ["delivered", "soft bounce"].includes(statuses[args.event])
      )
        continue;
      await ctx.db.patch(r._id, { deliveryStatus: statuses[args.event] });
    }
  },
});
