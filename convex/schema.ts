import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { product } from "./lib/validators";
import { encryptedValue } from "./lib/encryption";
export default defineSchema({
  ...authTables,
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
    encrypted: encryptedValue,
    requestHash: v.string(),
    phoneHash: v.string(),
  })
    .index("by_request", ["requestHash"])
    .index("by_phone", ["phoneHash"]),
  inventory: defineTable({ ...product, updatedAt: v.number() }),
});
