"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { TableOfContentsPlugin as LexicalTableOfContentsPlugin } from "@lexical/react/LexicalTableOfContentsPlugin";
import type { HeadingTagType } from "@lexical/rich-text";
import type { NodeKey } from "lexical";
import { useEffect, useRef, useState } from "react";

type TableOfContentsEntry = [key: NodeKey, text: string, tag: HeadingTagType];

const MARGIN_ABOVE_EDITOR = 624;
const HEADING_WIDTH = 9;

function indent(tagName: HeadingTagType): string {
  if (tagName === "h2") return "pl-3";
  if (tagName === "h3") return "pl-6";
  return "";
}

function isHeadingAtTheTopOfThePage(element: HTMLElement): boolean {
  const elementYPosition = element?.getClientRects()[0]?.y;
  return (
    elementYPosition >= MARGIN_ABOVE_EDITOR &&
    elementYPosition <= MARGIN_ABOVE_EDITOR + HEADING_WIDTH
  );
}

function isHeadingAboveViewport(element: HTMLElement): boolean {
  const elementYPosition = element?.getClientRects()[0]?.y;
  return elementYPosition < MARGIN_ABOVE_EDITOR;
}

function isHeadingBelowTheTopOfThePage(element: HTMLElement): boolean {
  const elementYPosition = element?.getClientRects()[0]?.y;
  return elementYPosition >= MARGIN_ABOVE_EDITOR + HEADING_WIDTH;
}

function TableOfContentsList({
  tableOfContents,
}: {
  tableOfContents: TableOfContentsEntry[];
}): React.JSX.Element {
  const [selectedKey, setSelectedKey] = useState<NodeKey>("");
  const selectedIndex = useRef(0);
  const [editor] = useLexicalComposerContext();

  function scrollToNode(key: NodeKey, currIndex: number) {
    editor.getEditorState().read(() => {
      const domElement = editor.getElementByKey(key);
      if (domElement !== null) {
        domElement.scrollIntoView({ behavior: "smooth" });
        setSelectedKey(key);
        selectedIndex.current = currIndex;
      }
    });
  }

  useEffect(() => {
    function scrollCallback() {
      if (
        tableOfContents.length !== 0 &&
        selectedIndex.current < tableOfContents.length - 1
      ) {
        let currentHeading = editor.getElementByKey(
          tableOfContents[selectedIndex.current][0],
        );
        if (currentHeading !== null) {
          if (isHeadingBelowTheTopOfThePage(currentHeading)) {
            // Scroll up — find first heading in viewport from the top
            for (let i = selectedIndex.current - 1; i >= 0; i--) {
              const heading = editor.getElementByKey(tableOfContents[i][0]);
              if (heading !== null) {
                if (
                  isHeadingAtTheTopOfThePage(heading) ||
                  isHeadingAboveViewport(heading)
                ) {
                  setSelectedKey(tableOfContents[i][0]);
                  selectedIndex.current = i;
                  break;
                }
              }
            }
          } else if (isHeadingAboveViewport(currentHeading)) {
            // Scroll down — find next heading past viewport top
            for (
              let i = selectedIndex.current + 1;
              i < tableOfContents.length;
              i++
            ) {
              const heading = editor.getElementByKey(tableOfContents[i][0]);
              if (heading !== null) {
                if (
                  isHeadingAtTheTopOfThePage(heading) ||
                  isHeadingBelowTheTopOfThePage(heading)
                ) {
                  setSelectedKey(tableOfContents[i][0]);
                  selectedIndex.current = i;
                  break;
                }
              }
            }
          }
        }
      } else {
        const firstHeading = editor.getElementByKey(tableOfContents[0]?.[0]);
        if (firstHeading !== null && !isHeadingAboveViewport(firstHeading!)) {
          setSelectedKey(tableOfContents[0][0]);
        }
      }
    }

    let timerId: ReturnType<typeof setTimeout>;
    function debounceScroll() {
      if (timerId) clearTimeout(timerId);
      timerId = setTimeout(scrollCallback, 10);
    }

    document.addEventListener("scroll", debounceScroll);
    return () => document.removeEventListener("scroll", debounceScroll);
  }, [tableOfContents, editor]);

  if (tableOfContents.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic px-3 py-2">
        No headings found
      </p>
    );
  }

  return (
    <ul className="space-y-1 py-2">
      {tableOfContents.map(([key, text, tag], index) => {
        const maxLen = index === 0 ? 20 : 27;
        const truncated = text.length > maxLen ? text.slice(0, maxLen) + "…" : text;
        const isSelected = selectedKey === key;
        return (
          <li key={key}>
            <button
              onClick={() => scrollToNode(key, index)}
              className={[
                "w-full text-left text-sm px-3 py-1 rounded transition-colors truncate",
                indent(tag),
                isSelected
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              ].join(" ")}
              title={text}
            >
              {truncated}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default function TableOfContentsPlugin(): React.JSX.Element {
  return (
    <div className="w-56 shrink-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-3 pt-3 pb-1">
        Contents
      </p>
      <LexicalTableOfContentsPlugin>
        {(tableOfContents) => (
          <TableOfContentsList tableOfContents={tableOfContents} />
        )}
      </LexicalTableOfContentsPlugin>
    </div>
  );
}
