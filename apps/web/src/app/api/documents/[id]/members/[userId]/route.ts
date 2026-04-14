import { auth } from "@block-editor/auth";
import { DocumentPolicy, getDocumentPermissions } from "@block-editor/authz";
import { prisma } from "@block-editor/db";
import { NextResponse } from "next/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const { id, userId: targetUserId } = await params;
  const session = await auth();
  if (!session?.user?.keycloakSub)
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const actor = await prisma.user.findUnique({ where: { keycloakSub: session.user.keycloakSub } });
  if (!actor) return NextResponse.json({ error: "user not found" }, { status: 404 });

  const document = await prisma.document.findUnique({ where: { id } });
  if (!document) return NextResponse.json({ error: "document not found" }, { status: 404 });

  const permissions = await getDocumentPermissions(actor.id, document);
  if (!DocumentPolicy.canShare(actor, permissions, document))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { roleId } = await request.json();
  if (!roleId) return NextResponse.json({ error: "roleId required" }, { status: 400 });

  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) return NextResponse.json({ error: "role not found" }, { status: 404 });

  const member = await prisma.documentMember.update({
    where: { documentId_userId: { documentId: id, userId: targetUserId } },
    data: { roleId },
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
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const { id, userId: targetUserId } = await params;
  const session = await auth();
  if (!session?.user?.keycloakSub)
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const actor = await prisma.user.findUnique({ where: { keycloakSub: session.user.keycloakSub } });
  if (!actor) return NextResponse.json({ error: "user not found" }, { status: 404 });

  const document = await prisma.document.findUnique({ where: { id } });
  if (!document) return NextResponse.json({ error: "document not found" }, { status: 404 });

  const permissions = await getDocumentPermissions(actor.id, document);
  if (!DocumentPolicy.canShare(actor, permissions, document))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  await prisma.documentMember.delete({
    where: { documentId_userId: { documentId: id, userId: targetUserId } },
  });

  return new NextResponse(null, { status: 204 });
}
