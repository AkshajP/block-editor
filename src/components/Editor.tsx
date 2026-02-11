"use client";

import { ListItemNode, ListNode } from "@lexical/list";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { HeadingNode } from "@lexical/rich-text";
import { EditorState } from "lexical";
import { useState } from "react";

import SlashMenuPlugin from "./plugins/SlashMenuPlugin";

const theme = {
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

export default function Editor() {
  const [jsonState, setJsonState] = useState<string>("");

  const initialConfig = {
    namespace: "MyEditor",
    nodes: [HeadingNode, ListNode, ListItemNode],
    theme,
    onError: (error: Error) => console.error(error),
  };

  // This function runs every time the user types or presses Enter
  function handleChange(editorState: EditorState) {
    const json = editorState.toJSON();
    setJsonState(JSON.stringify(json));

    // For MVP debugging: Log the state to see the blocks
    console.log("Current Editor Blocks:", json.root.children);
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="max-w-2xl mx-auto w-full p-4 border rounded-lg shadow-sm bg-background min-h-[200px] relative">
        <LexicalComposer initialConfig={initialConfig}>
          <RichTextPlugin
            contentEditable={
              <ContentEditable className="outline-none min-h-[150px] resize-none" />
            }
            placeholder={
              <div className="absolute top-4 left-4 text-gray-400 ">
                Type '/' for commands...
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
          <SlashMenuPlugin />
          <ListPlugin />
          <HistoryPlugin />
          <OnChangePlugin onChange={handleChange} />
        </LexicalComposer>
      </div>

      {/* Debug view to see your "Blocks" being created */}
      <div className="max-w-2xl mx-auto w-full p-4 bg-slate-100 rounded text-xs font-mono overflow-auto max-h-40">
        <p className="font-bold mb-2">Internal JSON State:</p>
        {jsonState || "Waiting for input..."}
      </div>
    </div>
  );
}
