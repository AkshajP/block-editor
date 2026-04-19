import { auth } from "@block-editor/auth";
import { prisma } from "@block-editor/db";
import { redirect } from "next/navigation";

import TemplatesPageClient from "@/components/TemplatesPageClient";

export default async function TemplatesPage() {
  const session = await auth();
  if (!session?.user?.keycloakSub) redirect("/api/auth/signin");

  const user = await prisma.user.findUnique({
    where: { keycloakSub: session.user.keycloakSub },
  });
  if (!user) redirect("/api/auth/signin");

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: user.id, isActive: true },
  });
  if (!membership) redirect("/");

  const templates = await prisma.template.findMany({
    where: { workspaceId: membership.workspaceId },
    select: {
      id: true,
      name: true,
      description: true,
      isSystem: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { variables: true } },
    },
    orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }],
  });

  return (
    <TemplatesPageClient
      user={{ displayName: user.displayName, email: user.email }}
      templates={templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description ?? undefined,
        isSystem: t.isSystem,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        variableCount: t._count.variables,
      }))}
    />
  );
}
