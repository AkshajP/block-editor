import { prisma } from "@block-editor/db";
import type { Permission } from "../permissions";

// Simple in-memory TTL cache — replace with Redis when needed
interface CacheEntry {
  permissions: string[];
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function cacheKey(userId: string, workspaceId: string): string {
  return `perms:${workspaceId}:${userId}`;
}

export function invalidatePermissionCache(
  userId: string,
  workspaceId: string
): void {
  cache.delete(cacheKey(userId, workspaceId));
}

export async function getUserWorkspacePermissions(
  userId: string,
  workspaceId: string
): Promise<string[]> {
  const key = cacheKey(userId, workspaceId);
  const cached = cache.get(key);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.permissions;
  }

  // 1. Collect permissions from all roles the user holds in this workspace
  const memberRoles = await prisma.workspaceMemberRole.findMany({
    where: { userId, workspaceId },
    include: {
      role: {
        include: {
          rolePermissions: {
            include: { permission: true },
          },
        },
      },
    },
  });

  const permissionSet = new Set<string>();

  for (const memberRole of memberRoles) {
    for (const rp of memberRole.role.rolePermissions) {
      permissionSet.add(rp.permission.name);
    }
  }

  // 2. Apply direct permission overrides (granted=true adds, granted=false removes)
  const directPerms = await prisma.userDirectPermission.findMany({
    where: { userId, workspaceId },
  });

  for (const dp of directPerms) {
    if (dp.granted) {
      permissionSet.add(dp.permissionName);
    } else {
      permissionSet.delete(dp.permissionName);
    }
  }

  const permissions = Array.from(permissionSet);

  cache.set(key, { permissions, expiresAt: Date.now() + CACHE_TTL_MS });

  return permissions;
}

export function hasPermission(
  userPermissions: string[],
  required: Permission
): boolean {
  return userPermissions.includes(required);
}
