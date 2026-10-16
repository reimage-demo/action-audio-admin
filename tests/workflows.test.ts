import { convexTest } from "convex-test";
import { describe, it, expect, beforeEach } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
const modules = import.meta.glob("../convex/**/*.ts");
function futureDate() {
  const d = new Date(Date.now() + 3 * 86400000);
  if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
const request = (extra = {}) => ({
  name: "Test Customer",
  email: "customer@example.com",
  phone: "8605550123",
  vehicle: "2022 Toyota Camry",
  service: "electronics-replacement",
  store: "wethersfield" as const,
  date: futureDate(),
  time: "10:00",
  notes: "Test booking",
  requestKey: crypto.randomUUID(),
  ...extra,
});
async function staff(t: ReturnType<typeof convexTest>) {
  const id = await t.run((ctx) =>
    ctx.db.insert("users", { email: "staff@example.com" }),
  );
  await t.run((ctx) =>
    ctx.db.insert("authAccounts", {
      userId: id,
      provider: "password",
      providerAccountId: "actionaudiomanager",
    }),
  );
  return t.withIdentity({ subject: id + "|session" });
}
beforeEach(() => {
  process.env.CUSTOMER_ENCRYPTION_KEY_ID = "test-v1";
  process.env.CUSTOMER_ENCRYPTION_KEYS = JSON.stringify({
    "test-v1": "12".repeat(32),
  });
  process.env.CUSTOMER_INDEX_KEY = "34".repeat(32);
});
describe("booking and vehicle service workflow", () => {
  it("creates one request on retry and exposes only safe tracking fields", async () => {
    const t = convexTest(schema, modules);
    const args = request();
    const saved = await t.mutation(api.appointments.create, args);
    expect(saved.trackingCode).toMatch(/^[a-f0-9]{32}$/);
    expect(await t.mutation(api.appointments.create, args)).toEqual(saved);
    const all = await t.run((ctx) => ctx.db.query("appointments").collect());
    expect(all).toHaveLength(1);
    const tracking = await t.query(api.appointments.track, {
      code: saved.trackingCode,
    });
    expect(tracking?.status).toBe("requested");
    expect(tracking).not.toHaveProperty("email");
    expect(tracking).not.toHaveProperty("name");
    expect(tracking).not.toHaveProperty("phone");
    expect(tracking).not.toHaveProperty("notes");
    expect(
      await t.query(api.appointments.track, { code: "unknown" }),
    ).toBeNull();
  });
  it("prevents duplicate slots while allowing the same time in the other store", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.appointments.create, request());
    await expect(
      t.mutation(
        api.appointments.create,
        request({ email: "other@example.com" }),
      ),
    ).rejects.toThrow("just requested");
    await t.mutation(
      api.appointments.create,
      request({ store: "hartford", service: "auto-detailing" }),
    );
    expect(
      await t.query(api.appointments.availability, {
        store: "wethersfield",
        date: futureDate(),
      }),
    ).not.toContain("10:00");
    expect(
      await t.query(api.appointments.availability, {
        store: "hartford",
        date: futureDate(),
      }),
    ).toContain("11:00");
  });
  it("rejects past dates, Sundays, invalid input, honeypots and repeated submissions", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.appointments.create, request({ date: "2020-01-01" })),
    ).rejects.toThrow("Monday");
    const d = new Date(Date.now() + 5 * 86400000);
    while (d.getUTCDay() !== 0) d.setUTCDate(d.getUTCDate() + 1);
    await expect(
      t.mutation(
        api.appointments.create,
        request({ date: d.toISOString().slice(0, 10) }),
      ),
    ).rejects.toThrow("Monday");
    await expect(
      t.mutation(api.appointments.create, request({ email: "bad" })),
    ).rejects.toThrow("details");
    await expect(
      t.mutation(api.appointments.create, request({ website: "spam" })),
    ).rejects.toThrow("Unable");
    for (const time of ["10:00", "11:00", "12:00"])
      await t.mutation(api.appointments.create, request({ time }));
    await expect(
      t.mutation(api.appointments.create, request({ time: "13:00" })),
    ).rejects.toThrow("additional");
  });
  it("denies anonymous and non-staff access, persists staff updates to tracking", async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.appointments.list, {})).rejects.toThrow(
      "Staff access",
    );
    const saved = await t.mutation(api.appointments.create, request());
    const a = await t.run((ctx) => ctx.db.query("appointments").first());
    await expect(
      t.mutation(api.appointments.updateStatus, {
        id: a!._id,
        status: "ready",
        message: "Ready",
      }),
    ).rejects.toThrow("Staff access");
    const outsider = await t.run((ctx) =>
      ctx.db.insert("users", { email: "outsider@example.com" }),
    );
    await expect(
      t
        .withIdentity({ subject: outsider + "|session" })
        .query(api.appointments.list, {}),
    ).rejects.toThrow("Staff access");
    const admin = await staff(t);
    await admin.mutation(api.appointments.updateStatus, {
      id: a!._id,
      status: "in_progress",
      message: "Installation underway.",
    });
    const tracked = await t.query(api.appointments.track, {
      code: saved.trackingCode,
    });
    expect(tracked?.status).toBe("in_progress");
    expect(tracked?.updates.at(-1)?.message).toBe("Installation underway.");
    await admin.mutation(api.appointments.updateStatus, {
      id: a!._id,
      status: "cancelled",
      message: "Cancelled at customer request.",
    });
    expect(
      await t.query(api.appointments.availability, {
        store: "wethersfield",
        date: futureDate(),
      }),
    ).toContain("10:00");
  });
  it("enforces store specialties and assigns independent random codes", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.appointments.create, request({ store: "hartford" })),
    ).rejects.toThrow("matching location");
    await expect(
      t.mutation(
        api.appointments.create,
        request({ service: "auto-detailing" }),
      ),
    ).rejects.toThrow("matching location");
    const a = await t.mutation(api.appointments.create, request());
    const b = await t.mutation(
      api.appointments.create,
      request({ store: "hartford", service: "auto-detailing" }),
    );
    expect(a.trackingCode).not.toBe(b.trackingCode);
  });
  it("publishes final checks and target dates, validates estimates, and can clear them", async () => {
    const t = convexTest(schema, modules),
      admin = await staff(t);
    const saved = await t.mutation(api.appointments.create, request());
    const a = (await admin.query(api.appointments.list, {}))[0];
    const update = {
      id: a._id,
      status: "quality_check" as const,
      message: "Checking the installation.",
    };
    for (const estimatedReadyDate of [
      "2020-01-01",
      "2026-02-30",
      "not-a-date",
    ]) {
      await expect(
        admin.mutation(api.appointments.updateStatus, {
          ...update,
          estimatedReadyDate,
        }),
      ).rejects.toThrow("target pickup");
    }
    await admin.mutation(api.appointments.updateStatus, {
      ...update,
      estimatedReadyDate: futureDate(),
    });
    let tracked = await t.query(api.appointments.track, {
      code: saved.trackingCode,
    });
    expect(tracked?.status).toBe("quality_check");
    expect(tracked?.estimatedReadyDate).toBe(futureDate());
    await admin.mutation(api.appointments.updateStatus, {
      ...update,
      estimatedReadyDate: "",
    });
    tracked = await t.query(api.appointments.track, {
      code: saved.trackingCode,
    });
    expect(tracked?.estimatedReadyDate).toBeUndefined();
  });
  it("does not let a reopened appointment take an occupied slot", async () => {
    const t = convexTest(schema, modules);
    const admin = await staff(t);
    await t.mutation(api.appointments.create, request());
    const a = (await admin.query(api.appointments.list, {}))[0];
    await admin.mutation(api.appointments.updateStatus, {
      id: a._id,
      status: "cancelled",
      message: "",
    });
    await t.mutation(
      api.appointments.create,
      request({ email: "second@example.com" }),
    );
    await expect(
      admin.mutation(api.appointments.updateStatus, {
        id: a._id,
        status: "confirmed",
        message: "",
      }),
    ).rejects.toThrow("occupied");
  });
});
describe("inventory publishing", () => {
  it("requires staff, hides drafts and supports publish/edit/unpublish", async () => {
    const t = convexTest(schema, modules);
    const product = {
      name: "Test speaker",
      brand: "Test",
      category: "Speakers",
      store: "wethersfield" as const,
      description: "Test product",
      availability: "in_stock" as const,
      published: false,
      price: 199.99,
    };
    await expect(t.mutation(api.inventory.save, product)).rejects.toThrow(
      "Staff access",
    );
    const admin = await staff(t);
    const id = await admin.mutation(api.inventory.save, product);
    expect(await t.query(api.inventory.publicList, {})).toEqual([]);
    await admin.mutation(api.inventory.save, {
      ...product,
      id,
      published: true,
    });
    expect(await t.query(api.inventory.publicList, {})).toHaveLength(1);
    const { price, ...withoutPrice } = product;
    await admin.mutation(api.inventory.save, {
      ...withoutPrice,
      id,
      published: true,
    });
    expect((await t.query(api.inventory.publicList, {}))[0]).not.toHaveProperty(
      "price",
    );
    await admin.mutation(api.inventory.save, {
      ...product,
      id,
      published: false,
    });
    expect(await t.query(api.inventory.publicList, {})).toEqual([]);
    await expect(
      admin.mutation(api.inventory.save, { ...product, price: -5 }),
    ).rejects.toThrow("details");
    await expect(
      admin.mutation(api.inventory.save, {
        ...product,
        imageUrl: "javascript:alert(1)",
      }),
    ).rejects.toThrow("details");
  });
});

describe("current service location restrictions", () => {
  it.each([
    ["auto-detailing", "hartford"],
    ["window-tinting", "hartford"],
    ["remote-starters", "wethersfield"],
    ["car-audio", "wethersfield"],
    ["dash-cams", "wethersfield"],
    ["gps-trackers", "wethersfield"],
  ])("books %s only at %s", async (service, store) => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(
        api.appointments.create,
        request({
          service,
          store: store === "hartford" ? "wethersfield" : "hartford",
        }),
      ),
    ).rejects.toThrow();
    const result = await t.mutation(
      api.appointments.create,
      request({ service, store }),
    );
    expect(
      await t.query(api.appointments.track, { code: result.trackingCode }),
    ).toMatchObject({ service, store });
  });
});
