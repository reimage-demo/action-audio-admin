import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { blindIndex, decrypt, encrypt } from "./encryption";
import {
  MARKETING_CONSENT_TEXT,
  MARKETING_CONSENT_VERSION,
} from "../../shared/promotions.js";
export type Customer = {
  name: string;
  email: string;
  phone: string;
  vehicles: string[];
  stores: string[];
  services: string[];
  sources: string[];
  firstSeen: number;
  lastSeen: number;
  marketingStatus: "unknown" | "subscribed" | "unsubscribed";
  blocked?: boolean;
  consent?: { at: number; source: string; text: string; version: string };
  conflicts: string[];
};
const context = (hash: string) => JSON.stringify(["customer", hash]);
export const readCustomer = (r: Doc<"customers">) =>
  decrypt<Customer>(r.encrypted, context(r.identityHash));
export const writeCustomer = (r: Doc<"customers">, c: Customer) =>
  encrypt(c, context(r.identityHash));
export async function saveCustomer(
  ctx: MutationCtx,
  data: {
    name: string;
    email?: string;
    phone: string;
    vehicle: string;
    store: string;
    service: string;
    createdAt: number;
    marketingOptIn?: boolean;
  },
  source: "appointment" | "estimate",
) {
  const email = (data.email || "").trim().toLowerCase();
  const identityHash = blindIndex(
    "customer-identity",
    email
      ? `email:${email}`
      : `phone-name:${data.phone.replace(/\D/g, "")}:${data.name.trim().toLowerCase()}`,
  );
  const existing = await ctx.db
    .query("customers")
    .withIndex("by_identity", (q) => q.eq("identityHash", identityHash))
    .unique();
  const old = existing ? await readCustomer(existing) : null;
  const conflicts = new Set(old?.conflicts || []);
  if (old && old.name.trim().toLowerCase() !== data.name.trim().toLowerCase())
    conflicts.add("Name differs between requests");
  if (old && old.phone.replace(/\D/g, "") !== data.phone.replace(/\D/g, ""))
    conflicts.add("Phone differs between requests");
  const optIn =
    data.marketingOptIn === true && (!old || old.marketingStatus === "unknown");
  const value: Customer = {
    name: old?.name || data.name.trim(),
    email,
    phone: old?.phone || data.phone,
    vehicles: [...new Set([...(old?.vehicles || []), data.vehicle])],
    stores: [...new Set([...(old?.stores || []), data.store])],
    services: [...new Set([...(old?.services || []), data.service])],
    sources: [...new Set([...(old?.sources || []), source])],
    firstSeen: Math.min(old?.firstSeen || data.createdAt, data.createdAt),
    lastSeen: Math.max(old?.lastSeen || 0, data.createdAt),
    marketingStatus: optIn ? "subscribed" : old?.marketingStatus || "unknown",
    ...(old?.blocked ? { blocked: true } : {}),
    ...(optIn
      ? {
          consent: {
            at: data.createdAt,
            source,
            text: MARKETING_CONSENT_TEXT,
            version: MARKETING_CONSENT_VERSION,
          },
        }
      : old?.consent
        ? { consent: old.consent }
        : {}),
    conflicts: [...conflicts],
  };
  if (existing) {
    await ctx.db.patch(existing._id, {
      encrypted: await writeCustomer(existing, value),
    });
    return existing._id;
  }
  return ctx.db.insert("customers", {
    identityHash,
    encrypted: await encrypt(value, context(identityHash)),
  });
}
export async function setSuppression(
  ctx: MutationCtx,
  id: Id<"customers">,
  reason: string,
) {
  const row = await ctx.db.get(id);
  if (!row) return;
  const data = await readCustomer(row);
  await ctx.db.patch(id, {
    encrypted: await writeCustomer(row, {
      ...data,
      blocked: true,
      marketingStatus: "unsubscribed",
      consent: {
        at: Date.now(),
        source: "Brevo",
        text: reason,
        version: "provider",
      },
    }),
  });
}
