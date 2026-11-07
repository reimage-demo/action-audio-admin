import { convexTest } from "convex-test";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import { estimateEmail } from "../shared/estimate-email.js";
const modules = import.meta.glob("../convex/**/*.ts");
const request = (extra = {}) => ({
  name: "Email Customer",
  email: "Customer@example.com",
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
  process.env.BREVO_API_KEY = "test-only";
  process.env.BREVO_SENDER_EMAIL = "store@example.com";
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete process.env.BREVO_ENABLED;
  delete process.env.BREVO_API_KEY;
  delete process.env.BREVO_SENDER_EMAIL;
});
async function setup() {
  const t = convexTest(schema, modules);
  const id = await t.run((ctx) => ctx.db.insert("users", { name: "Manager" }));
  await t.run((ctx) =>
    ctx.db.insert("authAccounts", {
      userId: id,
      provider: "password",
      providerAccountId: "actionaudiomanager",
    }),
  );
  const admin = t.withIdentity({ subject: id + "|session" });
  await t.mutation(api.estimates.create, request());
  const estimate = (await admin.query(api.estimates.list, {}))[0];
  const delivery = (
    await t.run((ctx) => ctx.db.query("emailDeliveries").collect())
  )[0];
  return { t, admin, estimate, delivery };
}
describe("estimate email outbox", () => {
  it("validates email, encrypts recipient and content, and queues exactly one thank-you per request", async () => {
    const { t, admin } = await setup();
    const args = request({ phone: "8605550199" });
    await t.mutation(api.estimates.create, args);
    await t.mutation(api.estimates.create, args);
    await expect(
      t.mutation(api.estimates.create, {
        ...args,
        email: "changed@example.com",
      }),
    ).rejects.toThrow("already submitted");
    await expect(
      t.mutation(api.estimates.create, request({ email: "invalid" })),
    ).rejects.toThrow("email");
    const rows = await t.run((ctx) =>
      ctx.db.query("emailDeliveries").collect(),
    );
    expect(rows).toHaveLength(2);
    expect(JSON.stringify(rows)).not.toContain("customer@example.com");
    expect(JSON.stringify(rows)).not.toContain("Email Customer");
    expect((await admin.query(api.estimates.list, {}))[0].email).toBe(
      "customer@example.com",
    );
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  });
  it("requires staff, supports legacy email entry, deduplicates send clicks, and only marks quoted after acceptance", async () => {
    const { t, admin, estimate } = await setup();
    const args = {
      id: estimate._id,
      email: "new@example.com",
      body: "Install remote start for $450 including labor.",
      requestKey: crypto.randomUUID(),
    };
    await expect(t.mutation(api.emails.sendEstimate, args)).rejects.toThrow(
      "Staff access",
    );
    await expect(
      t.query(api.emails.history, { id: estimate._id }),
    ).rejects.toThrow("Staff access");
    await expect(t.query(api.emails.usage, {})).rejects.toThrow("Staff access");
    const id = await admin.mutation(api.emails.sendEstimate, args);
    expect(await admin.mutation(api.emails.sendEstimate, args)).toBe(id);
    await expect(
      admin.mutation(api.emails.sendEstimate, {
        ...args,
        body: "A different estimate body.",
      }),
    ).rejects.toThrow("already queued");
    expect((await admin.query(api.estimates.list, {}))[0].status).toBe("new");
    const raw = JSON.stringify(
      await t.run((ctx) => ctx.db.query("emailDeliveries").collect()),
    );
    expect(raw).not.toContain(args.email);
    expect(raw).not.toContain(args.body);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    process.env.BREVO_ENABLED = "true";
    await t.mutation(internal.emails.claim, { id });
    await t.mutation(internal.emails.recordResult, {
      id,
      status: "sent",
      messageId: "test-id",
    });
    expect((await admin.query(api.estimates.list, {}))[0].status).toBe(
      "quoted",
    );
  });
  it("reserves the last slot atomically, defers overflow, and resumes after 24 hours", async () => {
    const { t, admin, estimate, delivery } = await setup();
    const id = await admin.mutation(api.emails.sendEstimate, {
      id: estimate._id,
      email: estimate.email!,
      body: "Your estimate is $450 installed.",
      requestKey: crypto.randomUUID(),
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await t.run(async (ctx) => {
      for (let i = 0; i < 289; i++)
        await ctx.db.insert("emailAttempts", { at: Date.now() });
    });
    process.env.BREVO_ENABLED = "true";
    const claims = await Promise.all([
      t.mutation(internal.emails.claim, { id }),
      t.mutation(internal.emails.claim, { id: delivery._id }),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    expect((await admin.query(api.emails.usage, {})).used).toBe(290);
    expect(
      await t.mutation(internal.emails.claim, {
        id: claims[0] ? id : delivery._id,
      }),
    ).toBeNull();
    vi.advanceTimersByTime(86400002);
    expect(
      await t.mutation(internal.emails.claim, {
        id: claims[0] ? delivery._id : id,
      }),
    ).not.toBeNull();
  });
  it("sends the branded template and records Brevo acceptance without exposing API keys", async () => {
    const { t, delivery } = await setup();
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    process.env.BREVO_ENABLED = "true";
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ plan: [{ type: "free", credits: 300 }] }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ messageId: "brevo-id" }), {
          status: 201,
        }),
      );
    vi.stubGlobal("fetch", fetcher);
    await t.action(internal.emails.deliver, { id: delivery._id });
    const sent = await t.run((ctx) => ctx.db.get(delivery._id));
    expect(sent?.status).toBe("sent");
    expect(sent?.messageId).toBe("brevo-id");
    const payload = JSON.parse(fetcher.mock.calls[1][1].body);
    expect(payload.to[0].email).toBe("customer@example.com");
    expect(payload.htmlContent).toContain("ACTION");
    expect(payload.textContent).toContain(
      "send your estimate to this email address",
    );
    expect(payload.headers.idempotencyKey).toBe(delivery._id);
  });
  it("keeps the account credit buffer and does not attempt to send", async () => {
    const { t, delivery } = await setup();
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    process.env.BREVO_ENABLED = "true";
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ plan: [{ type: "free", credits: 10 }] })),
      );
    vi.stubGlobal("fetch", fetcher);
    await t.action(internal.emails.deliver, { id: delivery._id });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect((await t.run((ctx) => ctx.db.get(delivery._id)))?.status).toBe(
      "pending",
    );
  });
  it("does not automatically resend ambiguous network failures", async () => {
    const { t, delivery } = await setup();
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    process.env.BREVO_ENABLED = "true";
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ plan: [{ type: "free", credits: 300 }] }),
        ),
      )
      .mockRejectedValueOnce(new Error("timeout"));
    vi.stubGlobal("fetch", fetcher);
    await t.action(internal.emails.deliver, { id: delivery._id });
    expect((await t.run((ctx) => ctx.db.get(delivery._id)))?.status).toBe(
      "review",
    );
    await t.action(internal.emails.deliver, { id: delivery._id });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("escapes customer and staff text in the HTML template", () => {
    const result = estimateEmail({
      kind: "estimate",
      name: "<script>alert(1)</script>",
      body: "<img src=x onerror=alert(1)>\n$450",
      service: "car-audio",
      store: "wethersfield",
    });
    expect(result.htmlContent).not.toContain("<script>");
    expect(result.htmlContent).not.toContain("<img src=x");
    expect(result.htmlContent).toContain("&lt;img");
    expect(result.htmlContent).toContain("<br>$450");
  });
});
