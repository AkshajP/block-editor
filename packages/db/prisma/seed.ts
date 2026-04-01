import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PERMISSIONS = [
  { name: "document.read", description: "Read documents in workspace" },
  { name: "document.write", description: "Create and edit documents" },
  { name: "document.delete", description: "Delete documents" },
  { name: "document.share", description: "Share documents with other users" },
  {
    name: "document.manage_all",
    description: "Manage all documents in workspace (admin override)",
  },
  { name: "snapshot.create", description: "Create document snapshots" },
  {
    name: "snapshot.restore",
    description: "Restore a document to a prior snapshot",
  },
  { name: "snapshot.delete", description: "Delete snapshots" },
  { name: "workspace.manage", description: "Manage workspace settings" },
  { name: "workspace.invite", description: "Invite users to workspace" },
  {
    name: "workspace.manage_roles",
    description: "Assign and manage member roles",
  },
  {
    name: "workspace.manage_blocklist",
    description: "Block and unblock users from workspace",
  },
  { name: "template.create", description: "Create templates" },
  { name: "template.edit", description: "Edit existing templates" },
  { name: "template.apply", description: "Apply a template to a document" },
  { name: "template.delete", description: "Delete templates" },
  {
    name: "variable.write",
    description: "Set static variable values on a document",
  },
];

const SYSTEM_ROLES = [
  {
    name: "Admin",
    description: "Full access to workspace",
    permissions: "*" as const,
  },
  {
    name: "Editor",
    description: "Can create, edit, and snapshot documents",
    permissions: [
      "document.read",
      "document.write",
      "document.delete",
      "document.share",
      "snapshot.create",
      "snapshot.restore",
      "snapshot.delete",
      "template.apply",
      "variable.write",
    ],
  },
  {
    name: "Viewer",
    description: "Read-only access to documents",
    permissions: ["document.read", "snapshot.create"],
  },
];

// IDs must match the pinned "id" fields in configs/realm-export.json so that
// the Keycloak sub issued at login always maps to the correct seeded user.
const DEV_USERS = [
  { keycloakSub: "00000000-0000-0000-0000-000000000001", email: "admin@dev.local", displayName: "Admin Dev", role: "Admin" },
  { keycloakSub: "00000000-0000-0000-0000-000000000002", email: "editor@dev.local", displayName: "Editor Dev", role: "Editor" },
  { keycloakSub: "00000000-0000-0000-0000-000000000003", email: "viewer@dev.local", displayName: "Viewer Dev", role: "Viewer" },
];

const DEV_WORKSPACE = {
  name: "Dev Workspace",
  slug: "dev-workspace",
};

async function main() {
  console.log("Seeding permissions...");
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      update: { description: perm.description },
      create: perm,
    });
  }

  const allPermissions = await prisma.permission.findMany();
  const permMap = new Map(allPermissions.map((p) => [p.name, p.id]));

  console.log("Seeding system roles...");
  for (const roleDef of SYSTEM_ROLES) {
    // Find or create the system role (workspaceId null = system-wide)
    let role = await prisma.role.findFirst({
      where: { name: roleDef.name, workspaceId: null },
    });

    if (!role) {
      role = await prisma.role.create({
        data: {
          name: roleDef.name,
          description: roleDef.description,
          isSystem: true,
          workspaceId: null,
        },
      });
    } else {
      role = await prisma.role.update({
        where: { id: role.id },
        data: { description: roleDef.description },
      });
    }

    // Replace all permissions for this role
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });

    const permIds =
      roleDef.permissions === "*"
        ? allPermissions.map((p) => p.id)
        : (roleDef.permissions as string[])
            .map((name) => permMap.get(name))
            .filter((id): id is string => Boolean(id));

    if (permIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: permIds.map((permissionId) => ({
          roleId: role!.id,
          permissionId,
        })),
        skipDuplicates: true,
      });
    }

    console.log(
      `  Role "${roleDef.name}" seeded with ${permIds.length} permissions`
    );
  }

  console.log("Seeding dev users...");
  const seededUsers: { id: string; email: string; role: string }[] = [];
  for (const u of DEV_USERS) {
    const user = await prisma.user.upsert({
      where: { keycloakSub: u.keycloakSub },
      update: { email: u.email, displayName: u.displayName },
      create: { keycloakSub: u.keycloakSub, email: u.email, displayName: u.displayName },
    });
    seededUsers.push({ id: user.id, email: user.email, role: u.role });
    console.log(`  User "${user.email}" (id: ${user.id})`);
  }

  const adminUser = seededUsers.find((u) => u.role === "Admin")!;

  console.log("Seeding dev workspace...");
  const devWorkspace = await prisma.workspace.upsert({
    where: { slug: DEV_WORKSPACE.slug },
    update: { name: DEV_WORKSPACE.name },
    create: { name: DEV_WORKSPACE.name, slug: DEV_WORKSPACE.slug, createdBy: adminUser.id },
  });
  console.log(`  Workspace "${devWorkspace.name}" (id: ${devWorkspace.id})`);

  console.log("Adding workspace members...");
  for (const u of seededUsers) {
    await prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: devWorkspace.id, userId: u.id } },
      update: { isActive: true },
      create: { workspaceId: devWorkspace.id, userId: u.id },
    });
    console.log(`  "${u.email}" joined workspace`);
  }

  // Only the Admin user gets a workspace-level role.
  // Editor and Viewer access is granted per-document via DocumentMember.
  console.log("Assigning workspace Admin role to admin user only...");
  const adminRole = await prisma.role.findFirstOrThrow({
    where: { name: "Admin", workspaceId: null },
  });
  await prisma.workspaceMemberRole.upsert({
    where: {
      workspaceId_userId_roleId: {
        workspaceId: devWorkspace.id,
        userId: adminUser.id,
        roleId: adminRole.id,
      },
    },
    update: {},
    create: { workspaceId: devWorkspace.id, userId: adminUser.id, roleId: adminRole.id },
  });
  console.log(`  "admin@dev.local" → Admin (workspace role)`);

  console.log("Seeding dev document...");
  const devDoc = await prisma.document.upsert({
    where: { id: "dev-document-id" },
    update: { title: "Dev Document" },
    create: {
      id: "dev-document-id",
      title: "Dev Document",
      workspaceId: devWorkspace.id,
      createdById: adminUser.id,
    },
  });
  console.log(`  Document "${devDoc.title}" (id: ${devDoc.id})`);

  console.log("Adding document members...");
  for (const u of seededUsers) {
    const role = await prisma.role.findFirstOrThrow({
      where: { name: u.role, workspaceId: null },
    });
    await prisma.documentMember.upsert({
      where: { documentId_userId: { documentId: devDoc.id, userId: u.id } },
      update: { roleId: role.id },
      create: { documentId: devDoc.id, userId: u.id, roleId: role.id },
    });
    console.log(`  "${u.email}" → ${u.role}`);
  }

  console.log("\nSeed complete.");
  console.log(`Workspace ID : ${devWorkspace.id}`);
  console.log(`Document ID  : ${devDoc.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
