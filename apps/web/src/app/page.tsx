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

  const documentMembers = await prisma.documentMember.findMany({
    where: { userId: user.id },
    include: {
      document: {
        include: { createdBy: { select: { displayName: true } } },
      },
    },
    orderBy: { addedAt: "desc" },
  });

  const documents = documentMembers.map((dm) => ({
    id: dm.document.id,
    title: dm.document.title,
    status: dm.document.status as string,
    updatedAt: dm.document.updatedAt.toISOString(),
    createdByName: dm.document.createdBy.displayName,
  }));

  return (
    <DashboardClient
      user={{ displayName: user.displayName, email: user.email }}
      documents={documents}
    />
  );
}
