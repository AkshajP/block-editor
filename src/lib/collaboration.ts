import type { CreateEditorArgs } from "lexical";
import { $createParagraphNode, $getRoot, createEditor } from "lexical";
import { Doc } from "yjs";

/**
 * Creates a headless Lexical editor for bootstrapping a Yjs document
 * This is used to initialize collaborative content on the server-side
 */
export function withHeadlessCollaborationEditor(
  nodes: CreateEditorArgs["nodes"],
  callback: (editor: ReturnType<typeof createEditor>) => Doc,
): Doc {
  const editor = createEditor({
    nodes,
    editorState: undefined,
    theme: {},
  });

  let yDoc!: Doc;

  editor.update(
    () => {
      // Initialize with empty paragraph
      $getRoot().append($createParagraphNode());
    },
    { discrete: true },
  );

  yDoc = editor._editorState ? callback(editor) : new Doc();

  return yDoc;
}

/**
 * Helper to create a bootstrapped Y.Doc for development/testing
 * In production, should bootstrap on the server instead
 */
export function createBootstrappedYDoc(nodes: CreateEditorArgs["nodes"]): Doc {
  return withHeadlessCollaborationEditor(nodes, () => new Doc());
}

/**
 * Configuration for the WebSocket server connection
 */
export const WS_SERVER_CONFIG = {
  host: process.env.NEXT_PUBLIC_WS_HOST || "localhost",
  port: process.env.NEXT_PUBLIC_WS_PORT || "1234",
};

export const getWebSocketUrl = (): string => {
  const host = WS_SERVER_CONFIG.host;
  const port = WS_SERVER_CONFIG.port;
  const protocol =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "wss"
      : "ws";
  return `${protocol}://${host}:${port}`;
};
