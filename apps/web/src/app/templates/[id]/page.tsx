import { auth } from "@block-editor/auth";
import { TemplatePolicy, getUserWorkspacePermissions } from "@block-editor/authz";
import { prisma } from "@block-editor/db";
import type { TemplateSchema } from "@block-editor/template-schema";
import { notFound, redirect } from "next/navigation";

import TemplateBuilderClient from "@/components/TemplateBuilderClient";

export default async function TemplateBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.keycloakSub) redirect("/api/auth/signin");

  const user = await prisma.user.findUnique({
    where: { keycloakSub: session.user.keycloakSub },
  });
  if (!user) redirect("/api/auth/signin");

  const template = await prisma.template.findUnique({ where: { id } });
  if (!template) notFound();

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: user.id, workspaceId: template.workspaceId, isActive: true },
  });
  if (!membership) notFound();

  const permissions = await getUserWorkspacePermissions(user.id, template.workspaceId);
  const canEdit = TemplatePolicy.canEdit(user, permissions, template);

  return (
    <TemplateBuilderClient
      templateId={id}
      initialName={template.name}
      initialDescription={template.description ?? ""}
      initialSchema={template.schema as unknown as TemplateSchema}
      isSystem={template.isSystem}
      canEdit={canEdit}
    />
  );
}
