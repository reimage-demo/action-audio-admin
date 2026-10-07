import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { managerUsername, validPasswordHash } from "./lib/password";
// Internal CLI/dashboard-only provisioning accepts a LOCAL precomputed verifier,
// never the plaintext password. authAccounts.secret is the library's hash field.
export const provision = internalMutation({
  args: { username: v.string(), passwordHash: v.string() },
  handler: async (ctx, { username, passwordHash }) => {
    if (username !== managerUsername() || !validPasswordHash(passwordHash))
      throw new Error("Invalid manager account configuration.");
    if (!/^[a-f0-9]{64}$/.test(process.env.AUTH_PASSWORD_PEPPER || ""))
      throw new Error("Configure the server-side password pepper first.");
    const existing = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", username),
      )
      .unique();
    if (existing)
      throw new Error(
        "Manager account already exists. Use the password rotation procedure.",
      );
    const userId = await ctx.db.insert("users", { name: username });
    await ctx.db.insert("authAccounts", {
      userId,
      provider: "password",
      providerAccountId: username,
      secret: passwordHash,
    });
    return { created: true, username };
  },
});
