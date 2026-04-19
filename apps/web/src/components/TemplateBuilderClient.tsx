"use client";

import type {
  TemplateSchema,
  VariableDefinition,
  ConstructPart,
  ConstructPartType,
  ConstructCategory,
  TemplateConstructRef,
} from "@block-editor/template-schema";
import {
  ArrowLeft,
  Blocks,
  Eye,
  EyeOff,
  FileText,
  GripVertical,
  Layers,
  Pencil,
  Play,
  Plus,
  Settings,
  SquareFunction,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "master" | "page" | "vars" | "computed" | "blocks";
type PageType =
  | "cover"
  | "toc"
  | "content"
  | "certificate"
  | "unnumbered"
  | "appendix";
type SaveStatus = "saved" | "saving" | "unsaved";
type DataType = "string" | "number" | "currency" | "date" | "image";

interface UIVariable extends VariableDefinition {
  required?: boolean;
  group?: string;
  placeholder?: string;
  dataType?: DataType;
}

interface ExtendedSchema extends TemplateSchema {
  variables?: UIVariable[];
}

interface Props {
  templateId: string;
  initialName: string;
  initialDescription: string;
  initialSchema: TemplateSchema;
  isSystem: boolean;
  canEdit: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ptToMm = (pt: number) => Math.round((pt / 2.835) * 10) / 10;
const mmToPt = (mm: number) => Math.round(mm * 2.835);

const PAGE_SIZES: Record<string, { w: number; h: number; label: string }> = {
  A4: { w: 595, h: 842, label: "A4" },
  Letter: { w: 612, h: 792, label: "Letter" },
  A3: { w: 842, h: 1190, label: "A3" },
  Legal: { w: 612, h: 1008, label: "Legal" },
};

function detectPageSize(w: number, h: number): string {
  for (const [key, val] of Object.entries(PAGE_SIZES)) {
    if (Math.abs(val.w - w) < 5 && Math.abs(val.h - h) < 5) return key;
    if (Math.abs(val.h - w) < 5 && Math.abs(val.w - h) < 5) return key;
  }
  return "A4";
}

const isLandscape = (schema: ExtendedSchema) =>
  schema.page.width > schema.page.height;

const BUILT_IN_COMPUTED = [
  {
    name: "page_number",
    label: "Page number",
    computedFn: "page_number" as const,
    desc: "Current page number",
    format: "1, 2, 3 (roman on TOC)",
  },
  {
    name: "total_pages",
    label: "Total pages",
    computedFn: "total_pages" as const,
    desc: "Total page count",
    format: "Counts visible pages only",
  },
  {
    name: "date",
    label: "Date",
    computedFn: "date" as const,
    desc: "Current date at render time",
    format: "e.g. April 19, 2026",
  },
];

// ─── Small shared atoms ───────────────────────────────────────────────────────

function VarPill({
  name,
  kind = "static",
}: {
  name: string;
  kind?: "static" | "computed";
}) {
  if (kind === "computed") {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono bg-purple-50 text-purple-700 border border-purple-200">
        ƒ {name}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono bg-blue-50 text-blue-700 border border-blue-200">
      <span className="opacity-50">{"{"}</span>
      {name}
      <span className="opacity-50">{"}"}</span>
    </span>
  );
}

function Toggle({
  on,
  onChange,
  label,
  hint,
  disabled,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <div>
        <div className="text-[12.5px] text-slate-700">{label}</div>
        {hint && <div className="text-[11px] text-slate-400">{hint}</div>}
      </div>
      <button
        onClick={() => !disabled && onChange(!on)}
        disabled={disabled}
        className={`relative w-7 h-4 rounded-full transition-colors border ${
          on ? "bg-blue-600 border-blue-600" : "bg-slate-100 border-slate-300"
        } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
      >
        <span
          className={`absolute top-[1px] w-3 h-3 bg-white rounded-full shadow-sm transition-all ${
            on ? "left-[13px]" : "left-[1px]"
          }`}
        />
      </button>
    </div>
  );
}

function Seg({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex bg-slate-100 p-0.5 rounded-md gap-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`text-[11.5px] px-2 py-0.5 rounded font-mono transition-all ${
            value === o.value
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Fld({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <label className="block text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function FldInput({
  value,
  onChange,
  type = "text",
  mono,
  placeholder,
}: {
  value: string | number;
  onChange: (v: string) => void;
  type?: "text" | "number";
  mono?: boolean;
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full px-2 py-1.5 text-[12.5px] bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${mono ? "font-mono" : ""}`}
    />
  );
}

function FldSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-2 py-1.5 text-[12.5px] bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10.5px] uppercase tracking-wider font-semibold text-slate-400 pt-3 pb-2 mt-3 border-t border-slate-100 first:border-none first:pt-1 first:mt-0">
      {children}
    </div>
  );
}

// ─── MasterFramePane ─────────────────────────────────────────────────────────

function MasterFramePane({ schema }: { schema: ExtendedSchema }) {
  const headerText = schema.header?.text ?? "";
  const footerText = schema.footer?.text ?? "";
  const leftHeader = headerText.split("·")[0]?.trim() ?? headerText;
  const rightHeader = headerText.split("·")[1]?.trim() ?? "";

  return (
    <div className="p-6 pb-20 max-w-[760px] mx-auto">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">
          Master frame
        </h2>
        <p className="text-[12.5px] text-slate-400">
          Defines page chrome (header/footer/numbering) inherited by every page
          type. Each page type can override.
        </p>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2.5 font-semibold text-sm text-slate-900">
            <Layers size={14} className="text-slate-500" />
            Master · default page chrome
          </div>
          <span className="text-[11.5px] text-slate-400 font-mono">
            A4 portrait · {ptToMm(schema.page.margins.top)}/
            {ptToMm(schema.page.margins.right)}/
            {ptToMm(schema.page.margins.bottom)}/
            {ptToMm(schema.page.margins.left)} mm
          </span>
        </div>
        <div className="p-6">
          <div
            className="grid gap-2"
            style={{ gridTemplateRows: "auto 1fr auto", minHeight: 360 }}
          >
            {/* Header area */}
            <div className="border-[1.5px] border-dashed border-slate-300 rounded-md p-4 bg-slate-50 flex flex-col gap-2">
              <div className="text-[10px] uppercase tracking-widest font-semibold text-slate-400">
                Header
              </div>
              <div className="flex items-center gap-2 px-2 py-1.5 bg-white border border-slate-200 rounded-md text-[12.5px] text-slate-700">
                <GripVertical
                  size={10}
                  className="text-slate-300 cursor-grab"
                />
                <span className="text-[10.5px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
                  text
                </span>
                {leftHeader ? (
                  <VarPill name={leftHeader} />
                ) : (
                  <span className="text-slate-400 text-xs italic">
                    no header text
                  </span>
                )}
                {rightHeader && (
                  <>
                    <span className="text-slate-300 mx-1">·</span>
                    <VarPill name={rightHeader} />
                  </>
                )}
              </div>
            </div>

            {/* Body slot */}
            <div
              className="border-[1.5px] border-dashed border-slate-300 rounded-md p-4 bg-slate-50 flex flex-col gap-2"
              style={{ minHeight: 140 }}
            >
              <div className="text-[10px] uppercase tracking-widest font-semibold text-slate-400">
                Body slot
              </div>
              <div className="flex items-center justify-between px-3 py-2 border border-slate-200 rounded-md bg-white text-[12px] text-slate-500">
                <div className="flex items-center gap-2">
                  <FileText size={12} />
                  Document content flows here
                </div>
                <span className="text-[11px] text-slate-400">
                  Each page type fills this with its own block list.
                </span>
              </div>
            </div>

            {/* Footer area */}
            <div className="border-[1.5px] border-dashed border-slate-300 rounded-md p-4 bg-slate-50 flex flex-col gap-2">
              <div className="text-[10px] uppercase tracking-widest font-semibold text-slate-400">
                Footer
              </div>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 px-2 py-1.5 bg-white border border-slate-200 rounded-md text-[12.5px] text-slate-700">
                  <GripVertical
                    size={10}
                    className="text-slate-300 cursor-grab"
                  />
                  <span className="text-[10.5px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
                    text
                  </span>
                  {footerText ? (
                    <span className="text-[12px]">{footerText}</span>
                  ) : (
                    <span className="text-slate-400 text-xs italic">
                      no footer text
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 px-2 py-1.5 bg-white border border-slate-200 rounded-md text-[12.5px] text-slate-700">
                  <span className="text-[10.5px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
                    computed
                  </span>
                  <VarPill name="page_number" kind="computed" />
                  <span className="text-slate-300">/</span>
                  <VarPill name="total_pages" kind="computed" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PageTypePane ─────────────────────────────────────────────────────────────

const PAGE_TYPE_CONFIGS: Record<
  PageType,
  { name: string; summary: string; body: React.ReactNode }
> = {
  cover: {
    name: "Cover",
    summary: "Bordered, no header/footer, page number suppressed.",
    body: (
      <div
        className="grid gap-2"
        style={{ gridTemplateRows: "auto 1fr auto", minHeight: 360 }}
      >
        <div className="border-[1.5px] border-dashed border-slate-200 rounded-md p-4 bg-slate-50/50 opacity-50">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-slate-400 mb-2">
            Header{" "}
            <span className="font-mono text-slate-300">
              · hidden by override
            </span>
          </div>
          <div className="px-2 py-1.5 border border-dashed border-slate-200 rounded text-[11.5px] text-slate-400 text-center">
            Header is suppressed for this page type
          </div>
        </div>
        <div
          className="border-[1.5px] border-dashed border-slate-300 rounded-md p-4 bg-slate-50 flex flex-col gap-2"
          style={{ minHeight: 200 }}
        >
          <div className="text-[10px] uppercase tracking-widest font-semibold text-slate-400">
            Body · static + variable
          </div>
          {[
            { type: "static", content: "Eyebrow band — gold" },
            { type: "heading", pill: "report_title" },
            { type: "subheading", pill: "report_subtitle" },
            { type: "date", pill: "report_period" },
            { type: "static", content: "Bordered frame · gold 0.5pt" },
          ].map((b, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-2 py-1.5 bg-white border border-slate-200 rounded-md text-[12.5px] text-slate-700"
            >
              <GripVertical size={10} className="text-slate-300 cursor-grab" />
              <span className="text-[10.5px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
                {b.type}
              </span>
              {b.pill ? (
                <VarPill name={b.pill} />
              ) : (
                <span className="text-[12px]">{b.content}</span>
              )}
            </div>
          ))}
        </div>
        <div className="border-[1.5px] border-dashed border-slate-200 rounded-md p-4 bg-slate-50/50 opacity-50">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-slate-400 mb-2">
            Footer{" "}
            <span className="font-mono text-slate-300">
              · hidden by override
            </span>
          </div>
          <div className="px-2 py-1.5 border border-dashed border-slate-200 rounded text-[11.5px] text-slate-400 text-center">
            Footer + page number suppressed
          </div>
        </div>
      </div>
    ),
  },
  toc: {
    name: "Table of contents",
    summary:
      "Inherits header. Footer numbering switches to roman (i, ii, iii…).",
    body: (
      <div
        className="grid gap-2"
        style={{ gridTemplateRows: "auto 1fr auto", minHeight: 360 }}
      >
        <div className="border-[1.5px] border-dashed border-slate-300 rounded-md p-4 bg-slate-50 flex flex-col gap-2">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-slate-400">
            Header <span className="font-mono text-slate-300">· inherited</span>
          </div>
          <div className="px-2 py-1.5 border border-dashed border-slate-200 rounded text-[11.5px] text-slate-400 text-center">
            Inherits master header
          </div>
        </div>
        <div
          className="border-[1.5px] border-dashed border-slate-300 rounded-md p-4 bg-slate-50 flex flex-col gap-2"
          style={{ minHeight: 160 }}
        >
          <div className="text-[10px] uppercase tracking-widest font-semibold text-slate-400">
            Body
          </div>
          <div className="flex items-center gap-2 px-2 py-1.5 bg-white border border-slate-200 rounded-md text-[12.5px] text-slate-700">
            <span className="text-[10.5px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
              heading
            </span>
            <span className="text-[12px]">Table of Contents</span>
          </div>
          <div className="flex items-center gap-2 px-2 py-1.5 bg-white border border-slate-200 rounded-md text-[12.5px] text-slate-700">
            <span className="text-[10.5px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
              computed
            </span>
            <VarPill name="toc_entries" kind="computed" />
            <span className="text-slate-400 text-[11px]">
              rendered as dotted-leader rows
            </span>
          </div>
        </div>
        <div className="border-[1.5px] border-dashed border-slate-300 rounded-md p-4 bg-slate-50 flex flex-col gap-2">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-slate-400">
            Footer · numbering = roman
          </div>
          <div className="flex items-center gap-2 px-2 py-1.5 bg-white border border-slate-200 rounded-md text-[12.5px] text-slate-700">
            <span className="text-[10.5px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
              computed
            </span>
            <VarPill name="page_number" kind="computed" />
            <span className="font-mono text-[10.5px] text-slate-400">
              format=roman
            </span>
          </div>
        </div>
      </div>
    ),
  },
  content: {
    name: "Content",
    summary: "Standard page. Inherits everything from master.",
    body: (
      <div
        className="grid gap-2"
        style={{ gridTemplateRows: "auto 1fr auto", minHeight: 360 }}
      >
        <div className="border-[1.5px] border-dashed border-slate-300 rounded-md p-4 bg-slate-50">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-slate-400 mb-2">
            Header <span className="font-mono text-slate-300">· inherited</span>
          </div>
          <div className="px-2 py-1.5 border border-dashed border-slate-200 rounded text-[11.5px] text-slate-400 text-center">
            Inherits master header
          </div>
        </div>
        <div
          className="border-[1.5px] border-dashed border-slate-300 rounded-md p-4 bg-slate-50 flex flex-col gap-2"
          style={{ minHeight: 160 }}
        >
          <div className="text-[10px] uppercase tracking-widest font-semibold text-slate-400">
            Body
          </div>
          <div className="flex items-center justify-between px-3 py-2 border border-slate-200 rounded-md bg-white text-[12px] text-slate-500">
            <div className="flex items-center gap-2">
              <FileText size={12} />
              <span>Document content (free)</span>
            </div>
            <span className="text-slate-400 text-[11px]">flow</span>
          </div>
        </div>
        <div className="border-[1.5px] border-dashed border-slate-300 rounded-md p-4 bg-slate-50">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-slate-400 mb-2">
            Footer <span className="font-mono text-slate-300">· inherited</span>
          </div>
          <div className="px-2 py-1.5 border border-dashed border-slate-200 rounded text-[11.5px] text-slate-400 text-center">
            Inherits master footer (page number 1, 2, 3…)
          </div>
        </div>
      </div>
    ),
  },
  certificate: {
    name: "Certificate",
    summary: "Bordered, no header/footer, no page number, custom layout.",
    body: (
      <div
        className="grid gap-2"
        style={{ gridTemplateRows: "auto 1fr auto", minHeight: 360 }}
      >
        <div className="border-[1.5px] border-dashed border-slate-200 rounded-md p-4 bg-slate-50/50 opacity-50">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-slate-400">
            Header · suppressed
          </div>
          <div className="mt-2 px-2 py-1.5 border border-dashed border-slate-200 rounded text-[11.5px] text-slate-400 text-center">
            Hidden
          </div>
        </div>
        <div
          className="border-[1.5px] border-dashed border-slate-300 rounded-md p-4 bg-slate-50 flex flex-col gap-2"
          style={{ minHeight: 220 }}
        >
          <div className="text-[10px] uppercase tracking-widest font-semibold text-slate-400">
            Body · certificate layout
          </div>
          {[
            { type: "static", content: "Gold double-border frame" },
            { type: "heading", content: '"Certificate of Completion"' },
            { type: "eyebrow", content: '"This is to certify that"' },
            { type: "name", pill: "recipient_name" },
            { type: "signature", pill: "ceo_name" },
          ].map((b, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-2 py-1.5 bg-white border border-slate-200 rounded-md text-[12.5px] text-slate-700"
            >
              <span className="text-[10.5px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
                {b.type}
              </span>
              {b.pill ? (
                <VarPill name={b.pill} />
              ) : (
                <span className="text-[12px]">{b.content}</span>
              )}
            </div>
          ))}
        </div>
        <div className="border-[1.5px] border-dashed border-slate-200 rounded-md p-4 bg-slate-50/50 opacity-50">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-slate-400">
            Footer · suppressed
          </div>
          <div className="mt-2 px-2 py-1.5 border border-dashed border-slate-200 rounded text-[11.5px] text-slate-400 text-center">
            Hidden
          </div>
        </div>
      </div>
    ),
  },
  unnumbered: {
    name: "Unnumbered",
    summary: "Same as content but suppresses footer page number.",
    body: (
      <div
        className="grid gap-2"
        style={{ gridTemplateRows: "auto 1fr auto", minHeight: 360 }}
      >
        <div className="border-[1.5px] border-dashed border-slate-300 rounded-md p-4 bg-slate-50">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-slate-400 mb-2">
            Header <span className="font-mono text-slate-300">· inherited</span>
          </div>
          <div className="px-2 py-1.5 border border-dashed border-slate-200 rounded text-[11.5px] text-slate-400 text-center">
            Inherits master header
          </div>
        </div>
        <div
          className="border-[1.5px] border-dashed border-slate-300 rounded-md p-4 bg-slate-50 flex flex-col gap-2"
          style={{ minHeight: 160 }}
        >
          <div className="text-[10px] uppercase tracking-widest font-semibold text-slate-400">
            Body
          </div>
          <div className="flex items-center justify-between px-3 py-2 border border-slate-200 rounded-md bg-white text-[12px] text-slate-500">
            <div className="flex items-center gap-2">
              <FileText size={12} />
              Document content (free)
            </div>
            <span className="text-slate-400 text-[11px]">flow</span>
          </div>
        </div>
        <div className="border-[1.5px] border-dashed border-slate-200 rounded-md p-4 bg-slate-50/50 opacity-50">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-slate-400 mb-2">
            Footer · page number suppressed
          </div>
          <div className="px-2 py-1.5 border border-dashed border-slate-200 rounded text-[11.5px] text-slate-400 text-center">
            No page number shown
          </div>
        </div>
      </div>
    ),
  },
  appendix: {
    name: "Appendix",
    summary: "Page numbering restarts at A1, A2…",
    body: (
      <div
        className="grid gap-2"
        style={{ gridTemplateRows: "auto 1fr auto", minHeight: 360 }}
      >
        <div className="border-[1.5px] border-dashed border-slate-300 rounded-md p-4 bg-slate-50">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-slate-400 mb-2">
            Header <span className="font-mono text-slate-300">· inherited</span>
          </div>
          <div className="px-2 py-1.5 border border-dashed border-slate-200 rounded text-[11.5px] text-slate-400 text-center">
            Inherits master header
          </div>
        </div>
        <div
          className="border-[1.5px] border-dashed border-slate-300 rounded-md p-4 bg-slate-50 flex flex-col gap-2"
          style={{ minHeight: 160 }}
        >
          <div className="text-[10px] uppercase tracking-widest font-semibold text-slate-400">
            Body
          </div>
          <div className="flex items-center justify-between px-3 py-2 border border-slate-200 rounded-md bg-white text-[12px] text-slate-500">
            <div className="flex items-center gap-2">
              <FileText size={12} />
              Document content (free)
            </div>
            <span className="text-slate-400 text-[11px]">flow</span>
          </div>
        </div>
        <div className="border-[1.5px] border-dashed border-slate-300 rounded-md p-4 bg-slate-50">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-slate-400 mb-2">
            Footer · numbering A1, A2…
          </div>
          <div className="flex items-center gap-2 px-2 py-1.5 bg-white border border-slate-200 rounded-md text-[12.5px] text-slate-700">
            <span className="text-[10.5px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
              computed
            </span>
            <VarPill name="page_number" kind="computed" />
            <span className="font-mono text-[10.5px] text-slate-400">
              format=alpha, prefix=A
            </span>
          </div>
        </div>
      </div>
    ),
  },
};

function PageTypePane({ id }: { id: PageType }) {
  const cfg = PAGE_TYPE_CONFIGS[id] ?? PAGE_TYPE_CONFIGS.content;
  return (
    <div className="p-6 pb-20 max-w-[760px] mx-auto">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900 mb-0.5">
          {cfg.name}{" "}
          <span className="font-mono text-slate-400 text-sm font-normal ml-1.5">
            /{id}
          </span>
        </h2>
        <p className="text-[12.5px] text-slate-400">{cfg.summary}</p>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2.5 font-semibold text-sm text-slate-900">
            <FileText size={14} className="text-slate-500" />
            Page type · {id}
          </div>
          <span className="text-[11.5px] text-slate-400 font-mono">
            extends master
          </span>
        </div>
        <div className="p-6">{cfg.body}</div>
      </div>
    </div>
  );
}

// ─── VariablesPane ────────────────────────────────────────────────────────────

function VariablesPane({
  schema,
  onAddVar,
  onDeleteVar,
  onSelectVar,
  selectedVar,
}: {
  schema: ExtendedSchema;
  onAddVar: () => void;
  onDeleteVar: (name: string) => void;
  onSelectVar: (name: string) => void;
  selectedVar: string | null;
}) {
  const staticVars = (schema.variables ?? []).filter(
    (v) => v.type === "STATIC",
  );

  const groups = staticVars.reduce<Record<string, UIVariable[]>>((acc, v) => {
    const g = (v as UIVariable).group ?? "General";
    (acc[g] ??= []).push(v as UIVariable);
    return acc;
  }, {});

  return (
    <div className="p-6 pb-20 max-w-[760px] mx-auto">
      <div className="flex items-end justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-0.5">
            Variables
          </h2>
          <p className="text-[12.5px] text-slate-400">
            Slots the document author fills in. Reference them with{" "}
            <span className="font-mono text-[10.5px] bg-slate-100 border border-slate-200 px-1 py-0.5 rounded text-slate-500">
              {"{var_name}"}
            </span>
          </p>
        </div>
        <button
          onClick={onAddVar}
          className="flex items-center gap-1.5 px-2.5 py-1.5 border border-slate-200 rounded-md text-[12.5px] text-slate-700 bg-white hover:bg-slate-50 transition-colors"
        >
          <Plus size={11} /> New variable
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <span className="font-semibold text-sm text-slate-900">
            {staticVars.length} user variables
          </span>
          <span className="text-[11.5px] text-slate-400 font-mono">
            {Object.keys(groups).length} groups
          </span>
        </div>

        {staticVars.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-[12.5px]">
            <Tag size={24} className="mx-auto mb-2 opacity-30" />
            No variables yet. Add one to get started.
          </div>
        ) : (
          <div className="p-2">
            {Object.entries(groups).map(([group, vars]) => (
              <div key={group} className="mb-2">
                <div className="text-[10.5px] uppercase tracking-wider font-semibold text-slate-400 px-2 py-2.5">
                  {group}
                </div>
                {vars.map((v) => (
                  <div
                    key={v.name}
                    onClick={() => onSelectVar(v.name)}
                    className={`grid items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-[12.5px] transition-colors ${
                      selectedVar === v.name
                        ? "bg-blue-50"
                        : "hover:bg-slate-50"
                    }`}
                    style={{ gridTemplateColumns: "18px 1fr 80px 80px 100px" }}
                  >
                    <span className="w-4 h-4 rounded flex items-center justify-center font-mono text-[9.5px] font-bold bg-blue-50 text-blue-700">
                      {}
                    </span>
                    <div>
                      <div className="font-mono text-[12px] text-slate-900">{`{${v.name}}`}</div>
                      <div className="text-[10.5px] text-slate-400">
                        {v.label}
                      </div>
                    </div>
                    <span className="font-mono text-[10.5px] text-slate-400">
                      {(v as UIVariable).dataType ?? "string"}
                    </span>
                    <span
                      className={`text-[10.5px] font-mono ${
                        (v as UIVariable).required
                          ? "text-red-500"
                          : "text-slate-400"
                      }`}
                    >
                      {(v as UIVariable).required ? "required" : "optional"}
                    </span>
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-[11px] text-slate-300 truncate">
                        {v.defaultValue ?? "—"}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteVar(v.name);
                        }}
                        className="ml-1 p-0.5 text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ComputedPane ──────────────────────────────────────────────────────────────

function ComputedPane({
  schema,
  onAddComputed,
  onDeleteComputed,
  onSelectComputed,
  selectedComputed,
}: {
  schema: ExtendedSchema;
  onAddComputed: () => void;
  onDeleteComputed: (name: string) => void;
  onSelectComputed: (name: string) => void;
  selectedComputed: string | null;
}) {
  const customComputedVars = (schema.variables ?? []).filter(
    (v) => v.type === "COMPUTED",
  );

  const FN_BADGE: Record<string, string> = {
    counter:       "bg-green-50 text-green-700 border-green-200",
    counter_reset: "bg-amber-50 text-amber-700 border-amber-200",
    derived:       "bg-blue-50 text-blue-700 border-blue-200",
  };

  function describeCustomVar(v: UIVariable): string {
    if (v.computedFn === "counter") return `Counts /${v.counterConstruct ?? "?"}`;
    if (v.computedFn === "counter_reset")
      return `Counts /${v.counterConstruct ?? "?"}, resets at /${v.counterResetOn ?? "?"}`;
    if (v.computedFn === "derived") return `= ${v.formula ?? ""}`;
    return v.label;
  }

  return (
    <div className="p-6 pb-20 max-w-[760px] mx-auto">
      <div className="flex items-end justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-0.5">Computed variables</h2>
          <p className="text-[12.5px] text-slate-400">
            Derived at render time by the template. Read-only for the document author.
          </p>
        </div>
        <button
          onClick={onAddComputed}
          className="flex items-center gap-1.5 px-2.5 py-1.5 border border-slate-200 rounded-md text-[12.5px] text-slate-700 bg-white hover:bg-slate-50 transition-colors"
        >
          <Plus size={11} /> New computed
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm mb-3">
        <div className="px-4 py-3 border-b border-slate-200 text-[11px] uppercase tracking-wider font-semibold text-slate-400">
          Built-in
        </div>
        {BUILT_IN_COMPUTED.map((c) => (
          <div
            key={c.name}
            onClick={() => onSelectComputed(c.name)}
            className={`flex items-center gap-2.5 px-3 py-2 border-t border-slate-100 first:border-none cursor-pointer transition-colors ${
              selectedComputed === c.name ? "bg-purple-50" : "hover:bg-slate-50"
            }`}
          >
            <span className="w-5 h-5 rounded flex items-center justify-center bg-purple-50 text-purple-700 font-mono text-[11px] font-bold shrink-0">ƒ</span>
            <div className="flex-1 min-w-0">
              <div className="font-mono text-purple-700 text-[12px]">{`{${c.name}}`}</div>
              <div className="text-[11px] text-slate-400 truncate">{c.desc}</div>
            </div>
            <span className="font-mono text-[10px] text-slate-300">built-in</span>
          </div>
        ))}
      </div>

      {customComputedVars.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="px-4 py-3 border-b border-slate-200 text-[11px] uppercase tracking-wider font-semibold text-slate-400">
            Custom · {customComputedVars.length}
          </div>
          {customComputedVars.map((v) => {
            const uv = v as UIVariable;
            return (
              <div
                key={v.name}
                onClick={() => onSelectComputed(v.name)}
                className={`flex items-center gap-2.5 px-3 py-2 border-t border-slate-100 first:border-none cursor-pointer transition-colors ${
                  selectedComputed === v.name ? "bg-purple-50" : "hover:bg-slate-50"
                }`}
              >
                <span className="w-5 h-5 rounded flex items-center justify-center bg-purple-50 text-purple-700 font-mono text-[11px] font-bold shrink-0">ƒ</span>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-purple-700 text-[12px]">{`{${v.name}}`}</div>
                  <div className="text-[11px] text-slate-400 truncate">{describeCustomVar(uv)}</div>
                </div>
                <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${FN_BADGE[v.computedFn ?? ""] ?? "bg-slate-50 text-slate-400 border-slate-200"}`}>
                  {v.computedFn}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteComputed(v.name); }}
                  className="p-0.5 text-slate-300 hover:text-red-500 transition-colors ml-1"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── CustomBlocksPane ─────────────────────────────────────────────────────────

const PART_TYPE_BADGE: Record<ConstructPartType, string> = {
  static_text:  "bg-slate-100 text-slate-500",
  computed_var: "bg-purple-50 text-purple-700",
  user_input:   "bg-blue-50 text-blue-700",
  image:        "bg-orange-50 text-orange-700",
};

function CustomBlocksPane({
  schema,
  onNew,
  onDelete,
  onSelect,
  selectedConstruct,
}: {
  schema: ExtendedSchema;
  onNew: () => void;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
  selectedConstruct: string | null;
}) {
  const customConstructs = (schema.constructs ?? []).filter((c) => c.definition != null);

  return (
    <div className="p-6 pb-20 max-w-[760px] mx-auto">
      <div className="flex items-end justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-0.5">Custom blocks</h2>
          <p className="text-[12.5px] text-slate-400">
            Combine atomic editor blocks into reusable constructs. Surfaced as slash commands.
          </p>
        </div>
        <button
          onClick={onNew}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900 text-white rounded-md text-[12.5px] font-medium hover:bg-slate-700 transition-colors"
        >
          <Plus size={11} /> New custom block
        </button>
      </div>

      {customConstructs.length === 0 ? (
        <div className="py-16 text-center text-slate-400 text-[12.5px]">
          <Blocks size={28} className="mx-auto mb-3 opacity-25" />
          <p className="mb-3">No custom blocks yet.</p>
          <button
            onClick={onNew}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-slate-300 rounded-md text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors text-[12px]"
          >
            <Plus size={12} /> Create your first custom block
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {customConstructs.map((ref) => {
            const def = ref.definition!;
            const isSelected = selectedConstruct === ref.id;
            const counterVar = def.counterVariable
              ? (schema.variables ?? []).find((v) => v.name === def.counterVariable)
              : undefined;

            return (
              <div
                key={ref.id}
                onClick={() => onSelect(ref.id)}
                className={`bg-white border rounded-xl p-3.5 cursor-pointer transition-all ${
                  isSelected ? "border-blue-400 ring-2 ring-blue-100" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-start justify-between mb-1.5">
                  <div>
                    <div className="font-semibold text-[13.5px] text-slate-900">{def.label}</div>
                    <div className="font-mono text-[11px] text-slate-400">
                      {def.slashCommand}
                      {def.aliases?.length ? " · " + def.aliases.join(", ") : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {counterVar && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9.5px] font-mono bg-purple-50 text-purple-700 border border-purple-200">
                        ƒ {counterVar.name}
                      </span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(ref.id); }}
                      className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
                {(def.parts ?? []).length > 0 && (
                  <div className="flex flex-col gap-1 mt-2">
                    {(def.parts ?? []).map((p, i) => (
                      <div key={p.id} className="flex items-center gap-1.5 text-[11.5px] text-slate-500">
                        <span className="w-4 h-4 rounded flex items-center justify-center bg-slate-100 text-[9px] text-slate-400 shrink-0">
                          {i + 1}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${PART_TYPE_BADGE[p.type]}`}>
                          {p.type === "static_text" ? `"${p.content ?? ""}"` : p.type === "computed_var" ? `{${p.variableName}}` : p.type === "user_input" ? `[${p.placeholder ?? "user input"}]` : "image"}
                        </span>
                        {p.style?.bold && <span className="text-[10px] text-slate-400 font-bold">B</span>}
                        {p.style?.italic && <span className="text-[10px] text-slate-400 italic">I</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <button
            onClick={onNew}
            className="flex items-center justify-center gap-2 h-36 border border-dashed border-slate-300 rounded-xl text-slate-400 text-[12px] hover:border-blue-400 hover:text-blue-600 transition-colors"
          >
            <Plus size={14} /> New custom block
          </button>
        </div>
      )}
    </div>
  );
}

// ─── PageRulesPanel (right inspector) ────────────────────────────────────────

const PAGE_TYPE_DEFAULTS: Record<
  PageType,
  {
    showHeader: boolean;
    showFooter: boolean;
    showPageNumber: boolean;
    numberingFormat: "arabic" | "roman" | "alpha";
    numberingStart: number;
    border: "none" | "thin" | "gold";
    watermark: boolean;
  }
> = {
  cover:       { showHeader: false, showFooter: false, showPageNumber: false, numberingFormat: "arabic", numberingStart: 1, border: "gold",  watermark: false },
  toc:         { showHeader: true,  showFooter: true,  showPageNumber: true,  numberingFormat: "roman",  numberingStart: 1, border: "none",  watermark: false },
  content:     { showHeader: true,  showFooter: true,  showPageNumber: true,  numberingFormat: "arabic", numberingStart: 1, border: "none",  watermark: false },
  certificate: { showHeader: false, showFooter: false, showPageNumber: false, numberingFormat: "arabic", numberingStart: 1, border: "gold",  watermark: false },
  unnumbered:  { showHeader: true,  showFooter: true,  showPageNumber: false, numberingFormat: "arabic", numberingStart: 1, border: "none",  watermark: false },
  appendix:    { showHeader: true,  showFooter: true,  showPageNumber: true,  numberingFormat: "alpha",  numberingStart: 1, border: "none",  watermark: false },
};

function PageRulesPanel({
  schema,
  master,
  pageType,
  onSchemaChange,
}: {
  schema: ExtendedSchema;
  master: boolean;
  pageType: PageType;
  onSchemaChange: (s: ExtendedSchema) => void;
}) {
  const landscape = isLandscape(schema);
  const detectedSize = detectPageSize(schema.page.width, schema.page.height);

  // Read page-type config, falling back to defaults
  const ptDefaults = PAGE_TYPE_DEFAULTS[pageType];
  const ptConfig = schema.pageTypeConfigs?.[pageType] ?? {};
  const showHeader     = ptConfig.showHeader     ?? ptDefaults.showHeader;
  const showFooter     = ptConfig.showFooter     ?? ptDefaults.showFooter;
  const showPageNumber = ptConfig.showPageNumber ?? ptDefaults.showPageNumber;
  const numFormat      = ptConfig.numberingFormat ?? ptDefaults.numberingFormat;
  const numStart       = ptConfig.numberingStart  ?? ptDefaults.numberingStart;
  const border         = ptConfig.border          ?? ptDefaults.border;
  const watermark      = ptConfig.watermark       ?? ptDefaults.watermark;

  function setPTC(updates: Partial<typeof ptConfig>) {
    onSchemaChange({
      ...schema,
      pageTypeConfigs: {
        ...schema.pageTypeConfigs,
        [pageType]: { ...ptConfig, ...updates },
      },
    });
  }

  function setPageSize(size: string, orientation: "portrait" | "landscape") {
    const s = PAGE_SIZES[size] ?? PAGE_SIZES.A4;
    const w = orientation === "landscape" ? Math.max(s.w, s.h) : Math.min(s.w, s.h);
    const h = orientation === "landscape" ? Math.min(s.w, s.h) : Math.max(s.w, s.h);
    onSchemaChange({ ...schema, page: { ...schema.page, width: w, height: h } });
  }

  function setMargin(side: "top" | "right" | "bottom" | "left", mm: string) {
    const pt = mmToPt(parseFloat(mm) || 0);
    onSchemaChange({ ...schema, page: { ...schema.page, margins: { ...schema.page.margins, [side]: pt } } });
  }

  function setHeaderText(text: string) {
    onSchemaChange({ ...schema, header: { height: schema.header?.height ?? 30, text } });
  }

  function setFooterText(text: string) {
    onSchemaChange({ ...schema, footer: { height: schema.footer?.height ?? 20, text } });
  }

  return (
    <>
      <div className="text-[11.5px] text-slate-400 mb-2">
        {master
          ? "Master rules apply to every page type unless overridden."
          : `Overrides on /${pageType}. Blank = inherit from master.`}
      </div>

      {master && (
        <>
          <SectionTitle>Page geometry</SectionTitle>
          <Fld label="Size">
            <FldSelect
              value={detectedSize}
              onChange={(v) => setPageSize(v, landscape ? "landscape" : "portrait")}
              options={Object.keys(PAGE_SIZES).map((k) => ({ value: k, label: k }))}
            />
          </Fld>
          <Fld label="Orientation">
            <Seg
              value={landscape ? "landscape" : "portrait"}
              options={[
                { value: "portrait", label: "Portrait" },
                { value: "landscape", label: "Landscape" },
              ]}
              onChange={(v) => setPageSize(detectedSize, v as "portrait" | "landscape")}
            />
          </Fld>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <Fld label="Margin top">
              <FldInput type="number" value={ptToMm(schema.page.margins.top)} onChange={(v) => setMargin("top", v)} />
            </Fld>
            <Fld label="Margin bottom">
              <FldInput type="number" value={ptToMm(schema.page.margins.bottom)} onChange={(v) => setMargin("bottom", v)} />
            </Fld>
            <Fld label="Margin left">
              <FldInput type="number" value={ptToMm(schema.page.margins.left)} onChange={(v) => setMargin("left", v)} />
            </Fld>
            <Fld label="Margin right">
              <FldInput type="number" value={ptToMm(schema.page.margins.right)} onChange={(v) => setMargin("right", v)} />
            </Fld>
          </div>
        </>
      )}

      <SectionTitle>Numbering</SectionTitle>
      <Toggle
        on={showPageNumber}
        onChange={(v) => setPTC({ showPageNumber: v })}
        label="Show page number"
        hint={master ? undefined : ptConfig.showPageNumber == null ? "Default from page type" : undefined}
      />
      <div className={`grid grid-cols-2 gap-2 mt-2 ${!showPageNumber ? "opacity-40 pointer-events-none" : ""}`}>
        <Fld label="Format">
          <Seg
            value={numFormat}
            options={[
              { value: "arabic", label: "1, 2" },
              { value: "roman", label: "i, ii" },
              { value: "alpha", label: "A, B" },
            ]}
            onChange={(v) => setPTC({ numberingFormat: v as "arabic" | "roman" | "alpha" })}
          />
        </Fld>
        <Fld label="Start from">
          <FldInput
            type="number"
            value={numStart}
            onChange={(v) => setPTC({ numberingStart: parseInt(v) || 1 })}
          />
        </Fld>
      </div>

      <SectionTitle>Header</SectionTitle>
      <Toggle
        on={showHeader}
        onChange={(v) => setPTC({ showHeader: v })}
        label="Show header"
        hint={!master && ptConfig.showHeader == null ? "Default from page type" : undefined}
      />
      {master && (
        <div className={`mt-2 ${!showHeader ? "opacity-40 pointer-events-none" : ""}`}>
          <Fld label="Left content">
            <FldInput
              mono
              value={schema.header?.text?.split("·")[0]?.trim() ?? ""}
              onChange={(v) => {
                const right = schema.header?.text?.split("·")[1]?.trim() ?? "";
                setHeaderText(right ? `${v} · ${right}` : v);
              }}
              placeholder="{org_name}"
            />
          </Fld>
          <Fld label="Right content">
            <FldInput
              mono
              value={schema.header?.text?.split("·")[1]?.trim() ?? ""}
              onChange={(v) => {
                const left = schema.header?.text?.split("·")[0]?.trim() ?? "";
                setHeaderText(left ? `${left} · ${v}` : v);
              }}
              placeholder="{report_title}"
            />
          </Fld>
        </div>
      )}

      <SectionTitle>Footer</SectionTitle>
      <Toggle
        on={showFooter}
        onChange={(v) => setPTC({ showFooter: v })}
        label="Show footer"
        hint={!master && ptConfig.showFooter == null ? "Default from page type" : undefined}
      />
      {master && (
        <div className={`mt-2 ${!showFooter ? "opacity-40 pointer-events-none" : ""}`}>
          <Fld label="Footer text">
            <FldInput
              mono
              value={schema.footer?.text ?? ""}
              onChange={setFooterText}
              placeholder="Confidential"
            />
          </Fld>
        </div>
      )}

      <SectionTitle>Background</SectionTitle>
      <Fld label="Border">
        <Seg
          value={border}
          options={[
            { value: "none", label: "None" },
            { value: "thin", label: "Thin" },
            { value: "gold", label: "Gold" },
          ]}
          onChange={(v) => setPTC({ border: v as "none" | "thin" | "gold" })}
        />
      </Fld>
      <Toggle
        on={watermark}
        onChange={(v) => setPTC({ watermark: v })}
        label="Watermark"
      />
    </>
  );
}

// ─── VariableInspector ────────────────────────────────────────────────────────

function VariableInspector({
  schema,
  selectedVar,
  onSchemaChange,
}: {
  schema: ExtendedSchema;
  selectedVar: string | null;
  onSchemaChange: (s: ExtendedSchema) => void;
}) {
  const variable = (schema.variables ?? []).find(
    (v) => v.name === selectedVar,
  ) as UIVariable | undefined;

  if (!variable) {
    return (
      <div className="text-[12px] text-slate-400 py-8 text-center">
        Select a variable to edit its settings.
      </div>
    );
  }

  function updateVar(updates: Partial<UIVariable>) {
    const newVars = (schema.variables ?? []).map((v) =>
      v.name === selectedVar ? { ...v, ...updates } : v,
    );
    onSchemaChange({ ...schema, variables: newVars });
  }

  return (
    <>
      <div className="text-[11.5px] text-slate-400 mb-3">
        Selected:{" "}
        <span className="font-mono text-blue-700">{`{${variable.name}}`}</span>
      </div>
      <Fld label="Display name">
        <FldInput
          value={variable.label}
          onChange={(v) => updateVar({ label: v })}
        />
      </Fld>
      <Fld label="Key (identifier)">
        <FldInput mono value={variable.name} onChange={() => {}} />
      </Fld>
      <Fld label="Type">
        <FldSelect
          value={(variable as UIVariable).dataType ?? "string"}
          onChange={(v) => updateVar({ dataType: v as DataType })}
          options={[
            { value: "string", label: "string" },
            { value: "number", label: "number" },
            { value: "currency", label: "currency" },
            { value: "date", label: "date" },
            { value: "image", label: "image" },
          ]}
        />
      </Fld>
      <Fld label="Default value">
        <FldInput
          value={variable.defaultValue ?? ""}
          onChange={(v) => updateVar({ defaultValue: v })}
        />
      </Fld>
      <Fld label="Placeholder shown in editor">
        <FldInput
          value={(variable as UIVariable).placeholder ?? ""}
          onChange={(v) => updateVar({ placeholder: v })}
          placeholder="e.g. Acme Corp"
        />
      </Fld>
      <Toggle
        on={(variable as UIVariable).required ?? false}
        onChange={(v) => updateVar({ required: v })}
        label="Required"
      />
      <Toggle on={false} onChange={() => {}} label="Show in onboarding panel" />
      <Fld label="Group">
        <FldInput
          value={(variable as UIVariable).group ?? "General"}
          onChange={(v) => updateVar({ group: v })}
          placeholder="General"
        />
      </Fld>
    </>
  );
}

// ─── ComputedInspector ────────────────────────────────────────────────────────

function ComputedInspector({
  schema,
  selectedComputed,
  onSchemaChange,
}: {
  schema: ExtendedSchema;
  selectedComputed: string | null;
  onSchemaChange: (s: ExtendedSchema) => void;
}) {
  const isBuiltin = BUILT_IN_COMPUTED.some((b) => b.name === selectedComputed);
  const variable = !isBuiltin
    ? ((schema.variables ?? []).find((v) => v.name === selectedComputed) as UIVariable | undefined)
    : undefined;

  const customConstructIds = (schema.constructs ?? [])
    .filter((c) => c.definition != null)
    .map((c) => ({ value: c.id, label: c.definition!.label ?? c.id }));

  const allVarNames = (schema.variables ?? [])
    .filter((v) => v.name !== selectedComputed)
    .map((v) => v.name);

  function updateVar(updates: Partial<UIVariable>) {
    const newVars = (schema.variables ?? []).map((v) =>
      v.name === selectedComputed ? { ...v, ...updates } : v,
    );
    onSchemaChange({ ...schema, variables: newVars });
  }

  if (!selectedComputed) {
    return (
      <>
        <div className="text-[12px] text-slate-400 py-4 text-center mb-4">
          Select a computed variable to edit it.
        </div>
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-[12px] text-slate-500">
          <p className="mb-1.5 font-medium text-slate-700">Built-in computed vars</p>
          {BUILT_IN_COMPUTED.map((c) => (
            <div key={c.name} className="flex items-center gap-2 py-1">
              <span className="w-4 h-4 rounded flex items-center justify-center bg-purple-50 text-purple-700 font-mono text-[9px] font-bold">ƒ</span>
              <span className="font-mono text-purple-700 text-[11.5px]">{`{${c.name}}`}</span>
              <span className="text-slate-400 text-[11px]">— {c.desc}</span>
            </div>
          ))}
        </div>
      </>
    );
  }

  if (isBuiltin) {
    const builtin = BUILT_IN_COMPUTED.find((b) => b.name === selectedComputed)!;
    return (
      <>
        <div className="text-[11.5px] text-slate-400 mb-3">
          Selected: <span className="font-mono text-purple-700">{`{${builtin.name}}`}</span>
        </div>
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-[12px] text-slate-500">
          <p className="font-medium text-slate-700 mb-1">{builtin.label}</p>
          <p>{builtin.desc}</p>
          <p className="text-[11px] text-slate-400 mt-1">{builtin.format}</p>
          <p className="text-[11px] text-slate-400 mt-2 italic">Built-in — cannot be edited.</p>
        </div>
      </>
    );
  }

  if (!variable) return null;

  const fnLabel: Record<string, string> = {
    counter: "Counter",
    counter_reset: "Resettable counter",
    derived: "Derived formula",
  };

  return (
    <>
      <div className="text-[11.5px] text-slate-400 mb-3">
        Selected: <span className="font-mono text-purple-700">{`{${variable.name}}`}</span>
      </div>
      <Fld label="Display label">
        <FldInput value={variable.label} onChange={(v) => updateVar({ label: v })} />
      </Fld>
      <Fld label="Key (identifier)">
        <FldInput mono value={variable.name} onChange={() => {}} />
      </Fld>
      <Fld label="Type">
        <div className="text-[12px] font-mono text-slate-600 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-md">
          {fnLabel[variable.computedFn ?? ""] ?? variable.computedFn ?? "—"}
        </div>
      </Fld>

      {(variable.computedFn === "counter" || variable.computedFn === "counter_reset") && (
        <>
          <Fld label="Counts insertions of">
            <FldSelect
              value={variable.counterConstruct ?? ""}
              onChange={(v) => updateVar({ counterConstruct: v })}
              options={[{ value: "", label: "— select construct —" }, ...customConstructIds]}
            />
          </Fld>
          {variable.computedFn === "counter_reset" && (
            <Fld label="Resets when">
              <FldSelect
                value={variable.counterResetOn ?? ""}
                onChange={(v) => updateVar({ counterResetOn: v || undefined })}
                options={[{ value: "", label: "Never (global counter)" }, ...customConstructIds]}
              />
            </Fld>
          )}
        </>
      )}

      {variable.computedFn === "derived" && (
        <Fld label="Formula">
          <FldInput
            mono
            value={variable.formula ?? ""}
            onChange={(v) => updateVar({ formula: v })}
            placeholder="{chapter_number}.{fig_number}"
          />
          {allVarNames.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {allVarNames.map((n) => (
                <button
                  key={n}
                  onClick={() => updateVar({ formula: (variable.formula ?? "") + `{${n}}` })}
                  className="px-1.5 py-0.5 rounded text-[10.5px] font-mono bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                >
                  {`{${n}}`}
                </button>
              ))}
            </div>
          )}
        </Fld>
      )}
    </>
  );
}

// ─── BlockInspector ───────────────────────────────────────────────────────────

function BlockInspector({
  schema,
  selectedConstruct,
  onSchemaChange,
}: {
  schema: ExtendedSchema;
  selectedConstruct: string | null;
  onSchemaChange: (s: ExtendedSchema) => void;
}) {
  const ref = (schema.constructs ?? []).find((c) => c.id === selectedConstruct);
  const def = ref?.definition;

  const computedVarNames = (schema.variables ?? [])
    .filter((v) => v.type === "COMPUTED")
    .map((v) => v.name);

  const customConstructIds = (schema.constructs ?? [])
    .filter((c) => c.definition != null && c.id !== selectedConstruct)
    .map((c) => ({ value: c.id, label: c.definition!.label ?? c.id }));

  function updateDef(updates: Partial<NonNullable<typeof def>>) {
    if (!ref) return;
    onSchemaChange({
      ...schema,
      constructs: (schema.constructs ?? []).map((c) =>
        c.id === selectedConstruct
          ? { ...c, definition: { ...c.definition!, ...updates } }
          : c,
      ),
    });
  }

  function updatePart(partId: string, updates: Partial<ConstructPart>) {
    if (!def) return;
    updateDef({
      parts: (def.parts ?? []).map((p) => (p.id === partId ? { ...p, ...updates } : p)),
    });
  }

  if (!selectedConstruct || !def) {
    return (
      <div className="text-[12px] text-slate-400 py-8 text-center">
        Select a custom block to edit its settings.
      </div>
    );
  }

  return (
    <>
      <div className="text-[11.5px] text-slate-400 mb-3">
        Selected: <span className="font-semibold text-slate-700">{def.label}</span>
      </div>
      <Fld label="Block name">
        <FldInput value={def.label} onChange={(v) => updateDef({ label: v })} />
      </Fld>
      <Fld label="Slash command">
        <FldInput mono value={def.slashCommand ?? ""} onChange={(v) => updateDef({ slashCommand: v })} />
      </Fld>
      <Fld label="Aliases (comma-separated)">
        <FldInput
          mono
          value={(def.aliases ?? []).join(", ")}
          onChange={(v) => updateDef({ aliases: v.split(",").map((s) => s.trim()).filter(Boolean) })}
        />
      </Fld>
      <Fld label="Category">
        <FldSelect
          value={def.category ?? "Structure"}
          onChange={(v) => updateDef({ category: v as ConstructCategory })}
          options={["Text", "Media", "Layout", "Structure"].map((c) => ({ value: c, label: c }))}
        />
      </Fld>

      <SectionTitle>Counter variable</SectionTitle>
      <Fld label="Drives counter">
        <FldSelect
          value={def.counterVariable ?? ""}
          onChange={(v) => updateDef({ counterVariable: v || undefined })}
          options={[{ value: "", label: "None" }, ...computedVarNames.map((n) => ({ value: n, label: n }))]}
        />
      </Fld>

      <SectionTitle>Composition</SectionTitle>
      {(def.parts ?? []).length === 0 ? (
        <div className="text-[11.5px] text-slate-400">No parts defined.</div>
      ) : (
        <div className="space-y-2">
          {(def.parts ?? []).map((p) => (
            <div key={p.id} className="p-2 bg-slate-50 rounded-md border border-slate-200 text-[11.5px]">
              <div className="font-mono text-slate-500 mb-1">
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${PART_TYPE_BADGE[p.type]}`}>{p.type}</span>
              </div>
              {p.type === "static_text" && (
                <input
                  value={p.content ?? ""}
                  onChange={(e) => updatePart(p.id, { content: e.target.value })}
                  className="w-full px-2 py-1 text-[12px] font-mono bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-500"
                />
              )}
              {p.type === "computed_var" && (
                <select
                  value={p.variableName ?? ""}
                  onChange={(e) => updatePart(p.id, { variableName: e.target.value })}
                  className="w-full px-2 py-1 text-[11.5px] bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-500"
                >
                  <option value="">— select variable —</option>
                  {(schema.variables ?? []).map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
                </select>
              )}
              {p.type === "user_input" && (
                <input
                  value={p.placeholder ?? ""}
                  onChange={(e) => updatePart(p.id, { placeholder: e.target.value })}
                  placeholder="Placeholder hint"
                  className="w-full px-2 py-1 text-[12px] bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-500"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ─── NewComputedModal ─────────────────────────────────────────────────────────

type ComputedKind = "counter" | "counter_reset" | "derived";

function NewComputedModal({
  schema,
  onSave,
  onClose,
}: {
  schema: ExtendedSchema;
  onSave: (v: UIVariable) => void;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<ComputedKind>("counter");
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [counterConstruct, setCounterConstruct] = useState("");
  const [counterResetOn, setCounterResetOn] = useState("");
  const [formula, setFormula] = useState("");

  const customConstructIds = (schema.constructs ?? [])
    .filter((c) => c.definition != null)
    .map((c) => ({ value: c.id, label: c.definition!.label ?? c.id }));

  const allVarNames = (schema.variables ?? []).map((v) => v.name);

  function insertRef(varName: string) {
    setFormula((f) => f + `{${varName}}`);
  }

  function save() {
    if (!name.trim()) return;
    const base: UIVariable = {
      name: name.trim().replace(/\s+/g, "_").toLowerCase(),
      label: label || name,
      type: "COMPUTED",
    };
    if (kind === "counter") {
      onSave({ ...base, computedFn: "counter", counterConstruct });
    } else if (kind === "counter_reset") {
      onSave({ ...base, computedFn: "counter_reset", counterConstruct, counterResetOn });
    } else {
      onSave({ ...base, computedFn: "derived", formula });
    }
  }

  const canSave =
    name.trim() &&
    (kind === "counter"
      ? !!counterConstruct
      : kind === "counter_reset"
        ? !!counterConstruct && !!counterResetOn
        : !!formula.trim());

  return (
    <div
      className="fixed inset-0 bg-slate-900/45 flex items-center justify-center z-50 p-8"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900">New computed variable</h2>
            <p className="text-[12px] text-slate-400 mt-0.5">Derived at render time. Read-only for document authors.</p>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X size={14} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Kind selector */}
          <Fld label="Type">
            <div className="flex gap-2">
              {(["counter", "counter_reset", "derived"] as ComputedKind[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={`flex-1 px-2 py-2 rounded-md border text-[12px] transition-colors ${
                    kind === k
                      ? "border-blue-500 bg-blue-50 text-blue-700 font-medium"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {k === "counter" ? "Counter" : k === "counter_reset" ? "Resettable counter" : "Derived formula"}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              {kind === "counter"
                ? "Counts how many times a specific construct has been inserted in the document."
                : kind === "counter_reset"
                  ? "Counts construct insertions but resets to 0 when a parent construct appears (e.g. figure numbers per chapter)."
                  : "Evaluates a formula by substituting values of other variables at render time."}
            </p>
          </Fld>

          <div className="grid grid-cols-2 gap-3">
            <Fld label="Key (identifier)">
              <FldInput mono value={name} onChange={setName} placeholder="chapter_number" />
            </Fld>
            <Fld label="Display label">
              <FldInput value={label} onChange={setLabel} placeholder="Chapter number" />
            </Fld>
          </div>

          {(kind === "counter" || kind === "counter_reset") && (
            <Fld label="Count insertions of construct">
              {customConstructIds.length > 0 ? (
                <FldSelect
                  value={counterConstruct}
                  onChange={setCounterConstruct}
                  options={[{ value: "", label: "— select construct —" }, ...customConstructIds]}
                />
              ) : (
                <div className="text-[11.5px] text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                  No custom constructs yet. Create one in the Custom Blocks tab first.
                </div>
              )}
            </Fld>
          )}

          {kind === "counter_reset" && (
            <Fld label="Reset when this construct appears">
              {customConstructIds.length > 0 ? (
                <FldSelect
                  value={counterResetOn}
                  onChange={setCounterResetOn}
                  options={[{ value: "", label: "— select construct —" }, ...customConstructIds]}
                />
              ) : (
                <div className="text-[11.5px] text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                  No custom constructs yet.
                </div>
              )}
            </Fld>
          )}

          {kind === "derived" && (
            <Fld label="Formula">
              <FldInput
                mono
                value={formula}
                onChange={setFormula}
                placeholder="{chapter_number}.{fig_number}"
              />
              {allVarNames.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {allVarNames.map((n) => (
                    <button
                      key={n}
                      onClick={() => insertRef(n)}
                      className="px-1.5 py-0.5 rounded text-[10.5px] font-mono bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                    >
                      {`{${n}}`}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-slate-400 mt-1">
                Use <span className="font-mono">{"{var_name}"}</span> to reference any static or computed variable.
              </p>
            </Fld>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
          <span className="text-[11.5px] text-slate-400">Saved to this template's variable list.</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 border border-slate-200 rounded-md text-[12.5px] text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={!canSave}
              className="px-3 py-1.5 bg-slate-900 text-white rounded-md text-[12.5px] font-medium hover:bg-slate-700 disabled:opacity-40"
            >
              Save variable
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── NewVariableModal ─────────────────────────────────────────────────────────

function NewVariableModal({
  onSave,
  onClose,
}: {
  onSave: (v: UIVariable) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [dataType, setDataType] = useState<DataType>("string");
  const [required, setRequired] = useState(false);
  const [defaultValue, setDefaultValue] = useState("");
  const [group, setGroup] = useState("General");

  function save() {
    if (!name.trim()) return;
    onSave({
      name: name.trim().replace(/\s+/g, "_").toLowerCase(),
      label: label || name,
      type: "STATIC",
      dataType,
      required,
      defaultValue: defaultValue || undefined,
      group,
    });
  }

  return (
    <div
      className="fixed inset-0 bg-slate-900/45 flex items-center justify-center z-50 p-8"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900">
              New variable
            </h2>
            <p className="text-[12px] text-slate-400 mt-0.5">
              A slot the document author fills in.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X size={14} />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Fld label="Key (identifier)">
              <FldInput
                mono
                value={name}
                onChange={setName}
                placeholder="org_name"
              />
            </Fld>
            <Fld label="Display name">
              <FldInput
                value={label}
                onChange={setLabel}
                placeholder="Organisation name"
              />
            </Fld>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Fld label="Type">
              <FldSelect
                value={dataType}
                onChange={(v) => setDataType(v as DataType)}
                options={[
                  { value: "string", label: "string" },
                  { value: "number", label: "number" },
                  { value: "currency", label: "currency" },
                  { value: "date", label: "date" },
                  { value: "image", label: "image" },
                ]}
              />
            </Fld>
            <Fld label="Group">
              <FldInput
                value={group}
                onChange={setGroup}
                placeholder="General"
              />
            </Fld>
          </div>
          <Fld label="Default value">
            <FldInput
              value={defaultValue}
              onChange={setDefaultValue}
              placeholder="Optional default"
            />
          </Fld>
          <Toggle on={required} onChange={setRequired} label="Required" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
          <span className="text-[11.5px] text-slate-400">
            Saved as a variable in this template.
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 border border-slate-200 rounded-md text-[12.5px] text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={!name.trim()}
              className="px-3 py-1.5 bg-slate-900 text-white rounded-md text-[12.5px] font-medium hover:bg-slate-700 disabled:opacity-40"
            >
              Save variable
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── NewCustomBlockModal ──────────────────────────────────────────────────────


function uid() {
  return Math.random().toString(36).slice(2, 9);
}

const PART_TYPE_LABELS: Record<ConstructPartType, string> = {
  static_text:  "Static text",
  computed_var: "Computed variable",
  user_input:   "User input",
  image:        "Image placeholder",
};

function PartRow({
  part,
  allVarNames,
  pendingVarName,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  part: ConstructPart;
  allVarNames: string[];
  pendingVarName?: string;
  onChange: (p: ConstructPart) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <div className="flex items-start gap-2 p-2 bg-slate-50 rounded-md border border-slate-200">
      <div className="flex flex-col gap-0.5 pt-1">
        <button onClick={onMoveUp} disabled={isFirst} className="text-slate-300 hover:text-slate-600 disabled:opacity-20 text-xs leading-none">▲</button>
        <button onClick={onMoveDown} disabled={isLast} className="text-slate-300 hover:text-slate-600 disabled:opacity-20 text-xs leading-none">▼</button>
      </div>
      <div className="flex-1 space-y-1.5">
        <select
          value={part.type}
          onChange={(e) => onChange({ ...part, type: e.target.value as ConstructPartType, content: undefined, variableName: undefined, placeholder: undefined })}
          className="w-full px-2 py-1 text-[11.5px] bg-white border border-slate-300 rounded text-slate-700 focus:outline-none focus:border-blue-500"
        >
          {(Object.keys(PART_TYPE_LABELS) as ConstructPartType[]).map((t) => (
            <option key={t} value={t}>{PART_TYPE_LABELS[t]}</option>
          ))}
        </select>

        {part.type === "static_text" && (
          <input
            value={part.content ?? ""}
            onChange={(e) => onChange({ ...part, content: e.target.value })}
            placeholder='e.g. "Chapter "'
            className="w-full px-2 py-1 text-[12px] font-mono bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-500"
          />
        )}
        {part.type === "computed_var" && (
          <select
            value={part.variableName ?? ""}
            onChange={(e) => onChange({ ...part, variableName: e.target.value })}
            className="w-full px-2 py-1 text-[11.5px] bg-white border border-slate-300 rounded text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="">— select variable —</option>
            {allVarNames.map((n) => (
              <option key={n} value={n}>
                {n === pendingVarName ? `${n}  (will be created)` : n}
              </option>
            ))}
          </select>
        )}
        {part.type === "user_input" && (
          <input
            value={part.placeholder ?? ""}
            onChange={(e) => onChange({ ...part, placeholder: e.target.value })}
            placeholder="Placeholder hint, e.g. Caption text"
            className="w-full px-2 py-1 text-[12px] bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-500"
          />
        )}

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <input type="checkbox" checked={!!part.style?.bold} onChange={(e) => onChange({ ...part, style: { ...part.style, bold: e.target.checked } })} />
            Bold
          </label>
          <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <input type="checkbox" checked={!!part.style?.italic} onChange={(e) => onChange({ ...part, style: { ...part.style, italic: e.target.checked } })} />
            Italic
          </label>
          <select
            value={part.style?.alignment ?? "left"}
            onChange={(e) => onChange({ ...part, style: { ...part.style, alignment: e.target.value as "left" | "center" | "right" | "justify" } })}
            className="ml-auto px-1.5 py-0.5 text-[11px] bg-white border border-slate-200 rounded text-slate-600"
          >
            {["left", "center", "right", "justify"].map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>
      <button onClick={onDelete} className="p-1 text-slate-300 hover:text-red-500 transition-colors mt-0.5">
        <Trash2 size={12} />
      </button>
    </div>
  );
}

function NewCustomBlockModal({
  schema,
  onSave,
  onClose,
}: {
  schema: ExtendedSchema;
  onSave: (ref: TemplateConstructRef, autoVar?: UIVariable) => void;
  onClose: () => void;
}) {
  const [blockName, setBlockName] = useState("");
  const [slash, setSlash] = useState("");
  const [aliases, setAliases] = useState("");
  const [category, setCategory] = useState<ConstructCategory>("Structure");
  const [parts, setParts] = useState<ConstructPart[]>([]);
  const [createCounter, setCreateCounter] = useState(false);
  const [counterVarName, setCounterVarName] = useState("");
  const [counterVarLabel, setCounterVarLabel] = useState("");
  const [counterResetOn, setCounterResetOn] = useState("");

  const existingVarNames = (schema.variables ?? []).map((v) => v.name);
  const pendingCounterVarName = createCounter ? counterVarName.trim().replace(/\s+/g, "_").toLowerCase() : "";
  // Include the pending counter var so it can be referenced in parts before save
  const allVarNames = pendingCounterVarName && !existingVarNames.includes(pendingCounterVarName)
    ? [...existingVarNames, pendingCounterVarName]
    : existingVarNames;

  const customConstructIds = (schema.constructs ?? [])
    .filter((c) => c.definition != null && c.id !== "")
    .map((c) => ({ value: c.id, label: c.definition!.label ?? c.id }));

  function addPart(type: ConstructPartType) {
    setParts((ps) => [...ps, { id: uid(), type }]);
  }

  function updatePart(id: string, p: ConstructPart) {
    setParts((ps) => ps.map((x) => (x.id === id ? p : x)));
  }

  function deletePart(id: string) {
    setParts((ps) => ps.filter((x) => x.id !== id));
  }

  function movePart(idx: number, dir: -1 | 1) {
    setParts((ps) => {
      const next = [...ps];
      const tmp = next[idx];
      next[idx] = next[idx + dir];
      next[idx + dir] = tmp;
      return next;
    });
  }

  function handleNameChange(v: string) {
    setBlockName(v);
    if (!slash) setSlash("/" + v.toLowerCase().replace(/\s+/g, "-"));
    if (!counterVarName) setCounterVarName(v.toLowerCase().replace(/\s+/g, "_") + "_number");
    if (!counterVarLabel) setCounterVarLabel(v + " number");
  }

  function save() {
    if (!blockName.trim()) return;
    const id = blockName.trim().toLowerCase().replace(/\s+/g, "-");
    const counterVarId = counterVarName.trim().replace(/\s+/g, "_").toLowerCase();

    const ref: TemplateConstructRef = {
      id,
      definition: {
        id,
        label: blockName.trim(),
        category,
        lexicalNodeTypes: ["custom-" + id],
        composite: parts.length > 1,
        pdf: {},
        parts,
        counterVariable: createCounter ? counterVarId : undefined,
        slashCommand: slash.startsWith("/") ? slash : "/" + slash,
        aliases: aliases ? aliases.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
      },
    };

    let autoVar: UIVariable | undefined;
    if (createCounter && counterVarId) {
      autoVar = {
        name: counterVarId,
        label: counterVarLabel || counterVarId,
        type: "COMPUTED",
        computedFn: counterResetOn ? "counter_reset" : "counter",
        counterConstruct: id,
        counterResetOn: counterResetOn || undefined,
      };
    }

    onSave(ref, autoVar);
  }

  const canSave = blockName.trim() && parts.length > 0 && (!createCounter || counterVarName.trim());

  return (
    <div
      className="fixed inset-0 bg-slate-900/45 flex items-center justify-center z-50 p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900">New custom block</h2>
            <p className="text-[12px] text-slate-400 mt-0.5">Define the composition and behavior of a slash-command construct.</p>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Identity */}
          <div className="grid grid-cols-2 gap-3">
            <Fld label="Block name">
              <FldInput value={blockName} onChange={handleNameChange} placeholder="Chapter" />
            </Fld>
            <Fld label="Category">
              <FldSelect
                value={category}
                onChange={(v) => setCategory(v as ConstructCategory)}
                options={["Text", "Media", "Layout", "Structure"].map((c) => ({ value: c, label: c }))}
              />
            </Fld>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Fld label="Slash command">
              <FldInput mono value={slash} onChange={setSlash} placeholder="/chapter" />
            </Fld>
            <Fld label="Aliases (comma-separated)">
              <FldInput mono value={aliases} onChange={setAliases} placeholder="/ch, /chap" />
            </Fld>
          </div>

          {/* Parts */}
          <div>
            {pendingCounterVarName && (
              <div className="mb-2 flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-purple-50 border border-purple-200 text-[11.5px] text-purple-700">
                <span className="font-mono font-bold">ƒ</span>
                <span>
                  <span className="font-mono">{`{${pendingCounterVarName}}`}</span>
                  {" "}is available as a variable part below — it will be created when you save.
                </span>
              </div>
            )}
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Composition</label>
              <div className="flex gap-1">
                {(["static_text", "computed_var", "user_input"] as ConstructPartType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => addPart(t)}
                    className="flex items-center gap-1 px-2 py-0.5 border border-slate-200 rounded text-[11px] text-slate-600 hover:bg-slate-50"
                  >
                    <Plus size={9} /> {t === "static_text" ? "Text" : t === "computed_var" ? "Variable" : "Input"}
                  </button>
                ))}
              </div>
            </div>
            {parts.length === 0 ? (
              <div className="text-center text-[12px] text-slate-400 py-6 border border-dashed border-slate-300 rounded-md">
                Add parts above to define this construct's composition.
              </div>
            ) : (
              <div className="space-y-1.5">
                {parts.map((p, i) => (
                  <PartRow
                    key={p.id}
                    part={p}
                    allVarNames={allVarNames}
                    pendingVarName={pendingCounterVarName || undefined}
                    onChange={(np) => updatePart(p.id, np)}
                    onDelete={() => deletePart(p.id)}
                    onMoveUp={() => movePart(i, -1)}
                    onMoveDown={() => movePart(i, 1)}
                    isFirst={i === 0}
                    isLast={i === parts.length - 1}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Counter */}
          <div className="border-t border-slate-100 pt-4">
            <Toggle
              on={createCounter}
              onChange={setCreateCounter}
              label="This construct drives a counter variable"
              hint="Each time this block is inserted, an auto-incrementing variable increases."
            />
            {createCounter && (
              <div className="mt-3 space-y-3 pl-1">
                <div className="grid grid-cols-2 gap-3">
                  <Fld label="Counter variable key">
                    <FldInput mono value={counterVarName} onChange={setCounterVarName} placeholder="chapter_number" />
                  </Fld>
                  <Fld label="Display label">
                    <FldInput value={counterVarLabel} onChange={setCounterVarLabel} placeholder="Chapter number" />
                  </Fld>
                </div>
                <Fld label="Reset when construct appears (optional)">
                  {customConstructIds.length > 0 ? (
                    <FldSelect
                      value={counterResetOn}
                      onChange={setCounterResetOn}
                      options={[{ value: "", label: "Never reset (global counter)" }, ...customConstructIds]}
                    />
                  ) : (
                    <div className="text-[11.5px] text-slate-400 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
                      No other constructs to reset on yet.
                    </div>
                  )}
                </Fld>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 shrink-0">
          <span className="text-[11.5px] text-slate-400">
            {createCounter ? "Will also create a counter variable." : "No counter variable."}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 border border-slate-200 rounded-md text-[12.5px] text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={!canSave}
              className="px-3 py-1.5 bg-slate-900 text-white rounded-md text-[12.5px] font-medium hover:bg-slate-700 disabled:opacity-40"
            >
              Create block
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Preview pane ─────────────────────────────────────────────────────────────

function PreviewPane({ schema }: { schema: ExtendedSchema }) {
  const headerLeft = schema.header?.text?.split("·")[0]?.trim() ?? "";
  const headerRight = schema.header?.text?.split("·")[1]?.trim() ?? "";
  const footerText = schema.footer?.text ?? "";
  const w = schema.page.width;
  const h = schema.page.height;
  const scale = 360 / Math.max(w, h);

  return (
    <div className="h-full bg-[#2a2e36] flex flex-col">
      <div className="sticky top-0 z-10 bg-[#1f2329] text-[#d0d5dd] flex items-center justify-between px-3 py-1.5 text-[11.5px] border-b border-[#14171c]">
        <div className="flex items-center gap-2">
          <span className="text-[#98a2b3] font-mono text-[11px]">Preview</span>
          <span className="w-px h-3.5 bg-[#2d323b]" />
          <span className="text-[#98a2b3] font-mono text-[11px]">
            {detectPageSize(schema.page.width, schema.page.height)} ·{" "}
            {isLandscape(schema) ? "landscape" : "portrait"}
          </span>
        </div>
      </div>
      <div className="flex-1 overflow-auto flex flex-col items-center py-5 gap-4">
        {/* Render 2 sample pages */}
        {[1, 2].map((pageNum) => (
          <div key={pageNum} className="relative" style={{ marginTop: 22 }}>
            <div className="absolute -top-5 left-0 font-mono text-[10px] text-[#98a2b3] flex items-center gap-2">
              <span>page {pageNum}</span>
              <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px]">
                {pageNum === 1 ? "cover" : "content"}
              </span>
            </div>
            <div
              className="bg-white relative shadow-2xl flex flex-col"
              style={{
                width: Math.round(w * scale),
                minHeight: Math.round(h * scale),
                fontSize: 9.5 * scale,
                color: "#1c1c1c",
              }}
            >
              {/* Header */}
              {pageNum > 1 && (
                <div
                  className="flex items-center justify-between border-b border-slate-200"
                  style={{
                    padding: `${Math.round(12 * scale)}px ${Math.round(38 * scale)}px`,
                    fontSize: 8 * scale,
                    color: "#667085",
                  }}
                >
                  <span>{headerLeft || "Header left"}</span>
                  <span>{headerRight || "Header right"}</span>
                </div>
              )}
              {/* Body */}
              <div
                className="flex-1 flex flex-col"
                style={{
                  padding: `${Math.round(36 * scale)}px ${Math.round(38 * scale)}px`,
                }}
              >
                {pageNum === 1 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center">
                    <div
                      style={{
                        fontSize: 22 * scale,
                        fontWeight: 700,
                        color: "#0a1f44",
                        marginBottom: 6 * scale,
                        fontFamily: "Georgia, serif",
                      }}
                    >
                      Document Title
                    </div>
                    <div
                      style={{
                        fontSize: 10 * scale,
                        color: "#667085",
                        fontStyle: "italic",
                        maxWidth: 200,
                      }}
                    >
                      Document subtitle goes here
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div
                      style={{
                        height: 6 * scale,
                        background: "#0a1f44",
                        width: "60%",
                        borderRadius: 1,
                      }}
                    />
                    <div
                      style={{
                        height: 2 * scale,
                        background: "#e4e7ec",
                        width: "90%",
                        borderRadius: 1,
                      }}
                    />
                    <div
                      style={{
                        height: 2 * scale,
                        background: "#e4e7ec",
                        width: "80%",
                        borderRadius: 1,
                      }}
                    />
                    <div
                      style={{
                        height: 2 * scale,
                        background: "#e4e7ec",
                        width: "85%",
                        borderRadius: 1,
                        marginTop: 6 * scale,
                      }}
                    />
                    <div
                      style={{
                        height: 2 * scale,
                        background: "#e4e7ec",
                        width: "75%",
                        borderRadius: 1,
                      }}
                    />
                    <div
                      style={{
                        height: 2 * scale,
                        background: "#e4e7ec",
                        width: "88%",
                        borderRadius: 1,
                      }}
                    />
                  </div>
                )}
              </div>
              {/* Footer */}
              {pageNum > 1 && (
                <div
                  className="flex items-center justify-between border-t border-slate-200 mt-auto"
                  style={{
                    padding: `${Math.round(8 * scale)}px ${Math.round(38 * scale)}px ${Math.round(14 * scale)}px`,
                    fontSize: 8 * scale,
                    color: "#667085",
                  }}
                >
                  <span>{footerText || "Footer text"}</span>
                  <span>{pageNum} / 6</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TemplateBuilderClient({
  templateId,
  initialName,
  initialSchema,
  isSystem,
  canEdit,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("page");
  const [activePage, setActivePage] = useState<PageType>("content");
  const [showPreview, setShowPreview] = useState(true);
  const [modal, setModal] = useState<
    "newVar" | "newComputed" | "newBlock" | null
  >(null);
  const [templateName, setTemplateName] = useState(initialName);
  const [editingName, setEditingName] = useState(false);
  const [schema, setSchema] = useState<ExtendedSchema>(
    initialSchema as ExtendedSchema,
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [selectedVar, setSelectedVar] = useState<string | null>(null);
  const [selectedComputed, setSelectedComputed] = useState<string | null>(null);
  const [selectedConstruct, setSelectedConstruct] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const save = useCallback(async () => {
    setSaveStatus("saving");
    try {
      await fetch(`/api/templates/${templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: templateName, schema }),
      });
      setSaveStatus("saved");
    } catch {
      setSaveStatus("unsaved");
    }
  }, [templateId, templateName, schema]);

  useEffect(() => {
    setSaveStatus("unsaved");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(save, 1500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [schema, templateName, save]);

  useEffect(() => {
    if (editingName && nameInputRef.current) nameInputRef.current.focus();
  }, [editingName]);

  function handleSchemaChange(s: ExtendedSchema) {
    if (canEdit) setSchema(s);
  }

  function addVariable(v: UIVariable) {
    setSchema((s) => ({
      ...s,
      variables: [...(s.variables ?? []), v],
    }));
    setSelectedVar(v.name);
    setModal(null);
  }

  function deleteVariable(name: string) {
    setSchema((s) => ({
      ...s,
      variables: (s.variables ?? []).filter((v) => v.name !== name),
    }));
    if (selectedVar === name) setSelectedVar(null);
  }

  function addComputedVariable(v: UIVariable) {
    setSchema((s) => ({ ...s, variables: [...(s.variables ?? []), v] }));
    setSelectedComputed(v.name);
    setModal(null);
  }

  function deleteComputedVariable(name: string) {
    setSchema((s) => ({ ...s, variables: (s.variables ?? []).filter((v) => v.name !== name) }));
    if (selectedComputed === name) setSelectedComputed(null);
  }

  function addCustomBlock(ref: TemplateConstructRef, autoVar?: UIVariable) {
    setSchema((s) => {
      const newVars = autoVar
        ? [...(s.variables ?? []), autoVar]
        : (s.variables ?? []);
      return {
        ...s,
        constructs: [...(s.constructs ?? []), ref],
        variables: newVars,
      };
    });
    setSelectedConstruct(ref.id);
    setModal(null);
  }

  function deleteCustomBlock(id: string) {
    setSchema((s) => ({
      ...s,
      constructs: (s.constructs ?? []).filter((c) => c.id !== id),
    }));
    if (selectedConstruct === id) setSelectedConstruct(null);
  }

  const staticVarCount = (schema.variables ?? []).filter(
    (v) => v.type === "STATIC",
  ).length;
  const computedVarCount = (schema.variables ?? []).filter(
    (v) => v.type === "COMPUTED",
  ).length;
  const customBlockCount = (schema.constructs ?? []).filter(
    (c) => c.definition != null,
  ).length;

  const PAGE_TYPES: [PageType, string, number | string][] = [
    ["cover", "Cover", 1],
    ["toc", "Table of contents", 1],
    ["content", "Content", "∞"],
    ["certificate", "Certificate", "0..n"],
    ["unnumbered", "Unnumbered", "∞"],
    ["appendix", "Appendix", "∞"],
  ];

  return (
    <div className="h-screen flex flex-col bg-[#f6f7f9] overflow-hidden">
      {/* ── Top bar ── */}
      <header className="h-11 flex items-center justify-between px-4 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3 text-sm">
          <button
            onClick={() => router.push("/templates")}
            className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft size={12} />
            Back
          </button>
          {editingName ? (
            <input
              ref={nameInputRef}
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={(e) => e.key === "Enter" && setEditingName(false)}
              className="font-semibold text-slate-900 bg-transparent border-b border-blue-500 outline-none px-0 py-0"
            />
          ) : (
            <button
              onClick={() => canEdit && setEditingName(true)}
              className="flex items-center gap-1.5 font-semibold text-slate-900 group"
            >
              {templateName}
              {canEdit && (
                <Pencil
                  size={11}
                  className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
                />
              )}
            </button>
          )}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11.5px] font-medium border bg-purple-50 border-purple-200 text-purple-700">
            <Layers size={10} /> Template
          </span>
          {isSystem && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11.5px] font-medium border border-slate-200 bg-white text-slate-500">
              system
            </span>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11.5px] font-medium border ${
              saveStatus === "saved"
                ? "bg-green-50 border-green-200 text-green-700"
                : saveStatus === "saving"
                  ? "bg-yellow-50 border-yellow-200 text-yellow-700"
                  : "bg-slate-50 border-slate-200 text-slate-500"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                saveStatus === "saved"
                  ? "bg-green-600"
                  : saveStatus === "saving"
                    ? "bg-yellow-500"
                    : "bg-slate-400"
              }`}
            />
            {saveStatus === "saved"
              ? "Saved"
              : saveStatus === "saving"
                ? "Saving…"
                : "Unsaved"}
          </span>
          <button className="px-2.5 py-1 border border-slate-200 rounded-md text-[12.5px] text-slate-700 bg-white hover:bg-slate-50 transition-colors">
            Test with sample doc
          </button>
          <button className="px-2.5 py-1 border border-slate-200 rounded-md text-[12.5px] text-slate-700 bg-white hover:bg-slate-50 transition-colors">
            Versions
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-[12.5px] font-medium rounded-md hover:bg-slate-700 transition-colors">
            <Play size={11} /> Publish template
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div
        className="flex-1 min-h-0 grid"
        style={{ gridTemplateColumns: "240px 1fr 320px" }}
      >
        {/* Left rail */}
        <aside className="bg-white border-r border-slate-200 flex flex-col overflow-y-auto">
          {/* Template parts */}
          <div className="px-3 py-3">
            <div className="text-[10.5px] uppercase tracking-wider font-semibold text-slate-400 px-1.5 pb-1.5">
              Template parts
            </div>
            {[
              {
                id: "master" as Tab,
                icon: <Layers size={12} />,
                label: "Master frame",
              },
              {
                id: "vars" as Tab,
                icon: <Tag size={12} />,
                label: "Variables",
                badge: staticVarCount,
              },
              {
                id: "computed" as Tab,
                icon: <SquareFunction size={12} />,
                label: "Computed",
                badge: computedVarCount + BUILT_IN_COMPUTED.length,
              },
              {
                id: "blocks" as Tab,
                icon: <Blocks size={12} />,
                label: "Custom blocks",
                badge: customBlockCount,
              },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12.5px] transition-colors ${
                  activeTab === item.id && activeTab !== "page"
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span
                  className={
                    activeTab === item.id && activeTab !== "page"
                      ? "text-blue-600"
                      : "text-slate-400"
                  }
                >
                  {item.icon}
                </span>
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Page types */}
          <div className="px-3 py-3 border-t border-slate-100">
            <div className="flex items-center justify-between text-[10.5px] uppercase tracking-wider font-semibold text-slate-400 px-1.5 pb-1.5">
              <span>Page types</span>
              <button className="text-slate-400 hover:text-slate-600 text-base leading-none">
                +
              </button>
            </div>
            {PAGE_TYPES.map(([id, name, count]) => (
              <button
                key={id}
                onClick={() => {
                  setActiveTab("page");
                  setActivePage(id);
                }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12.5px] transition-colors ${
                  activeTab === "page" && activePage === id
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <FileText
                  size={12}
                  className={
                    activeTab === "page" && activePage === id
                      ? "text-blue-600"
                      : "text-slate-400"
                  }
                />
                <span className="flex-1 text-left">{name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono">
                  {count}
                </span>
              </button>
            ))}
          </div>
        </aside>

        {/* Workspace */}
        <div className="flex flex-col min-w-0 min-h-0">
          {/* Subbar */}
          <div className="h-9 flex items-center justify-between px-3.5 bg-white border-b border-slate-200 shrink-0 text-[12px]">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Edit template</span>
              <span className="w-px h-4 bg-slate-200" />
              {activeTab === "page" && (
                <>
                  <span className="font-mono text-[10.5px] bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                    page-type: {activePage}
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    extends · master
                  </span>
                </>
              )}
              {activeTab === "master" && (
                <span className="text-slate-500 text-[11.5px]">
                  Master frame
                </span>
              )}
              {activeTab === "vars" && (
                <span className="font-mono text-[10.5px] bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                  {staticVarCount} variables
                </span>
              )}
              {activeTab === "computed" && (
                <span className="font-mono text-[10.5px] bg-purple-50 border border-purple-200 px-2 py-0.5 rounded text-purple-700">
                  {computedVarCount + BUILT_IN_COMPUTED.length} computed
                </span>
              )}
              {activeTab === "blocks" && (
                <span className="font-mono text-[10.5px] bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                  {customBlockCount} custom blocks
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {activeTab === "blocks" && (
                <>
                  <button
                    onClick={() => setModal("newBlock")}
                    className="flex items-center gap-1 px-2 py-1 border border-slate-200 rounded text-[11.5px] text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <Plus size={11} /> New custom block
                  </button>
                  <span className="w-px h-4 bg-slate-200" />
                </>
              )}
              <button
                onClick={() => setShowPreview((v) => !v)}
                className={`flex items-center gap-1 px-2 py-1 border rounded text-[11.5px] transition-colors ${
                  showPreview
                    ? "border-blue-300 bg-blue-50 text-blue-700"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {showPreview ? <EyeOff size={11} /> : <Eye size={11} />}
                {showPreview ? "Hide" : "Show"} preview
              </button>
            </div>
          </div>

          {/* Canvas */}
          <div
            className="flex-1 min-h-0 grid"
            style={{ gridTemplateColumns: showPreview ? "1fr 1fr" : "1fr" }}
          >
            {/* Editor pane */}
            <div className="bg-[#f6f7f9] overflow-auto min-h-0">
              {activeTab === "master" && <MasterFramePane schema={schema} />}
              {activeTab === "page" && <PageTypePane id={activePage} />}
              {activeTab === "vars" && (
                <VariablesPane
                  schema={schema}
                  onAddVar={() => setModal("newVar")}
                  onDeleteVar={deleteVariable}
                  onSelectVar={setSelectedVar}
                  selectedVar={selectedVar}
                />
              )}
              {activeTab === "computed" && (
                <ComputedPane
                  schema={schema}
                  onAddComputed={() => setModal("newComputed")}
                  onDeleteComputed={deleteComputedVariable}
                  onSelectComputed={setSelectedComputed}
                  selectedComputed={selectedComputed}
                />
              )}
              {activeTab === "blocks" && (
                <CustomBlocksPane
                  schema={schema}
                  onNew={() => setModal("newBlock")}
                  onDelete={deleteCustomBlock}
                  onSelect={setSelectedConstruct}
                  selectedConstruct={selectedConstruct}
                />
              )}
            </div>

            {/* Preview pane */}
            {showPreview && (
              <div className="min-h-0 overflow-hidden border-l border-slate-200">
                <PreviewPane schema={schema} />
              </div>
            )}
          </div>
        </div>

        {/* Right inspector */}
        <aside className="bg-white border-l border-slate-200 flex flex-col min-h-0">
          <div className="flex border-b border-slate-200 px-1">
            <button className="flex items-center gap-1.5 px-2.5 py-2.5 text-[11.5px] text-slate-900 font-medium border-b-2 border-slate-900 relative top-px">
              <Settings size={11} />
              {activeTab === "page"
                ? "Page rules"
                : activeTab === "master"
                  ? "Master rules"
                  : activeTab === "vars"
                    ? "Variable"
                    : activeTab === "computed"
                      ? "Computed"
                      : "Block"}
            </button>
            <button className="flex items-center gap-1.5 px-2.5 py-2.5 text-[11.5px] text-slate-400 hover:text-slate-700">
              <Layers size={11} /> Inheritance
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {(activeTab === "page" || activeTab === "master") && (
              <PageRulesPanel
                schema={schema}
                master={activeTab === "master"}
                pageType={activePage}
                onSchemaChange={handleSchemaChange}
              />
            )}
            {activeTab === "vars" && (
              <VariableInspector
                schema={schema}
                selectedVar={selectedVar}
                onSchemaChange={handleSchemaChange}
              />
            )}
            {activeTab === "computed" && (
              <ComputedInspector
                schema={schema}
                selectedComputed={selectedComputed}
                onSchemaChange={handleSchemaChange}
              />
            )}
            {activeTab === "blocks" && (
              <BlockInspector
                schema={schema}
                selectedConstruct={selectedConstruct}
                onSchemaChange={handleSchemaChange}
              />
            )}
          </div>
        </aside>
      </div>

      {/* Modals */}
      {modal === "newVar" && (
        <NewVariableModal onSave={addVariable} onClose={() => setModal(null)} />
      )}
      {modal === "newComputed" && (
        <NewComputedModal schema={schema} onSave={addComputedVariable} onClose={() => setModal(null)} />
      )}
      {modal === "newBlock" && (
        <NewCustomBlockModal schema={schema} onSave={addCustomBlock} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
