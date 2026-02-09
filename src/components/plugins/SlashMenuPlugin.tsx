"use client";

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
import { Heading1, Type } from "lucide-react";
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

        return (
          <div className="z-50 w-64 rounded-md border bg-white p-1 shadow-lg animate-in fade-in-0 zoom-in-95 mt-8">
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
