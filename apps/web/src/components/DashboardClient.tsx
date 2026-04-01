"use client";

import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { signOutAction } from "@/app/actions/auth";

interface Document {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  createdByName: string;
}

interface Props {
  user: { displayName: string; email: string };
  documents: Document[];
}

export default function DashboardClient({
  user,
  documents: initialDocs,
}: Props) {
  const router = useRouter();
  const [documents, setDocuments] = useState(initialDocs);
  const [creating, setCreating] = useState(false);

  async function createDocument() {
    setCreating(true);
    try {
      const res = await fetch("/api/documents", { method: "POST" });
      if (res.ok) {
        const doc = await res.json();
        router.push(`/documents/${doc.id}`);
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-semibold text-slate-900">Block Editor</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600">{user.displayName}</span>
          <form action={signOutAction}>
            <button
              type="submit"
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-slate-900">My Documents</h2>
          <button
            onClick={createDocument}
            disabled={creating}
            className="bg-slate-900 text-white px-4 py-2 rounded-md text-sm hover:bg-slate-700 disabled:opacity-50"
          >
            {creating ? "Creating…" : "New Document"}
          </button>
        </div>

        {documents.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <p>No documents yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map((doc) => (
              <div
                key={doc.id}
                onClick={() => router.push(`/documents/${doc.id}`)}
                className="cursor-pointer bg-white rounded-lg border p-5 hover:shadow-md transition-shadow"
              >
                <h3 className="font-semibold text-slate-900 truncate">
                  {doc.title}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  by {doc.createdByName}
                </p>
                <div className="flex items-center justify-between mt-4">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      doc.status === "PUBLISHED"
                        ? "bg-green-100 text-green-700"
                        : doc.status === "ARCHIVED"
                          ? "bg-slate-100 text-slate-500"
                          : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {doc.status}
                  </span>
                  <span className="text-xs text-slate-400">
                    {formatDistanceToNow(new Date(doc.updatedAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
