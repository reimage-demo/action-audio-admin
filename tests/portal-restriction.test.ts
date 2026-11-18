import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
const modules = import.meta.glob("../convex/**/*.ts");
afterEach(() => vi.unstubAllEnvs());
it("keeps login authorization and counts while denying customer reads and writes", async () => {
  vi.stubEnv("PORTAL_RESTRICTED", "true");
  vi.stubEnv("CUSTOMER_ENCRYPTION_KEY_ID", "test-v1");
  vi.stubEnv("CUSTOMER_ENCRYPTION_KEYS", JSON.stringify({ "test-v1": "12".repeat(32) }));
  vi.stubEnv("CUSTOMER_INDEX_KEY", "34".repeat(32));
  const t = convexTest(schema, modules);
  const id = await t.run(async (ctx) => {
    const id = await ctx.db.insert("users", { name: "Manager" });
    await ctx.db.insert("authAccounts", { userId: id, provider: "password", providerAccountId: "actionaudiomanager" });
    return id;
  });
  const admin = t.withIdentity({ subject: id + "|session" });
  await t.mutation(api.estimates.create, { name: "Private Customer", phone: "8605550123", email: "private@example.com", vehicleMake: "Toyota", vehicleModel: "Camry", service: "remote-starters", requestKey: crypto.randomUUID() });
  expect(await admin.query(api.staff.access, {})).toEqual({ restricted: true, estimates: 1, appointments: 0 });
  await expect(t.query(api.staff.access, {})).rejects.toThrow("Staff access required");
  for (const ref of [api.estimates.list, api.appointments.list, api.customers.list, api.emails.usage]) {
    await expect(admin.query(ref, {})).rejects.toThrow("Please Contact 8602050115 to restore connection");
  }
  const estimate = await t.run((ctx) => ctx.db.query("estimates").first());
  await expect(admin.mutation(api.estimates.remove, { id: estimate!._id })).rejects.toThrow("restore connection");
  vi.stubEnv("PORTAL_RESTRICTED", "false");
  expect((await admin.query(api.estimates.list, {}))[0].phone).toBe("8605550123");
});
