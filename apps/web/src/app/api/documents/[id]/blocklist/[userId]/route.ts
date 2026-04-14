import { auth } from "@block-editor/auth";
import { DocumentPolicy, getDocumentPermissions } from "@block-editor/authz";
import { prisma } from "@block-editor/db";
import { NextResponse } from "next/server";

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

  await prisma.documentBlocklist.delete({
    where: { documentId_blockedUserId: { documentId: id, blockedUserId: targetUserId } },
  });

  return new NextResponse(null, { status: 204 });
}
