import { query, mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { product } from "./lib/validators";
import { requireAdmin } from "./lib/requireAdmin";
export const publicList = query({
  args: {},
  handler: async (ctx) =>
    (await ctx.db.query("inventory").order("desc").collect()).filter(
      (p) => p.published && p.store === "wethersfield",
    ),
});
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return ctx.db.query("inventory").order("desc").collect();
  },
});
export const save = mutation({
  args: { id: v.optional(v.id("inventory")), ...product },
  handler: async (ctx, { id, ...data }) => {
    await requireAdmin(ctx);
    if (data.store !== "wethersfield")
      throw new ConvexError(
        "Electronics are available through Wethersfield. Hartford handles detailing.",
      );
    if (
      !data.name.trim() ||
      data.name.length > 140 ||
      !data.brand.trim() ||
      data.brand.length > 80 ||
      data.description.length > 2000 ||
      ![
        "Speakers",
        "Subwoofers",
        "Amplifiers",
        "Receivers",
        "Remote starters",
        "Security",
        "Accessories",
        "Motorcycle audio",
        "Video systems",
        "Power liftgates",
        "Radar detectors",
      ].includes(data.category) ||
      (data.price !== undefined &&
        (!Number.isFinite(data.price) || data.price < 0)) ||
      (data.imageUrl &&
        (!data.imageUrl.startsWith("https://") || data.imageUrl.length > 2000))
    )
      throw new ConvexError(
        "Check the product details. Images must use HTTPS.",
      );
    if (id) {
      if (!(await ctx.db.get(id))) throw new ConvexError("Product not found.");
      await ctx.db.patch(id, {
        ...data,
        price: data.price,
        imageUrl: data.imageUrl || undefined,
        updatedAt: Date.now(),
      });
      return id;
    }
    return ctx.db.insert("inventory", { ...data, updatedAt: Date.now() });
  },
});
