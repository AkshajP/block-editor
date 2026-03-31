import type { Template, User } from "@block-editor/db";
import { hasPermission } from "../services/permission.service";
import { PERMISSIONS } from "../permissions";

export class TemplatePolicy {
  /**
   * User can create a template if they have template.create.
   */
  static canCreate(userPermissions: string[]): boolean {
    return hasPermission(userPermissions, PERMISSIONS.TEMPLATE_CREATE);
  }

  /**
   * User can edit a template if they created it or have document.manage_all.
   * System templates are immutable regardless.
   */
  static canEdit(
    user: Pick<User, "id">,
    userPermissions: string[],
    template: Pick<Template, "createdById" | "isSystem">
  ): boolean {
    if (template.isSystem) return false;
    if (hasPermission(userPermissions, PERMISSIONS.DOCUMENT_MANAGE_ALL)) {
      return true;
    }
    return (
      hasPermission(userPermissions, PERMISSIONS.TEMPLATE_EDIT) &&
      template.createdById === user.id
    );
  }

  /**
   * User can apply any template to a document if they have template.apply.
   */
  static canApply(userPermissions: string[]): boolean {
    return hasPermission(userPermissions, PERMISSIONS.TEMPLATE_APPLY);
  }

  /**
   * User can delete a template if they created it or have document.manage_all.
   * System templates cannot be deleted.
   */
  static canDelete(
    user: Pick<User, "id">,
    userPermissions: string[],
    template: Pick<Template, "createdById" | "isSystem">
  ): boolean {
    if (template.isSystem) return false;
    if (hasPermission(userPermissions, PERMISSIONS.DOCUMENT_MANAGE_ALL)) {
      return true;
    }
    return (
      hasPermission(userPermissions, PERMISSIONS.TEMPLATE_DELETE) &&
      template.createdById === user.id
    );
  }
}
