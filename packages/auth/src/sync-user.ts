import { prisma } from "@block-editor/db";
import type { AuthenticatedUser } from "./types";

interface KeycloakProfile {
  sub: string;
  email: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

export async function syncUser(
  profile: KeycloakProfile,
): Promise<AuthenticatedUser> {
  const displayName =
    (profile.name ??
      [profile.given_name, profile.family_name].filter(Boolean).join(" ")) ||
    profile.email;

  const user = await prisma.user.upsert({
    where: { keycloakSub: profile.sub },
    update: {
      email: profile.email,
      displayName,
      avatarUrl: profile.picture ?? null,
    },
    create: {
      keycloakSub: profile.sub,
      email: profile.email,
      displayName,
      avatarUrl: profile.picture ?? null,
    },
  });

  return user;
}
