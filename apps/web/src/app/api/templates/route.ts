import { auth } from "@block-editor/auth";
import { TemplatePolicy, getUserWorkspacePermissions } from "@block-editor/authz";
import { prisma } from "@block-editor/db";
import { NextResponse } from "next/server";
import type { TemplateSchema } from "@block-editor/template-schema";

export async function GET() {
  const session = await auth();
  if (!session?.user?.keycloakSub)
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { keycloakSub: session.user.keycloakSub },
  });
  if (!user)
    return NextResponse.json({ error: "user not found" }, { status: 404 });

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: user.id, isActive: true },
  });
  if (!membership)
    return NextResponse.json({ error: "no workspace membership" }, { status: 403 });

  const templates = await prisma.template.findMany({
    where: { workspaceId: membership.workspaceId },
    select: {
      id: true,
      name: true,
      description: true,
      isSystem: true,
      createdById: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(templates);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.keycloakSub)
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { keycloakSub: session.user.keycloakSub },
  });
  if (!user)
    return NextResponse.json({ error: "user not found" }, { status: 404 });

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: user.id, isActive: true },
  });
  if (!membership)
    return NextResponse.json({ error: "no workspace membership" }, { status: 403 });

  const permissions = await getUserWorkspacePermissions(user.id, membership.workspaceId);
  if (!TemplatePolicy.canCreate(permissions))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await request.json();

  const name = typeof body.name === "string" ? body.name.trim() : null;
  if (!name)
    return NextResponse.json({ error: "name is required" }, { status: 400 });

  const schema = body.schema as TemplateSchema | undefined;
  if (!schema || schema.version !== 1)
    return NextResponse.json(
      { error: "schema is required and must have version: 1" },
      { status: 400 },
    );

  const template = await prisma.template.create({
    data: {
      name,
      description: typeof body.description === "string" ? body.description : undefined,
      schema: schema as object,
      workspaceId: membership.workspaceId,
      createdById: user.id,
      isSystem: false,
    },
  });

  return NextResponse.json(
    { id: template.id, name: template.name },
    { status: 201 },
  );
}
