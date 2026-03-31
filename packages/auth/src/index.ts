import NextAuth from "next-auth";
import { authConfig } from "./config";

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

export { authConfig } from "./config";
export type { AuthenticatedUser } from "./types";
export { syncUser } from "./sync-user";
