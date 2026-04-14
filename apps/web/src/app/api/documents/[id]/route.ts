import { auth } from "@block-editor/auth";
import { DocumentPolicy, getDocumentPermissions } from "@block-editor/authz";
import { prisma } from "@block-editor/db";
import { NextResponse } from "next/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.keycloakSub)
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { keycloakSub: session.user.keycloakSub },
  });
  if (!user)
    return NextResponse.json({ error: "user not found" }, { status: 404 });

  const document = await prisma.document.findUnique({ where: { id } });
  if (!document)
    return NextResponse.json({ error: "document not found" }, { status: 404 });

  const permissions = await getDocumentPermissions(user.id, document);
  if (!DocumentPolicy.canRename(user, permissions, document))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await request.json();
  const title = typeof body.title === "string" ? body.title.trim() : null;
  if (!title)
    return NextResponse.json({ error: "title is required" }, { status: 400 });

  const updated = await prisma.document.update({
    where: { id },
    data: { title },
  });

  return NextResponse.json({ id: updated.id, title: updated.title });
}
