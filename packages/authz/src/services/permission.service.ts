import { prisma } from "@block-editor/db";
import type { Permission } from "../permissions";
import { PERMISSIONS } from "../permissions";

// ── Workspace-level permission cache (used for admin checks only) ─────────────
interface CacheEntry {
  permissions: string[];
  expiresAt: number;
}

const wsCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function wsCacheKey(userId: string, workspaceId: string): string {
  return `perms:${workspaceId}:${userId}`;
}

export function invalidatePermissionCache(
  userId: string,
  workspaceId: string
): void {
  wsCache.delete(wsCacheKey(userId, workspaceId));
}

/**
 * Returns permissions derived from the user's workspace-level roles.
 * Only workspace Admins carry roles; all other access is document-scoped.
 */
export async function getUserWorkspacePermissions(
  userId: string,
  workspaceId: string
): Promise<string[]> {
  const key = wsCacheKey(userId, workspaceId);
  const cached = wsCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.permissions;

  const memberRoles = await prisma.workspaceMemberRole.findMany({
    where: { userId, workspaceId },
    include: {
      role: {
        include: { rolePermissions: { include: { permission: true } } },
      },
    },
  });

  const permissionSet = new Set<string>();
  for (const mr of memberRoles) {
    for (const rp of mr.role.rolePermissions) {
      permissionSet.add(rp.permission.name);
    }
  }

  const directPerms = await prisma.userDirectPermission.findMany({
    where: { userId, workspaceId },
  });
  for (const dp of directPerms) {
    if (dp.granted) permissionSet.add(dp.permissionName);
    else permissionSet.delete(dp.permissionName);
  }

  const permissions = Array.from(permissionSet);
  wsCache.set(key, { permissions, expiresAt: Date.now() + CACHE_TTL_MS });
  return permissions;
}

// ── All permission strings ────────────────────────────────────────────────────
const ALL_PERMISSIONS = Object.values(PERMISSIONS) as string[];

/**
 * Resolves the effective permission set for a user on a specific document.
 *
 * Resolution order:
 *  1. Owner (document.createdById)  → all permissions (immune to blocklist)
 *  2. Workspace Admin (manage_all)  → all permissions (immune to blocklist)
 *  3. Document blocklist            → no permissions (overrides explicit membership)
 *  4. Published + public document   → workspace members get document.read
 *  5. Explicit DocumentMember       → permissions from their document-level role
 */
export async function getDocumentPermissions(
  userId: string,
  document: {
    id: string;
    workspaceId: string;
    createdById: string;
    status: string;
    isPublic: boolean;
  }
): Promise<string[]> {
  // 1. Owner gets everything.
  if (document.createdById === userId) return ALL_PERMISSIONS;

  // 2. Workspace Admin (carries document.manage_all via workspace role).
  const wsPerms = await getUserWorkspacePermissions(userId, document.workspaceId);
  if (wsPerms.includes(PERMISSIONS.DOCUMENT_MANAGE_ALL)) return ALL_PERMISSIONS;

  // 3. Blocklist check — applies regardless of explicit membership.
  const blocked = await prisma.documentBlocklist.findUnique({
    where: { documentId_blockedUserId: { documentId: document.id, blockedUserId: userId } },
  });
  if (blocked) return [];

  const permissionSet = new Set<string>();

  // 4. Published + public document → all workspace members can read.
  if (document.status === "PUBLISHED" && document.isPublic) {
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId: document.workspaceId, userId },
      },
    });
    if (member?.isActive) permissionSet.add(PERMISSIONS.DOCUMENT_READ);
  }

  // 5. Explicit DocumentMember → apply their document-level role's permissions.
  const docMember = await prisma.documentMember.findUnique({
    where: { documentId_userId: { documentId: document.id, userId } },
    include: {
      role: {
        include: { rolePermissions: { include: { permission: true } } },
      },
    },
  });
  if (docMember) {
    for (const rp of docMember.role.rolePermissions) {
      permissionSet.add(rp.permission.name);
    }
  }

  return Array.from(permissionSet);
}

export function hasPermission(
  userPermissions: string[],
  required: Permission
): boolean {
  return userPermissions.includes(required);
}
