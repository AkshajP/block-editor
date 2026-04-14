"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import Editor from "./Editor";

interface Props {
  documentId: string;
  title: string;
  canWrite: boolean;
  userName: string;
}

export default function EditorPage({
  documentId,
  title,
  canWrite,
  userName,
}: Props) {
  const router = useRouter();
  const [showSnapshots, setShowSnapshots] = useState(false);

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => router.push("/")}
          className="text-slate-500 hover:text-slate-700 text-sm"
        >
          ← Back
        </button>
        <h1 className="text-lg font-semibold text-slate-900 flex-1 truncate">
          {title}
        </h1>
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
