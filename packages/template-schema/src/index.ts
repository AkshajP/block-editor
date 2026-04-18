// ─── Presentation (PDF) config per construct ────────────────────────────────

export type TextAlignment = "left" | "center" | "right" | "justify";
export type FontFamily = "Helvetica" | "Times-Roman" | "Courier" | string;

export interface ConstructPDFConfig {
  fontFamily?: FontFamily;
  fontSize?: number;          // pt
  alignment?: TextAlignment;
  bold?: boolean;
  italic?: boolean;
  color?: string;             // hex, e.g. "#1a1a1a"
  lineHeight?: number;        // multiplier, e.g. 1.5
  margins?: {
    top?: number;             // pt
    bottom?: number;          // pt
    left?: number;            // pt
    right?: number;           // pt
  };
  // Only for constructs that auto-number (e.g. chapter headings)
  computed?: {
    counter: string;          // shared counter key, e.g. "chapter"
    format: string;           // e.g. "CHAPTER {n}" — {n} = counter, {text} = node content
  };
}

// ─── Construct definition ────────────────────────────────────────────────────

export type ConstructCategory = "Text" | "Media" | "Layout" | "Structure";

export interface ConstructDefinition {
  id: string;
  label: string;
  icon?: string;              // lucide-react icon name, e.g. "Heading1"
  category?: ConstructCategory;

  /**
   * Lexical node type strings this construct maps to.
   * Consumer (apps/web) is responsible for mapping these to actual Lexical
   * node classes — keeps this package free of Lexical as a dependency.
   */
  lexicalNodeTypes: string[];

  /**
   * True when inserting this construct inserts a sequence of multiple nodes
   * (e.g. captioned image = image node + paragraph node).
   */
  composite?: boolean;

  pdf: ConstructPDFConfig;
}

// ─── Template schema (stored as JSONB in the `templates.schema` column) ──────

export interface PageConfig {
  /** Page width in points. 595 ≈ A4, 612 = US Letter. */
  width: number;
  /** Page height in points. 842 ≈ A4, 792 = US Letter. */
  height: number;
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  /** Number of text columns (default 1). */
  columns?: number;
}

export interface HeaderFooterConfig {
  /** Reserved height in points. */
  height: number;
  /** Static text content. Future: replace with Lexical serialized nodes. */
  text?: string;
}

export type VariableType = "STATIC" | "COMPUTED";
export type ComputedFn = "date" | "page_number" | "total_pages";

export interface VariableDefinition {
  /** Identifier used in the document, e.g. "institute_name". */
  name: string;
  /** Human-readable label shown in the variables panel. */
  label: string;
  type: VariableType;
  /** Only for COMPUTED variables. */
  computedFn?: ComputedFn;
  defaultValue?: string;
}

/**
 * A reference to a construct inside a template schema.
 * `id` must exist in the global registry OR `definition` must be provided inline.
 */
export interface TemplateConstructRef {
  id: string;
  /** Template-level style overrides applied on top of the base definition. */
  overrides?: Partial<ConstructPDFConfig>;
  /**
   * Full inline definition for custom constructs not in the registry.
   * When provided, `id` is still used as the unique key.
   */
  definition?: ConstructDefinition;
}

export interface TemplateSchema {
  version: 1;
  page: PageConfig;
  header?: HeaderFooterConfig;
  footer?: HeaderFooterConfig;
  /**
   * Ordered list of constructs available in this template.
   * The order determines the slash-menu ordering.
   */
  constructs: TemplateConstructRef[];
  variables?: VariableDefinition[];
  /**
   * The construct ID used when the user types plain text (no slash command).
   * Defaults to "paragraph".
   */
  defaultConstructId?: string;
}

// ─── Built-in construct IDs ──────────────────────────────────────────────────
// Stable string constants so callers don't magic-string these.

export const CONSTRUCT_IDS = {
  PARAGRAPH: "paragraph",
  HEADING_1: "heading-1",
  HEADING_2: "heading-2",
  HEADING_3: "heading-3",
  HEADING_4: "heading-4",
  HEADING_5: "heading-5",
  HEADING_6: "heading-6",
  BULLET_LIST: "bullet-list",
  NUMBERED_LIST: "numbered-list",
} as const;

export type BuiltInConstructId = (typeof CONSTRUCT_IDS)[keyof typeof CONSTRUCT_IDS];
