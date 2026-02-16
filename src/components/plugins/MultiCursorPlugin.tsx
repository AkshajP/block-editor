"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
  SELECTION_CHANGE_COMMAND,
} from "lexical";
import { useEffect, useRef, useState } from "react";
import { Awareness } from "y-protocols/awareness";

import { useAwarenessContext } from "@/components/AwarenessContext";
import { initializeAwareness, type UserAwareness } from "@/lib/collaboration";

interface RemoteCursor {
  clientID: number;
  name: string;
  color: string;
  position: { top: number; left: number };
  selection?: { top: number; left: number; width: number; height: number };
}

/**
 * MultiCursorPlugin renders live cursors for all connected users
 * Uses Yjs Awareness to track cursor positions and selections
 */
export default function MultiCursorPlugin() {
  const [editor] = useLexicalComposerContext();
  const { awareness: sharedAwareness } = useAwarenessContext();

  const [remoteCursors, setRemoteCursors] = useState<Map<number, RemoteCursor>>(
    new Map(),
  );
  const editorRootRef = useRef<HTMLElement | null>(null);
  const updateLocalStateRef = useRef<
    ((state: Partial<UserAwareness>) => void) | null
  >(null);
  const awarenessRef = useRef<Awareness | null>(null);

  // Get editor root element
  useEffect(() => {
    editorRootRef.current = editor.getRootElement();
  }, [editor]);

  // Initialize awareness tracking
  useEffect(() => {
    if (!sharedAwareness) return;

    awarenessRef.current = sharedAwareness;
    const { updateLocalState } = initializeAwareness(sharedAwareness);
    updateLocalStateRef.current = updateLocalState;
  }, [sharedAwareness]);

  // Track local selection changes and broadcast to awareness
  useEffect(() => {
    if (!awarenessRef.current || !updateLocalStateRef.current) return;

    const unsubscribe = editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        editor.getEditorState().read(() => {
          const selection = $getSelection();

          if ($isRangeSelection(selection)) {
            const anchorNode = selection.anchor.getNode();
            const focusNode = selection.focus.getNode();

            // Store selection information with node keys for recreation
            updateLocalStateRef.current?.({
              cursor: {
                anchor: selection.anchor.offset,
                head: selection.focus.offset,
              },
              selection: {
                anchorKey: selection.anchor.key,
                anchorOffset: selection.anchor.offset,
                focusKey: selection.focus.key,
                focusOffset: selection.focus.offset,
              },
            });
          }
        });

        return false;
      },
      COMMAND_PRIORITY_EDITOR,
    );

    return () => {
      unsubscribe();
    };
  }, [editor]);

  // Calculate cursor position from selection data
  const calculateCursorPosition = (
    selectionData: any,
  ): { top: number; left: number } | null => {
    if (!editorRootRef.current || !selectionData) return null;

    try {
      return editor.getEditorState().read(() => {
        const { focusKey, focusOffset } = selectionData;

        if (!focusKey) return null;

        const node = $getNodeByKey(focusKey);
        if (!node) return null;

        // Get the DOM node
        const domNode = editor.getElementByKey(focusKey);
        if (!domNode) return null;

        // Create a range to get cursor position
        const range = document.createRange();
        const textNode = domNode.firstChild || domNode;

        if (textNode.nodeType === Node.TEXT_NODE && textNode.textContent) {
          const offset = Math.min(focusOffset, textNode.textContent.length);
          range.setStart(textNode, offset);
          range.setEnd(textNode, offset);
        } else {
          range.selectNode(domNode);
        }

        const rect = range.getBoundingClientRect();

        return {
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
        };
      });
    } catch (error) {
      console.error("Error calculating cursor position:", error);
      return null;
    }
  };

  // Listen for awareness updates from other users
  useEffect(() => {
    if (!awarenessRef.current || !sharedAwareness) return;

    const awareness = awarenessRef.current;

    const handleAwarenessChange = () => {
      const newRemoteCursors = new Map<number, RemoteCursor>();
      const states = awareness.getStates();
      const localClientID = awareness.clientID;

      states.forEach((state: any, clientID: number) => {
        // Skip local user
        if (clientID === localClientID) return;

        const userState = state.user;
        const selectionState = state.selection;

        if (userState && selectionState) {
          // Calculate cursor position from selection data
          const position = calculateCursorPosition(selectionState);

          if (position) {
            newRemoteCursors.set(clientID, {
              clientID,
              name: userState.name || "Unknown",
              color: userState.color || "#999",
              position,
            });
          }
        }
      });

      setRemoteCursors(newRemoteCursors);
    };

    // Initial update
    handleAwarenessChange();

    // Listen for changes
    awareness.on("change", handleAwarenessChange);

    // Also update on editor changes to recalculate positions
    const removeUpdateListener = editor.registerUpdateListener(() => {
      handleAwarenessChange();
    });

    return () => {
      awareness.off("change", handleAwarenessChange);
      removeUpdateListener();
    };
  }, [sharedAwareness, editor]);

  return (
    <div className="pointer-events-none absolute inset-0 z-50 overflow-visible">
      {Array.from(remoteCursors.values()).map((cursor) => (
        <div
          key={cursor.clientID}
          className="absolute"
          style={{
            top: `${cursor.position.top}px`,
            left: `${cursor.position.left}px`,
            transform: "translateX(-1px)",
          }}
        >
          {/* Cursor line */}
          <div
            className="w-0.5 h-5 animate-pulse"
            style={{
              backgroundColor: cursor.color,
              opacity: 0.9,
            }}
          />

          {/* User label */}
          <div
            className="absolute flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-white whitespace-nowrap"
            style={{
              backgroundColor: cursor.color,
              top: "-28px",
              left: "0px",
            }}
          >
            <span className="w-2 h-2 rounded-full bg-white" />
            {cursor.name}
          </div>
        </div>
      ))}
    </div>
  );
}
