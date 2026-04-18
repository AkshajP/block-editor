import { auth } from "@block-editor/auth";
import { TemplatePolicy, getUserWorkspacePermissions } from "@block-editor/authz";
import { prisma } from "@block-editor/db";
import { NextResponse } from "next/server";
import type { TemplateSchema } from "@block-editor/template-schema";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.keycloakSub)
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { keycloakSub: session.user.keycloakSub },
  });
  if (!user)
    return NextResponse.json({ error: "user not found" }, { status: 404 });

  const template = await prisma.template.findUnique({
    where: { id },
    include: { variables: true },
  });
  if (!template)
    return NextResponse.json({ error: "not found" }, { status: 404 });

  // User must be a member of the template's workspace to read it.
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: user.id, workspaceId: template.workspaceId, isActive: true },
  });
  if (!membership)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  return NextResponse.json({
    id: template.id,
    name: template.name,
    description: template.description,
    isSystem: template.isSystem,
    schema: template.schema,
    variables: template.variables,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.keycloakSub)
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { keycloakSub: session.user.keycloakSub },
  });
  if (!user)
    return NextResponse.json({ error: "user not found" }, { status: 404 });

  const template = await prisma.template.findUnique({ where: { id } });
  if (!template)
    return NextResponse.json({ error: "not found" }, { status: 404 });

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: user.id, workspaceId: template.workspaceId, isActive: true },
  });
  if (!membership)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const permissions = await getUserWorkspacePermissions(user.id, template.workspaceId);
  if (!TemplatePolicy.canEdit(user, permissions, template))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await request.json();
  const data: { name?: string; description?: string; schema?: object } = {};

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
    data.name = name;
  }

  if ("description" in body) {
    data.description = typeof body.description === "string" ? body.description : undefined;
  }

  if (body.schema) {
    const schema = body.schema as TemplateSchema;
    if (schema.version !== 1)
      return NextResponse.json({ error: "schema must have version: 1" }, { status: 400 });
    data.schema = schema as object;
  }

  const updated = await prisma.template.update({ where: { id }, data });
  return NextResponse.json({ id: updated.id, name: updated.name });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.keycloakSub)
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { keycloakSub: session.user.keycloakSub },
  });
  if (!user)
    return NextResponse.json({ error: "user not found" }, { status: 404 });

  const template = await prisma.template.findUnique({ where: { id } });
  if (!template)
    return NextResponse.json({ error: "not found" }, { status: 404 });

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: user.id, workspaceId: template.workspaceId, isActive: true },
  });
  if (!membership)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const permissions = await getUserWorkspacePermissions(user.id, template.workspaceId);
  if (!TemplatePolicy.canDelete(user, permissions, template))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  await prisma.template.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
