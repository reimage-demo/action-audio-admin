import { readBooking } from "./appointments";
import { query } from "./_generated/server";
import { requireAdmin } from "./lib/requireAdmin";
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { managerUsername, validPasswordHash } from "./lib/password";
// Internal CLI/dashboard-only provisioning accepts a LOCAL precomputed verifier,
// never the plaintext password. authAccounts.secret is the library's hash field.
export const provision = internalMutation({
  args: { username: v.string(), passwordHash: v.string() },
  handler: async (ctx, { username, passwordHash }) => {
    if (username !== managerUsername() || !validPasswordHash(passwordHash))
      throw new Error("Invalid manager account configuration.");
    if (!/^[a-f0-9]{64}$/.test(process.env.AUTH_PASSWORD_PEPPER || ""))
      throw new Error("Configure the server-side password pepper first.");
    const existing = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", username),
      )
      .unique();
    if (existing)
      throw new Error(
        "Manager account already exists. Use the password rotation procedure.",
      );
    const userId = await ctx.db.insert("users", { name: username });
    await ctx.db.insert("authAccounts", {
      userId,
      provider: "password",
      providerAccountId: username,
      secret: passwordHash,
    });
    return { created: true, username };
  },
});

// Only aggregate dashboard metrics and appointment names leave this endpoint.
export const access = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx, true);
    const restricted = process.env.PORTAL_RESTRICTED === "true";
    if (!restricted) return { restricted: false, estimates: 0, appointments: 0 };
    const estimates = await ctx.db.query("estimates").collect();
    const appointments = await ctx.db.query("appointments").collect();
    const bookings = await Promise.all(appointments.map(readBooking));
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const inventory = await ctx.db.query("inventory").collect();
    return {
      restricted: true, estimates: estimates.length, appointments: appointments.length,
      dashboard: {
        stats: [
          ["New requests", bookings.filter(a => a.status === "requested").length, "Awaiting confirmation"],
          ["Vehicles in the shop", bookings.filter(a => ["checked_in", "in_progress", "waiting_parts", "quality_check"].includes(a.status)).length, "Active service"],
          ["Ready for pickup", bookings.filter(a => a.status === "ready").length, "Awaiting collection"],
          ["Today’s appointments", bookings.filter(a => a.date === today && a.status !== "cancelled").length, "Today"],
        ],
        todayAppointments: bookings.filter(a => a.date === today).map(a => ({ name: a.name })),
        publishedProducts: inventory.filter(p => p.published).length,
      },
    };
  },
});
