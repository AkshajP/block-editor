# Phase 3 — PDF Presentation Layer

**Track:** Viability (closes the viability proof)
**Prerequisite reading:** [overview.md](overview.md), [phase-1.md](phase-1.md), [phase-2.md](phase-2.md)
**Depends on:** `@blockeditor/template-core` (Phase 1); editor-exported document JSON (Phase 2).
**Blocks:** Phase 4 (variable UX needs the export pipeline to substitute into).

## Objective

Produce a standalone package that takes `{ document, template }` JSON and emits a PDF. The editor scenario from Phase 2 (two chapters, three captioned images) must render to PDF with identical text content and correct counter resets. No UI integration with the editor is required yet beyond a throwaway "Export PDF" button for manual verification.

This phase closes the viability loop: one schema, two renderers, same output.

## Why now

Before building any author-facing UX (variable forms, template builder), we must prove the PDF renderer and the editor renderer agree on what a template means. If they disagree, WYSIWYG is broken and the fix is in the schema — which is cheap to change now, expensive later.

## Scope

### 1. New package

```
packages/pdf/
├── src/
│   ├── renderer.tsx
│   ├── nodes/
│   │   ├── StaticText.tsx
│   │   ├── EditableSlot.tsx
│   │   ├── VariablePill.tsx
│   │   ├── Primitive.tsx
│   │   ├── CustomBlock.tsx
│   │   ├── AggregatorView.tsx
│   │   └── CrossRef.tsx
│   ├── pagination/
│   │   └── paginate.ts
│   └── index.ts
├── src/__tests__/
│   ├── render.test.ts
│   ├── aggregation.test.ts
│   └── pagination.test.ts
└── package.json
```

Dependency: `@react-pdf/renderer`. Register in [../../pnpm-workspace.yaml](../../pnpm-workspace.yaml). Name: `@blockeditor/pdf`.

### 2. Public API

```ts
renderDocumentToPdf(
  document: DocumentTree,
  template: Template,
  slotValues: Record<InstancePath, Record<SlotId, string>>,
  staticVariableValues: Record<VariableId, string>
): Promise<Buffer>
```

The function must:

1. Call `resolveCounters(document, template)` — reusing Phase 1 code — to compute per-instance variable values.
2. Call `resolveAggregations(document, template, counters)` to compute collections and publishedRefs.
3. Walk the document tree, emitting `@react-pdf/renderer` primitives for each `BlockNode` kind. `aggregator` nodes render their collection via `itemTemplate`; `cross-ref` nodes resolve via `publishedRefs`.
4. Apply `PresentationStyle` at each level, with template `typography` as the base. Styles merge parent → child.
5. Use `pageDefaults` and any root-level `PageLayout` block to control page geometry.

### 3. Node renderers

One component per `BlockNode.kind`, mirroring the editor's `CustomBlockNode` walk but emitting `<Text>` / `<View>` / `<Image>` / `<Page>` from `@react-pdf/renderer` instead of DOM. Each renderer is pure, takes the node and its resolved variable map, and delegates recursion for `nested-block` and `primitive.children`.

The `aggregator` renderer deserves special care:

- Pulls the collection for its instance path from the aggregation result.
- For each collected item, renders `itemTemplate` as a sub-tree, injecting that item's slot values (so `{slot:full_citation}` resolves to the *item's* `full_citation`, not the aggregator block's).
- Collection items inside a TOC or similar page-number-sensitive aggregator must render the collected item's page number. `@react-pdf/renderer` exposes page context via the `<Text render={({pageNumber}) => ...}>` callback; use it. A dedicated "which page did source instance X render on?" pass is not required — instead, flow the source block with an invisible anchor and resolve page numbers via `@react-pdf/renderer`'s two-pass layout (the library already supports this pattern for TOCs).

### 4. Page layout & pagination

- A `page-layout` block opens a new `<Page>` with its declared dimensions.
- Content after the last `page-layout` block uses `template.pageDefaults`.
- `@react-pdf/renderer` handles overflow pagination within a page layout automatically; do not try to pre-paginate.
- Populate `page_number` / `total_pages` global-computed variables via `@react-pdf/renderer`'s built-in `render` function for page context, passed into the interpolator at render time.

### 5. Export button in the editor (temporary)

Add a "Export PDF" button to [apps/web/src/components/EditorPage.tsx](../../apps/web/src/components/EditorPage.tsx) that:

- Serializes the current Lexical tree to the `DocumentTree` shape.
- POSTs it with the active template id to a new Next.js route handler `apps/web/src/app/api/documents/[id]/export/route.ts`.
- The route calls `@blockeditor/pdf.renderDocumentToPdf` server-side and streams the resulting PDF back.
- Client triggers a download.

