"use client";

import { ListItemNode, ListNode } from "@lexical/list";
import { LexicalCollaboration } from "@lexical/react/LexicalCollaborationContext";
import { CollaborationPlugin } from "@lexical/react/LexicalCollaborationPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { HeadingNode } from "@lexical/rich-text";
import { useCallback, useState } from "react";
import { Awareness } from "y-protocols/awareness";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";

import { getWebSocketUrl } from "@/lib/collaboration";

import { AwarenessProvider } from "./AwarenessContext";
import MultiCursorPlugin from "./plugins/MultiCursorPlugin";
import SlashMenuPlugin from "./plugins/SlashMenuPlugin";
import UserPresence from "./UserPresence";

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
  const [currentAwareness, setCurrentAwareness] = useState<Awareness | null>(
    null,
  );

  const initialConfig = {
    // NOTE: Critical for collaboration - set editorState to null so CollaborationPlugin
    // can initialize the content instead of using a default state
    editorState: null,
    namespace: "MyEditor",
    nodes: [HeadingNode, ListNode, ListItemNode],
    theme,
    onError: (error: Error) => console.error(error),
  };

  // Get the WebSocket document from the provider
  const getDocFromMap = useCallback(
    (id: string, yjsDocMap: Map<string, Y.Doc>): Y.Doc => {
      let doc = yjsDocMap.get(id);

      if (doc === undefined) {
        doc = new Y.Doc();
        yjsDocMap.set(id, doc);
      } else {
        doc.load();
      }

      return doc;
    },
    [],
  );

  // Create the WebSocket provider factory for real-time synchronization
  const providerFactory = useCallback(
    (id: string, yjsDocMap: Map<string, Y.Doc>) => {
      const doc = getDocFromMap(id, yjsDocMap);

      const provider = new WebsocketProvider(getWebSocketUrl(), id, doc, {
        connect: true,
      });

      // Get awareness directly from the provider
      const awareness = (provider as unknown as { awareness: Awareness })
        .awareness;
      setCurrentAwareness(awareness);

      return provider;
    },
    [getDocFromMap],
  );

  // Track editor state changes
  const handleChange = () => {
    // State changes are now tracked through collaboration
  };

  return (
    <AwarenessProvider awareness={currentAwareness}>
      <LexicalCollaboration>
        <LexicalComposer initialConfig={initialConfig}>
          <div className="flex flex-col gap-4 w-full">
            <UserPresence />
            <div className="max-w-2xl mx-auto w-full p-4 border rounded-lg shadow-sm bg-background min-h-50 relative">
              <RichTextPlugin
                contentEditable={
                  <ContentEditable className="outline-none min-h-37.5 resize-none" />
                }
                placeholder={
                  <div className="absolute top-4 left-4 text-gray-400 pointer-events-none">
                    Type '/' for commands...
                  </div>
                }
                ErrorBoundary={LexicalErrorBoundary}
              />
              <SlashMenuPlugin />
              <ListPlugin />
              <HistoryPlugin />
              <OnChangePlugin onChange={handleChange} />
              <CollaborationPlugin
                id="block-editor/collaborative"
                // @ts-expect-error: WebsocketProvider is compatible at runtime but types don't match Lexical's ProviderFactory
                providerFactory={providerFactory}
                shouldBootstrap={false}
              />
              <MultiCursorPlugin />
            </div>
          </div>
        </LexicalComposer>
      </LexicalCollaboration>
    </AwarenessProvider>
  );
}
