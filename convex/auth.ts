import { convexAuth, retrieveAccount } from "@convex-dev/auth/server";
import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { hashSecret, verifySecret, managerUsername } from "./lib/password";
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    ConvexCredentials({
      id: "password",
      crypto: { hashSecret, verifySecret },
      authorize: async (params, ctx) => {
        if (
          params.flow !== "signIn" ||
          typeof params.username !== "string" ||
          params.username.trim().toLowerCase() !== managerUsername() ||
          typeof params.password !== "string" ||
          params.password.length > 256
        )
          throw new Error("Invalid credentials.");
        // Convex Auth applies its account-based failed-attempt throttling here.
        const result = await retrieveAccount(ctx, {
          provider: "password",
          account: { id: managerUsername(), secret: params.password },
        });
        return { userId: result.user._id };
      },
    }),
  ],
});
