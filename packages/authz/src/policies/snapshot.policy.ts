import type { Snapshot, User } from "@block-editor/db";
import { hasPermission } from "../services/permission.service";
import { PERMISSIONS } from "../permissions";

export class SnapshotPolicy {
  /**
   * Any user with document.read can list/view snapshots.
   */
  static canList(userPermissions: string[]): boolean {
    return hasPermission(userPermissions, PERMISSIONS.DOCUMENT_READ);
  }

  /**
   * User can create a snapshot if they have snapshot.create.
   */
  static canCreate(userPermissions: string[]): boolean {
    return hasPermission(userPermissions, PERMISSIONS.SNAPSHOT_CREATE);
  }

  /**
   * User can restore a snapshot if they have snapshot.restore.
   */
  static canRestore(userPermissions: string[]): boolean {
    return hasPermission(userPermissions, PERMISSIONS.SNAPSHOT_RESTORE);
  }

  /**
   * User can delete a snapshot if they created it OR have document.manage_all.
   */
  static canDelete(
    user: Pick<User, "id">,
    userPermissions: string[],
    snapshot: Pick<Snapshot, "createdById">
  ): boolean {
    if (hasPermission(userPermissions, PERMISSIONS.DOCUMENT_MANAGE_ALL)) {
      return true;
    }
    return (
      hasPermission(userPermissions, PERMISSIONS.SNAPSHOT_DELETE) &&
      snapshot.createdById === user.id
    );
  }
}
