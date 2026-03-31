export interface AuthenticatedUser {
  id: string;
  keycloakSub: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
}
