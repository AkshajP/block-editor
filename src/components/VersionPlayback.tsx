"use client";

import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Awareness } from "y-protocols/awareness";
import * as Y from "yjs";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useVersionHistory } from "@/hooks/use-version-history";
import { VersionedEdit } from "@/lib/version-history";

interface VersionPlaybackProps {
  doc: Y.Doc | null;
  awareness: Awareness | null;
  onPlaybackUpdate?: (edit: VersionedEdit | null) => void;
  onEditsChange?: (edits: VersionedEdit[]) => void;
  className?: string;
  compact?: boolean;
}

/**
 * Component for controlling version playback
 */
export function VersionPlayback({
  doc,
  awareness,
  onPlaybackUpdate,
  onEditsChange,
  className = "",
  compact = false,
}: VersionPlaybackProps) {
  const versionHistory = useVersionHistory(doc, awareness, true);

  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentEdit, setCurrentEdit] = useState<VersionedEdit | null>(null);
  const playbackUnsubscribeRef = useRef<(() => void) | null>(null);

  // Notify parent of edits changes
  useEffect(() => {
    onEditsChange?.(versionHistory.edits);
  }, [versionHistory.edits, onEditsChange]);

  // Subscribe to playback events
  useEffect(() => {
    if (!versionHistory.isInitialized) return;

    playbackUnsubscribeRef.current = versionHistory.subscribeToPlayback(
      (event, _doc) => {
        setCurrentIndex(event.currentEditIndex);

        if (event.type === "playback" && event.edit) {
          setCurrentEdit(event.edit);
          onPlaybackUpdate?.(event.edit);
        }

        if (event.type === "stop") {
          setIsPlaying(false);
        }

        if (event.type === "seek") {
          setCurrentEdit(null);
          onPlaybackUpdate?.(null);
        }
      },
    );

    return () => {
      playbackUnsubscribeRef.current?.();
    };
  }, [versionHistory, onPlaybackUpdate]);

  const handlePlayForward = async () => {
    setIsPlaying(true);
    await versionHistory.playForward();
    setIsPlaying(false);
  };

  const _handlePlayBackward = async () => {
    setIsPlaying(true);
    await versionHistory.playBackward();
    setIsPlaying(false);
  };

  const handlePause = () => {
    if (isPlaying) {
      versionHistory.pause();
      setIsPlaying(false);
    }
  };

  const handleStepForward = () => {
    versionHistory.stepForward();
  };

  const handleStepBackward = () => {
    versionHistory.stepBackward();
  };

  const handleSkipToStart = () => {
    versionHistory.seekToStart();
    setCurrentIndex(0);
    setCurrentEdit(null);
  };

  const handleSkipToEnd = () => {
    versionHistory.seekToEnd();
    setCurrentIndex(versionHistory.edits.length);
    setCurrentEdit(null);
  };

  const handleSliderChange = (value: number[]) => {
    const index = Math.floor(value[0]);
    versionHistory.seekToEditIndex(index);
    setCurrentIndex(index);
  };

  const handleSpeedChange = (value: number[]) => {
    const speed = value[0];
    setPlaybackSpeed(speed);
    versionHistory.setPlaybackSpeed(speed);
  };

  if (!versionHistory.isInitialized) {
    return null;
  }

  const totalEdits = versionHistory.edits.length;

  return (
    <div
      className={`flex flex-col gap-3 p-4 bg-muted/50 rounded-lg border ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Version Playback</h3>
        {versionHistory.statistics && (
          <div className="flex gap-2">
            <Badge variant="secondary" className="text-xs">
              {totalEdits} edits
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {String(
                (versionHistory.statistics as Record<string, unknown>)
                  .totalSnapshots,
              )}{" "}
              snapshots
            </Badge>
          </div>
        )}
      </div>

      {/* Current Edit Info */}
      {currentEdit && !compact && (
        <div className="text-xs text-muted-foreground bg-background p-2 rounded border">
          <div className="font-medium">{currentEdit.userName}</div>
          <div className="text-xs">
            {currentEdit.operation === "insert" && "Typed: "}
            {currentEdit.operation === "delete" && "Deleted: "}
            {currentEdit.operation === "format" && "Formatted: "}
            {currentEdit.content && (
              <span className="italic">
                &quot;{currentEdit.content.substring(0, 30)}&quot;
              </span>
            )}
          </div>
          <div className="text-xs">
            {new Date(currentEdit.timestamp).toLocaleTimeString()}
          </div>
        </div>
      )}

      {/* Progress Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Edit {currentIndex + 1}</span>
          <span>{totalEdits}</span>
        </div>
        <Slider
          value={[currentIndex]}
          min={0}
          max={Math.max(totalEdits - 1, 0)}
          step={1}
          onValueChange={handleSliderChange}
          disabled={totalEdits === 0}
          className="h-1"
        />
      </div>

      {/* Playback Controls */}
      <div className="flex items-center justify-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={handleSkipToStart}
          disabled={totalEdits === 0 || isPlaying}
          title="Skip to start"
        >
          <SkipBack className="w-4 h-4" />
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={handleStepBackward}
          disabled={totalEdits === 0 || isPlaying || currentIndex === 0}
          title="Step backward"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        {!isPlaying ? (
          <Button
            size="sm"
            variant="default"
            onClick={handlePlayForward}
            disabled={totalEdits === 0 || currentIndex >= totalEdits - 1}
            title="Play forward"
          >
            <Play className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            size="sm"
            variant="default"
            onClick={handlePause}
            title="Pause playback"
          >
            <Pause className="w-4 h-4" />
          </Button>
        )}

        <Button
          size="sm"
          variant="outline"
          onClick={handleStepForward}
          disabled={
            totalEdits === 0 || isPlaying || currentIndex >= totalEdits - 1
          }
          title="Step forward"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={handleSkipToEnd}
          disabled={totalEdits === 0 || isPlaying}
          title="Skip to end"
        >
          <SkipForward className="w-4 h-4" />
        </Button>
      </div>

      {/* Speed Control */}
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <label className="text-xs font-medium">Playback Speed</label>
          <span className="text-xs font-semibold">
            {playbackSpeed.toFixed(1)}x
          </span>
        </div>
        <Slider
          value={[playbackSpeed]}
          min={0.25}
          max={4}
          step={0.25}
          onValueChange={handleSpeedChange}
          className="h-1"
        />
        <div className="flex justify-between text-xs text-muted-foreground text-very-small">
          <span>0.25x</span>
          <span>4x</span>
        </div>
      </div>

      {/* Statistics */}
      {versionHistory.statistics && !compact && (
        <div className="text-xs text-muted-foreground space-y-1 border-t pt-2">
          <div>
            Time span:{" "}
            {Math.round(
              ((versionHistory.statistics as Record<string, unknown>)
                .timeSpan as number) / 1000,
            )}
            s
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(
              (versionHistory.statistics as Record<string, unknown>)
                .editsByType as Record<string, number>,
            ).map(([type, count]) => (
              <span
                key={type}
                className="bg-background px-2 py-1 rounded text-xs"
              >
                {type}: {count}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
