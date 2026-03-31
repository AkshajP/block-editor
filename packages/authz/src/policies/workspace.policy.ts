import type { Workspace, User } from "@block-editor/db";
import { hasPermission } from "../services/permission.service";
import { PERMISSIONS } from "../permissions";

export class WorkspacePolicy {
  /**
   * User can invite others if they have workspace.invite.
   */
  static canInvite(userPermissions: string[]): boolean {
    return hasPermission(userPermissions, PERMISSIONS.WORKSPACE_INVITE);
  }

  /**
   * User can manage roles if they have workspace.manage_roles.
   */
  static canManageRoles(userPermissions: string[]): boolean {
    return hasPermission(userPermissions, PERMISSIONS.WORKSPACE_MANAGE_ROLES);
  }

  /**
   * User can block/unblock members if they have workspace.manage_blocklist.
   */
  static canManageBlocklist(userPermissions: string[]): boolean {
    return hasPermission(
      userPermissions,
      PERMISSIONS.WORKSPACE_MANAGE_BLOCKLIST
    );
  }

  /**
   * Only the workspace creator or a user with workspace.manage can delete it.
   */
  static canDelete(
    user: Pick<User, "id">,
    userPermissions: string[],
    workspace: Pick<Workspace, "createdBy">
  ): boolean {
    return (
      workspace.createdBy === user.id ||
      hasPermission(userPermissions, PERMISSIONS.WORKSPACE_MANAGE)
    );
  }

  /**
   * User can update workspace settings if they have workspace.manage.
   */
  static canManage(userPermissions: string[]): boolean {
    return hasPermission(userPermissions, PERMISSIONS.WORKSPACE_MANAGE);
  }
}
