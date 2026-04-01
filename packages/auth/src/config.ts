import type { NextAuthConfig } from "next-auth";
import KeycloakProvider from "next-auth/providers/keycloak";
import { syncUser } from "./sync-user";

export const authConfig: NextAuthConfig = {
  secret: process.env.AUTH_SECRET,
  providers: [
    KeycloakProvider({
      clientId: process.env.AUTH_KEYCLOAK_ID!,
      clientSecret: process.env.AUTH_KEYCLOAK_SECRET!,
      issuer: process.env.AUTH_KEYCLOAK_ISSUER!,
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === "keycloak" && profile?.sub && profile.email) {
        await syncUser({
          sub: profile.sub,
          email: profile.email,
          name: profile.name as string | undefined,
          given_name: profile.given_name as string | undefined,
          family_name: profile.family_name as string | undefined,
          picture: profile.picture as string | undefined,
        });
      }
      return true;
    },

    async jwt({ token, account, profile }) {
      if (account?.provider === "keycloak" && profile?.sub) {
        token.keycloakSub = profile.sub;
        token.idToken = account.id_token;
      }
      return token;
    },

    async session({ session, token }) {
      if (token.keycloakSub) {
        session.user.keycloakSub = token.keycloakSub as string;
      }
      if (token.idToken) {
        session.idToken = token.idToken as string;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
  events: {
    async signOut(message) {
      // Handled via redirect in the signOutAction — no server-side action needed
      void message;
    },
  },
};

declare module "next-auth" {
  interface Session {
    idToken?: string;
    user: {
      keycloakSub: string;
    } & import("next-auth").DefaultSession["user"];
  }
}
