"use client";

import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { VersionedEdit } from "@/lib/version-history";

interface VersionTimelineProps {
  edits: VersionedEdit[];
  currentEditIndex?: number;
  onEditSelect?: (edit: VersionedEdit, index: number) => void;
  className?: string;
  height?: string;
}

interface UserTimeline {
  userName: string;
  edits: Array<{
    edit: VersionedEdit;
    index: number;
    position: number; // 0-100
  }>;
}

/**
 * Component for visualizing version history timeline
 */
export function VersionTimeline({
  edits,
  currentEditIndex = 0,
  onEditSelect,
  className = "",
  height = "200px",
}: VersionTimelineProps) {
  // Group edits by user
  const timeline = useMemo(() => {
    const userMap = new Map<
      string,
      Array<{ edit: VersionedEdit; index: number }>
    >();

    edits.forEach((edit, index) => {
      if (!userMap.has(edit.userName)) {
        userMap.set(edit.userName, []);
      }
      userMap.get(edit.userName)!.push({ edit, index });
    });

    const timelineData: UserTimeline[] = [];

    for (const [userName, userEdits] of userMap) {
      const minTime = edits[0]?.timestamp ?? 0;
      const maxTime = edits[edits.length - 1]?.timestamp ?? 0;
      const timeSpan = maxTime - minTime || 1;

      const timelineEdits = userEdits.map(({ edit, index }) => ({
        edit,
        index,
        position: ((edit.timestamp - minTime) / timeSpan) * 100,
      }));

      timelineData.push({
        userName,
        edits: timelineEdits,
      });
    }

    return timelineData;
  }, [edits]);

  const _getOperationColor = (operation: string) => {
    switch (operation) {
      case "insert":
        return "bg-green-500";
      case "delete":
        return "bg-red-500";
      case "format":
        return "bg-blue-500";
      default:
        return "bg-gray-500";
    }
  };

  const _getUserColor = (userName: string) => {
    // Simple hash-based color
    const colors = [
      "bg-indigo-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-rose-500",
      "bg-orange-500",
      "bg-amber-500",
      "bg-yellow-500",
      "bg-lime-500",
      "bg-green-500",
      "bg-teal-500",
      "bg-cyan-500",
      "bg-sky-500",
    ];

    const hash = userName
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  if (edits.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border bg-muted/50 ${className}`}
        style={{ height }}
      >
        <p className="text-sm text-muted-foreground">No edits yet</p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border bg-background overflow-auto ${className}`}
      style={{ height }}
    >
      <TooltipProvider>
        <div className="flex flex-col gap-1 p-3">
          {timeline.map((userTimeline) => (
            <div
              key={userTimeline.userName}
              className="flex items-center gap-2"
            >
              {/* User label */}
              <div className="w-24 shrink-0">
                <Badge
                  variant="secondary"
                  className="text-xs w-full justify-center"
                >
                  {userTimeline.userName.split(" ")[0]}
                </Badge>
              </div>

              {/* Timeline track */}
              <div className="flex-1 relative h-8 bg-muted rounded">
                {userTimeline.edits.map(({ edit, index, position }) => (
                  <Tooltip key={edit.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onEditSelect?.(edit, index)}
                        className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-background cursor-pointer hover:scale-125 transition-transform ${_getOperationColor(edit.operation)} ${
                          index === currentEditIndex
                            ? "ring-2 ring-offset-1 ring-primary"
                            : ""
                        }`}
                        style={{ left: `${position}%` }}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      <div>{edit.operation}</div>
                      <div>{new Date(edit.timestamp).toLocaleTimeString()}</div>
                      {edit.content && (
                        <div className="max-w-xs truncate">
                          &quot;{edit.content.substring(0, 30)}&quot;
                        </div>
                      )}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>

              {/* Edit count */}
              <div className="w-8 text-right shrink-0">
                <span className="text-xs text-muted-foreground">
                  {userTimeline.edits.length}
                </span>
              </div>
            </div>
          ))}
        </div>
      </TooltipProvider>
    </div>
  );
}
