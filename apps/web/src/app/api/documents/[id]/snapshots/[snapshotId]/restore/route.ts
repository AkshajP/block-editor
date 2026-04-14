import { auth } from "@block-editor/auth";
import { getDocumentPermissions, SnapshotPolicy } from "@block-editor/authz";
import { prisma } from "@block-editor/db";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string; snapshotId: string }> };

/**
 * POST /api/documents/:id/snapshots/:snapshotId/restore
 *
 * Returns the lexicalState from the snapshot so the client can load it
 * into the Lexical editor and push the resulting Yjs update.
 */
export async function POST(_req: Request, { params }: RouteContext) {
  const { id: documentId, snapshotId } = await params;

  const session = await auth();
  if (!session?.user?.keycloakSub)
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { keycloakSub: session.user.keycloakSub },
  });
  if (!user)
    return NextResponse.json({ error: "user not found" }, { status: 404 });

  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });
  if (!document)
    return NextResponse.json({ error: "document not found" }, { status: 404 });

  const permissions = await getDocumentPermissions(user.id, document);
  if (!SnapshotPolicy.canRestore(permissions))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const snapshot = await prisma.snapshot.findFirst({
    where: { id: snapshotId, documentId },
    select: { id: true, name: true, lexicalState: true },
  });

  if (!snapshot)
    return NextResponse.json({ error: "snapshot not found" }, { status: 404 });

  return NextResponse.json({ lexicalState: snapshot.lexicalState });
}
