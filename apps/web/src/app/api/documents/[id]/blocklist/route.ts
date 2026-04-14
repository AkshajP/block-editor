import { auth } from "@block-editor/auth";
import { DocumentPolicy, getDocumentPermissions } from "@block-editor/authz";
import { prisma } from "@block-editor/db";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  const entries = await prisma.documentBlocklist.findMany({
    where: { documentId: id },
    include: {
      blockedUser: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
    },
  });

  return NextResponse.json(entries.map((e) => ({
    userId: e.blockedUserId,
    displayName: e.blockedUser.displayName,
    email: e.blockedUser.email,
    avatarUrl: e.blockedUser.avatarUrl,
    blockedAt: e.blockedAt.toISOString(),
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

  const actor = await prisma.user.findUnique({ where: { keycloakSub: session.user.keycloakSub } });
  if (!actor) return NextResponse.json({ error: "user not found" }, { status: 404 });

  const document = await prisma.document.findUnique({ where: { id } });
  if (!document) return NextResponse.json({ error: "document not found" }, { status: 404 });

  const permissions = await getDocumentPermissions(actor.id, document);
  if (!DocumentPolicy.canShare(actor, permissions, document))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { userId } = await request.json();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  if (userId === document.createdById)
    return NextResponse.json({ error: "cannot block the document owner" }, { status: 400 });

  const entry = await prisma.documentBlocklist.upsert({
    where: { documentId_blockedUserId: { documentId: id, blockedUserId: userId } },
    update: {},
    create: { documentId: id, blockedUserId: userId, blockedById: actor.id },
    include: {
      blockedUser: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
    },
  });

  return NextResponse.json({
    userId: entry.blockedUserId,
    displayName: entry.blockedUser.displayName,
    email: entry.blockedUser.email,
    avatarUrl: entry.blockedUser.avatarUrl,
    blockedAt: entry.blockedAt.toISOString(),
  }, { status: 201 });
}
