"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

import Editor from "./Editor";

interface Props {
  documentId: string;
  title: string;
  canWrite: boolean;
  canRename: boolean;
  userName: string;
}

export default function EditorPage({
  documentId,
  title: initialTitle,
  canWrite,
  canRename,
  userName,
}: Props) {
  const router = useRouter();
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [title, setTitle] = useState(initialTitle);
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
      if (res.ok) {
        setTitle(trimmed);
      }
    } finally {
      setEditing(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") commitEdit();
    if (e.key === "Escape") setEditing(false);
  }

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
        {!canWrite && (
          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded">
            Read only
          </span>
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
