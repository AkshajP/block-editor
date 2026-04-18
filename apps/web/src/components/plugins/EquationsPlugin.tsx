"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $insertNodeToNearestRoot } from "@lexical/utils";
import {
  $createParagraphNode,
  $isRootOrShadowRoot,
  COMMAND_PRIORITY_EDITOR,
  LexicalCommand,
  createCommand,
} from "lexical";
import { useEffect } from "react";

import {
  $createEquationNode,
  EquationNode,
} from "@/components/nodes/EquationNode";

export type InsertEquationPayload = { equation: string; inline: boolean };

export const INSERT_EQUATION_COMMAND: LexicalCommand<InsertEquationPayload> =
  createCommand("INSERT_EQUATION_COMMAND");

export default function EquationsPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!editor.hasNodes([EquationNode])) {
      throw new Error(
        "EquationsPlugin: EquationNode not registered on editor",
      );
    }

    return editor.registerCommand(
      INSERT_EQUATION_COMMAND,
      ({ equation, inline }) => {
        editor.update(() => {
          const equationNode = $createEquationNode(equation, inline);

          if (inline) {
            // For inline equations, just insert at selection
            $insertNodeToNearestRoot(equationNode);
          } else {
            // For block equations, ensure they're wrapped in a paragraph if needed
            const selection = equationNode.getParent();
            if (selection && $isRootOrShadowRoot(selection)) {
              const paragraph = $createParagraphNode();
              equationNode.insertAfter(paragraph);
            }
            $insertNodeToNearestRoot(equationNode);
          }
        });
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  }, [editor]);

  return null;
}
