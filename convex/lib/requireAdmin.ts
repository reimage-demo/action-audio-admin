import { getAuthUserId } from "@convex-dev/auth/server";
import type { QueryCtx, MutationCtx } from "../_generated/server";
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
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
  return id!;
}
