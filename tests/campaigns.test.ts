import { convexTest } from "convex-test";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import { saveCustomer } from "../convex/lib/customers";
import {
  promotionTemplates,
  promotionEmail,
  validatePromotion,
} from "../shared/promotions.js";
const modules = import.meta.glob("../convex/**/*.ts");
const { id: template, name, description, ...fields } = promotionTemplates[0];
const content = { template, ...fields };
beforeEach(() => {
  vi.useFakeTimers();
  process.env.CUSTOMER_ENCRYPTION_KEY_ID = "test-v1";
  process.env.CUSTOMER_ENCRYPTION_KEYS = JSON.stringify({
    "test-v1": "12".repeat(32),
  });
  process.env.CUSTOMER_INDEX_KEY = "34".repeat(32);
  process.env.PROMOTIONS_ENABLED = "false";
  process.env.BREVO_MARKETING_API_KEY = "mock-only";
  process.env.BREVO_MARKETING_FOLDER_ID = "1";
  process.env.BREVO_PROMOTION_SENDER_EMAIL =
    "estimates@actionaudiostorellc.com";
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Unexpected external request in local test");
    }),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  for (const k of [
    "PROMOTIONS_ENABLED",
    "BREVO_MARKETING_API_KEY",
    "BREVO_MARKETING_FOLDER_ID",
    "BREVO_PROMOTION_SENDER_EMAIL",
  ])
    delete process.env[k];
});
async function setup(count = 2) {
  const t = convexTest(schema, modules);
  const user = await t.run((ctx) => ctx.db.insert("users", {}));
  await t.run((ctx) =>
    ctx.db.insert("authAccounts", {
      userId: user,
      provider: "password",
      providerAccountId: "actionaudiomanager",
    }),
  );
  const admin = t.withIdentity({ subject: user + "|session" });
  const ids = await t.run(async (ctx) => {
    const ids = [];
    for (let i = 0; i < count; i++)
      ids.push(
        await saveCustomer(
          ctx,
          {
            name: "Test " + i,
            email: `test${i}@example.com`,
            phone: "8605550123",
            vehicle: "Toyota",
            store: "wethersfield",
            service: "car-audio",
            createdAt: Date.now(),
            marketingOptIn: true,
          },
          "estimate",
        ),
      );
    return ids;
  });
  const draft = await admin.mutation(api.campaigns.save, {
    key: crypto.randomUUID(),
    content,
    customerIds: ids,
  });
  return { t, admin, ids, ...draft };
}
async function queue(s: any) {
  process.env.PROMOTIONS_ENABLED = "true";
  await s.admin.mutation(api.campaigns.queue, {
    id: s.id,
    revision: s.revision,
    eligibleCount: s.ids.length,
  });
}
describe("local campaign workflow", () => {
  it("saves encrypted drafts but cannot send with live promotions disabled", async () => {
    const s = await setup();
    expect(
      (await s.admin.query(api.campaigns.list, {}))[0].content.subject,
    ).toBe(content.subject);
    const raw = JSON.stringify(
      await s.t.run((ctx) => ctx.db.query("campaigns").collect()),
    );
    expect(raw).not.toContain(content.subject);
    await expect(
      s.admin.mutation(api.campaigns.queue, {
        id: s.id,
        revision: 1,
        eligibleCount: 2,
      }),
    ).rejects.toThrow("disabled");
    await s.t.action(internal.campaigns.deliver, { id: s.id });
    expect(fetch).not.toHaveBeenCalled();
    await expect(s.t.query(api.campaigns.list, {})).rejects.toThrow(
      "Staff access",
    );
    await expect(
      s.t.mutation(api.campaigns.save, {
        key: crypto.randomUUID(),
        content,
        customerIds: s.ids,
      }),
    ).rejects.toThrow("Staff access");
  });
  it("freezes the approved audience, rejects stale revisions and deduplicates queue retries", async () => {
    const s = await setup();
    await s.admin.mutation(api.campaigns.save, {
      id: s.id,
      key: crypto.randomUUID(),
      content: { ...content, offer: "Updated offer" },
      customerIds: [...s.ids, s.ids[0]],
    });
    process.env.PROMOTIONS_ENABLED = "true";
    await expect(
      s.admin.mutation(api.campaigns.queue, {
        id: s.id,
        revision: 1,
        eligibleCount: 2,
      }),
    ).rejects.toThrow("changed");
    await s.admin.mutation(api.campaigns.queue, {
      id: s.id,
      revision: 2,
      eligibleCount: 2,
    });
    await s.admin.mutation(api.campaigns.queue, {
      id: s.id,
      revision: 2,
      eligibleCount: 2,
    });
    expect(
      await s.admin.query(api.campaigns.history, { id: s.id }),
    ).toHaveLength(2);
    await expect(
      s.admin.mutation(api.campaigns.save, {
        id: s.id,
        key: crypto.randomUUID(),
        content,
        customerIds: [],
      }),
    ).rejects.toThrow("already queued");
  });
  it("rechecks unsubscribe changes before queueing and again before a worker claims recipients", async () => {
    const s = await setup();
    const c = (await s.admin.query(api.customers.list, {}))[0];
    await s.admin.mutation(api.customers.update, {
      id: c._id,
      name: c.name,
      phone: c.phone,
      marketingStatus: "unsubscribed",
      evidence: "Customer opt-out",
      confirmDetails: false,
    });
    process.env.PROMOTIONS_ENABLED = "true";
    await expect(
      s.admin.mutation(api.campaigns.queue, {
        id: s.id,
        revision: 1,
        eligibleCount: 2,
      }),
    ).rejects.toThrow("eligibility changed");
    await s.admin.mutation(api.campaigns.queue, {
      id: s.id,
      revision: 1,
      eligibleCount: 1,
    });
    const c2 = (await s.admin.query(api.customers.list, {})).find(
      (x) => x._id !== c._id,
    )!;
    await s.admin.mutation(api.customers.update, {
      id: c2._id,
      name: c2.name,
      phone: c2.phone,
      marketingStatus: "unsubscribed",
      evidence: "Customer opt-out",
      confirmDetails: false,
    });
    expect(
      await s.t.mutation(internal.campaigns.claim, {
        id: s.id,
        providerRoom: 300,
      }),
    ).toBeNull();
    expect(
      (await s.admin.query(api.campaigns.history, { id: s.id })).every(
        (r) => r.status === "skipped",
      ),
    ).toBe(true);
  });
  it("shares the email quota, reserves room for estimates, and prevents concurrent duplicate batches", async () => {
    const s = await setup();
    await queue(s);
    await s.t.run(async (ctx) => {
      for (let i = 0; i < 239; i++)
        await ctx.db.insert("emailAttempts", { at: Date.now() });
    });
    const batch = await s.t.mutation(internal.campaigns.claim, {
      id: s.id,
      providerRoom: 300,
    });
    expect(batch?.recipients).toHaveLength(1);
    expect(
      await s.t.mutation(internal.campaigns.claim, {
        id: s.id,
        providerRoom: 300,
      }),
    ).toBeNull();
    await s.t.mutation(internal.campaigns.batchRecord, {
      id: batch!.batchId,
      status: "submitted",
    });
    expect(
      await s.t.mutation(internal.campaigns.claim, {
        id: s.id,
        providerRoom: 300,
      }),
    ).toBeNull();
    expect(
      (await s.admin.query(api.campaigns.history, { id: s.id })).filter(
        (r) => r.status === "pending",
      ),
    ).toHaveLength(1);
  });
  it("stops unsent recipients without recalling submitted messages", async () => {
    const s = await setup();
    await queue(s);
    await s.admin.mutation(api.campaigns.cancel, { id: s.id });
    expect(
      await s.t.mutation(internal.campaigns.claim, {
        id: s.id,
        providerRoom: 300,
      }),
    ).toBeNull();
    expect(
      (await s.admin.query(api.campaigns.history, { id: s.id })).every(
        (r) => r.status === "skipped",
      ),
    ).toBe(true);
  });
  it("honors Brevo blocklists, sends one campaign to the exact remaining audience, and records acceptance separately from delivery", async () => {
    const s = await setup();
    await queue(s);
    const calls: any[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url, opts: any = {}) => {
        const path = String(url).replace("https://api.brevo.com/v3/", "");
        const body = opts.body ? JSON.parse(opts.body) : null;
        calls.push({ path, method: opts.method, body });
        if (path === "account")
          return Response.json({ plan: [{ type: "free", credits: 300 }] });
        if (path === "contacts/lists") return Response.json({ id: 20 });
        if (path === "contacts/test0%40example.com")
          return Response.json({ emailBlacklisted: true });
        if (path === "contacts/test1%40example.com")
          return Response.json({ emailBlacklisted: false });
        if (path === "contacts") return Response.json({ id: 42 });
        if (path === "emailCampaigns") return Response.json({ id: 50 });
        if (path === "emailCampaigns/50/sendNow")
          return new Response(null, { status: 204 });
        throw new Error("Unexpected mocked path " + path);
      }),
    );
    await s.t.action(internal.campaigns.deliver, { id: s.id });
    expect(calls.filter((c) => c.path.endsWith("/sendNow"))).toHaveLength(1);
    expect(calls.find((c) => c.path === "contacts").body).toEqual({
      email: "test1@example.com",
      updateEnabled: true,
      listIds: [20],
    });
    expect(
      calls.find((c) => c.path === "emailCampaigns").body.recipients,
    ).toEqual({ listIds: [20] });
    expect(
      calls.find((c) => c.path === "emailCampaigns").body.htmlContent,
    ).toContain("{{ unsubscribe }}");
    const history = await s.admin.query(api.campaigns.history, { id: s.id });
    expect(history.map((r) => r.status).sort()).toEqual([
      "skipped",
      "submitted",
    ]);
    expect(
      (await s.admin.query(api.customers.list, {})).find(
        (c) => c.email === "test0@example.com",
      )?.blocked,
    ).toBe(true);
    expect(
      (await s.admin.query(api.campaigns.list, {}))[0].totals,
    ).toBeUndefined();
  });
  it("does not resend an ambiguous provider response", async () => {
    const s = await setup(1);
    await queue(s);
    let sends = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url, opts: any = {}) => {
        const path = String(url);
        if (path.endsWith("/account"))
          return Response.json({ plan: [{ type: "free", credits: 300 }] });
        if (path.endsWith("/sendNow")) {
          sends++;
          throw new Error("timeout");
        }
        if (path.includes("/contacts/"))
          return opts.method === "POST"
            ? Response.json({ id: 3 })
            : Response.json({ emailBlacklisted: false });
        return Response.json({ id: 4 });
      }),
    );
    await s.t.action(internal.campaigns.deliver, { id: s.id });
    await s.t.action(internal.campaigns.deliver, { id: s.id });
    expect(sends).toBe(1);
    expect((await s.admin.query(api.campaigns.list, {}))[0].status).toBe(
      "review",
    );
  });
  it("escapes template content and rejects unsafe links", () => {
    const rendered = promotionEmail({
      ...content,
      body: "<script>alert(1)</script>",
    });
    expect(rendered.htmlContent).toContain("&lt;script&gt;");
    expect(rendered.htmlContent).toContain("105 Silas Deane Hwy");
    expect(rendered.htmlContent).toContain("2814 Main St");
    expect(rendered.htmlContent).toContain("8606676330");
    expect(
      validatePromotion({ ...content, url: "javascript:alert(1)" }),
    ).not.toBe("");
    expect(
      validatePromotion({ ...content, url: "https://untrusted.example/" }),
    ).not.toBe("");
  });
});

