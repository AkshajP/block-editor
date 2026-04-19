"use client";

import { ListItemNode, ListNode } from "@lexical/list";
import { LexicalCollaboration } from "@lexical/react/LexicalCollaborationContext";
import { CollaborationPlugin } from "@lexical/react/LexicalCollaborationPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { HeadingNode } from "@lexical/rich-text";
import type { Klass, LexicalNode } from "lexical";
import { useCallback, useEffect, useRef, useState } from "react";
import { Awareness } from "y-protocols/awareness";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";

import { TemplateProvider } from "@block-editor/template-engine";
import type { TemplateSchema } from "@block-editor/template-schema";

import { getWebSocketUrl } from "@/lib/collaboration";

import { AwarenessProvider } from "./AwarenessContext";
import { ConstructBadgeNode } from "./nodes/ConstructBadgeNode";
import MultiCursorPlugin from "./plugins/MultiCursorPlugin";
import SlashMenuPlugin from "./plugins/SlashMenuPlugin";
import SnapshotPanel from "./SnapshotPanel";
import UserPresence from "./UserPresence";

// ─── Lexical node class map ───────────────────────────────────────────────────
// Maps construct lexicalNodeTypes strings → Lexical node classes.
// Extend this when new node types (ImageNode, etc.) are added.

const NODE_CLASS_MAP: Record<string, Klass<LexicalNode>> = {
  heading: HeadingNode,
  list: ListNode,
  listitem: ListItemNode,
  // ImageNode: add here when implemented
};

// paragraph, text, root are always built-in — no registration needed.
const ALWAYS_NODES: Klass<LexicalNode>[] = [ConstructBadgeNode];

function getLexicalNodes(schema: TemplateSchema | null): Klass<LexicalNode>[] {
  if (!schema) {
    // No template — register all known node classes as a safe fallback.
    return Object.values(NODE_CLASS_MAP);
  }

  const needed = new Set<string>();
  for (const ref of schema.constructs) {
    // For inline custom constructs (ref.definition), use those node types too.
    const nodeTypes = ref.definition?.lexicalNodeTypes ?? [];
    nodeTypes.forEach((t: string) => needed.add(t));

    // Built-in construct node types come from the registry inside TemplateProvider,
    // but we also resolve them here by matching the known IDs to their node types.
    // This avoids importing the full registry into this file.
    const knownTypes = builtInNodeTypesForConstructId(ref.id);
    knownTypes.forEach((t: string) => needed.add(t));
  }

  return [...needed]
    .map((t) => NODE_CLASS_MAP[t])
    .filter((cls): cls is Klass<LexicalNode> => cls !== undefined);
}

// Maps built-in construct IDs → their lexicalNodeTypes without importing the
// full registry (keeps this module free of template-engine at runtime for
// constructs that don't need any extra nodes).
const BUILTIN_NODE_TYPES: Record<string, string[]> = {
  "paragraph": [],           // ParagraphNode is always built-in
  "heading-1": ["heading"],
  "heading-2": ["heading"],
  "heading-3": ["heading"],
  "heading-4": ["heading"],
  "heading-5": ["heading"],
  "heading-6": ["heading"],
  "bullet-list": ["list", "listitem"],
  "numbered-list": ["list", "listitem"],
};

function builtInNodeTypesForConstructId(id: string): string[] {
  return BUILTIN_NODE_TYPES[id] ?? [];
}

// Returns true when the template requires list nodes — used to conditionally
// mount ListPlugin. If no template, assume lists are needed (safe fallback).
function templateRequiresLists(schema: TemplateSchema | null): boolean {
  if (!schema) return true;
  return schema.constructs.some((ref) => {
    const types = ref.definition?.lexicalNodeTypes ?? builtInNodeTypesForConstructId(ref.id);
    return types.includes("list");
  });
}

// ─── Editor theme ─────────────────────────────────────────────────────────────
// Visual appearance in the editor (Tailwind classes). Separate from the PDF
// config in ConstructDefinition — editor styling is always Tailwind-based.

const theme = {
  paragraph: "mb-2 text-gray-800",
  heading: {
    h1: "text-3xl font-bold mb-4 text-gray-900",
    h2: "text-2xl font-bold mb-3 text-gray-900",
    h3: "text-xl font-semibold mb-3 text-gray-900",
    h4: "text-lg font-semibold mb-2 text-gray-800",
    h5: "text-base font-semibold mb-2 text-gray-800",
    h6: "text-sm font-semibold mb-2 text-gray-700",
  },
  list: {
    ul: "list-disc list-outside ml-6 mb-2",
    ol: "list-decimal list-outside ml-6 mb-2",
    listitem: "mb-1",
  },
};

// ─── Props ────────────────────────────────────────────────────────────────────

export interface EditorProps {
  documentId: string;
  canWrite: boolean;
  userName: string;
  showSnapshots?: boolean;
  templateSchema: TemplateSchema | null;
}

