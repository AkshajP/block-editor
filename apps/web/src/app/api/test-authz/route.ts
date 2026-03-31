import { auth } from "@block-editor/auth";
import {
  DocumentPolicy,
  getUserWorkspacePermissions,
} from "@block-editor/authz";
import { prisma } from "@block-editor/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get("documentId");
  if (!documentId)
    return NextResponse.json({ error: "documentId query param required" }, { status: 400 });

  const session = await auth();
  if (!session?.user?.keycloakSub)
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { keycloakSub: session.user.keycloakSub },
  });
  if (!user)
    return NextResponse.json({ error: "user not found" }, { status: 404 });

  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document)
    return NextResponse.json({ error: "document not found" }, { status: 404 });

  const permissions = await getUserWorkspacePermissions(user.id, document.workspaceId);

  return NextResponse.json({
    permissions,
    canRead: DocumentPolicy.canRead(permissions),
    canWrite: DocumentPolicy.canWrite(permissions, document),
    canDelete: DocumentPolicy.canDelete(user, permissions, document),
    canShare: DocumentPolicy.canShare(user, permissions, document),
    canManageAll: DocumentPolicy.canManageAll(permissions),
  });
}
