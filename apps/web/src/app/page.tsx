import { auth } from "@block-editor/auth";
import { prisma } from "@block-editor/db";
import { redirect } from "next/navigation";

import DashboardClient from "@/components/DashboardClient";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.keycloakSub) redirect("/api/auth/signin");

  const user = await prisma.user.findUnique({
    where: { keycloakSub: session.user.keycloakSub },
  });
  if (!user) redirect("/api/auth/signin");

  const workspaceMemberships = await prisma.workspaceMember.findMany({
    where: { userId: user.id, isActive: true },
    select: { workspaceId: true },
  });
  const workspaceIds = workspaceMemberships.map((m) => m.workspaceId);

  const docs = await prisma.document.findMany({
    where: {
      OR: [
        { createdById: user.id },
        {
          members: { some: { userId: user.id } },
          blocklist: { none: { blockedUserId: user.id } },
        },
        {
          workspaceId: { in: workspaceIds },
          status: "PUBLISHED",
          isPublic: true,
          blocklist: { none: { blockedUserId: user.id } },
        },
      ],
    },
    include: { createdBy: { select: { displayName: true } } },
    orderBy: { updatedAt: "desc" },
  });

  const documents = docs.map((doc) => ({
    id: doc.id,
    title: doc.title,
    status: doc.status as string,
    updatedAt: doc.updatedAt.toISOString(),
    createdByName: doc.createdBy.displayName,
  }));

  return (
    <DashboardClient
      user={{ displayName: user.displayName, email: user.email }}
      documents={documents}
    />
  );
}
