"use client";

import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";

const theme = {
  paragraph: "mb-2 text-gray-800 leading-7",
};

export default function Editor() {
  const initialConfig = {
    namespace: "MyEditor",
    theme,
    onError: (error: Error) => console.error(error),
  };

  return (
    <div className="max-w-2xl mx-auto mt-20 p-4 border rounded-lg shadow-sm bg-white min-h-[200px] relative">
      <LexicalComposer initialConfig={initialConfig}>
        <RichTextPlugin
          contentEditable={
            <ContentEditable className="outline-none min-h-[150px] resize-none" />
          }
          placeholder={
            <div className="absolute top-4 left-4 text-gray-400 pointer-events-none">
              Type '/' for commands...
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
      </LexicalComposer>
    </div>
  );
}
