import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
const modules = import.meta.glob("../convex/**/*.ts");
const estimate = () => ({
  name: "Notification Test",
  phone: "8605550199",
  vehicleMake: "Toyota",
  vehicleModel: "Camry",
  service: "remote-starters",
  requestKey: crypto.randomUUID(),
});
const booking = () => {
  const date = new Date(Date.now() + 3 * 86400000);
  if (date.getUTCDay() === 0) date.setUTCDate(date.getUTCDate() + 1);
  return {
    name: "Notification Test",
    email: "notification@example.com",
    phone: "8605550199",
    vehicle: "2022 Toyota Camry",
    service: "remote-starters",
    store: "wethersfield" as const,
    date: date.toISOString().slice(0, 10),
    time: "11:00",
    notes: "Private test notes",
    requestKey: crypto.randomUUID(),
  };
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("CUSTOMER_ENCRYPTION_KEY_ID", "test-v1");
  vi.stubEnv(
    "CUSTOMER_ENCRYPTION_KEYS",
    JSON.stringify({ "test-v1": "12".repeat(32) }),
  );
  vi.stubEnv("CUSTOMER_INDEX_KEY", "34".repeat(32));
  vi.stubEnv("PUSHOVER_ENABLED", "true");
  vi.stubEnv("PUSHOVER_APP_TOKEN", "test-token");
  vi.stubEnv("PUSHOVER_USER_KEY", "test-user");
  vi.stubEnv("PUSHOVER_DEVICE", "iphone");
  vi.stubEnv(
    "PUSHOVER_PORTAL_URL",
    "https://reimage-demo.github.io/action-audio-admin/",
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
const drain = (t: ReturnType<typeof convexTest>) =>
  t.finishAllScheduledFunctions(() => vi.runAllTimers());
describe("Pushover intake notifications", () => {
  it("sends one private phone alert per saved booking/estimate, including form retries", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ status: 1, request: "receipt" })),
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const t = convexTest(schema, modules),
      a = booking(),
      e = estimate();
    await t.mutation(api.appointments.create, a);
    await t.mutation(api.appointments.create, a);
    await t.mutation(api.estimates.create, e);
    await t.mutation(api.estimates.create, e);
    await drain(t);
    const rows = await t.run((ctx) =>
      ctx.db.query("notificationDeliveries").collect(),
    );
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.status === "sent" && r.attempts === 1)).toBe(
      true,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const bodies = fetchMock.mock.calls.map(
      (c) => c[1].body as URLSearchParams,
    );
    expect(bodies.map((b) => b.get("title"))).toEqual(
      expect.arrayContaining([
        "Action Audio — New appointment request",
        "Action Audio — New estimate request",
      ]),
    );
    for (const body of bodies) {
      expect(body.get("device")).toBe("iphone");
      expect(body.get("url")).toBe(process.env.PUSHOVER_PORTAL_URL);
      for (const secret of [a.name, a.email, a.phone, a.notes, a.vehicle])
        expect(body.toString()).not.toContain(encodeURIComponent(secret));
    }
    await t.action(internal.notifications.deliver, { id: rows[0]._id });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("retries temporary failures without failing or duplicating the saved request", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(new Response("{}", { status: 503 }))
      .mockResolvedValueOnce(new Response('{"status":1}'));
    vi.stubGlobal("fetch", fetchMock);
    const t = convexTest(schema, modules);
    expect(await t.mutation(api.estimates.create, estimate())).toEqual({
      received: true,
    });
    await drain(t);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const rows = await t.run((ctx) =>
      ctx.db.query("notificationDeliveries").collect(),
    );
    expect(rows[0]).toMatchObject({ status: "sent", attempts: 3 });
    expect(
      await t.run((ctx) => ctx.db.query("estimates").collect()),
    ).toHaveLength(1);
  });
  it.each([400, 429, 503])(
    "bounds retries and records failure for HTTP %s",
    async (status) => {
      const fetchMock = vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(new Response('{"status":0}', { status })),
        );
      vi.stubGlobal("fetch", fetchMock);
      const t = convexTest(schema, modules);
      await t.mutation(api.estimates.create, estimate());
      await drain(t);
      expect(fetchMock).toHaveBeenCalledTimes(status === 503 ? 5 : 1);
      expect(
        (await t.run((ctx) => ctx.db.query("notificationDeliveries").first()))
          ?.status,
      ).toBe("failed");
    },
  );
  it("does not alert on rejected or disabled submissions", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.estimates.create, { ...estimate(), website: "spam" }),
    ).rejects.toThrow();
    vi.stubEnv("PUSHOVER_ENABLED", "false");
    await t.mutation(api.estimates.create, estimate());
    await drain(t);
    expect(
      await t.run((ctx) => ctx.db.query("notificationDeliveries").collect()),
    ).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("preserves intake when credentials are missing and records the configuration failure", async () => {
    vi.stubEnv("PUSHOVER_APP_TOKEN", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const t = convexTest(schema, modules);
    await t.mutation(api.estimates.create, estimate());
    await drain(t);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      await t.run((ctx) => ctx.db.query("notificationDeliveries").first()),
    ).toMatchObject({
      status: "failed",
      errorCode: "configuration_missing_or_disabled",
    });
  });
});