// ─── Outer shell: ws-token gate ───────────────────────────────────────────────

export default function Editor({
  documentId,
  canWrite,
  userName,
  showSnapshots = false,
  templateSchema,
}: EditorProps) {
  const [wsToken, setWsToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState(false);

  useEffect(() => {
    fetch(`/api/documents/${documentId}/ws-token`)
      .then((res) => {
        if (!res.ok) throw new Error("forbidden");
        return res.json();
      })
      .then((data) => setWsToken(data.token))
      .catch(() => setTokenError(true));
  }, [documentId]);

  if (tokenError) {
    return (
      <div className="text-center py-10 text-slate-500">
        You do not have permission to access this document.
      </div>
    );
  }

  if (!wsToken) {
    return (
      <div className="text-center py-10 text-slate-400 text-sm">
        Connecting…
      </div>
    );
  }

  return (
    <EditorInner
      documentId={documentId}
      canWrite={canWrite}
      userName={userName}
      wsToken={wsToken}
      showSnapshots={showSnapshots}
      templateSchema={templateSchema}
    />
  );
}

// ─── Inner: LexicalComposer + plugins ────────────────────────────────────────

interface EditorInnerProps {
  documentId: string;
  canWrite: boolean;
  userName: string;
  wsToken: string;
  showSnapshots: boolean;
  templateSchema: TemplateSchema | null;
}

function EditorInner({
  documentId,
  canWrite,
  userName,
  wsToken,
  showSnapshots,
  templateSchema,
}: EditorInnerProps) {
  const [currentAwareness, setCurrentAwareness] = useState<Awareness | null>(null);
  const hiddenCursorsRef = useRef<HTMLDivElement>(null);

  const initialConfig = {
    // NOTE: Critical for collaboration — editorState null lets CollaborationPlugin init content.
    editorState: null,
    namespace: "MyEditor",
    nodes: [...ALWAYS_NODES, ...getLexicalNodes(templateSchema)],
    theme,
    editable: canWrite,
    onError: (error: Error) => console.error(error),
  };

  const getDocFromMap = useCallback(
    (id: string, yjsDocMap: Map<string, Y.Doc>): Y.Doc => {
      let doc = yjsDocMap.get(id);
      if (doc === undefined) {
        doc = new Y.Doc();
        yjsDocMap.set(id, doc);
      } else {
        doc.load();
      }
      return doc;
    },
    [],
  );

  const providerFactory = useCallback(
    (id: string, yjsDocMap: Map<string, Y.Doc>) => {
      const doc = getDocFromMap(id, yjsDocMap);

      const provider = new WebsocketProvider(getWebSocketUrl(), id, doc, {
        connect: true,
        params: { token: wsToken },
      });

      const awareness = (provider as unknown as { awareness: Awareness }).awareness;
      setCurrentAwareness(awareness);

      return provider;
    },
    [getDocFromMap, wsToken],
  );

  return (
    <TemplateProvider schema={templateSchema}>
      <AwarenessProvider awareness={currentAwareness}>
        <LexicalCollaboration>
          <LexicalComposer initialConfig={initialConfig}>
            <div className="flex gap-4 w-full items-start">
              <div className="flex flex-col gap-4 flex-1 min-w-0">
                <UserPresence />
                <div className="max-w-2xl mx-auto w-full p-4 border rounded-lg shadow-sm bg-background min-h-50 relative">
                  <RichTextPlugin
                    contentEditable={
                      <ContentEditable
                        className={`outline-none min-h-37.5 resize-none ${!canWrite ? "cursor-default" : ""}`}
                      />
                    }
                    placeholder={
                      canWrite ? (
                        <div className="absolute top-4 left-4 text-gray-400 pointer-events-none">
                          Type '/' for commands…
                        </div>
                      ) : null
                    }
                    ErrorBoundary={LexicalErrorBoundary}
                  />
                  {canWrite && <SlashMenuPlugin />}
                  {templateRequiresLists(templateSchema) && <ListPlugin />}
                  <HistoryPlugin />
                  <OnChangePlugin onChange={() => {}} />
                  <div ref={hiddenCursorsRef} style={{ display: "none" }} />
                  <CollaborationPlugin
                    id={documentId}
                    // @ts-expect-error: WebsocketProvider is compatible at runtime but types don't match Lexical's ProviderFactory
                    providerFactory={providerFactory}
                    shouldBootstrap={false}
                    cursorsContainerRef={hiddenCursorsRef}
                  />
                  <MultiCursorPlugin userName={userName} />
                </div>
              </div>
              {showSnapshots && (
                <div className="w-72 shrink-0 border rounded-lg bg-background overflow-hidden flex flex-col min-h-100">
                  <SnapshotPanel documentId={documentId} canWrite={canWrite} />
                </div>
              )}
            </div>
          </LexicalComposer>
        </LexicalCollaboration>
      </AwarenessProvider>
    </TemplateProvider>
  );
}
