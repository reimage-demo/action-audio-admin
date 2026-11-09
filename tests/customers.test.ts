import { convexTest } from "convex-test";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { readCustomer } from "../convex/lib/customers";
const modules = import.meta.glob("../convex/**/*.ts");
const request = (extra = {}) => ({
  name: "Local Customer",
  email: "customer@example.com",
  phone: "8605550123",
  vehicleMake: "Toyota",
  vehicleModel: "Camry",
  service: "remote-starters",
  requestKey: crypto.randomUUID(),
  ...extra,
});
beforeEach(() => {
  vi.useFakeTimers();
  process.env.CUSTOMER_ENCRYPTION_KEY_ID = "test-v1";
  process.env.CUSTOMER_ENCRYPTION_KEYS = JSON.stringify({
    "test-v1": "12".repeat(32),
  });
  process.env.CUSTOMER_INDEX_KEY = "34".repeat(32);
  process.env.BREVO_ENABLED = "false";
  process.env.PUSHOVER_ENABLED = "false";
});
afterEach(() => vi.useRealTimers());
async function setup() {
  const t = convexTest(schema, modules);
  const user = await t.run((ctx) => ctx.db.insert("users", {}));
  await t.run((ctx) =>
    ctx.db.insert("authAccounts", {
      userId: user,
      provider: "password",
      providerAccountId: "actionaudiomanager",
    }),
  );
  return { t, admin: t.withIdentity({ subject: user + "|session" }) };
}
async function book(t: any, email: string) {
  const d = new Date(Date.now() + 3 * 86400000);
  if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
  await t.mutation(api.appointments.create, {
    name: "Local Customer",
    email,
    phone: "8605550123",
    vehicle: "2022 Toyota Camry",
    service: "car-audio",
    store: "wethersfield",
    date: d.toISOString().slice(0, 10),
    time: "10:00",
    notes: "",
    requestKey: crypto.randomUUID(),
  });
}
describe("saved customers", () => {
  it("captures appointments and estimates in one encrypted profile, deduplicates retries, and survives estimate deletion", async () => {
    const { t, admin } = await setup();
    const args = request({ email: " CUSTOMER@example.com " });
    await t.mutation(api.estimates.create, args);
    await t.mutation(api.estimates.create, args);
    await book(t, "customer@example.com");
    const customers = await admin.query(api.customers.list, {});
    expect(customers).toHaveLength(1);
    expect(customers[0]).toMatchObject({
      email: "customer@example.com",
      marketingStatus: "unknown",
      sources: ["estimate", "appointment"],
    });
    const rows = await t.run((ctx) => ctx.db.query("customers").collect());
    for (const value of [args.name, "customer@example.com", args.phone])
      expect(JSON.stringify(rows)).not.toContain(value);
    const a = (await admin.query(api.estimates.list, {}))[0];
    await admin.mutation(api.estimates.remove, { id: a._id });
    expect(await admin.query(api.customers.list, {})).toHaveLength(1);
    expect((await admin.query(api.appointments.list, {}))[0].customerId).toBe(
      customers[0]._id,
    );
  });
  it("records opt-in evidence and never resubscribes an opt-out on a new request", async () => {
    const { t, admin } = await setup();
    await t.mutation(api.estimates.create, request({ marketingOptIn: true }));
    let c = (await admin.query(api.customers.list, {}))[0];
    expect(c.marketingStatus).toBe("subscribed");
    expect(c.consent?.text).toContain("unsubscribe");
    await admin.mutation(api.customers.update, {
      id: c._id,
      name: c.name,
      phone: c.phone,
      marketingStatus: "unsubscribed",
      evidence: "Requested by customer",
      confirmDetails: false,
    });
    await t.mutation(api.estimates.create, request({ marketingOptIn: true }));
    c = (await admin.query(api.customers.list, {}))[0];
    expect(c.marketingStatus).toBe("unsubscribed");
    await expect(
      admin.mutation(api.customers.update, {
        id: c._id,
        name: c.name,
        phone: c.phone,
        marketingStatus: "unknown",
        evidence: "",
        confirmDetails: false,
      }),
    ).rejects.toThrow("Keep the recorded opt-out");
    await expect(
      admin.mutation(api.customers.update, {
        id: c._id,
        name: c.name,
        phone: c.phone,
        marketingStatus: "subscribed",
        evidence: "",
        confirmDetails: false,
      }),
    ).rejects.toThrow("when and how");
  });
  it("flags conflicting contact data without overwriting it or merging distinct email addresses", async () => {
    const { t, admin } = await setup();
    await t.mutation(api.estimates.create, request());
    await t.mutation(
      api.estimates.create,
      request({ name: "Different Person", phone: "8605550149" }),
    );
    let customers = await admin.query(api.customers.list, {});
    expect(customers[0].name).toBe("Local Customer");
    expect(customers[0].conflicts).toHaveLength(2);
    await t.mutation(
      api.estimates.create,
      request({ email: "different@example.com" }),
    );
    expect(await admin.query(api.customers.list, {})).toHaveLength(2);
  });
  it("backfills existing rows without sending email or changing consent and can be rerun safely", async () => {
    const { t, admin } = await setup();
    await t.mutation(api.estimates.create, request());
    await book(t, "customer@example.com");
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await t.run(async (ctx) => {
      for (const c of await ctx.db.query("customers").collect())
        await ctx.db.delete(c._id);
      for (const r of await ctx.db.query("estimates").collect())
        await ctx.db.patch(r._id, { customerId: undefined });
      for (const r of await ctx.db.query("appointments").collect())
        await ctx.db.patch(r._id, { customerId: undefined });
    });
    const before = await t.run((ctx) =>
      ctx.db.query("emailDeliveries").collect(),
    );
    for (let i = 0; i < 2; i++)
      for (const table of ["appointments", "estimates"] as const)
        await admin.mutation(api.customers.backfill, { table, cursor: null });
    const rows = await admin.query(api.customers.list, {});
    expect(rows).toHaveLength(1);
    expect(rows[0].marketingStatus).toBe("unknown");
    expect(
      await t.run((ctx) => ctx.db.query("emailDeliveries").collect()),
    ).toEqual(before);
  });
  it("restricts customer reads, edits and backfill to the manager", async () => {
    const { t, admin } = await setup();
    await t.mutation(api.estimates.create, request());
    const c = (await admin.query(api.customers.list, {}))[0];
    await expect(t.query(api.customers.list, {})).rejects.toThrow(
      "Staff access",
    );
    await expect(
      t.mutation(api.customers.backfill, { table: "estimates", cursor: null }),
    ).rejects.toThrow("Staff access");
    await expect(
      t.mutation(api.customers.update, {
        id: c._id,
        name: c.name,
        phone: c.phone,
        marketingStatus: "subscribed",
        evidence: "Not authorized",
        confirmDetails: true,
      }),
    ).rejects.toThrow("Staff access");
  });
});
