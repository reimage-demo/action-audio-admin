import { v, ConvexError } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAdmin } from "./lib/requireAdmin";
import { readCustomer, writeCustomer, saveCustomer } from "./lib/customers";
import { readBooking } from "./appointments";
import { readEstimate } from "./estimates";
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("customers").collect();
    return Promise.all(
      rows.map(async (row) => ({ _id: row._id, ...(await readCustomer(row)) })),
    );
  },
});
export const update = mutation({
  args: {
    id: v.id("customers"),
    name: v.string(),
    phone: v.string(),
    marketingStatus: v.union(
      v.literal("unknown"),
      v.literal("subscribed"),
      v.literal("unsubscribed"),
    ),
    evidence: v.string(),
    confirmDetails: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const row = await ctx.db.get(args.id);
    if (!row) throw new ConvexError("Customer not found.");
    const old = await readCustomer(row);
    if (
      old.marketingStatus === "unsubscribed" &&
      args.marketingStatus === "unknown"
    )
      throw new ConvexError(
        "Keep the recorded opt-out, or record new permission to subscribe.",
      );
    if (
      args.name.trim().length < 2 ||
      args.name.length > 100 ||
      args.phone.replace(/\D/g, "").length < 10 ||
      args.phone.length > 30 ||
      args.evidence.length > 1000
    )
      throw new ConvexError("Check the customer details.");
    if (
      args.marketingStatus === "subscribed" &&
      old.marketingStatus !== "subscribed" &&
      args.evidence.trim().length < 10
    )
      throw new ConvexError(
        "Record when and how the customer agreed to promotional emails.",
      );
    if (args.marketingStatus === "subscribed" && old.blocked)
      throw new ConvexError(
        "This address is blocked by the email provider. Resolve its status in Brevo first.",
      );
    await ctx.db.patch(row._id, {
      encrypted: await writeCustomer(row, {
        ...old,
        name: args.name.trim(),
        phone: args.phone.trim(),
        marketingStatus: args.marketingStatus,
        conflicts: args.confirmDetails ? [] : old.conflicts,
        ...(args.marketingStatus !== old.marketingStatus
          ? {
              consent: {
                at: Date.now(),
                source: "Staff",
                text: args.evidence.trim() || "Staff recorded an opt-out.",
                version: "manual",
              },
            }
          : {}),
      }),
    });
  },
});
// Explicit, resumable backfill. No emails are enqueued and existing consent is retained.
export const backfill = mutation({
  args: {
    table: v.union(v.literal("appointments"), v.literal("estimates")),
    cursor: v.union(v.string(), v.null()),
  },
  handler: async (ctx, { table, cursor }) => {
    await requireAdmin(ctx);
    if (table === "appointments") {
      const page = await ctx.db
        .query("appointments")
        .paginate({ numItems: 50, cursor });
      for (const row of page.page) {
        if (row.customerId) continue;
        const a = await readBooking(row);
        const customerId = await saveCustomer(ctx, a, "appointment");
        await ctx.db.patch(row._id, { customerId });
      }
      return { cursor: page.continueCursor, done: page.isDone };
    }
    const page = await ctx.db
      .query("estimates")
      .paginate({ numItems: 50, cursor });
    for (const row of page.page) {
      if (row.customerId) continue;
      const a = await readEstimate(row);
      const customerId = await saveCustomer(
        ctx,
        {
          ...a,
          vehicle: [a.vehicleYear, a.vehicleMake, a.vehicleModel]
            .filter(Boolean)
            .join(" "),
        },
        "estimate",
      );
      await ctx.db.patch(row._id, { customerId });
    }
    return { cursor: page.continueCursor, done: page.isDone };
  },
});
