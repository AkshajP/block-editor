import { auth } from "@block-editor/auth";
import { DocumentPolicy, getDocumentPermissions } from "@block-editor/authz";
import { prisma } from "@block-editor/db";
import { createHmac } from "crypto";
import { NextResponse } from "next/server";

function signPayload(payload: string): string {
  const secret =
    process.env.WS_SECRET ??
    process.env.AUTH_SECRET ??
    "dev-ws-secret";
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: documentId } = await params;

  const session = await auth();
  if (!session?.user?.keycloakSub)
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { keycloakSub: session.user.keycloakSub },
  });
  if (!user)
    return NextResponse.json({ error: "user not found" }, { status: 404 });

  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document)
    return NextResponse.json({ error: "document not found" }, { status: 404 });

  const permissions = await getDocumentPermissions(user.id, document);
  if (!DocumentPolicy.canRead(permissions))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // Token valid for 10 minutes — long enough for initial connect + reconnects
  const exp = Date.now() + 10 * 60 * 1000;
  const payload = `${documentId}:${user.id}:${exp}`;
  const signature = signPayload(payload);
  const token = `${Buffer.from(payload).toString("base64url")}.${signature}`;

  return NextResponse.json({ token });
}
