import { auth } from "@block-editor/auth";
import { DocumentPolicy, getDocumentPermissions } from "@block-editor/authz";
import { prisma } from "@block-editor/db";
import { notFound, redirect } from "next/navigation";

import EditorPage from "@/components/EditorPage";

export default async function DocumentPage({
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

  const document = await prisma.document.findUnique({ where: { id } });
  if (!document) notFound();

  const permissions = await getDocumentPermissions(user.id, document);
  if (!DocumentPolicy.canRead(permissions)) notFound();

  const canWrite = DocumentPolicy.canWrite(permissions, document);
  const canRename = DocumentPolicy.canRename(user, permissions, document);
  const canPublish = DocumentPolicy.canPublish(user, permissions, document);
  const canChangeVisibility = DocumentPolicy.canChangeVisibility(user, permissions, document);
  const canShare = DocumentPolicy.canShare(user, permissions, document);

  return (
    <EditorPage
      documentId={id}
      workspaceId={document.workspaceId}
      title={document.title}
      initialStatus={document.status}
      initialIsPublic={document.isPublic}
      canWrite={canWrite}
      canRename={canRename}
      canPublish={canPublish}
      canChangeVisibility={canChangeVisibility}
      canShare={canShare}
      userName={user.displayName}
    />
  );
}
