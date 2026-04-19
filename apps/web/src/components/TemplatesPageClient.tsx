"use client";

import { formatDistanceToNow } from "date-fns";
import { Layers, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { signOutAction } from "@/app/actions/auth";

interface Template {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  variableCount: number;
}

interface Props {
  user: { displayName: string; email: string };
  templates: Template[];
}

const DEFAULT_SCHEMA = {
  version: 1 as const,
  page: { width: 595, height: 842, margins: { top: 71, right: 62, bottom: 62, left: 62 } },
  header: { height: 30, text: "" },
  footer: { height: 20, text: "" },
  constructs: [
    { id: "paragraph" },
    { id: "heading-1" },
    { id: "heading-2" },
    { id: "heading-3" },
    { id: "bullet-list" },
    { id: "numbered-list" },
  ],
  variables: [],
};

const PALETTE = ["purple", "teal", "blue", "ghost"] as const;

export default function TemplatesPageClient({ user, templates: initialTemplates }: Props) {
  const router = useRouter();
  const [templates, setTemplates] = useState(initialTemplates);
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<"docs" | "templates">("templates");

  async function createTemplate() {
    setCreating(true);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Untitled template", schema: DEFAULT_SCHEMA }),
      });
      if (res.ok) {
        const tpl = await res.json();
        router.push(`/templates/${tpl.id}`);
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="h-screen flex flex-col bg-[#f6f7f9]">
      {/* Top bar */}
      <header className="h-11 flex items-center justify-between px-4 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-bold text-slate-900 text-sm tracking-tight">Block Editor</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">{user.displayName}</span>
          <form action={signOutAction}>
            <button type="submit" className="text-xs text-slate-400 hover:text-slate-600">
              Sign out
            </button>
          </form>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-[1100px] mx-auto px-8 py-6">
          {/* Subbar / tabs */}
          <div className="flex items-center justify-between border-b border-slate-200 mb-5">
            <div className="flex items-center gap-1">
              <button
                onClick={() => router.push("/")}
                className={`px-1 py-2 mr-3 text-sm border-b-2 transition-colors ${
                  activeTab === "docs"
                    ? "border-slate-900 text-slate-900 font-medium"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                My Documents
              </button>
              <button
                onClick={() => setActiveTab("templates")}
                className={`px-1 py-2 mr-3 text-sm border-b-2 transition-colors ${
                  activeTab === "templates"
                    ? "border-slate-900 text-slate-900 font-medium"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                Templates{" "}
                <span className="text-[10px] ml-1 bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                  {templates.length}
                </span>
              </button>
            </div>
            <button
              onClick={createTemplate}
              disabled={creating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-md hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              <Plus size={11} />
              {creating ? "Creating…" : "New template"}
            </button>
          </div>

          {/* Grid */}
          {templates.length === 0 ? (
            <div className="text-center py-24 text-slate-400">
              <Layers size={32} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No templates yet. Create one to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {templates.map((tpl, i) => {
                const color = PALETTE[i % PALETTE.length];
                const chipStyles: Record<string, string> = {
                  purple: "bg-purple-50 border-purple-200 text-purple-700",
                  teal: "bg-cyan-50 border-cyan-200 text-cyan-700",
                  blue: "bg-blue-50 border-blue-200 text-blue-700",
                  ghost: "bg-white border-slate-200 text-slate-500",
                };
                return (
                  <div
                    key={tpl.id}
                    onClick={() => router.push(`/templates/${tpl.id}`)}
                    className="bg-white border border-slate-200 rounded-[10px] overflow-hidden cursor-pointer hover:shadow-md transition-shadow flex flex-col"
                  >
                    {/* Preview thumbnail */}
                    <div className="h-[120px] bg-[#2a2e36] flex items-center justify-center">
                      <div className="flex gap-1.5">
                        {[1, 2, 3].map((p) => (
                          <div
                            key={p}
                            className="w-12 h-16 bg-white rounded-[1px] shadow-lg relative"
                            style={{ boxShadow: "0 2px 6px rgba(0,0,0,0.3)" }}
                          >
                            {(color === "purple" && p === 1) || color === "blue" ? (
                              <div className="absolute inset-1 border border-[#c0a062] rounded-[1px]" />
                            ) : null}
                            <div className="p-[6px] pt-[10px]">
                              <div className="h-[6px] bg-slate-900 w-6 mb-[3px] rounded-[0.5px]" />
                              <div className="h-[1.5px] bg-slate-200 w-7 mb-[1.5px]" />
                              <div className="h-[1.5px] bg-slate-200 w-5 mb-[1.5px]" />
                              <div className="h-[1.5px] bg-slate-200 w-6" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-3.5 flex-1 flex flex-col">
                      <div className="flex items-start justify-between mb-1">
                        <span className="font-semibold text-slate-900 text-[13.5px]">{tpl.name}</span>
                        {color !== "ghost" && (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${chipStyles[color]}`}
                          >
                            <Layers size={9} />
                            {tpl.isSystem ? "System" : "Template"}
                          </span>
                        )}
                      </div>
                      {tpl.description && (
                        <p className="text-[11.5px] text-slate-400 flex-1 mb-2">{tpl.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-auto text-[11px] text-slate-400 font-mono">
                        <span>{tpl.variableCount} vars</span>
                        <span>·</span>
                        <span>
                          {formatDistanceToNow(new Date(tpl.updatedAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