This is deliberately minimal. Phase 5 will replace it with a proper export flow.

## Deliverables

- New package `packages/pdf/` with the files listed above.
- New route `apps/web/src/app/api/documents/[id]/export/route.ts`.
- New button wired in `EditorPage.tsx` (guarded by a feature flag or simple prop — do not ship unguarded).
- Golden-file tests under `packages/pdf/src/__tests__/` comparing rendered PDFs' *text content* (not byte-for-byte — PDFs aren't deterministic) against expected strings.

## Acceptance criteria

1. **Package builds standalone.** `pnpm --filter @blockeditor/pdf build` succeeds with no dependency on `apps/web`, `react-dom`, or `lexical`.
2. **Reference document renders.** Given the Phase 2 scenario (two chapters, three captioned images), `renderDocumentToPdf` produces a PDF whose extracted text contains, in order: `"Chapter"`, `"1"`, `"Introduction"`, `"Fig 1.1: Sample"`, `"Chapter"`, `"2"`, `"Methods"`, `"Fig 2.1: Graph"`. Use `pdf-parse` or equivalent in tests to assert this.
3. **Counter parity with editor.** The strings rendered by the PDF for every variable equal the strings shown by the editor for the same document. Assert via a shared test helper that runs both Phase 2's resolution path and Phase 3's and compares outputs for the reference document.
4. **TOC parity.** Given a document with a `TableOfContents` block and several `Heading 1` primitives, the PDF's TOC lists every heading in document order with its 1-based index and the actual page number on which that heading renders. Moving the TOC to a different position in the document does not change what it collects.
5. **Bibliography + cross-ref parity.** Given a document with `CrossRef` nodes targeting citation keys and a trailing `Bibliography` aggregator, the PDF's cross-refs render the same `[N]` numbers as the editor does, and the bibliography lists references in the same sorted order.
6. **Unresolved cross-ref in PDF.** A `CrossRef` with no matching target renders `[?]` in the PDF (same as editor). Does not throw during render.
7. **Page layout switch.** A document with two different `PageLayout` blocks (A4 portrait then A4 landscape) produces a PDF with at least one page of each orientation. Verify page dimensions via `pdfjs-dist` or `@react-pdf/renderer`'s layout output in tests.
8. **Presentation inheritance.** A block with no `fontFamily` inherits `template.typography.fontFamily`. A child overriding `fontSize` does not reset `fontFamily`. Covered by a dedicated test.
9. **Global variables resolve.** `{page_number}` and `{total_pages}` placed in a block that appears on multiple pages resolve per-page (page 1 shows `1 / 3`, page 2 shows `2 / 3`, etc.).
10. **Export button works end-to-end.** Manually: open a document with custom blocks, click "Export PDF", receive a download whose content matches criteria #2, #4, and #5. This is a manual acceptance step — document the exact clicks in the PR description.
11. **No Lexical in `@blockeditor/pdf`.** `grep -rE "(lexical|yjs)" packages/pdf/src` returns nothing.
12. **Viability exit criterion met.** The statement in [overview.md](overview.md) — "one hand-authored JSON template must render identically in the editor and the PDF output" — holds for the reference template, including counters, TOC ordering, and cross-reference numbering. If any of those disagree, **stop and revise the schema** before Phase 4.

## Out of scope

- Server-side rendering performance tuning (Phase 6 if needed).
- Fonts beyond built-in `@react-pdf/renderer` fonts (treat custom font registration as Phase 5).
- Per-tenant export theming.
- PDF/A compliance, accessibility tagging, encryption.
- Any editor-side change beyond the minimal export button.

## Risks to watch

- **Text-content comparison is the right check.** Do not byte-compare PDFs; they vary across environments. Extract text and assert.
- **Style merging is easy to get wrong.** Write the merge function once, use it at every recursion level, test it directly.
- **Variable resolution must be the same function** in both renderers. If you find yourself re-implementing the resolver inside `@blockeditor/pdf`, stop — import Phase 1's. Same rule for `resolveAggregations`.
- **TOC page numbers require `@react-pdf/renderer`'s two-pass layout.** Do not try to pre-compute page numbers in the aggregation resolver — it has no concept of pages. Page numbers are inserted at render time via `<Text render={...}>`. If the library's two-pass behavior proves insufficient for your layout, the fallback is a known `@react-pdf/renderer` limitation; document it and move on — don't invent a third pass in the resolver.

## Handoff to Phase 4

When this phase closes, the architecture is proven. Phase 4 can begin with:

- An export pipeline that already substitutes resolved values.
- Confidence that adding static-variable UX won't require schema changes.
- A reference document that serves as the regression fixture for every later phase.
