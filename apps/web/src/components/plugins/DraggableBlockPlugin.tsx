"use client";

import { DraggableBlockPlugin_EXPERIMENTAL } from "@lexical/react/LexicalDraggableBlockPlugin";
import { useRef } from "react";

const DRAG_DATA_FORMAT = "application/x-lexical-drag-block";

function isOnMenu(element: HTMLElement): boolean {
  return !!element.closest("[data-draggable-menu]");
}

export default function DraggableBlockPlugin({
  anchorElem,
}: {
  anchorElem?: HTMLElement;
}): React.JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null);
  const targetLineRef = useRef<HTMLDivElement>(null);

  return (
    <DraggableBlockPlugin_EXPERIMENTAL
      anchorElem={anchorElem}
      menuRef={menuRef}
      targetLineRef={targetLineRef}
      menuComponent={
        <div
          ref={menuRef}
          data-draggable-menu
          className="absolute left-0 top-0 opacity-0 hover:opacity-100 will-change-[opacity] transition-opacity cursor-grab active:cursor-grabbing flex items-center justify-center w-6 h-6 rounded hover:bg-muted"
          aria-label="Drag to reorder block"
        >
          {/* Six-dot drag handle */}
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="text-muted-foreground"
          >
            <circle cx="5" cy="4" r="1.25" />
            <circle cx="11" cy="4" r="1.25" />
            <circle cx="5" cy="8" r="1.25" />
            <circle cx="11" cy="8" r="1.25" />
            <circle cx="5" cy="12" r="1.25" />
            <circle cx="11" cy="12" r="1.25" />
          </svg>
        </div>
      }
      targetLineComponent={
        <div
          ref={targetLineRef}
          className="absolute left-0 right-0 h-0.5 bg-primary rounded pointer-events-none opacity-0"
        />
      }
      isOnMenu={isOnMenu}
    />
  );
}

export { DRAG_DATA_FORMAT };
