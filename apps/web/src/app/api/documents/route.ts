import { auth } from "@block-editor/auth";
import {
  DocumentPolicy,
  getDocumentPermissions,
} from "@block-editor/authz";
import { prisma } from "@block-editor/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.keycloakSub)
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { keycloakSub: session.user.keycloakSub },
  });
  if (!user)
    return NextResponse.json({ error: "user not found" }, { status: 404 });

  // Documents the user can see:
  //   • documents they own
  //   • documents they are an explicit member of
  //   • published documents in workspaces they belong to
  const workspaceMemberships = await prisma.workspaceMember.findMany({
    where: { userId: user.id, isActive: true },
    select: { workspaceId: true },
  });
  const workspaceIds = workspaceMemberships.map((m) => m.workspaceId);

  const documents = await prisma.document.findMany({
    where: {
      OR: [
        { createdById: user.id },
        { members: { some: { userId: user.id } } },
        { workspaceId: { in: workspaceIds }, status: "PUBLISHED" },
      ],
    },
    include: { createdBy: { select: { displayName: true } } },
    orderBy: { updatedAt: "desc" },
  });

  // Filter to those the user can actually read (handles edge cases like archived)
  const results = await Promise.all(
    documents.map(async (doc) => {
      const permissions = await getDocumentPermissions(user.id, doc);
      if (!DocumentPolicy.canRead(permissions)) return null;
      return {
        id: doc.id,
        title: doc.title,
        status: doc.status as string,
        updatedAt: doc.updatedAt.toISOString(),
        createdByName: doc.createdBy.displayName,
        isOwner: doc.createdById === user.id,
      };
    }),
  );

  return NextResponse.json(results.filter(Boolean));
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.keycloakSub)
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { keycloakSub: session.user.keycloakSub },
  });
  if (!user)
    return NextResponse.json({ error: "user not found" }, { status: 404 });

  // Any active workspace member can create a document — they become the owner.
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: user.id, isActive: true },
  });
  if (!membership)
    return NextResponse.json({ error: "no workspace membership" }, { status: 403 });

  const document = await prisma.document.create({
    data: {
      title: "Untitled Document",
      workspaceId: membership.workspaceId,
      createdById: user.id,
    },
  });

  return NextResponse.json(
    { id: document.id, title: document.title },
    { status: 201 },
  );
}
