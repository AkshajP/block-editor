import { auth } from "@block-editor/auth";
import { getDocumentPermissions, SnapshotPolicy } from "@block-editor/authz";
import { prisma } from "@block-editor/db";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

type LexicalNode = {
  type: string;
  children?: LexicalNode[];
  text?: string;
  tag?: string;
  [key: string]: unknown;
};

type LexicalRoot = {
  root: { children: LexicalNode[] };
};

function extractTopLevelNodes(state: unknown): LexicalNode[] {
  const s = state as LexicalRoot;
  return s?.root?.children ?? [];
}

function nodeToText(node: LexicalNode): string {
  if (node.text) return node.text;
  if (node.children) return node.children.map(nodeToText).join("");
  return "";
}

function nodeLabel(node: LexicalNode): string {
  if (node.type === "heading") return `h:${node.tag ?? ""}`;
  return node.type;
}

export type DiffEntry =
  | { kind: "added"; index: number; node: LexicalNode }
  | { kind: "removed"; index: number; node: LexicalNode }
  | { kind: "changed"; index: number; before: LexicalNode; after: LexicalNode };

function diffNodes(before: LexicalNode[], after: LexicalNode[]): DiffEntry[] {
  const results: DiffEntry[] = [];
  const maxLen = Math.max(before.length, after.length);

  for (let i = 0; i < maxLen; i++) {
    const b = before[i];
    const a = after[i];
    if (!b) {
      results.push({ kind: "added", index: i, node: a });
    } else if (!a) {
      results.push({ kind: "removed", index: i, node: b });
    } else {
      const bText = nodeToText(b);
      const aText = nodeToText(a);
      const bLabel = nodeLabel(b);
      const aLabel = nodeLabel(a);
      if (bText !== aText || bLabel !== aLabel) {
        results.push({ kind: "changed", index: i, before: b, after: a });
      }
    }
  }

  return results;
}

export async function GET(req: Request, { params }: RouteContext) {
  const { id: documentId } = await params;
  const url = new URL(req.url);
  const aId = url.searchParams.get("a");
  const bId = url.searchParams.get("b");

  if (!aId || !bId)
    return NextResponse.json(
      { error: "query params a and b are required" },
      { status: 400 },
    );

  const session = await auth();
  if (!session?.user?.keycloakSub)
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { keycloakSub: session.user.keycloakSub },
  });
  if (!user)
    return NextResponse.json({ error: "user not found" }, { status: 404 });

  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });
  if (!document)
    return NextResponse.json({ error: "document not found" }, { status: 404 });

  const permissions = await getDocumentPermissions(user.id, document);
  if (!SnapshotPolicy.canList(permissions))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const [snapshotA, snapshotB] = await Promise.all([
    prisma.snapshot.findFirst({ where: { id: aId, documentId } }),
    prisma.snapshot.findFirst({ where: { id: bId, documentId } }),
  ]);

  if (!snapshotA || !snapshotB)
    return NextResponse.json({ error: "snapshot not found" }, { status: 404 });

  const nodesA = extractTopLevelNodes(snapshotA.lexicalState);
  const nodesB = extractTopLevelNodes(snapshotB.lexicalState);
  const diff = diffNodes(nodesA, nodesB);

  return NextResponse.json({
    a: {
      id: snapshotA.id,
      name: snapshotA.name,
      createdAt: snapshotA.createdAt,
    },
    b: {
      id: snapshotB.id,
      name: snapshotB.name,
      createdAt: snapshotB.createdAt,
    },
    diff,
  });
}
