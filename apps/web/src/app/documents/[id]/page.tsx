import { auth } from "@block-editor/auth";
import { DocumentPolicy, getDocumentPermissions } from "@block-editor/authz";
import { prisma } from "@block-editor/db";
import type { TemplateSchema } from "@block-editor/template-schema";
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

  // Fetch the document's template (or fall back to the workspace system template).
  // Fetched server-side so LexicalComposer receives the node list before mount.
  let templateSchema: TemplateSchema | null = null;
  if (document.templateId) {
    const tpl = await prisma.template.findUnique({ where: { id: document.templateId } });
    templateSchema = tpl ? (tpl.schema as unknown as TemplateSchema) : null;
  } else {
    const sysTpl = await prisma.template.findFirst({
      where: { workspaceId: document.workspaceId, isSystem: true },
      orderBy: { createdAt: "asc" },
    });
    templateSchema = sysTpl ? (sysTpl.schema as TemplateSchema) : null;
  }

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
      templateSchema={templateSchema}
      canWrite={canWrite}
      canRename={canRename}
      canPublish={canPublish}
      canChangeVisibility={canChangeVisibility}
      canShare={canShare}
      userName={user.displayName}
    />
  );
}
