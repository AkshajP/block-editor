"use server";

import { auth, signOut } from "@block-editor/auth";
import { redirect } from "next/navigation";

export async function signOutAction() {
  const session = await auth();
  const idToken = session?.idToken;

  await signOut({ redirect: false });

  const issuer = process.env.AUTH_KEYCLOAK_ISSUER;
  if (idToken && issuer) {
    const postLogoutUri = encodeURIComponent(
      `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/auth/signin`,
    );
    redirect(
      `${issuer}/protocol/openid-connect/logout?id_token_hint=${idToken}&post_logout_redirect_uri=${postLogoutUri}`,
    );
  }

  redirect("/api/auth/signin");
}
