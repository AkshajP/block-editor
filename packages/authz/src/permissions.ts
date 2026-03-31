export const PERMISSIONS = {
  // Document
  DOCUMENT_READ: "document.read",
  DOCUMENT_WRITE: "document.write",
  DOCUMENT_DELETE: "document.delete",
  DOCUMENT_SHARE: "document.share",
  DOCUMENT_MANAGE_ALL: "document.manage_all",

  // Snapshots
  SNAPSHOT_CREATE: "snapshot.create",
  SNAPSHOT_RESTORE: "snapshot.restore",
  SNAPSHOT_DELETE: "snapshot.delete",

  // Workspace
  WORKSPACE_MANAGE: "workspace.manage",
  WORKSPACE_INVITE: "workspace.invite",
  WORKSPACE_MANAGE_ROLES: "workspace.manage_roles",
  WORKSPACE_MANAGE_BLOCKLIST: "workspace.manage_blocklist",

  // Templates
  TEMPLATE_CREATE: "template.create",
  TEMPLATE_EDIT: "template.edit",
  TEMPLATE_APPLY: "template.apply",
  TEMPLATE_DELETE: "template.delete",

  // Variables
  VARIABLE_WRITE: "variable.write",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
