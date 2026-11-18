import { getAuthUserId } from "@convex-dev/auth/server";
import type { QueryCtx, MutationCtx } from "../_generated/server";
export async function requireAdmin(ctx: QueryCtx | MutationCtx, allowRestricted = false) {
  const id = await getAuthUserId(ctx);
  const account = id
    ? await ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) =>
          q.eq("userId", id).eq("provider", "password"),
        )
        .unique()
    : null;
  if (!account || account.providerAccountId !== "actionaudiomanager")
    throw new Error("Staff access required.");
  if (!allowRestricted && process.env.PORTAL_RESTRICTED === "true")
    throw new Error("Please Contact 8602050115 to restore connection");
  return id!;
}
