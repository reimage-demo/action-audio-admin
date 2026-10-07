import { services } from "../shared/catalog.js";
import { query, mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { bytesToHex } from "@noble/hashes/utils";
import type { Doc } from "./_generated/dataModel";
import { blindIndex, encrypt, decrypt } from "./lib/encryption";
import { store, status } from "./lib/validators";
import { requireAdmin } from "./lib/requireAdmin";
const times = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
];
const serviceIds = services.map((service) => service.id);
const active = (a: { status: string }) =>
  !["cancelled", "completed"].includes(a.status);
function validDate(date: string) {
  const d = new Date(date + "T12:00:00Z");
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(+d) ||
    d.toISOString().slice(0, 10) !== date ||
    date <= today ||
    d.getUTCDay() === 0 ||
    +d > Date.now() + 180 * 86400000
  )
    throw new ConvexError(
      "Choose Monday–Saturday, from tomorrow through the next six months.",
    );
}
type Booking = {
  name: string;
  email: string;
  phone: string;
  vehicle: string;
  service: string;
  store: "hartford" | "wethersfield";
  date: string;
  time: string;
  notes: string;
  status: string;
  trackingCode: string;
  requestKey: string;
  createdAt: number;
  updates: { status: string; message: string; at: number }[];
};
const slotIndex = (s: string, d: string, t: string) =>
  blindIndex("slot", JSON.stringify([s, d, t]));
const context = (a: {
  requestHash: string;
  emailHash: string;
  trackingHash: string;
  slotHash: string;
}) => JSON.stringify([a.requestHash, a.emailHash, a.trackingHash, a.slotHash]);
async function read(a: Doc<"appointments">) {
  return decrypt<Booking>(a.encrypted, context(a));
}
export const availability = query({
  args: { store, date: v.string() },
  handler: async (ctx, args) => {
    validDate(args.date);
    const available: string[] = [];
    for (const time of times) {
      const hash = slotIndex(args.store, args.date, time);
      const rows = await ctx.db
        .query("appointments")
        .withIndex("by_slot", (q) => q.eq("slotHash", hash))
        .collect();
      const bookings = await Promise.all(rows.map(read));
      if (!bookings.some(active)) available.push(time);
    }
    return available;
  },
});
export const create = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    vehicle: v.string(),
    service: v.string(),
    store,
    date: v.string(),
    time: v.string(),
    notes: v.string(),
    requestKey: v.string(),
    website: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.website) throw new ConvexError("Unable to submit request.");
    const email = args.email.trim().toLowerCase();
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254 ||
      args.name.trim().length < 2 ||
      args.name.length > 100 ||
      args.vehicle.trim().length < 3 ||
      args.vehicle.length > 150 ||
      args.phone.replace(/\D/g, "").length < 10 ||
      args.phone.length > 30 ||
      args.notes.length > 2000 ||
      !/^[a-f0-9-]{36}$/.test(args.requestKey)
    )
      throw new ConvexError("Please check your contact and vehicle details.");
    const requestHash = blindIndex("request", args.requestKey);
    const emailHash = blindIndex("email", email);
    const old = await ctx.db
      .query("appointments")
      .withIndex("by_request", (q) => q.eq("requestHash", requestHash))
      .unique();
    if (old) {
      // Idempotent retries must belong to the same booking payload.
      const prior = await read(old);
      if (
        prior.email !== email ||
        prior.name !== args.name.trim() ||
        prior.phone !== args.phone ||
        prior.vehicle !== args.vehicle ||
        prior.notes !== args.notes ||
        prior.store !== args.store ||
        prior.date !== args.date ||
        prior.time !== args.time ||
        prior.service !== args.service
      )
        throw new ConvexError(
          "This request has already been submitted. Please start a new booking.",
        );
      return { trackingCode: prior.trackingCode };
    }
    validDate(args.date);
    if (!times.includes(args.time) || !serviceIds.includes(args.service))
      throw new ConvexError("Choose a valid service and time.");
    const recent = await ctx.db
      .query("appointments")
      .withIndex("by_email", (q) => q.eq("emailHash", emailHash))
      .collect();
    if (
      recent.filter((a) => a._creationTime > Date.now() - 86400000).length >= 3
    )
      throw new ConvexError(
        "Please contact the store to arrange additional appointments.",
      );
    const slotHash = slotIndex(args.store, args.date, args.time);
    const booked = await ctx.db
      .query("appointments")
      .withIndex("by_slot", (q) => q.eq("slotHash", slotHash))
      .collect();
    if ((await Promise.all(booked.map(read))).some(active))
      throw new ConvexError(
        "That time was just requested. Please select another time.",
      );
    const trackingCode = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
    const { website, ...data } = args;
    const booking: Booking = {
      ...data,
      name: args.name.trim(),
      email,
      status: "requested",
      trackingCode,
      createdAt: Date.now(),
      updates: [
        {
          status: "requested",
          message:
            "Your request is with our team. We will contact you to confirm the appointment.",
          at: Date.now(),
        },
      ],
    };
    const indexes = {
      requestHash,
      emailHash,
      slotHash,
      trackingHash: blindIndex("tracking", trackingCode),
    };
    await ctx.db.insert("appointments", {
      ...indexes,
      encrypted: await encrypt(booking, context(indexes)),
    });
    return { trackingCode };
  },
});
export const track = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    if (!/^[a-f0-9]{32}$/.test(code)) return null;
    const hash = blindIndex("tracking", code);
    const row = await ctx.db
      .query("appointments")
      .withIndex("by_tracking", (q) => q.eq("trackingHash", hash))
      .unique();
    if (!row) return null;
    const a = await read(row);
    return {
      store: a.store,
      date: a.date,
      time: a.time,
      service: a.service,
      status: a.status,
      updates: a.updates,
    };
  },
});
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("appointments").order("desc").collect();
    return Promise.all(
      rows.map(async (row) => ({
        ...(await read(row)),
        _id: row._id,
        _creationTime: row._creationTime,
      })),
    );
  },
});
export const updateStatus = mutation({
  args: { id: v.id("appointments"), status, message: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const row = await ctx.db.get(args.id);
    if (!row) throw new ConvexError("Appointment not found.");
    if (args.message.length > 1000)
      throw new ConvexError("Keep customer updates under 1,000 characters.");
    const a = await read(row);
    if (!active(a) && active({ status: args.status })) {
      const conflicts = await ctx.db
        .query("appointments")
        .withIndex("by_slot", (q) => q.eq("slotHash", row.slotHash))
        .collect();
      const others = await Promise.all(
        conflicts.filter((x) => x._id !== row._id).map(read),
      );
      if (others.some(active))
        throw new ConvexError("This appointment slot is now occupied.");
    }
    await ctx.db.patch(row._id, {
      encrypted: await encrypt(
        {
          ...a,
          status: args.status,
          updates: [
            ...a.updates,
            {
              status: args.status,
              message: args.message.trim(),
              at: Date.now(),
            },
          ],
        },
        context(row),
      ),
    });
  },
});
