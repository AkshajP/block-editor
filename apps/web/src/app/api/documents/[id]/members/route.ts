import { auth } from "@block-editor/auth";
import { DocumentPolicy, getDocumentPermissions } from "@block-editor/authz";
import { prisma } from "@block-editor/db";
import { NextResponse } from "next/server";

async function resolveActorAndDoc(
  keycloakSub: string,
  docId: string
): Promise<
  | { error: NextResponse }
  | { user: { id: string }; document: { id: string; workspaceId: string; createdById: string; status: string; isPublic: boolean }; permissions: string[] }
> {
  const user = await prisma.user.findUnique({ where: { keycloakSub } });
  if (!user) return { error: NextResponse.json({ error: "user not found" }, { status: 404 }) };

  const document = await prisma.document.findUnique({ where: { id: docId } });
  if (!document) return { error: NextResponse.json({ error: "document not found" }, { status: 404 }) };

  const permissions = await getDocumentPermissions(user.id, document);
  return { user, document, permissions };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.keycloakSub)
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const resolved = await resolveActorAndDoc(session.user.keycloakSub, id);
  if ("error" in resolved) return resolved.error;
  const { permissions } = resolved;

  if (!DocumentPolicy.canRead(permissions))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const members = await prisma.documentMember.findMany({
    where: { documentId: id },
    include: {
      user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
      role: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(members.map((m) => ({
    userId: m.userId,
    displayName: m.user.displayName,
    email: m.user.email,
    avatarUrl: m.user.avatarUrl,
    roleId: m.role.id,
    roleName: m.role.name,
    addedAt: m.addedAt.toISOString(),
  })));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.keycloakSub)
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const resolved = await resolveActorAndDoc(session.user.keycloakSub, id);
  if ("error" in resolved) return resolved.error;
  const { user, document, permissions } = resolved;

  if (!DocumentPolicy.canShare(user, permissions, document))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await request.json();
  const { userId, roleId } = body;

  if (!userId || !roleId)
    return NextResponse.json({ error: "userId and roleId are required" }, { status: 400 });

  // Verify target user is a workspace member
  const targetMembership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: document.workspaceId, userId } },
  });
  if (!targetMembership?.isActive)
    return NextResponse.json({ error: "user is not a workspace member" }, { status: 400 });

  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) return NextResponse.json({ error: "role not found" }, { status: 404 });

  const member = await prisma.documentMember.upsert({
    where: { documentId_userId: { documentId: id, userId } },
    update: { roleId },
    create: { documentId: id, userId, roleId },
    include: {
      user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
      role: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({
    userId: member.userId,
    displayName: member.user.displayName,
    email: member.user.email,
    avatarUrl: member.user.avatarUrl,
    roleId: member.role.id,
    roleName: member.role.name,
    addedAt: member.addedAt.toISOString(),
  }, { status: 201 });
}
