"use client";

import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
} from "@lexical/list";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  useBasicTypeaheadTriggerMatch,
} from "@lexical/react/LexicalTypeaheadMenuPlugin";
import { $createHeadingNode } from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  type LexicalEditor,
} from "lexical";
import {
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  List,
  ListOrdered,
  Type,
} from "lucide-react";
import * as React from "react";

import { useTemplate } from "@block-editor/template-engine";
import type { ResolvedConstruct } from "@block-editor/template-engine";

import { $createConstructBadgeNode } from "../nodes/ConstructBadgeNode";

// ─── Insert handlers ──────────────────────────────────────────────────────────
// Maps built-in construct IDs to their Lexical editor insert actions.
// Add an entry here when a new construct type (ImageNode, etc.) is supported.

type InsertFn = (editor: LexicalEditor) => void;

const INSERT_HANDLERS: Record<string, InsertFn> = {
  paragraph: (editor) =>
    editor.update(() => {
      const sel = $getSelection();
      if ($isRangeSelection(sel)) $setBlocksType(sel, () => $createParagraphNode());
    }),
  "heading-1": (editor) =>
    editor.update(() => {
      const sel = $getSelection();
      if ($isRangeSelection(sel)) $setBlocksType(sel, () => $createHeadingNode("h1"));
    }),
  "heading-2": (editor) =>
    editor.update(() => {
      const sel = $getSelection();
      if ($isRangeSelection(sel)) $setBlocksType(sel, () => $createHeadingNode("h2"));
    }),
  "heading-3": (editor) =>
    editor.update(() => {
      const sel = $getSelection();
      if ($isRangeSelection(sel)) $setBlocksType(sel, () => $createHeadingNode("h3"));
    }),
  "heading-4": (editor) =>
    editor.update(() => {
      const sel = $getSelection();
      if ($isRangeSelection(sel)) $setBlocksType(sel, () => $createHeadingNode("h4"));
    }),
  "heading-5": (editor) =>
    editor.update(() => {
      const sel = $getSelection();
      if ($isRangeSelection(sel)) $setBlocksType(sel, () => $createHeadingNode("h5"));
    }),
  "heading-6": (editor) =>
    editor.update(() => {
      const sel = $getSelection();
      if ($isRangeSelection(sel)) $setBlocksType(sel, () => $createHeadingNode("h6"));
    }),
  "numbered-list": (editor) =>
    editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined),
  "bullet-list": (editor) =>
    editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined),
};

// ─── Icon map ─────────────────────────────────────────────────────────────────
// Maps lucide icon names (stored on ConstructDefinition) → React elements.

const ICON_MAP: Record<string, React.ReactElement> = {
  Type: <Type className="mr-2 h-4 w-4" />,
  Heading1: <Heading1 className="mr-2 h-4 w-4" />,
  Heading2: <Heading2 className="mr-2 h-4 w-4" />,
  Heading3: <Heading3 className="mr-2 h-4 w-4" />,
  Heading4: <Heading4 className="mr-2 h-4 w-4" />,
  Heading5: <Heading5 className="mr-2 h-4 w-4" />,
  Heading6: <Heading6 className="mr-2 h-4 w-4" />,
  List: <List className="mr-2 h-4 w-4" />,
  ListOrdered: <ListOrdered className="mr-2 h-4 w-4" />,
};

const DEFAULT_ICON = <Type className="mr-2 h-4 w-4" />;

function iconForConstruct(c: ResolvedConstruct): React.ReactElement {
  return c.icon ? (ICON_MAP[c.icon] ?? DEFAULT_ICON) : DEFAULT_ICON;
}

// ─── Menu option ──────────────────────────────────────────────────────────────

class SlashMenuItem extends MenuOption {
  title: string;
  icon: React.ReactElement;
  onSelect: (queryString: string) => void;

  constructor(
    title: string,
    options: { icon: React.ReactElement; onSelect: (queryString: string) => void },
  ) {
    super(title);
    this.title = title;
    this.icon = options.icon;
    this.onSelect = options.onSelect;
  }
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export default function SlashMenuPlugin() {
  const [editor] = useLexicalComposerContext();
  const { constructs } = useTemplate();

  const options = React.useMemo(() => {
    return constructs.map((c) => {
      const handler = INSERT_HANDLERS[c.id];
      return new SlashMenuItem(c.label, {
        icon: iconForConstruct(c),
        onSelect: () => {
          if (handler) {
            handler(editor);
          } else {
            editor.update(() => {
              const sel = $getSelection();
              if ($isRangeSelection(sel)) {
                sel.insertNodes([$createConstructBadgeNode(c.id, c.label, c.parts ?? [])]);
              }
            });
          }
        },
      });
    });
  }, [constructs, editor]);

  const checkForTriggerMatch = useBasicTypeaheadTriggerMatch("/", {
    minLength: 0,
  });

  return (
    <LexicalTypeaheadMenuPlugin<SlashMenuItem>
      onQueryChange={() => {}}
      onSelectOption={(option, _nodeToRemove, closeMenu) => {
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            selection.deleteCharacter(true); // remove the "/" trigger character
          }
          option.onSelect("");
        });
        closeMenu();
      }}
      triggerFn={checkForTriggerMatch}
      options={options}
      menuRenderFn={(anchorElementRef, { selectedIndex, selectOptionAndCleanUp, options }) => {
        if (!anchorElementRef.current || options.length === 0) return null;

        const rect = anchorElementRef.current.getBoundingClientRect();

        return (
          <div
            style={{
              position: "fixed",
              top: `${rect.bottom + 4}px`,
              left: `${rect.left}px`,
            }}
            className="z-50 w-64 rounded-md border bg-white p-1 shadow-lg animate-in fade-in-0 zoom-in-95"
          >
            {options.map((option, i) => (
              <button
                key={option.key}
                tabIndex={-1}
                onClick={() => selectOptionAndCleanUp(option)}
                className={`flex w-full items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors ${
                  selectedIndex === i
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {option.icon}
                {option.title}
              </button>
            ))}
          </div>
        );
      }}
    />
  );
}
