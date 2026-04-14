import { auth } from "@block-editor/auth";
import { getDocumentPermissions, SnapshotPolicy } from "@block-editor/authz";
import { prisma } from "@block-editor/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  lexicalState: z.record(z.string(), z.unknown()),
});

type RouteContext = { params: Promise<{ id: string }> };

async function resolveUser(keycloakSub: string) {
  return prisma.user.findUnique({ where: { keycloakSub } });
}

export async function GET(_req: Request, { params }: RouteContext) {
  const { id: documentId } = await params;

  const session = await auth();
  if (!session?.user?.keycloakSub)
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const user = await resolveUser(session.user.keycloakSub);
  if (!user)
    return NextResponse.json({ error: "user not found" }, { status: 404 });

  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });
  if (!document)
    return NextResponse.json({ error: "document not found" }, { status: 404 });

  const permissions = await getDocumentPermissions(user.id, document);
  if (!SnapshotPolicy.canList(permissions))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const snapshots = await prisma.snapshot.findMany({
    where: { documentId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      createdBy: { select: { id: true, displayName: true } },
    },
  });

  return NextResponse.json(snapshots);
}

export async function POST(req: Request, { params }: RouteContext) {
  const { id: documentId } = await params;

  const session = await auth();
  if (!session?.user?.keycloakSub)
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const user = await resolveUser(session.user.keycloakSub);
  if (!user)
    return NextResponse.json({ error: "user not found" }, { status: 404 });

  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });
  if (!document)
    return NextResponse.json({ error: "document not found" }, { status: 404 });

  const permissions = await getDocumentPermissions(user.id, document);
  if (!SnapshotPolicy.canCreate(permissions))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );

  const snapshot = await prisma.snapshot.create({
    data: {
      documentId,
      name: parsed.data.name,
      description: parsed.data.description,
      createdById: user.id,
      lexicalState: parsed.data.lexicalState,
    },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      createdBy: { select: { id: true, displayName: true } },
    },
  });

  return NextResponse.json(snapshot, { status: 201 });
}
