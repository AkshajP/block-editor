"use client";

import type {
  TemplateSchema,
  VariableDefinition,
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
}: {
  schema: ExtendedSchema;
  onAddComputed: () => void;
}) {
  const computedVars = (schema.variables ?? []).filter(
    (v) => v.type === "COMPUTED",
  );
  const allComputed = [
    ...BUILT_IN_COMPUTED.map((c) => ({ ...c, builtin: true })),
    ...computedVars
      .filter(
        (v) => !BUILT_IN_COMPUTED.find((b) => b.computedFn === v.computedFn),
      )
      .map((v) => ({
        name: v.name,
        label: v.label,
        computedFn: v.computedFn as string,
        desc: "",
        format: "",
        builtin: false,
      })),
  ];

  return (
    <div className="p-6 pb-20 max-w-[760px] mx-auto">
      <div className="flex items-end justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-0.5">
            Computed variables
          </h2>
          <p className="text-[12.5px] text-slate-400">
            Derived at render time by the template. Read-only for the document
            author.
          </p>
        </div>
        <button
          onClick={onAddComputed}
          className="flex items-center gap-1.5 px-2.5 py-1.5 border border-slate-200 rounded-md text-[12.5px] text-slate-700 bg-white hover:bg-slate-50 transition-colors"
        >
          <Plus size={11} /> New computed
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <span className="font-semibold text-sm text-slate-900">
            {allComputed.length} computed values
          </span>
          <span className="text-[11.5px] text-slate-400 font-mono">
            evaluated per page
          </span>
        </div>
        <div className="p-3">
          {allComputed.map((c, i) => (
            <div
              key={c.name}
              className="grid items-center gap-2.5 px-2 py-2 border-t border-slate-100 first:border-none"
              style={{ gridTemplateColumns: "24px 1fr 60px" }}
            >
              <span className="w-5 h-5 rounded flex items-center justify-center bg-purple-50 text-purple-700 font-mono text-[11px] font-bold">
                ƒ
              </span>
              <div>
                <div className="font-mono text-purple-700 text-[12.5px]">{`{${c.name}}`}</div>
                <div className="text-[11.5px] text-slate-500">
                  {c.desc || c.label}
                </div>
                {c.format && (
                  <div className="text-[11px] text-slate-400">{c.format}</div>
                )}
              </div>
              <span className="font-mono text-[10.5px] text-slate-400 text-right">
                {c.builtin ? "built-in" : "custom"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── CustomBlocksPane ─────────────────────────────────────────────────────────

function CustomBlocksPane({
  schema,
  onNew,
}: {
  schema: ExtendedSchema;
  onNew: () => void;
}) {
  const customConstructs = (schema.constructs ?? []).filter(
    (c) => c.definition != null,
  );

  const SAMPLE_BLOCKS = [
    {
      name: "Captioned image",
      slash: "/captioned-image · /cap",
      desc: "Image + caption + auto figure number",
      parts: ["image", "caption text", "{figure_n}"],
      color: "purple",
    },
    {
      name: "Metric card",
      slash: "/metric · /m",
      desc: "Big number + label + delta arrow",
      parts: ["heading (number)", "label", "delta % colored"],
      color: "teal",
    },
  ];

  return (
    <div className="p-6 pb-20 max-w-[760px] mx-auto">
      <div className="flex items-end justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-0.5">
            Custom blocks
          </h2>
          <p className="text-[12.5px] text-slate-400">
            Combine atomic editor blocks into reusable constructs. Surfaced as
            slash commands.
          </p>
        </div>
        <button
          onClick={onNew}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900 text-white rounded-md text-[12.5px] font-medium hover:bg-slate-700 transition-colors"
        >
          <Plus size={11} /> New custom block
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {(customConstructs.length > 0 ? [] : SAMPLE_BLOCKS).map((b) => {
          const chipColors: Record<string, string> = {
            purple: "bg-purple-50 text-purple-700 border-purple-200",
            teal: "bg-cyan-50 text-cyan-700 border-cyan-200",
          };
          return (
            <div
              key={b.name}
              className="bg-white border border-slate-200 rounded-xl p-3.5"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-semibold text-[13.5px] text-slate-900">
                    {b.name}
                  </div>
                  <div className="font-mono text-[11px] text-slate-400">
                    {b.slash}
                  </div>
                </div>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${chipColors[b.color] ?? ""}`}
                >
                  preview
                </span>
              </div>
              <p className="text-[12px] text-slate-400 mb-3">{b.desc}</p>
              <div className="flex flex-col gap-1">
                {b.parts.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-[11.5px] text-slate-400"
                  >
                    <span className="w-3.5 h-3.5 rounded flex items-center justify-center bg-slate-100 text-[9px] text-slate-400">
                      {i + 1}
                    </span>
                    {p}
                  </div>
                ))}
              </div>
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
    </div>
  );
}

// ─── PageRulesPanel (right inspector) ────────────────────────────────────────

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
  const numbered =
    pageType !== "cover" &&
    pageType !== "certificate" &&
    pageType !== "unnumbered";
  const showHeader = pageType !== "cover" && pageType !== "certificate";
  const showFooter = pageType !== "cover" && pageType !== "certificate";

  function setPageSize(size: string, orientation: "portrait" | "landscape") {
    const s = PAGE_SIZES[size] ?? PAGE_SIZES.A4;
    const w =
      orientation === "landscape" ? Math.max(s.w, s.h) : Math.min(s.w, s.h);
    const h =
      orientation === "landscape" ? Math.min(s.w, s.h) : Math.max(s.w, s.h);
    onSchemaChange({
      ...schema,
      page: { ...schema.page, width: w, height: h },
    });
  }

  function setMargin(side: "top" | "right" | "bottom" | "left", mm: string) {
    const pt = mmToPt(parseFloat(mm) || 0);
    onSchemaChange({
      ...schema,
      page: { ...schema.page, margins: { ...schema.page.margins, [side]: pt } },
    });
  }

  function setHeaderText(text: string) {
    onSchemaChange({
      ...schema,
      header: { height: schema.header?.height ?? 30, text },
    });
  }

  function setFooterText(text: string) {
    onSchemaChange({
      ...schema,
      footer: { height: schema.footer?.height ?? 20, text },
    });
  }

  return (
    <>
      <div className="text-[11.5px] text-slate-400 mb-2">
        {master
          ? "Master rules apply to every page type unless overridden."
          : `Overrides on /${pageType}. Inherited values are dimmed.`}
      </div>

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
          onChange={(v) =>
            setPageSize(detectedSize, v as "portrait" | "landscape")
          }
        />
      </Fld>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <Fld label="Margin top">
          <FldInput
            type="number"
            value={ptToMm(schema.page.margins.top)}
            onChange={(v) => setMargin("top", v)}
          />
        </Fld>
        <Fld label="Margin bottom">
          <FldInput
            type="number"
            value={ptToMm(schema.page.margins.bottom)}
            onChange={(v) => setMargin("bottom", v)}
          />
        </Fld>
        <Fld label="Margin left">
          <FldInput
            type="number"
            value={ptToMm(schema.page.margins.left)}
            onChange={(v) => setMargin("left", v)}
          />
        </Fld>
        <Fld label="Margin right">
          <FldInput
            type="number"
            value={ptToMm(schema.page.margins.right)}
            onChange={(v) => setMargin("right", v)}
          />
        </Fld>
      </div>

      <SectionTitle>Numbering</SectionTitle>
      <Toggle
        on={numbered}
        onChange={() => {}}
        label="Show page number"
        hint={!numbered ? "Suppressed by override" : "Inherited from master"}
        disabled={!master}
      />
      <div
        className={`grid grid-cols-2 gap-2 mt-2 ${!numbered ? "opacity-40" : ""}`}
      >
        <Fld label="Format">
          <Seg
            value={
              pageType === "toc"
                ? "roman"
                : pageType === "appendix"
                  ? "alpha"
                  : "arabic"
            }
            options={[
              { value: "arabic", label: "1, 2" },
              { value: "roman", label: "i, ii" },
              { value: "alpha", label: "A, B" },
            ]}
            onChange={() => {}}
          />
        </Fld>
        <Fld label="Start from">
          <FldInput type="number" value={1} onChange={() => {}} />
        </Fld>
      </div>

      <SectionTitle>Header</SectionTitle>
      <Toggle
        on={showHeader}
        onChange={() => {}}
        label="Show header"
        disabled={!master}
      />
      <div className={`mt-2 ${!showHeader ? "opacity-40" : ""}`}>
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

      <SectionTitle>Footer</SectionTitle>
      <Toggle
        on={showFooter}
        onChange={() => {}}
        label="Show footer"
        disabled={!master}
      />
      <div className={`mt-2 ${!showFooter ? "opacity-40" : ""}`}>
        <Fld label="Footer text">
          <FldInput
            mono
            value={schema.footer?.text ?? ""}
            onChange={setFooterText}
            placeholder="Confidential"
          />
        </Fld>
      </div>

      <SectionTitle>Background</SectionTitle>
      <Fld label="Border">
        <Seg
          value={
            pageType === "cover" || pageType === "certificate" ? "gold" : "none"
          }
          options={[
            { value: "none", label: "None" },
            { value: "thin", label: "Thin" },
            { value: "gold", label: "Gold" },
          ]}
          onChange={() => {}}
        />
      </Fld>
      <Toggle on={false} onChange={() => {}} label="Watermark" />
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

function ComputedInspector() {
  return (
    <>
      <div className="text-[11.5px] text-slate-400 mb-3">
        Built-in computed variables are managed by the template engine. Custom
        computed variables can be added above.
      </div>
      <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-[12px] text-slate-500">
        <p className="mb-1 font-medium text-slate-700">
          Built-in computed vars
        </p>
        {BUILT_IN_COMPUTED.map((c) => (
          <div key={c.name} className="flex items-center gap-2 py-1">
            <span className="w-4 h-4 rounded flex items-center justify-center bg-purple-50 text-purple-700 font-mono text-[9px] font-bold">
              ƒ
            </span>
            <span className="font-mono text-purple-700 text-[11.5px]">{`{${c.name}}`}</span>
            <span className="text-slate-400 text-[11px]">— {c.desc}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── BlockInspector ───────────────────────────────────────────────────────────

function BlockInspector() {
  return (
    <>
      <div className="text-[11.5px] text-slate-400 mb-3">
        Custom blocks combine atomic editor blocks into a single construct.
        Authors insert them with slash commands.
      </div>
      <Fld label="Slash command">
        <FldInput mono value="/captioned-image" onChange={() => {}} />
      </Fld>
      <Fld label="Aliases">
        <FldInput mono value="/cap, /figure" onChange={() => {}} />
      </Fld>
      <Fld label="Category">
        <FldSelect
          value="media"
          onChange={() => {}}
          options={[
            { value: "media", label: "media" },
            { value: "layout", label: "layout" },
            { value: "text", label: "text" },
          ]}
        />
      </Fld>
      <Toggle
        on={true}
        onChange={() => {}}
        label="Auto-increment figure number"
      />
      <Toggle on={true} onChange={() => {}} label="Include in TOC of figures" />
    </>
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

  function addComputedVariable() {
    setModal("newComputed");
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
                  onAddComputed={addComputedVariable}
                />
              )}
              {activeTab === "blocks" && (
                <CustomBlocksPane
                  schema={schema}
                  onNew={() => setModal("newBlock")}
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
            {activeTab === "computed" && <ComputedInspector />}
            {activeTab === "blocks" && <BlockInspector />}
          </div>
        </aside>
      </div>

      {/* Modals */}
      {modal === "newVar" && (
        <NewVariableModal onSave={addVariable} onClose={() => setModal(null)} />
      )}
      {modal === "newBlock" && (
        <div
          className="fixed inset-0 bg-slate-900/45 flex items-center justify-center z-50 p-8"
          onClick={(e) => e.target === e.currentTarget && setModal(null)}
        >
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-semibold text-slate-900">
                New custom block
              </h2>
              <button
                onClick={() => setModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            </div>
            <p className="text-[12.5px] text-slate-400 mb-4">
              Custom block composition is coming soon. This feature will let you
              combine atomic blocks into reusable constructs.
            </p>
            <button
              onClick={() => setModal(null)}
              className="w-full px-3 py-2 bg-slate-900 text-white rounded-md text-[13px] font-medium hover:bg-slate-700"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
