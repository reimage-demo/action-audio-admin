import { v } from "convex/values";
export const store = v.union(v.literal("hartford"), v.literal("wethersfield"));
export const status = v.union(
  ...[
    "requested",
    "confirmed",
    "checked_in",
    "in_progress",
    "waiting_parts",
    "ready",
    "completed",
    "cancelled",
  ].map((s) => v.literal(s)),
);
export const product = {
  name: v.string(),
  brand: v.string(),
  category: v.string(),
  description: v.string(),
  price: v.optional(v.number()),
  store,
  availability: v.union(
    v.literal("in_stock"),
    v.literal("order"),
    v.literal("unavailable"),
  ),
  published: v.boolean(),
  imageUrl: v.optional(v.string()),
};
