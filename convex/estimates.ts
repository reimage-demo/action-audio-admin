import { query, mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { serviceContent } from "../shared/service-content.js";
import { serviceStore } from "../shared/catalog.js";
import { blindIndex, encrypt, decrypt } from "./lib/encryption";
import { requireAdmin } from "./lib/requireAdmin";
import type { Doc } from "./_generated/dataModel";
const estimateStatus = v.union(
  v.literal("new"),
  v.literal("contacted"),
  v.literal("quoted"),
  v.literal("closed"),
);
type Estimate = {
  name: string;
  phone: string;
  vehicleMake: string;
  vehicleModel: string;
  service: string;
  store: string;
  requestKey: string;
  status: "new" | "contacted" | "quoted" | "closed";
  staffNotes: string;
  createdAt: number;
  updatedAt: number;
};
const context = (r: { requestHash: string; phoneHash: string }) =>
  JSON.stringify(["estimate", r.requestHash, r.phoneHash]);
const read = (r: Doc<"estimates">) =>
  decrypt<Estimate>(r.encrypted, context(r));
export const create = mutation({
  args: {
    name: v.string(),
    phone: v.string(),
    vehicleMake: v.string(),
    vehicleModel: v.string(),
    service: v.string(),
    requestKey: v.string(),
    website: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.website) throw new ConvexError("Unable to submit request.");
    const name = args.name.trim(),
      phone = args.phone.trim(),
      vehicleMake = args.vehicleMake.trim(),
      vehicleModel = args.vehicleModel.trim();
    const selected = serviceContent.find((s) => s.id === args.service);
    if (
      name.length < 2 ||
      name.length > 100 ||
      phone.replace(/\D/g, "").length < 10 ||
      phone.replace(/\D/g, "").length > 15 ||
      phone.length > 30 ||
      vehicleMake.length < 2 ||
      vehicleMake.length > 80 ||
      vehicleModel.length < 1 ||
      vehicleModel.length > 100 ||
      !selected ||
      !/^[a-f0-9-]{36}$/.test(args.requestKey)
    )
      throw new ConvexError(
        "Check your name, phone number, vehicle make, model, and service.",
      );
    const requestHash = blindIndex("estimate-request", args.requestKey),
      phoneHash = blindIndex("estimate-phone", phone.replace(/\D/g, ""));
    const previous = await ctx.db
      .query("estimates")
      .withIndex("by_request", (q) => q.eq("requestHash", requestHash))
      .unique();
    if (previous) {
      const prior = await read(previous);
      if (
        prior.name !== name ||
        prior.phone !== phone ||
        prior.vehicleMake !== vehicleMake ||
        prior.vehicleModel !== vehicleModel ||
        prior.service !== args.service
      )
        throw new ConvexError(
          "This request was already submitted. Start a new request to change the details.",
        );
      return { received: true };
    }
    const recent = await ctx.db
      .query("estimates")
      .withIndex("by_phone", (q) => q.eq("phoneHash", phoneHash))
      .collect();
    if (
      recent.filter((r) => r._creationTime > Date.now() - 86400000).length >= 3
    )
      throw new ConvexError(
        "Please call the store to discuss additional estimates.",
      );
    const store = serviceStore(selected.booking)!.id;
    const estimate: Estimate = {
      name,
      phone,
      vehicleMake,
      vehicleModel,
      service: args.service,
      store,
      requestKey: args.requestKey,
      status: "new",
      staffNotes: "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const indexes = { requestHash, phoneHash };
    await ctx.db.insert("estimates", {
      ...indexes,
      encrypted: await encrypt(estimate, context(indexes)),
    });
    return { received: true };
  },
});
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("estimates").order("desc").collect();
    return Promise.all(
      rows.map(async (r) => ({ ...(await read(r)), _id: r._id })),
    );
  },
});
export const update = mutation({
  args: {
    id: v.id("estimates"),
    status: estimateStatus,
    staffNotes: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (args.staffNotes.length > 2000)
      throw new ConvexError("Keep notes under 2,000 characters.");
    const row = await ctx.db.get(args.id);
    if (!row) throw new ConvexError("Estimate request not found.");
    const data = await read(row);
    await ctx.db.patch(row._id, {
      encrypted: await encrypt(
        {
          ...data,
          status: args.status,
          staffNotes: args.staffNotes.trim(),
          updatedAt: Date.now(),
        },
        context(row),
      ),
    });
  },
});
