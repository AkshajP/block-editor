import type { CreateEditorArgs } from "lexical";
import { $createParagraphNode, $getRoot, createEditor } from "lexical";
import { Awareness } from "y-protocols/awareness";
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

  editor.update(
    () => {
      // Initialize with empty paragraph
      $getRoot().append($createParagraphNode());
    },
    { discrete: true },
  );

  const yDoc = editor._editorState ? callback(editor) : new Doc();

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

/**
 * User awareness state for multi-cursor support
 */
export interface UserAwareness {
  clientID: number;
  user: {
    name: string;
    color: string;
  };
  cursor?: {
    anchor: number;
    head: number;
  };
  selection?: {
    anchorKey: string;
    anchorOffset: number;
    focusKey: string;
    focusOffset: number;
  };
  lastUpdate: number;
}

/**
 * Cursor color palette for different users
 */
export const CURSOR_COLORS = [
  "#FF6B6B", // Red
  "#4ECDC4", // Teal
  "#FFE66D", // Yellow
  "#95E1D3", // Mint
  "#C7CEEA", // Lavender
  "#F38181", // Pink
  "#AA96DA", // Purple
  "#FCBAD3", // Light Pink
  "#A8E6CF", // Light Green
  "#FFD3B6", // Peach
];

/**
 * Generate a random color from the palette for a user
 */
export const getRandomCursorColor = (clientID: number): string => {
  return CURSOR_COLORS[clientID % CURSOR_COLORS.length];
};

/**
 * Generate a random user name for anonymous users
 */
export const generateRandomUserName = (): string => {
  const adjectives = [
    "Swift",
    "Bright",
    "Clever",
    "Bold",
    "Quick",
    "Smart",
    "Keen",
  ];
  const animals = [
    "Panda",
    "Eagle",
    "Tiger",
    "Fox",
    "Wolf",
    "Bear",
    "Lion",
    "Otter",
  ];

  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];

  return `${adj} ${animal}`;
};

/**
 * Initialize awareness for a Yjs document or Awareness object
 */
export const initializeAwareness = (
  docOrAwareness: Doc | Awareness,
): {
  awareness: Awareness;
  clientID: number;
  updateLocalState: (state: Partial<UserAwareness>) => void;
} => {
  // Get awareness from either a Doc or Awareness object
  let awareness: Awareness;
  if ("clientID" in docOrAwareness) {
    // It's already an Awareness object
    awareness = docOrAwareness as Awareness;
  } else {
    // It's a Doc, extract awareness
    awareness = (
      docOrAwareness as unknown as { getAwareness(): Awareness }
    ).getAwareness();
  }
  const clientID = awareness.clientID;

  const userName = generateRandomUserName();
  const color = getRandomCursorColor(clientID);

  const updateLocalState = (state: Partial<UserAwareness>) => {
    awareness.setLocalState({
      clientID,
      user: { name: userName, color },
      lastUpdate: Date.now(),
      ...state,
    } as UserAwareness);
  };

  // Set initial state
  updateLocalState({});

  return { awareness, clientID, updateLocalState };
};
