"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { ListItemNode, ListNode } from "@lexical/list";
import { HeadingNode } from "@lexical/rich-text";
import { EditorState } from "lexical";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { EquationNode } from "@/components/nodes/EquationNode";
import { LayoutContainerNode } from "@/components/nodes/LayoutContainerNode";
import { LayoutItemNode } from "@/components/nodes/LayoutItemNode";

// ─── Page size definitions ────────────────────────────────────────────────────

export type PageSize = "A3" | "A4" | "A5" | "Letter" | "Legal";

const PAGE_DIMENSIONS: Record<PageSize, { widthMm: number; heightMm: number }> =
  {
    A3: { widthMm: 297, heightMm: 420 },
    A4: { widthMm: 210, heightMm: 297 },
    A5: { widthMm: 148, heightMm: 210 },
    Letter: { widthMm: 216, heightMm: 279 },
    Legal: { widthMm: 216, heightMm: 356 },
  };

/** 1 mm ≈ 3.7795 px at 96 dpi */
const MM_TO_PX = 3.7795275591;
function mmToPx(mm: number): number {
  return Math.round(mm * MM_TO_PX);
}

// ─── Shared context ───────────────────────────────────────────────────────────

type PageLayoutContextValue = {
  pageSize: PageSize;
  setPageSize: (size: PageSize) => void;
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  editorState: EditorState | null;
  setEditorState: (state: EditorState) => void;
};

const PageLayoutContext = createContext<PageLayoutContextValue>({
  pageSize: "A4",
  setPageSize: () => {},
  enabled: false,
  setEnabled: () => {},
  editorState: null,
  setEditorState: () => {},
});

export function usePageLayout() {
  return useContext(PageLayoutContext);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function PageLayoutProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [pageSize, setPageSize] = useState<PageSize>("A4");
  const [enabled, setEnabled] = useState(false);
  const [editorState, setEditorState] = useState<EditorState | null>(null);

  return (
    <PageLayoutContext.Provider
      value={{ pageSize, setPageSize, enabled, setEnabled, editorState, setEditorState }}
    >
      {children}
    </PageLayoutContext.Provider>
  );
}

// ─── Lexical plugin (runs inside the main editor) ────────────────────────────
// Captures editor state changes and forwards them to the preview panel.

export function PageLayoutPlugin(): null {
  const [editor] = useLexicalComposerContext();
  const { setEditorState } = usePageLayout();

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      setEditorState(editorState);
    });
  }, [editor, setEditorState]);

  return null;
}

// ─── Toolbar ─────────────────────────────────────────────────────────────────

export function PageLayoutToolbar(): React.JSX.Element {
  const { pageSize, setPageSize, enabled, setEnabled } = usePageLayout();

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setEnabled(!enabled)}
        className={[
          "text-xs px-2 py-1 rounded border transition-colors",
          enabled
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-background text-muted-foreground border-border hover:border-foreground",
        ].join(" ")}
      >
        {enabled ? "Page view on" : "Page view off"}
      </button>

      {enabled && (
        <select
          value={pageSize}
          onChange={(e) => setPageSize(e.target.value as PageSize)}
          className="text-xs px-2 py-1 rounded border border-border bg-background text-foreground"
        >
          {(Object.keys(PAGE_DIMENSIONS) as PageSize[]).map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

// ─── Preview panel (rendered outside the main editor) ────────────────────────

const PANEL_WIDTH_PX = 320; // width of the preview panel in px
const MARGIN_MM = 20;

/** Theme for the read-only preview — mirrors Editor.tsx theme */
const previewTheme = {
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

function ReadOnlyPreview({
  editorState,
  pageSize,
}: {
  editorState: EditorState;
  pageSize: PageSize;
}): React.JSX.Element {
  const { widthMm, heightMm } = PAGE_DIMENSIONS[pageSize];
  const pagePx = mmToPx(widthMm);
  const pageHeightPx = mmToPx(heightMm);
  const marginPx = mmToPx(MARGIN_MM);
  // Scale the full page width down to fit the panel
  const scale = PANEL_WIDTH_PX / pagePx;

  const initialConfig = {
    namespace: "PageLayoutPreview",
    nodes: [
      HeadingNode,
      ListNode,
      ListItemNode,
      EquationNode,
      LayoutContainerNode,
      LayoutItemNode,
    ],
    theme: previewTheme,
    editable: false,
    editorState,
    onError: (error: Error) => console.error("[preview]", error),
  };

  return (
    <div
      style={{ width: PANEL_WIDTH_PX, height: pageHeightPx * scale }}
      className="overflow-hidden bg-muted/30 rounded flex items-start justify-center"
    >
      {/* Scaled page */}
      <div
        style={{
          width: pagePx,
          minHeight: pageHeightPx,
          padding: marginPx,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          boxSizing: "border-box",
        }}
        className="bg-white shadow-md relative"
      >
        <LexicalComposer initialConfig={initialConfig}>
          <RichTextPlugin
            contentEditable={
              <ContentEditable className="outline-none pointer-events-none" />
            }
            placeholder={null}
            ErrorBoundary={LexicalErrorBoundary}
          />
        </LexicalComposer>
      </div>
    </div>
  );
}

export function PageLayoutPanel(): React.JSX.Element | null {
  const { enabled, pageSize, setPageSize, editorState } = usePageLayout();

  if (!enabled) return null;

  const { widthMm, heightMm } = PAGE_DIMENSIONS[pageSize];

  return (
    <div className="w-80 shrink-0 border rounded-lg bg-background overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Page preview
        </span>
        <select
          value={pageSize}
          onChange={(e) => setPageSize(e.target.value as PageSize)}
          className="text-xs px-1.5 py-0.5 rounded border border-border bg-background text-foreground"
        >
          {(Object.keys(PAGE_DIMENSIONS) as PageSize[]).map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      {/* Dimensions label */}
      <p className="text-[10px] text-muted-foreground px-3 pt-1.5">
        {widthMm} × {heightMm} mm
      </p>

      {/* Scaled page preview */}
      <div className="flex-1 overflow-y-auto p-3">
        {editorState ? (
          <ReadOnlyPreview editorState={editorState} pageSize={pageSize} />
        ) : (
          <p className="text-xs text-muted-foreground italic text-center mt-4">
            Start typing to see the preview
          </p>
        )}
      </div>
    </div>
  );
}
