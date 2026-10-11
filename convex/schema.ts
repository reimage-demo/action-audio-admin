import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { product } from "./lib/validators";
import { encryptedValue } from "./lib/encryption";
export default defineSchema({
  ...authTables,
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
  estimates: defineTable({encrypted:encryptedValue,requestHash:v.string(),phoneHash:v.string()}).index("by_request",["requestHash"]).index("by_phone",["phoneHash"]),
  inventory: defineTable({ ...product, updatedAt: v.number() }),
});
