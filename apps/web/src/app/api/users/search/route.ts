import { auth } from "@block-editor/auth";
import { prisma } from "@block-editor/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.keycloakSub)
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { keycloakSub: session.user.keycloakSub },
  });
  if (!user)
    return NextResponse.json({ error: "user not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const workspaceId = searchParams.get("workspaceId");

  if (!workspaceId)
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });

  // Ensure the requester is a member of the workspace
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
  });
  if (!membership?.isActive)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // Search workspace members by displayName or email (case-insensitive contains)
  const members = await prisma.workspaceMember.findMany({
    where: {
      workspaceId,
      isActive: true,
      user: q
        ? {
            OR: [
              { displayName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
    },
    include: {
      user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
    },
    take: 10,
  });

  return NextResponse.json(
    members
      .map((m) => m.user)
      .filter((u) => u.id !== user.id) // exclude self
  );
}
