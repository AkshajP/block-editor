"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  DecoratorNode,
  $getRoot,
  $isElementNode,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical";
import * as React from "react";

import { useTemplate } from "@block-editor/template-engine";
import type { ConstructPart, TemplateSchema } from "@block-editor/template-schema";

// ─── Serialized form ──────────────────────────────────────────────────────────

export type SerializedConstructBadgeNode = Spread<
  { constructId: string; label: string; parts: ConstructPart[] },
  SerializedLexicalNode
>;

// ─── Label resolution ─────────────────────────────────────────────────────────
// Called inside editorState.read() — may use $ Lexical helpers.

function countPrecedingBadges(nodeKey: NodeKey, targetConstructId: string): number {
  const root = $getRoot();
  let count = 0;
  let found = false;

  function traverse(node: LexicalNode): void {
    if (found) return;
    if ($isConstructBadgeNode(node)) {
      if (node.__key === nodeKey) { found = true; return; }
      if (node.__constructId === targetConstructId) count++;
    }
    if ($isElementNode(node)) {
      for (const child of node.getChildren()) {
        traverse(child);
        if (found) return;
      }
    }
  }

  traverse(root);
  return count + 1; // 1-indexed
}

function resolveLabel(
  nodeKey: NodeKey,
  constructId: string,
  fallback: string,
  parts: ConstructPart[],
  schema: TemplateSchema | null,
): string {
  if (!parts.length) return fallback;

  const text = parts
    .map((part) => {
      switch (part.type) {
        case "static_text":
          return part.content ?? "";
        case "computed_var": {
          const varDef = schema?.variables?.find((v) => v.name === part.variableName);
          if (!varDef) return part.variableName ? `{${part.variableName}}` : "";
          if (varDef.computedFn === "counter" || varDef.computedFn === "counter_reset") {
            return String(countPrecedingBadges(nodeKey, varDef.counterConstruct ?? constructId));
          }
          if (varDef.computedFn === "date") return new Date().toLocaleDateString();
          return varDef.defaultValue ?? (part.variableName ? `{${part.variableName}}` : "");
        }
        case "user_input":
          return part.placeholder ? `[${part.placeholder}]` : "[text]";
        case "image":
          return "[image]";
        default:
          return "";
      }
    })
    .join("")
    .trim();

  return text || fallback;
}

// ─── Badge React component ────────────────────────────────────────────────────

interface ConstructBadgeProps {
  nodeKey: NodeKey;
  constructId: string;
  label: string;
  parts: ConstructPart[];
}

function ConstructBadge({ nodeKey, constructId, label, parts }: ConstructBadgeProps) {
  const [editor] = useLexicalComposerContext();
  const { schema } = useTemplate();
  const [resolvedLabel, setResolvedLabel] = React.useState(label);

  React.useEffect(() => {
    const update = () => {
      editor.getEditorState().read(() => {
        setResolvedLabel(resolveLabel(nodeKey, constructId, label, parts, schema));
      });
    };
    update();
    return editor.registerUpdateListener(update);
  }, [editor, nodeKey, constructId, label, parts, schema]);

  return (
    <span
      contentEditable={false}
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-violet-100 text-violet-700 border border-violet-200 select-none mx-0.5"
    >
      {resolvedLabel}
    </span>
  );
}

// ─── Lexical node ─────────────────────────────────────────────────────────────

export class ConstructBadgeNode extends DecoratorNode<React.ReactElement> {
  __constructId: string;
  __label: string;
  __parts: ConstructPart[];

  static getType(): string {
    return "construct-badge";
  }

  static clone(node: ConstructBadgeNode): ConstructBadgeNode {
    return new ConstructBadgeNode(node.__constructId, node.__label, node.__parts, node.__key);
  }

  constructor(constructId: string, label: string, parts: ConstructPart[], key?: NodeKey) {
    super(key);
    this.__constructId = constructId;
    this.__label = label;
    this.__parts = parts;
  }

  static importJSON(serialized: SerializedConstructBadgeNode): ConstructBadgeNode {
    return new ConstructBadgeNode(serialized.constructId, serialized.label, serialized.parts);
  }

  exportJSON(): SerializedConstructBadgeNode {
    return {
      ...super.exportJSON(),
      type: "construct-badge",
      version: 1,
      constructId: this.__constructId,
      label: this.__label,
      parts: this.__parts,
    };
  }

  createDOM(): HTMLElement {
    return document.createElement("span");
  }

  updateDOM(): false {
    return false;
  }

  isInline(): boolean {
    return true;
  }

  decorate(): React.ReactElement {
    return (
      <ConstructBadge
        nodeKey={this.__key}
        constructId={this.__constructId}
        label={this.__label}
        parts={this.__parts}
      />
    );
  }
}

export function $createConstructBadgeNode(
  constructId: string,
  label: string,
  parts: ConstructPart[],
): ConstructBadgeNode {
  return new ConstructBadgeNode(constructId, label, parts);
}

export function $isConstructBadgeNode(
  node: LexicalNode | null | undefined,
): node is ConstructBadgeNode {
  return node instanceof ConstructBadgeNode;
}
