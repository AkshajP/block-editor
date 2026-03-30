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

// 1. Define the Menu Option Class
class SlashMenuItem extends MenuOption {
  title: string;
  icon: React.ReactElement;
  onSelect: (queryString: string) => void;

  constructor(
    title: string,
    options: {
      icon: React.ReactElement;
      onSelect: (queryString: string) => void;
    },
  ) {
    super(title);
    this.title = title;
    this.icon = options.icon;
    this.onSelect = options.onSelect;
  }
}

export default function SlashMenuPlugin() {
  const [editor] = useLexicalComposerContext();

  // 2. Define our Available Actions
  const options = React.useMemo(
    () => [
      new SlashMenuItem("Heading 1", {
        icon: <Heading1 className="mr-2 h-4 w-4" />,
        onSelect: () => {
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              $setBlocksType(selection, () => $createHeadingNode("h1"));
            }
          });
        },
      }),
      new SlashMenuItem("Heading 2", {
        icon: <Heading2 className="mr-2 h-4 w-4" />,
        onSelect: () => {
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              $setBlocksType(selection, () => $createHeadingNode("h2"));
            }
          });
        },
      }),
      new SlashMenuItem("Heading 3", {
        icon: <Heading3 className="mr-2 h-4 w-4" />,
        onSelect: () => {
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              $setBlocksType(selection, () => $createHeadingNode("h3"));
            }
          });
        },
      }),
      new SlashMenuItem("Heading 4", {
        icon: <Heading4 className="mr-2 h-4 w-4" />,
        onSelect: () => {
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              $setBlocksType(selection, () => $createHeadingNode("h4"));
            }
          });
        },
      }),
      new SlashMenuItem("Heading 5", {
        icon: <Heading5 className="mr-2 h-4 w-4" />,
        onSelect: () => {
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              $setBlocksType(selection, () => $createHeadingNode("h5"));
            }
          });
        },
      }),
      new SlashMenuItem("Heading 6", {
        icon: <Heading6 className="mr-2 h-4 w-4" />,
        onSelect: () => {
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              $setBlocksType(selection, () => $createHeadingNode("h6"));
            }
          });
        },
      }),
      new SlashMenuItem("Text", {
        icon: <Type className="mr-2 h-4 w-4" />,
        onSelect: () => {
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              $setBlocksType(selection, () => $createParagraphNode());
            }
          });
        },
      }),
      new SlashMenuItem("Numbered List", {
        icon: <ListOrdered className="mr-2 h-4 w-4" />,
        onSelect: () => {
          editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
        },
      }),
      new SlashMenuItem("Bullet List", {
        icon: <List className="mr-2 h-4 w-4" />,
        onSelect: () => {
          editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
        },
      }),
    ],
    [editor],
  );

  const checkForTriggerMatch = useBasicTypeaheadTriggerMatch("/", {
    minLength: 0,
  });

  return (
    <LexicalTypeaheadMenuPlugin<SlashMenuItem>
      onQueryChange={() => {}}
      onSelectOption={(option, nodeToRemove, closeMenu) => {
        editor.update(() => {
          // Remove the "/" trigger character from the editor
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            selection.deleteCharacter(true); // deletes the "/"
          }
          // Apply the new block type
          option.onSelect("");
        });
        // Close the menu after editor update completes
        closeMenu();
      }}
      triggerFn={checkForTriggerMatch}
      options={options}
      menuRenderFn={(
        anchorElementRef,
        { selectedIndex, selectOptionAndCleanUp, options },
      ) => {
        if (!anchorElementRef.current || options.length === 0) return null;

        // Get the position of the anchor element (cursor position)
        // TODO: Make this menu stick near the cursor when scrolled instead of fixed wrt page
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
