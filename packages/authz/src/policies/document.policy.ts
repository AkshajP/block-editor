import type { Document, User } from "@block-editor/db";
import { hasPermission } from "../services/permission.service";
import { PERMISSIONS } from "../permissions";

export class DocumentPolicy {
  /**
   * User can read if they have document.read in the workspace.
   */
  static canRead(userPermissions: string[]): boolean {
    return hasPermission(userPermissions, PERMISSIONS.DOCUMENT_READ);
  }

  /**
   * User can write if they have document.write AND the document is not archived.
   * Admins with document.manage_all bypass the archive check.
   */
  static canWrite(
    userPermissions: string[],
    document: Pick<Document, "status">
  ): boolean {
    if (hasPermission(userPermissions, PERMISSIONS.DOCUMENT_MANAGE_ALL)) {
      return true;
    }
    if (!hasPermission(userPermissions, PERMISSIONS.DOCUMENT_WRITE)) {
      return false;
    }
    return document.status !== "ARCHIVED";
  }

  /**
   * User can delete if they are the document creator OR have document.manage_all.
   */
  static canDelete(
    user: Pick<User, "id">,
    userPermissions: string[],
    document: Pick<Document, "createdById">
  ): boolean {
    if (hasPermission(userPermissions, PERMISSIONS.DOCUMENT_MANAGE_ALL)) {
      return true;
    }
    return (
      hasPermission(userPermissions, PERMISSIONS.DOCUMENT_DELETE) &&
      document.createdById === user.id
    );
  }

  /**
   * User can share if they have document.share AND are the creator OR have manage_all.
   */
  static canShare(
    user: Pick<User, "id">,
    userPermissions: string[],
    document: Pick<Document, "createdById">
  ): boolean {
    if (hasPermission(userPermissions, PERMISSIONS.DOCUMENT_MANAGE_ALL)) {
      return true;
    }
    return (
      hasPermission(userPermissions, PERMISSIONS.DOCUMENT_SHARE) &&
      document.createdById === user.id
    );
  }

  /**
   * User can rename if they are the document creator OR have document.manage_all.
   */
  static canRename(
    user: Pick<User, "id">,
    userPermissions: string[],
    document: Pick<Document, "createdById">
  ): boolean {
    if (hasPermission(userPermissions, PERMISSIONS.DOCUMENT_MANAGE_ALL)) {
      return true;
    }
    return document.createdById === user.id;
  }

  /**
   * User can publish/unpublish if they are the document creator OR have document.manage_all.
   */
  static canPublish(
    user: Pick<User, "id">,
    userPermissions: string[],
    document: Pick<Document, "createdById">
  ): boolean {
    if (hasPermission(userPermissions, PERMISSIONS.DOCUMENT_MANAGE_ALL)) {
      return true;
    }
    return document.createdById === user.id;
  }

  /**
   * User can change visibility (public/private) if they are the document creator
   * OR have document.manage_all (workspace admins and document-level admins).
   */
  static canChangeVisibility(
    user: Pick<User, "id">,
    userPermissions: string[],
    document: Pick<Document, "createdById">
  ): boolean {
    if (hasPermission(userPermissions, PERMISSIONS.DOCUMENT_MANAGE_ALL)) {
      return true;
    }
    return document.createdById === user.id;
  }

  /**
   * Full admin control over any document in workspace.
   */
  static canManageAll(userPermissions: string[]): boolean {
    return hasPermission(userPermissions, PERMISSIONS.DOCUMENT_MANAGE_ALL);
  }
}
