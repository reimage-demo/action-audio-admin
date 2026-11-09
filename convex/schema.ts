import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { product } from "./lib/validators";
import { encryptedValue } from "./lib/encryption";
export default defineSchema({
  ...authTables,
  campaigns: defineTable({
    key: v.string(),
    encrypted: encryptedValue,
    status: v.string(),
    revision: v.number(),
    updatedAt: v.number(),
    error: v.optional(v.string()),
    totals: v.optional(
      v.object({
        sent: v.number(),
        delivered: v.number(),
        bounced: v.number(),
        unsubscribed: v.number(),
      }),
    ),
  })
    .index("by_key", ["key"])
    .index("by_status", ["status"]),
  campaignRecipients: defineTable({
    campaignId: v.id("campaigns"),
    customerId: v.id("customers"),
    status: v.string(),
    reason: v.optional(v.string()),
    batchId: v.optional(v.id("campaignBatches")),
    deliveryStatus: v.optional(v.string()),
  }).index("by_campaign", ["campaignId"]),
  campaignBatches: defineTable({
    campaignId: v.id("campaigns"),
    status: v.string(),
    startedAt: v.number(),
    providerId: v.optional(v.number()),
    listId: v.optional(v.number()),
    error: v.optional(v.string()),
  })
    .index("by_campaign", ["campaignId"])
    .index("by_provider", ["providerId"])
    .index("by_status", ["status"]),
  campaignTests: defineTable({
    key: v.string(),
    status: v.string(),
    encrypted: encryptedValue,
  }).index("by_key", ["key"]),
  customers: defineTable({
    identityHash: v.string(),
    encrypted: encryptedValue,
  }).index("by_identity", ["identityHash"]),
  emailDeliveries: defineTable({
    estimateId: v.id("estimates"),
    kind: v.union(v.literal("thanks"), v.literal("estimate")),
    key: v.string(),
    encrypted: encryptedValue,
    status: v.union(
      v.literal("pending"),
      v.literal("sending"),
      v.literal("sent"),
      v.literal("failed"),
      v.literal("review"),
    ),
    attempts: v.number(),
    nextAttemptAt: v.number(),
    attemptedAt: v.optional(v.number()),
    sentAt: v.optional(v.number()),
    errorCode: v.optional(v.string()),
    messageId: v.optional(v.string()),
  })
    .index("by_key", ["key"])
    .index("by_estimate", ["estimateId"])
    .index("by_status_next", ["status", "nextAttemptAt"]),
  emailAttempts: defineTable({ at: v.number() }).index("by_at", ["at"]),
  notificationDeliveries: defineTable({
    kind: v.union(v.literal("appointment"), v.literal("estimate")),
    recordId: v.union(v.id("appointments"), v.id("estimates")),
    status: v.union(
      v.literal("pending"),
      v.literal("sent"),
      v.literal("failed"),
    ),
    attempts: v.number(),
    errorCode: v.optional(v.string()),
    pushoverRequest: v.optional(v.string()),
    sentAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_record", ["recordId"]),
  appointments: defineTable({
    customerId: v.optional(v.id("customers")),
    encrypted: encryptedValue,
    emailHash: v.string(),
    trackingHash: v.string(),
    requestHash: v.string(),
    slotHash: v.string(),
  })
    .index("by_tracking", ["trackingHash"])
    .index("by_request", ["requestHash"])
    .index("by_slot", ["slotHash"])
    .index("by_email", ["emailHash"]),
  estimates: defineTable({
    customerId: v.optional(v.id("customers")),
    encrypted: encryptedValue,
    requestHash: v.string(),
    phoneHash: v.string(),
  })
    .index("by_request", ["requestHash"])
    .index("by_phone", ["phoneHash"]),
  inventory: defineTable({ ...product, updatedAt: v.number() }),
});
