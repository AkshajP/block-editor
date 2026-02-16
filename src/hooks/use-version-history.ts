import { useEffect, useRef, useState } from "react";
import { Awareness } from "y-protocols/awareness";
import * as Y from "yjs";

import { PlaybackEngine, PlaybackEventCallback } from "@/lib/playback-engine";
import { Snapshot, VersionedEdit, VersionHistory } from "@/lib/version-history";

/**
 * Hook for managing document versioning and playback
 */
export function useVersionHistory(
  doc: Y.Doc | null,
  awareness: Awareness | null,
  enabled: boolean = true,
) {
  const versionHistoryRef = useRef<VersionHistory | null>(null);
  const playbackEngineRef = useRef<PlaybackEngine | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const [edits, setEdits] = useState<VersionedEdit[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [statistics, setStatistics] = useState<Record<string, unknown> | null>(
    null,
  );

  // Initialize version history when doc and awareness are available
  useEffect(() => {
    if (!doc || !awareness || !enabled) return;

    // Create instances
    versionHistoryRef.current = new VersionHistory(100);
    playbackEngineRef.current = new PlaybackEngine();

    // Initialize tracking
    const cleanup = versionHistoryRef.current.initializeVersionTracking(
      doc,
      awareness,
    );
    cleanupRef.current = cleanup;

    // Subscribe to changes
    const unsubscribe = versionHistoryRef.current.subscribe(
      (edits, snapshots) => {
        setEdits(edits);
        setSnapshots(snapshots);
        const stats = versionHistoryRef.current?.getStatistics();
        if (stats) {
          setStatistics(stats);
        }
      },
    );

    // Initial state update
    setEdits(versionHistoryRef.current.getEdits());
    setSnapshots(versionHistoryRef.current.getSnapshots());
    setStatistics(versionHistoryRef.current.getStatistics());
    setIsInitialized(true);

    return () => {
      unsubscribe?.();
      cleanup?.();
      cleanupRef.current = null;
    };
  }, [doc, awareness, enabled]);

  // Seek to timestamp
  const seekToTimestamp = (timestamp: number): Y.Doc | null => {
    if (!versionHistoryRef.current || !playbackEngineRef.current) return null;

    const playbackDoc = playbackEngineRef.current.seekToTimestamp(
      timestamp,
      versionHistoryRef.current.getEdits(),
      versionHistoryRef.current.getSnapshots(),
    );

    return playbackDoc;
  };

  // Seek to edit index
  const seekToEditIndex = (index: number): Y.Doc | null => {
    if (!versionHistoryRef.current || !playbackEngineRef.current) return null;

    try {
      const playbackDoc = playbackEngineRef.current.seekToEditIndex(
        index,
        versionHistoryRef.current.getEdits(),
        versionHistoryRef.current.getSnapshots(),
      );

      return playbackDoc;
    } catch (error) {
      console.error("Failed to seek to edit index:", error);
      return null;
    }
  };

  // Seek to start
  const seekToStart = (): Y.Doc | null => {
    if (!versionHistoryRef.current || !playbackEngineRef.current) return null;

    const playbackDoc = playbackEngineRef.current.seekToStart(
      versionHistoryRef.current.getEdits(),
      versionHistoryRef.current.getSnapshots(),
    );

    return playbackDoc;
  };

  // Seek to end
  const seekToEnd = (): Y.Doc | null => {
    if (!versionHistoryRef.current || !playbackEngineRef.current) return null;

    const playbackDoc = playbackEngineRef.current.seekToEnd(
      versionHistoryRef.current.getEdits(),
      versionHistoryRef.current.getSnapshots(),
    );

    return playbackDoc;
  };

  // Play forward
  const playForward = async (
    onUpdate?: PlaybackEventCallback,
  ): Promise<boolean> => {
    if (!versionHistoryRef.current || !playbackEngineRef.current) return false;

    return playbackEngineRef.current.playForward(
      versionHistoryRef.current.getEdits(),
      versionHistoryRef.current.getSnapshots(),
      onUpdate,
    );
  };

  // Play backward
  const playBackward = async (
    onUpdate?: PlaybackEventCallback,
  ): Promise<boolean> => {
    if (!versionHistoryRef.current || !playbackEngineRef.current) return false;

    return playbackEngineRef.current.playBackward(
      versionHistoryRef.current.getEdits(),
      versionHistoryRef.current.getSnapshots(),
      onUpdate,
    );
  };

  // Step forward
  const stepForward = (): Y.Doc | null => {
    if (!versionHistoryRef.current || !playbackEngineRef.current) return null;

    return playbackEngineRef.current.stepForward(
      versionHistoryRef.current.getEdits(),
      versionHistoryRef.current.getSnapshots(),
    );
  };

  // Step backward
  const stepBackward = (): Y.Doc | null => {
    if (!versionHistoryRef.current || !playbackEngineRef.current) return null;

    return playbackEngineRef.current.stepBackward(
      versionHistoryRef.current.getEdits(),
      versionHistoryRef.current.getSnapshots(),
    );
  };

  // Pause
  const pause = (): void => {
    if (!playbackEngineRef.current) return;
    playbackEngineRef.current.pause();
  };

  // Resume
  const resume = (): void => {
    if (!playbackEngineRef.current) return;
    playbackEngineRef.current.resume();
  };

  // Set playback speed
  const setPlaybackSpeed = (speed: number): void => {
    if (!playbackEngineRef.current) return;
    try {
      playbackEngineRef.current.setPlaybackSpeed(speed);
    } catch (error) {
      console.error("Failed to set playback speed:", error);
    }
  };

  // Get playback speed
  const getPlaybackSpeed = (): number => {
    return playbackEngineRef.current?.getPlaybackSpeed() ?? 1.0;
  };

  // Check if playing
  const isPlaying = (): boolean => {
    return playbackEngineRef.current?.isCurrentlyPlaying() ?? false;
  };

  // Subscribe to playback events
  const subscribeToPlayback = (
    callback: PlaybackEventCallback,
  ): (() => void) | null => {
    return playbackEngineRef.current?.subscribe(callback) ?? null;
  };

  // Get current playback doc
  const getPlaybackDoc = (): Y.Doc | null => {
    return playbackEngineRef.current?.getPlaybackDocument() ?? null;
  };

  // Get current edit index
  const getCurrentEditIndex = (): number => {
    return playbackEngineRef.current?.getCurrentEditIndex() ?? 0;
  };

  // Export history
  const exportHistory = () => {
    if (!versionHistoryRef.current) return null;
    return versionHistoryRef.current.exportHistory();
  };

  // Clear history
  const clearHistory = (): void => {
    if (!versionHistoryRef.current) return;
    versionHistoryRef.current.clearHistory();
    setEdits([]);
    setSnapshots([]);
  };

  // Get timeline
  const getTimeline = (): Map<string, VersionedEdit[]> => {
    return versionHistoryRef.current?.getEditTimeline() ?? new Map();
  };

  // Find edits by user
  const findEditsByUser = (userName: string): VersionedEdit[] => {
    return versionHistoryRef.current?.findEditsByUser(userName) ?? [];
  };

  // Find edits by time range
  const findEditsByTimeRange = (
    startTime: number,
    endTime: number,
  ): VersionedEdit[] => {
    return (
      versionHistoryRef.current?.findEditsByTimeRange(startTime, endTime) ?? []
    );
  };

  return {
    // State
    edits,
    snapshots,
    isInitialized,
    statistics,

    // Seeking methods
    seekToTimestamp,
    seekToEditIndex,
    seekToStart,
    seekToEnd,

    // Playback methods
    playForward,
    playBackward,
    stepForward,
    stepBackward,
    pause,
    resume,

    // Playback control
    setPlaybackSpeed,
    getPlaybackSpeed,
    isPlaying,

    // Subscription and state
    subscribeToPlayback,
    getPlaybackDoc,
    getCurrentEditIndex,

    // Export/import
    exportHistory,
    clearHistory,

    // Query methods
    getTimeline,
    findEditsByUser,
    findEditsByTimeRange,
  };
}
