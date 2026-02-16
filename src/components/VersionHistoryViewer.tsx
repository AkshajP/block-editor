"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VersionedEdit } from "@/lib/version-history";

interface VersionHistoryViewerProps {
  edits: VersionedEdit[];
  onEditSelect?: (edit: VersionedEdit, index: number) => void;
  className?: string;
  maxHeight?: string;
}

/**
 * Component for viewing and inspecting version history
 */
export function VersionHistoryViewer({
  edits,
  onEditSelect,
  className = "",
  maxHeight = "400px",
}: VersionHistoryViewerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterUser, setFilterUser] = useState<string | null>(null);
  const [filterOperation, setFilterOperation] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Get unique users and operations
  const uniqueUsers = useMemo(() => {
    return Array.from(new Set(edits.map((e) => e.userName)));
  }, [edits]);

  const uniqueOperations = useMemo(() => {
    return Array.from(new Set(edits.map((e) => e.operation)));
  }, [edits]);

  // Filter and sort edits
  const filteredEdits = useMemo(() => {
    let result = [...edits];

    // Filter by user
    if (filterUser) {
      result = result.filter((e) => e.userName === filterUser);
    }

    // Filter by operation
    if (filterOperation) {
      result = result.filter((e) => e.operation === filterOperation);
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (e) =>
          e.userName.toLowerCase().includes(term) ||
          e.content?.toLowerCase().includes(term) ||
          e.operation.toLowerCase().includes(term),
      );
    }

    // Sort
    result.sort((a, b) => {
      const comparison = a.timestamp - b.timestamp;
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [edits, filterUser, filterOperation, searchTerm, sortOrder]);

  const getOperationColor = (operation: string) => {
    switch (operation) {
      case "insert":
        return "bg-green-100 text-green-800";
      case "delete":
        return "bg-red-100 text-red-800";
      case "format":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const formatContent = (content: string | null) => {
    if (!content) return "-";
    const truncated =
      content.length > 50 ? content.substring(0, 47) + "..." : content;
    return `"${truncated}"`;
  };

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Filters */}
      <div className="flex flex-col gap-2 p-3 bg-muted/50 rounded-lg border">
        <div className="flex gap-2">
          <Input
            placeholder="Search by user, content, or operation..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 text-sm"
          />
        </div>

        <div className="flex gap-2">
          <Select
            value={filterUser || ""}
            onValueChange={(v) => setFilterUser(v || null)}
          >
            <SelectTrigger className="h-8 w-40 text-sm">
              <SelectValue placeholder="Filter by user" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Users</SelectItem>
              {uniqueUsers.map((user) => (
                <SelectItem key={user} value={user}>
                  {user}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filterOperation || ""}
            onValueChange={(v) => setFilterOperation(v || null)}
          >
            <SelectTrigger className="h-8 w-40 text-sm">
              <SelectValue placeholder="Filter by operation" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Operations</SelectItem>
              {uniqueOperations.map((op) => (
                <SelectItem key={op} value={op}>
                  {op}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            className="h-8 text-xs"
          >
            {sortOrder === "asc" ? "↑ Oldest" : "↓ Newest"}
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">
          Showing {filteredEdits.length} of {edits.length} edits
        </div>
      </div>

      {/* Table */}
      <ScrollArea className="rounded-lg border" style={{ maxHeight }}>
        {filteredEdits.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No edits found
          </div>
        ) : (
          <Table className="text-xs">
            <TableHeader className="sticky top-0 bg-muted">
              <TableRow>
                <TableHead className="w-20">Time</TableHead>
                <TableHead className="w-24">User</TableHead>
                <TableHead className="w-20">Type</TableHead>
                <TableHead className="flex-1">Content</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEdits.map((edit, _index) => (
                <TableRow
                  key={edit.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => onEditSelect?.(edit, edits.indexOf(edit))}
                >
                  <TableCell className="font-mono text-xs">
                    {formatTime(edit.timestamp)}
                  </TableCell>
                  <TableCell className="font-medium">{edit.userName}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-xs ${getOperationColor(edit.operation)}`}
                    >
                      {edit.operation}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatContent(edit.content)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ScrollArea>
    </div>
  );
}
