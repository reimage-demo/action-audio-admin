import { query, mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { serviceContent } from "../shared/service-content.js";
import { estimateQuestions } from "../shared/estimate-intake.js";
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
  vehicleYear?: string;
  vehicleTrim?: string;
  details?: string;
  budget?: string;
  timing?: string;
  answers?: { id: string; label: string; value: string }[];
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
    vehicleYear: v.optional(v.string()),
    vehicleTrim: v.optional(v.string()),
    details: v.optional(v.string()),
    budget: v.optional(v.string()),
    timing: v.optional(v.string()),
    answers: v.optional(
      v.array(v.object({ id: v.string(), value: v.string() })),
    ),
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
    // Optional fields allow older clients and encrypted records to remain readable.
    // New intake submissions must include a valid year, scope, and service answers.
    const vehicleYear = args.vehicleYear?.trim() || "";
    const vehicleTrim = args.vehicleTrim?.trim() || "";
    const details = args.details?.trim() || "";
    const budget = args.budget?.trim() || "";
    const timing = args.timing?.trim() || "";
    const questions =
      estimateQuestions[args.service as keyof typeof estimateQuestions] || [];
    const supplied = args.answers || [];
    const hasIntake =
      args.vehicleYear !== undefined ||
      args.details !== undefined ||
      args.answers !== undefined;
    if (
      vehicleTrim.length > 100 ||
      details.length > 2000 ||
      budget.length > 100 ||
      timing.length > 200 ||
      (hasIntake &&
        (!/^\d{4}$/.test(vehicleYear) ||
          Number(vehicleYear) < 1900 ||
          Number(vehicleYear) > new Date().getFullYear() + 2 ||
          details.length < 10))
    )
      throw new ConvexError(
        "Check your vehicle year and project details. Tell us a little about the work you need.",
      );
    if (
      hasIntake &&
      (supplied.length !== questions.length ||
        new Set(supplied.map((a) => a.id)).size !== supplied.length ||
        questions.some(
          (q) =>
            !supplied.some((a) => a.id === q.id && q.options.includes(a.value)),
        ))
    )
      throw new ConvexError(
        "Answer the service questions. Choose Not sure if you need advice.",
      );
    const answers = questions.flatMap((q) => {
      const answer = supplied.find((a) => a.id === q.id);
      return answer ? [{ id: q.id, label: q.label, value: answer.value }] : [];
    });
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
        prior.service !== args.service ||
        (prior.vehicleYear || "") !== vehicleYear ||
        (prior.vehicleTrim || "") !== vehicleTrim ||
        (prior.details || "") !== details ||
        (prior.budget || "") !== budget ||
        (prior.timing || "") !== timing ||
        JSON.stringify(
          (prior.answers || []).map(({ id, value }) => ({ id, value })),
        ) !== JSON.stringify(answers.map(({ id, value }) => ({ id, value })))
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
      vehicleYear,
      vehicleTrim,
      details,
      budget,
      timing,
      answers,
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
