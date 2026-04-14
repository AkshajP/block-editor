"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

interface Snapshot {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  createdBy: { id: string; displayName: string };
}

interface DiffEntry {
  kind: "added" | "removed" | "changed";
  index: number;
  node?: { type: string; children?: { text?: string }[]; text?: string };
  before?: { type: string; children?: { text?: string }[]; text?: string };
  after?: { type: string; children?: { text?: string }[]; text?: string };
}

interface SnapshotPanelProps {
  documentId: string;
  canWrite: boolean;
}

function nodeText(node?: {
  text?: string;
  children?: { text?: string }[];
}): string {
  if (!node) return "";
  if (node.text) return node.text;
  if (node.children) return node.children.map((c) => c.text ?? "").join("");
  return "";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SnapshotPanel({
  documentId,
  canWrite,
}: SnapshotPanelProps) {
  const [editor] = useLexicalComposerContext();

  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveDesc, setSaveDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const [diffOpen, setDiffOpen] = useState(false);
  const [diffA, setDiffA] = useState<string | null>(null);
  const [diffB, setDiffB] = useState<string | null>(null);
  const [diffResult, setDiffResult] = useState<{
    a: { name: string };
    b: { name: string };
    diff: DiffEntry[];
  } | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  const [restoring, setRestoring] = useState<string | null>(null);

  const fetchSnapshots = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/snapshots`);
      if (res.ok) setSnapshots(await res.json());
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  const handleSave = async () => {
    if (!saveName.trim()) return;
    setSaving(true);
    try {
      const lexicalState = editor.getEditorState().toJSON();
      const res = await fetch(`/api/documents/${documentId}/snapshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: saveName.trim(),
          description: saveDesc.trim() || undefined,
          lexicalState,
        }),
      });
      if (res.ok) {
        const snap = await res.json();
        setSnapshots((prev) => [snap, ...prev]);
        setSaveOpen(false);
        setSaveName("");
        setSaveDesc("");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async (snapshotId: string) => {
    setRestoring(snapshotId);
    try {
      const res = await fetch(
        `/api/documents/${documentId}/snapshots/${snapshotId}/restore`,
        { method: "POST" },
      );
      if (!res.ok) return;
      const { lexicalState } = await res.json();
      const newState = editor.parseEditorState(JSON.stringify(lexicalState));
      editor.setEditorState(newState);
    } finally {
      setRestoring(null);
    }
  };

  const handleDelete = async (snapshotId: string) => {
    const res = await fetch(
      `/api/documents/${documentId}/snapshots/${snapshotId}`,
      { method: "DELETE" },
    );
    if (res.ok) {
      setSnapshots((prev) => prev.filter((s) => s.id !== snapshotId));
    }
  };

  const handleDiff = async () => {
    if (!diffA || !diffB || diffA === diffB) return;
    setDiffLoading(true);
    try {
      const res = await fetch(
        `/api/documents/${documentId}/snapshots/diff?a=${diffA}&b=${diffB}`,
      );
      if (res.ok) setDiffResult(await res.json());
    } finally {
      setDiffLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 flex items-center justify-between border-b">
        <span className="text-sm font-medium text-slate-700">Snapshots</span>
        {canWrite && (
          <Button size="sm" variant="outline" onClick={() => setSaveOpen(true)}>
            Save snapshot
          </Button>
        )}
      </div>

      {snapshots.length > 1 && (
        <div className="px-4 py-2 border-b">
          <Button
            size="sm"
            variant="ghost"
            className="w-full text-xs text-slate-500"
            onClick={() => setDiffOpen(true)}
          >
            Compare two snapshots…
          </Button>
        </div>
      )}

      <ScrollArea className="flex-1">
        {loading ? (
          <p className="text-xs text-slate-400 p-4">Loading…</p>
        ) : snapshots.length === 0 ? (
          <p className="text-xs text-slate-400 p-4">No snapshots yet.</p>
        ) : (
          <ul className="divide-y">
            {snapshots.map((snap) => (
              <li key={snap.id} className="px-4 py-3 flex flex-col gap-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {snap.name}
                    </p>
                    {snap.description && (
                      <p className="text-xs text-slate-500 truncate">
                        {snap.description}
                      </p>
                    )}
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatDate(snap.createdAt)} ·{" "}
                      {snap.createdBy.displayName}
                    </p>
                  </div>
                  {canWrite && (
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        disabled={restoring === snap.id}
                        onClick={() => handleRestore(snap.id)}
                      >
                        {restoring === snap.id ? "Restoring…" : "Restore"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                        onClick={() => handleDelete(snap.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>

      {/* Save dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Save snapshot</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <Input
              placeholder="Snapshot name"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
            <Textarea
              placeholder="Description (optional)"
              rows={2}
              value={saveDesc}
              onChange={(e) => setSaveDesc(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!saveName.trim() || saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diff dialog */}
      <Dialog
        open={diffOpen}
        onOpenChange={(open) => {
          setDiffOpen(open);
          if (!open) setDiffResult(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Compare snapshots</DialogTitle>
          </DialogHeader>

          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <p className="text-xs text-slate-500 mb-1">From</p>
              <select
                className="w-full border rounded px-2 py-1.5 text-sm"
                value={diffA ?? ""}
                onChange={(e) => setDiffA(e.target.value || null)}
              >
                <option value="">Select snapshot…</option>
                {snapshots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {formatDate(s.createdAt)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <p className="text-xs text-slate-500 mb-1">To</p>
              <select
                className="w-full border rounded px-2 py-1.5 text-sm"
                value={diffB ?? ""}
                onChange={(e) => setDiffB(e.target.value || null)}
              >
                <option value="">Select snapshot…</option>
                {snapshots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {formatDate(s.createdAt)}
                  </option>
                ))}
              </select>
            </div>
            <Button
              size="sm"
              onClick={handleDiff}
              disabled={!diffA || !diffB || diffA === diffB || diffLoading}
            >
              {diffLoading ? "…" : "Diff"}
            </Button>
          </div>

          {diffResult && (
            <ScrollArea className="flex-1 mt-3">
              {diffResult.diff.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">
                  No differences found.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {diffResult.diff.map((entry, i) => (
                    <li key={i} className="rounded p-2 border">
                      {entry.kind === "added" && (
                        <div className="bg-green-50 border-green-200 border rounded p-2">
                          <Badge
                            variant="outline"
                            className="text-green-700 border-green-300 mb-1"
                          >
                            + added (block {entry.index + 1})
                          </Badge>
                          <p className="text-slate-700">
                            {nodeText(entry.node)}
                          </p>
                        </div>
                      )}
                      {entry.kind === "removed" && (
                        <div className="bg-red-50 border-red-200 border rounded p-2">
                          <Badge
                            variant="outline"
                            className="text-red-700 border-red-300 mb-1"
                          >
                            − removed (block {entry.index + 1})
                          </Badge>
                          <p className="text-slate-700 line-through">
                            {nodeText(entry.node)}
                          </p>
                        </div>
                      )}
                      {entry.kind === "changed" && (
                        <div className="border rounded overflow-hidden">
                          <div className="bg-red-50 px-2 py-1.5 border-b">
                            <Badge
                              variant="outline"
                              className="text-red-700 border-red-300 mb-1"
                            >
                              before (block {entry.index + 1})
                            </Badge>
                            <p className="text-slate-700 line-through">
                              {nodeText(entry.before)}
                            </p>
                          </div>
                          <div className="bg-green-50 px-2 py-1.5">
                            <Badge
                              variant="outline"
                              className="text-green-700 border-green-300 mb-1"
                            >
                              after
                            </Badge>
                            <p className="text-slate-700">
                              {nodeText(entry.after)}
                            </p>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDiffOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
