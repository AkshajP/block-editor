import { auth } from "@block-editor/auth";
import { prisma } from "@block-editor/db";
import { NextResponse } from "next/server";

// Returns system roles (non-Admin) available for document membership
export async function GET() {
  const session = await auth();
  if (!session?.user?.keycloakSub)
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const roles = await prisma.role.findMany({
    where: { isSystem: true, name: { not: "Admin" } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(roles);
}
