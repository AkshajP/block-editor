"use client";

import { useEffect, useRef, useState } from "react";
import { Awareness } from "y-protocols/awareness";
import * as Y from "yjs";

import { Badge } from "@/components/ui/badge";
import { useVersionHistory } from "@/hooks/use-version-history";

interface PlaybackViewerProps {
  doc: Y.Doc | null;
  awareness: Awareness | null;
  className?: string;
}

/**
 * Component that displays the current playback document content
 */
export function PlaybackViewer({
  doc,
  awareness,
  className = "",
}: PlaybackViewerProps) {
  const versionHistory = useVersionHistory(doc, awareness, true);
  const [playbackContent, setPlaybackContent] = useState<string>("");
  const [currentEditIndex, setCurrentEditIndex] = useState(0);
  const [currentEditInfo, setCurrentEditInfo] = useState<string>("");
  const playbackUnsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!versionHistory.isInitialized) return;

    playbackUnsubscribeRef.current = versionHistory.subscribeToPlayback(
      (event, playbackDoc) => {
        setCurrentEditIndex(event.currentEditIndex);

        if (playbackDoc) {
          const ytext = playbackDoc.getText("shared");
          setPlaybackContent(ytext.toString());
        }

        // Update edit info
        if (event.edit) {
          const { userName, operation, content } = event.edit;
          let info = `${userName} ${operation}d`;
          if (content && content.length > 0) {
            info += `: "${content.substring(0, 20)}${content.length > 20 ? "..." : ""}"`;
          }
          setCurrentEditInfo(info);
        } else {
          setCurrentEditInfo("");
        }
      },
    );

    return () => {
      playbackUnsubscribeRef.current?.();
    };
  }, [versionHistory.isInitialized, versionHistory]);

  if (!versionHistory.isInitialized) {
    return null;
  }

  const totalEdits = versionHistory.edits.length;

  return (
    <div
      className={`flex flex-col gap-2 p-4 border rounded-lg bg-blue-50 dark:bg-blue-950 ${className}`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
          Playback Preview
        </h3>
        <div className="flex gap-2">
          <Badge variant="secondary" className="text-xs">
            Edit {currentEditIndex + 1} / {totalEdits}
          </Badge>
        </div>
      </div>

      {currentEditInfo && (
        <div className="text-xs text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">
          {currentEditInfo}
        </div>
      )}

      <div className="p-3 bg-white dark:bg-gray-950 rounded border border-blue-200 dark:border-blue-800 min-h-20 max-h-40 overflow-y-auto">
        <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
          {playbackContent || (
            <span className="text-gray-400 italic">
              Waiting for playback...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
