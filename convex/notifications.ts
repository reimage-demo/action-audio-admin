import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// No customer details or credentials are stored in the notification queue.
export async function enqueueNotification(
  ctx: MutationCtx,
  kind: "appointment" | "estimate",
  recordId: Id<"appointments"> | Id<"estimates">,
) {
  if (process.env.PUSHOVER_ENABLED !== "true") return;
  const id = await ctx.db.insert("notificationDeliveries", {
    kind,
    recordId,
    status: "pending",
    attempts: 0,
  });
  await ctx.scheduler.runAfter(0, internal.notifications.deliver, { id });
}

export const getDelivery = internalQuery({
  args: { id: v.id("notificationDeliveries") },
  handler: (ctx, { id }) => ctx.db.get(id),
});

export const recordResult = internalMutation({
  args: {
    id: v.id("notificationDeliveries"),
    sent: v.boolean(),
    retryable: v.boolean(),
    errorCode: v.optional(v.string()),
    request: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row || row.status !== "pending") return;
    const attempts = row.attempts + 1;
    const delays = [30_000, 120_000, 600_000, 3_600_000];
    const retry = !args.sent && args.retryable && attempts <= delays.length;
    await ctx.db.patch(row._id, {
      attempts,
      status: args.sent ? "sent" : retry ? "pending" : "failed",
      errorCode: args.errorCode,
      pushoverRequest: args.request,
      sentAt: args.sent ? Date.now() : undefined,
    });
    if (retry)
      await ctx.scheduler.runAfter(
        delays[attempts - 1],
        internal.notifications.deliver,
        { id: row._id },
      );
  },
});

export const deliver = internalAction({
  args: { id: v.id("notificationDeliveries") },
  handler: async (ctx, { id }): Promise<void> => {
    const row = await ctx.runQuery(internal.notifications.getDelivery, { id });
    if (!row || row.status !== "pending") return;
    const token = process.env.PUSHOVER_APP_TOKEN;
    const user = process.env.PUSHOVER_USER_KEY;
    const portal = process.env.PUSHOVER_PORTAL_URL;
    if (
      process.env.PUSHOVER_ENABLED !== "true" ||
      !token ||
      !user ||
      !portal?.startsWith("https://")
    ) {
      await ctx.runMutation(internal.notifications.recordResult, {
        id,
        sent: false,
        retryable: false,
        errorCode: "configuration_missing_or_disabled",
      });
      return;
    }
    const booking = row.kind === "appointment";
    const body = new URLSearchParams({
      token,
      user,
      title: booking
        ? "Action Audio — New appointment request"
        : "Action Audio — New estimate request",
      message: booking
        ? "A customer submitted an appointment request. Open the staff portal to review the details and confirm the appointment."
        : "A customer requested an estimate. Open the staff portal’s Estimates tab to review the request and follow up.",
      url: portal,
      url_title: "Open Action Audio staff portal",
      priority: "0",
    });
    if (process.env.PUSHOVER_DEVICE)
      body.set("device", process.env.PUSHOVER_DEVICE);
    let result: {
      sent: boolean;
      retryable: boolean;
      errorCode?: string;
      request?: string;
    };
    try {
      const response = await fetch("https://api.pushover.net/1/messages.json", {
        method: "POST",
        body,
        signal: AbortSignal.timeout(15_000),
      });
      const data = (await response.json().catch(() => null)) as {
        status?: number;
        request?: string;
      } | null;
      result =
        response.ok && data?.status === 1
          ? { sent: true, retryable: false, request: data.request }
          : {
              sent: false,
              retryable: response.status >= 500 || (response.ok && !data),
              errorCode: `pushover_http_${response.status}`,
            };
    } catch {
      result = { sent: false, retryable: true, errorCode: "network_error" };
    }
    // Never log response bodies: third-party errors may echo credentials.
    await ctx.runMutation(internal.notifications.recordResult, {
      id,
      ...result,
    });
  },
});