describe("campaign feedback and test emails", () => {
  it("requires an authenticated webhook and preserves an unsubscribe against late delivery events", async () => {
    const s = await setup(1);
    await queue(s);
    const batch = await s.t.mutation(internal.campaigns.claim, {
      id: s.id,
      providerRoom: 300,
    });
    await s.t.mutation(internal.campaigns.batchRecord, {
      id: batch!.batchId,
      providerId: 77,
    });
    process.env.BREVO_MARKETING_WEBHOOK_SECRET = "a".repeat(40);
    const event = {
      email: "test0@example.com",
      event: "unsubscribed",
      camp_id: 77,
    };
    expect(
      (
        await s.t.fetch("/brevo/marketing-events", {
          method: "POST",
          body: JSON.stringify(event),
        })
      ).status,
    ).toBe(401);
    expect(
      (await s.admin.query(api.customers.list, {}))[0].marketingStatus,
    ).toBe("subscribed");
    const headers = { "x-action-audio-webhook-key": "a".repeat(40) };
    expect(
      (
        await s.t.fetch("/brevo/marketing-events", {
          method: "POST",
          headers,
          body: JSON.stringify(event),
        })
      ).status,
    ).toBe(204);
    await s.t.fetch("/brevo/marketing-events", {
      method: "POST",
      headers,
      body: JSON.stringify({ ...event, event: "delivered" }),
    });
    expect(
      (await s.admin.query(api.customers.list, {}))[0].marketingStatus,
    ).toBe("unsubscribed");
    expect(
      (await s.admin.query(api.campaigns.history, { id: s.id }))[0]
        .deliveryStatus,
    ).toBe("unsubscribed");
    delete process.env.BREVO_MARKETING_WEBHOOK_SECRET;
  });
  it("sends a test only to the specified address, tracks the outcome, and deduplicates double-clicks", async () => {
    const s = await setup();
    process.env.PROMOTIONS_ENABLED = "true";
    const key = crypto.randomUUID();
    const id = await s.admin.mutation(api.campaigns.sendTest, {
      id: s.id,
      email: "owner@example.com",
      key,
    });
    expect(
      await s.admin.mutation(api.campaigns.sendTest, {
        id: s.id,
        email: "owner@example.com",
        key,
      }),
    ).toBe(id);
    const calls: any[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url, opts: any) => {
        calls.push({ url: String(url), body: JSON.parse(opts.body) });
        return String(url).endsWith("/sendTest")
          ? new Response(null, { status: 204 })
          : Response.json({ id: 42 });
      }),
    );
    await s.t.action(internal.campaigns.deliverTest, { id });
    await s.t.action(internal.campaigns.deliverTest, { id });
    expect(calls).toHaveLength(2);
    expect(calls[1].body).toEqual({ emailTo: ["owner@example.com"] });
    expect(calls[0].body.subject).toContain("[TEST]");
    expect(await s.admin.query(api.campaigns.testStatus, { id })).toBe(
      "submitted",
    );
    expect(await s.admin.query(api.campaigns.history, { id: s.id })).toEqual(
      [],
    );
  });
  it("splits large audiences into separate batches and leaves the remainder queued", async () => {
    const s = await setup(55);
    await queue(s);
    const first = await s.t.mutation(internal.campaigns.claim, {
      id: s.id,
      providerRoom: 300,
    });
    expect(first!.recipients).toHaveLength(50);
    await s.t.mutation(internal.campaigns.batchRecord, {
      id: first!.batchId,
      status: "submitted",
    });
    const second = await s.t.mutation(internal.campaigns.claim, {
      id: s.id,
      providerRoom: 250,
    });
    expect(second!.recipients).toHaveLength(5);
    expect(
      second!.recipients.some((r) =>
        first!.recipients.some((x) => x.customerId === r.customerId),
      ),
    ).toBe(false);
  });
});
