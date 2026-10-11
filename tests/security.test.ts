import { convexTest } from "convex-test";
import { describe, it, expect, beforeEach } from "vitest";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import { encrypt, decrypt, blindIndex } from "../convex/lib/encryption";
import { hashSecret, verifySecret } from "../convex/lib/password";
const modules = import.meta.glob("../convex/**/*.ts");
beforeEach(() => {
  process.env.AUTH_PASSWORD_PEPPER = "ab".repeat(32);
  process.env.CUSTOMER_ENCRYPTION_KEY_ID = "test-v1";
  process.env.CUSTOMER_ENCRYPTION_KEYS = JSON.stringify({
    "test-v1": "cd".repeat(32),
  });
  process.env.CUSTOMER_INDEX_KEY = "ef".repeat(32);
});
function booking() {
  const d = new Date(Date.now() + 4 * 86400000);
  if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
  return {
    name: "Private Customer",
    email: "private@example.com",
    phone: "8605557890",
    vehicle: "2024 Private Vehicle",
    service: "electronics-repair",
    store: "wethersfield" as const,
    date: d.toISOString().slice(0, 10),
    time: "11:00",
    notes: "Confidential customer notes",
    requestKey: crypto.randomUUID(),
  };
}
describe("protected credentials", () => {
  it("salts each hash, verifies only the correct password and requires the pepper", async () => {
    const password = "Test-only secret passphrase";
    const first = await hashSecret(password),
      second = await hashSecret(password);
    expect(first).not.toBe(second);
    expect(first).not.toContain(password);
    expect(await verifySecret(password, first)).toBe(true);
    expect(await verifySecret("wrong-password", first)).toBe(false);
    expect(await verifySecret(first, first)).toBe(false);
    process.env.AUTH_PASSWORD_PEPPER = "11".repeat(32);
    expect(await verifySecret(password, first)).toBe(false);
    delete process.env.AUTH_PASSWORD_PEPPER;
    await expect(verifySecret(password, first)).rejects.toThrow(
      "not configured",
    );
  });
  it("provisions only a hashed manager account and disallows overwriting it", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(internal.staff.provision, {
        username: "actionaudiomanager",
        passwordHash: "plaintext-password",
      }),
    ).rejects.toThrow("Invalid");
    const passwordHash = await hashSecret("Test-only manager passphrase");
    await t.mutation(internal.staff.provision, {
      username: "actionaudiomanager",
      passwordHash,
    });
    const account = await t.run((ctx) => ctx.db.query("authAccounts").unique());
    expect(account?.secret).toBe(passwordHash);
    expect(
      await t
        .withIdentity({ subject: account!.userId + "|session" })
        .query(api.appointments.list, {}),
    ).toEqual([]);
    await expect(
      t.mutation(internal.staff.provision, {
        username: "actionaudiomanager",
        passwordHash,
      }),
    ).rejects.toThrow("already exists");
  });
});
describe("customer encryption", () => {
  it("uses unique authenticated ciphertext and rejects tampering, context swaps and wrong keys", async () => {
    const a = await encrypt({ private: "details" }, "record-a"),
      b = await encrypt({ private: "details" }, "record-a");
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(await decrypt(a, "record-a")).toEqual({ private: "details" });
    await expect(decrypt(a, "record-b")).rejects.toThrow("protected");
    const damaged = {
      ...a,
      ciphertext:
        (a.ciphertext.startsWith("00") ? "ff" : "00") + a.ciphertext.slice(2),
    };
    await expect(decrypt(damaged, "record-a")).rejects.toThrow("protected");
    process.env.CUSTOMER_ENCRYPTION_KEYS = JSON.stringify({
      "test-v1": "01".repeat(32),
    });
    await expect(decrypt(a, "record-a")).rejects.toThrow("protected");
  });
  it("keeps all customer fields and tracking credentials out of stored rows", async () => {
    const t = convexTest(schema, modules),
      args = booking();
    const saved = await t.mutation(api.appointments.create, args);
    const row = await t.run((ctx) => ctx.db.query("appointments").unique());
    const raw = JSON.stringify(row);
    for (const value of [
      args.name,
      args.email,
      args.phone,
      args.vehicle,
      args.notes,
      args.date,
      args.time,
      args.store,
      args.service,
      args.requestKey,
      saved.trackingCode,
    ])
      expect(raw).not.toContain(value);
    expect(Object.keys(row!).sort()).toEqual(
      [
        "_id",
        "_creationTime",
        "encrypted",
        "emailHash",
        "trackingHash",
        "requestHash",
        "slotHash",
      ].sort(),
    );
    expect(
      await t.query(api.appointments.track, { code: saved.trackingCode }),
    ).toMatchObject({ store: args.store, status: "requested" });
    await expect(t.query(api.appointments.list, {})).rejects.toThrow(
      "Staff access",
    );
    await expect(
      t.mutation(api.appointments.create, {
        ...args,
        email: "intruder@example.com",
      }),
    ).rejects.toThrow("already been submitted");
  });
  it("fails closed without keys and supports retaining old encryption keys during rotation", async () => {
    const t = convexTest(schema, modules);
    delete process.env.CUSTOMER_ENCRYPTION_KEYS;
    await expect(
      t.mutation(api.appointments.create, booking()),
    ).rejects.toThrow("not configured");
    expect(
      await t.run((ctx) => ctx.db.query("appointments").collect()),
    ).toEqual([]);
    process.env.CUSTOMER_ENCRYPTION_KEYS = JSON.stringify({
      "test-v1": "cd".repeat(32),
    });
    const old = await encrypt({ name: "Private" }, "record");
    process.env.CUSTOMER_ENCRYPTION_KEYS = JSON.stringify({
      "test-v1": "cd".repeat(32),
      "test-v2": "ab".repeat(32),
    });
    process.env.CUSTOMER_ENCRYPTION_KEY_ID = "test-v2";
    expect(await decrypt(old, "record")).toEqual({ name: "Private" });
    expect((await encrypt({ name: "Private" }, "record")).keyId).toBe(
      "test-v2",
    );
    expect(blindIndex("email", "x")).not.toBe(blindIndex("tracking", "x"));
  });
});
