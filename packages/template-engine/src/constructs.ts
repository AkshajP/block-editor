import type { ConstructDefinition } from "@block-editor/template-schema";
import { CONSTRUCT_IDS } from "@block-editor/template-schema";

/**
 * Built-in construct definitions.
 * `lexicalNodeTypes` uses the string type names that Lexical registers nodes
 * under — the consumer (apps/web) maps these to actual Klass objects.
 *
 * `pdf` values here are the defaults; templates can override them via
 * TemplateConstructRef.overrides.
 */
export const BUILT_IN_CONSTRUCTS: ConstructDefinition[] = [
  {
    id: CONSTRUCT_IDS.PARAGRAPH,
    label: "Text",
    icon: "Type",
    category: "Text",
    lexicalNodeTypes: ["paragraph"],
    pdf: {
      fontFamily: "Helvetica",
      fontSize: 12,
      alignment: "left",
      lineHeight: 1.5,
      margins: { top: 0, bottom: 8 },
    },
  },
  {
    id: CONSTRUCT_IDS.HEADING_1,
    label: "Heading 1",
    icon: "Heading1",
    category: "Text",
    lexicalNodeTypes: ["heading"],
    pdf: {
      fontFamily: "Helvetica",
      fontSize: 24,
      bold: true,
      alignment: "left",
      margins: { top: 16, bottom: 8 },
    },
  },
  {
    id: CONSTRUCT_IDS.HEADING_2,
    label: "Heading 2",
    icon: "Heading2",
    category: "Text",
    lexicalNodeTypes: ["heading"],
    pdf: {
      fontFamily: "Helvetica",
      fontSize: 20,
      bold: true,
      alignment: "left",
      margins: { top: 14, bottom: 6 },
    },
  },
  {
    id: CONSTRUCT_IDS.HEADING_3,
    label: "Heading 3",
    icon: "Heading3",
    category: "Text",
    lexicalNodeTypes: ["heading"],
    pdf: {
      fontFamily: "Helvetica",
      fontSize: 16,
      bold: true,
      alignment: "left",
      margins: { top: 12, bottom: 4 },
    },
  },
  {
    id: CONSTRUCT_IDS.HEADING_4,
    label: "Heading 4",
    icon: "Heading4",
    category: "Text",
    lexicalNodeTypes: ["heading"],
    pdf: {
      fontFamily: "Helvetica",
      fontSize: 14,
      bold: true,
      alignment: "left",
      margins: { top: 10, bottom: 4 },
    },
  },
  {
    id: CONSTRUCT_IDS.HEADING_5,
    label: "Heading 5",
    icon: "Heading5",
    category: "Text",
    lexicalNodeTypes: ["heading"],
    pdf: {
      fontFamily: "Helvetica",
      fontSize: 12,
      bold: true,
      alignment: "left",
      margins: { top: 8, bottom: 4 },
    },
  },
  {
    id: CONSTRUCT_IDS.HEADING_6,
    label: "Heading 6",
    icon: "Heading6",
    category: "Text",
    lexicalNodeTypes: ["heading"],
    pdf: {
      fontFamily: "Helvetica",
      fontSize: 10,
      bold: true,
      alignment: "left",
      margins: { top: 8, bottom: 4 },
    },
  },
  {
    id: CONSTRUCT_IDS.NUMBERED_LIST,
    label: "Numbered List",
    icon: "ListOrdered",
    category: "Text",
    lexicalNodeTypes: ["list", "listitem"],
    pdf: {
      fontFamily: "Helvetica",
      fontSize: 12,
      alignment: "left",
      margins: { top: 0, bottom: 8, left: 16 },
    },
  },
  {
    id: CONSTRUCT_IDS.BULLET_LIST,
    label: "Bullet List",
    icon: "List",
    category: "Text",
    lexicalNodeTypes: ["list", "listitem"],
    pdf: {
      fontFamily: "Helvetica",
      fontSize: 12,
      alignment: "left",
      margins: { top: 0, bottom: 8, left: 16 },
    },
  },
];
