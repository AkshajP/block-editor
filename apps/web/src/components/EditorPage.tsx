"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, FileText, Globe, Lock, Pencil, Star } from "lucide-react";

import Editor from "./Editor";

type DocumentStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

interface Props {
  documentId: string;
  title: string;
  initialStatus: DocumentStatus;
  initialIsPublic: boolean;
  canWrite: boolean;
  canRename: boolean;
  canPublish: boolean;
  canChangeVisibility: boolean;
  userName: string;
}

const STATUS_STYLES: Record<DocumentStatus, string> = {
  DRAFT: "bg-yellow-100 text-yellow-700",
  PUBLISHED: "bg-green-100 text-green-700",
  ARCHIVED: "bg-slate-100 text-slate-500",
};

const STATUS_ICONS: Record<DocumentStatus, React.ReactNode> = {
  DRAFT: <FileText size={12} />,
  PUBLISHED: <Star size={12} />,
  ARCHIVED: <Archive size={12} />,
};

export default function EditorPage({
  documentId,
  title: initialTitle,
  initialStatus,
  initialIsPublic,
  canWrite,
  canRename,
  canPublish,
  canChangeVisibility,
  userName,
}: Props) {
  const router = useRouter();
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [status, setStatus] = useState<DocumentStatus>(initialStatus);
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setDraft(title);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  async function commitEdit() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === title) {
      setEditing(false);
      return;
    }
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      if (res.ok) setTitle(trimmed);
    } finally {
      setEditing(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") commitEdit();
    if (e.key === "Escape") setEditing(false);
  }

  async function togglePublish() {
    const nextStatus: DocumentStatus =
      status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    setSaving(true);
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) setStatus(nextStatus);
    } finally {
      setSaving(false);
    }
  }

  async function toggleVisibility() {
    const next = !isPublic;
    setSaving(true);
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: next }),
      });
      if (res.ok) setIsPublic(next);
    } finally {
      setSaving(false);
    }
  }

  const isPublished = status === "PUBLISHED";

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => router.push("/")}
          className="text-slate-500 hover:text-slate-700 text-sm"
        >
          ← Back
        </button>
        <div className="flex-1 flex items-center gap-2 min-w-0">
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleKeyDown}
              className="text-lg font-semibold text-slate-900 bg-transparent border-b border-slate-400 outline-none w-full min-w-0"
              maxLength={255}
              autoFocus
            />
          ) : (
            <>
              <h1 className="text-lg font-semibold text-slate-900 truncate">
                {title}
              </h1>
              {canRename && (
                <button
                  onClick={startEdit}
                  className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label="Rename document"
                >
                  <Pencil size={15} />
                </button>
              )}
            </>
          )}
        </div>

        {/* Status badge */}
        <span
          className={`flex items-center gap-1 text-xs px-2 py-1 rounded font-medium ${STATUS_STYLES[status]}`}
        >
          {STATUS_ICONS[status]}
          {status.charAt(0) + status.slice(1).toLowerCase()}
        </span>

        {/* Visibility badge — only meaningful when published */}
        {isPublished && (
          <span
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded font-medium ${
              isPublic
                ? "bg-blue-50 text-blue-600"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {isPublic ? <Globe size={12} /> : <Lock size={12} />}
            {isPublic ? "Workspace" : "Private"}
          </span>
        )}

        {!canWrite && (
          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded">
            Read only
          </span>
        )}

        {/* Visibility toggle — only shown when published and user can publish */}
        {canChangeVisibility && isPublished && (
          <button
            onClick={toggleVisibility}
            disabled={saving}
            title={isPublic ? "Make private (invite-only)" : "Make public to workspace"}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border transition-colors disabled:opacity-50 bg-white text-slate-600 border-slate-200 hover:border-slate-400"
          >
            {isPublic ? <Lock size={12} /> : <Globe size={12} />}
            {isPublic ? "Make private" : "Make public"}
          </button>
        )}

        {/* Publish / Unpublish */}
        {canPublish && status !== "ARCHIVED" && (
          <button
            onClick={togglePublish}
            disabled={saving}
            className={`text-xs px-3 py-1.5 rounded border transition-colors disabled:opacity-50 ${
              isPublished
                ? "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                : "bg-green-600 text-white border-green-600 hover:bg-green-700"
            }`}
          >
            {saving ? "Saving…" : isPublished ? "Unpublish" : "Publish"}
          </button>
        )}

        <button
          onClick={() => setShowSnapshots((v) => !v)}
          className={`text-xs px-3 py-1.5 rounded border transition-colors ${
            showSnapshots
              ? "bg-slate-900 text-white border-slate-900"
              : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
          }`}
        >
          Snapshots
        </button>
      </header>
      <div className="max-w-5xl mx-auto px-6 py-10">
        <Editor
          documentId={documentId}
          canWrite={canWrite}
          userName={userName}
          showSnapshots={showSnapshots}
        />
      </div>
    </main>
  );
}
