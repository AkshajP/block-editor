"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { createDOMRange, createRectsFromDOMRange } from "@lexical/selection";
import {
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
  SELECTION_CHANGE_COMMAND,
} from "lexical";
import { useCallback, useEffect, useRef, useState } from "react";
import { Awareness } from "y-protocols/awareness";

import { useAwarenessContext } from "@/components/AwarenessContext";
import { initializeAwareness, type UserAwareness } from "@/lib/collaboration";

function useDebouncedCallback<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });
  return useCallback(
    (...args: Parameters<T>) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => fnRef.current(...args), delay);
    },
    [delay],
  );
}

interface SelectionRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface RemoteCursor {
  clientID: number;
  name: string;
  color: string;
  /** Position of the caret (focus end of selection) */
  caretPosition: { top: number; left: number; height: number };
  /** All rects covered by the selection — empty when collapsed */
  selectionRects: SelectionRect[];
}

/**
 * MultiCursorPlugin renders live cursors and selection highlights for remote users.
 * Position logic mirrors @lexical/yjs: uses createDOMRange + createRectsFromDOMRange
 * from @lexical/selection, offset against the cursor overlay's offsetParent.
 */
export default function MultiCursorPlugin({ userName }: { userName?: string }) {
  const [editor] = useLexicalComposerContext();
  const { awareness: sharedAwareness } = useAwarenessContext();

  const [remoteCursors, setRemoteCursors] = useState<Map<number, RemoteCursor>>(
    new Map(),
  );

  const cursorOverlayRef = useRef<HTMLDivElement>(null);
  const updateLocalStateRef = useRef<
    ((state: Partial<UserAwareness>) => void) | null
  >(null);
  const awarenessRef = useRef<Awareness | null>(null);

  useEffect(() => {
    if (!sharedAwareness) return;
    awarenessRef.current = sharedAwareness;
    const { updateLocalState } = initializeAwareness(sharedAwareness, userName);
    updateLocalStateRef.current = updateLocalState;
  }, [sharedAwareness, userName]);

  const broadcastSelectionUpdate = useDebouncedCallback(
    useCallback((selection: ReturnType<typeof $getSelection>) => {
      if (!$isRangeSelection(selection)) return;
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
    }, []),
    300,
  );

  useEffect(() => {
    if (!awarenessRef.current || !updateLocalStateRef.current) return;

    const unsubscribe = editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        editor.getEditorState().read(() => {
          broadcastSelectionUpdate($getSelection());
        });
        return false;
      },
      COMMAND_PRIORITY_EDITOR,
    );

    return () => unsubscribe();
  }, [editor, sharedAwareness, broadcastSelectionUpdate]);

  /**
   * Returns the caret position (at the focus/last rect) and all selection rects,
   * all offset against cursorOverlay.offsetParent — matching Lexical's own approach.
   */
  const calculateCursorData = (
    selectionData: Record<string, unknown>,
  ): Pick<RemoteCursor, "caretPosition" | "selectionRects"> | null => {
    const overlay = cursorOverlayRef.current;
    if (!overlay || !selectionData) return null;

    const { anchorKey, anchorOffset, focusKey, focusOffset } = selectionData as {
      anchorKey: string;
      anchorOffset: number;
      focusKey: string;
      focusOffset: number;
    };
    if (!anchorKey || !focusKey) {
      console.log("[cursor] missing anchorKey/focusKey", selectionData);
      return null;
    }

    try {
      return editor.getEditorState().read(() => {
        const anchorNode = $getNodeByKey(anchorKey);
        const focusNode = $getNodeByKey(focusKey);
        if (!anchorNode || !focusNode) {
          console.log("[cursor] node not found in editor state", { anchorKey, focusKey });
          return null;
        }

        const range = createDOMRange(editor, anchorNode, anchorOffset, focusNode, focusOffset);
        if (!range) {
          console.log("[cursor] createDOMRange returned null");
          return null;
        }

        const domRects = createRectsFromDOMRange(editor, range);
        if (!domRects.length) {
          console.log("[cursor] createRectsFromDOMRange returned no rects");
          return null;
        }

        const offsetParent = overlay.offsetParent;
        if (!offsetParent) {
          console.log("[cursor] overlay has no offsetParent");
          return null;
        }
        const containerRect = offsetParent.getBoundingClientRect();

        const selectionRects: SelectionRect[] = domRects.map((r) => ({
          top: r.top - containerRect.top,
          left: r.left - containerRect.left,
          width: r.width,
          height: r.height,
        }));

        const lastRect = selectionRects[selectionRects.length - 1];
        const caretPosition = {
          top: lastRect.top,
          left: lastRect.left + lastRect.width,
          height: lastRect.height,
        };

        const isCollapsed =
          anchorKey === focusKey && anchorOffset === focusOffset;

        console.log("[cursor] calculated", { caretPosition, selectionRects, isCollapsed });

        return {
          caretPosition,
          selectionRects: isCollapsed ? [] : selectionRects,
        };
      });
    } catch (err) {
      console.error("[cursor] error", err);
      return null;
    }
  };

  useEffect(() => {
    if (!awarenessRef.current || !sharedAwareness) return;

    const awareness = awarenessRef.current;

    const handleAwarenessChange = () => {
      const states = awareness.getStates();
      const localClientID = awareness.clientID;
      console.log("[cursor] awareness change — states:", states.size, "local:", localClientID);

      setRemoteCursors((prev) => {
        const next = new Map<number, RemoteCursor>();

        states.forEach((state: Record<string, unknown>, clientID: number) => {
          if (clientID === localClientID) return;
          console.log("[cursor] remote client", clientID, "state:", state);

          const userState =
            (state.user as { name?: string; color?: string } | undefined) ??
            (state.name
              ? { name: state.name as string, color: state.color as string }
              : undefined);
          const selectionState = state.selection as Record<string, unknown> | undefined;

          if (!userState) {
            console.log("[cursor] client", clientID, "has no user state — skipping");
            return;
          }

          const cursorData = selectionState ? calculateCursorData(selectionState) : null;
          const prevCursor = prev.get(clientID);
          const resolvedData = cursorData ?? (prevCursor
            ? { caretPosition: prevCursor.caretPosition, selectionRects: prevCursor.selectionRects }
            : null);

          if (!resolvedData) return;

          next.set(clientID, {
            clientID,
            name: userState.name ?? "Unknown",
            color: userState.color ?? "#999",
            ...resolvedData,
          });
        });

        return next;
      });
    };

    handleAwarenessChange();
    awareness.on("change", handleAwarenessChange);
    const removeUpdateListener = editor.registerUpdateListener(handleAwarenessChange);

    return () => {
      awareness.off("change", handleAwarenessChange);
      removeUpdateListener();
    };
  }, [sharedAwareness, editor]);

  return (
    <div
      ref={cursorOverlayRef}
      className="pointer-events-none absolute inset-0 z-50 overflow-visible"
    >
      {Array.from(remoteCursors.values()).map((cursor) => (
        <div key={cursor.clientID}>
          {/* Selection highlight rects */}
          {cursor.selectionRects.map((rect, i) => (
            <div
              key={i}
              className="absolute"
              style={{
                top: `${rect.top}px`,
                left: `${rect.left}px`,
                width: `${rect.width}px`,
                height: `${rect.height}px`,
                backgroundColor: cursor.color,
                opacity: 0.2,
                zIndex: 40,
              }}
            />
          ))}

          {/* Caret line + name label */}
          <div
            className="absolute"
            style={{
              top: `${cursor.caretPosition.top}px`,
              left: `${cursor.caretPosition.left}px`,
              transform: "translateX(-1px)",
            }}
          >
            <div
              style={{
                width: "2px",
                height: `${cursor.caretPosition.height}px`,
                backgroundColor: cursor.color,
                opacity: 0.9,
              }}
            />
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
        </div>
      ))}
    </div>
  );
}
