"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import type {
  ConstructDefinition,
  TemplateConstructRef,
  TemplateSchema,
} from "@block-editor/template-schema";
import { getConstruct, getAllConstructs } from "./registry";

// ─── Resolved construct ───────────────────────────────────────────────────────
// A construct definition with template-level overrides merged in.

export interface ResolvedConstruct extends ConstructDefinition {
  /** Template-level overrides (already merged into `pdf`) */
  _hasOverrides: boolean;
}

function resolveRef(ref: TemplateConstructRef): ResolvedConstruct | null {
  const base = ref.definition ?? getConstruct(ref.id);
  if (!base) return null;

  const merged: ResolvedConstruct = {
    ...base,
    pdf: ref.overrides ? { ...base.pdf, ...ref.overrides } : base.pdf,
    _hasOverrides: !!ref.overrides,
  };
  return merged;
}

// ─── Context value ────────────────────────────────────────────────────────────

export interface TemplateContextValue {
  /** Raw schema from DB, or null when no template is attached. */
  schema: TemplateSchema | null;
  /**
   * Ordered list of constructs resolved from the schema.
   * When schema is null this falls back to ALL built-in constructs.
   */
  constructs: ResolvedConstruct[];
  /**
   * Deduplicated Lexical node type strings required by the active constructs.
   * Consumer maps these to actual Klass objects for LexicalComposer.
   */
  requiredNodeTypes: string[];
}

// ─── Context ──────────────────────────────────────────────────────────────────

const TemplateContext = createContext<TemplateContextValue>({
  schema: null,
  constructs: [],
  requiredNodeTypes: [],
});

// ─── Provider ─────────────────────────────────────────────────────────────────

interface TemplateProviderProps {
  /**
   * Pass the parsed TemplateSchema from the DB.
   * Pass null / undefined to fall back to all built-in constructs.
   */
  schema: TemplateSchema | null | undefined;
  children: ReactNode;
}

export function TemplateProvider({ schema, children }: TemplateProviderProps) {
  let constructs: ResolvedConstruct[];

  if (schema) {
    constructs = schema.constructs
      .map(resolveRef)
      .filter((c): c is ResolvedConstruct => c !== null);
  } else {
    // No template attached — expose every built-in construct.
    constructs = getAllConstructs().map((c) => ({
      ...c,
      _hasOverrides: false,
    }));
  }

  const requiredNodeTypes = [
    ...new Set(constructs.flatMap((c) => c.lexicalNodeTypes)),
  ];

  return (
    <TemplateContext.Provider value={{ schema: schema ?? null, constructs, requiredNodeTypes }}>
      {children}
    </TemplateContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTemplate(): TemplateContextValue {
  return useContext(TemplateContext);
}
