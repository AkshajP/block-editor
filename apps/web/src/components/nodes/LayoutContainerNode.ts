import type {
  DOMConversionMap,
  DOMConversionOutput,
  EditorConfig,
  LexicalNode,
  SerializedElementNode,
  Spread,
} from "lexical";

import { addClassNamesToElement } from "@lexical/utils";
import { $applyNodeReplacement, ElementNode } from "lexical";

export type SerializedLayoutContainerNode = Spread<
  { templateColumns: string },
  SerializedElementNode
>;

function $convertLayoutContainerElement(
  domNode: HTMLElement,
): DOMConversionOutput | null {
  const templateColumns = domNode.style.gridTemplateColumns;
  if (templateColumns) {
    return { node: $createLayoutContainerNode(templateColumns) };
  }
  return null;
}

export class LayoutContainerNode extends ElementNode {
  __templateColumns: string;

  static getType(): string {
    return "layout-container";
  }

  static clone(node: LayoutContainerNode): LayoutContainerNode {
    return new LayoutContainerNode(node.__templateColumns, node.__key);
  }

  constructor(templateColumns: string, key?: string) {
    super(key);
    this.__templateColumns = templateColumns;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = document.createElement("div");
    dom.style.gridTemplateColumns = this.__templateColumns;
    dom.style.display = "grid";
    dom.style.gap = "1rem";
    dom.setAttribute("data-lexical-layout-container", "true");
    if (typeof config.theme.layoutContainer === "string") {
      addClassNamesToElement(dom, config.theme.layoutContainer);
    }
    return dom;
  }

  exportDOM(): { element: HTMLElement } {
    const element = document.createElement("div");
    element.style.gridTemplateColumns = this.__templateColumns;
    element.style.display = "grid";
    element.style.gap = "1rem";
    element.setAttribute("data-lexical-layout-container", "true");
    return { element };
  }

  updateDOM(prevNode: this, dom: HTMLElement): boolean {
    if (prevNode.__templateColumns !== this.__templateColumns) {
      dom.style.gridTemplateColumns = this.__templateColumns;
    }
    return false;
  }

  static importDOM(): DOMConversionMap | null {
    return {
      div: (domNode: HTMLElement) => {
        if (!domNode.hasAttribute("data-lexical-layout-container")) return null;
        return { conversion: $convertLayoutContainerElement, priority: 2 };
      },
    };
  }

  static importJSON(
    serializedNode: SerializedLayoutContainerNode,
  ): LayoutContainerNode {
    return $createLayoutContainerNode(
      serializedNode.templateColumns,
    ).updateFromJSON(serializedNode);
  }

  exportJSON(): SerializedLayoutContainerNode {
    return {
      ...super.exportJSON(),
      templateColumns: this.__templateColumns,
    };
  }

  getTemplateColumns(): string {
    return this.getLatest().__templateColumns;
  }

  setTemplateColumns(templateColumns: string): this {
    const writable = this.getWritable();
    writable.__templateColumns = templateColumns;
    return writable;
  }

  isShadowRoot(): boolean {
    return true;
  }

  canBeEmpty(): boolean {
    return false;
  }
}

export function $createLayoutContainerNode(
  templateColumns: string,
): LayoutContainerNode {
  return $applyNodeReplacement(new LayoutContainerNode(templateColumns));
}

export function $isLayoutContainerNode(
  node: LexicalNode | null | undefined,
): node is LayoutContainerNode {
  return node instanceof LayoutContainerNode;
}
