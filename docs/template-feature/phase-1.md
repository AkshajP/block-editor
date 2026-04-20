# Phase 1 — Block Schema & Variable Model

**Track:** Viability
**Prerequisite reading:** [overview.md](overview.md)
**Depends on:** nothing (pure types + pure functions)
**Blocks:** Phase 2 (editor runtime) and Phase 3 (PDF) both consume Phase 1 outputs.

## Objective

Define the type system and pure resolver that every later phase will build on. No React, no Lexical nodes, no UI. By the end of this phase the project has a standalone TypeScript package that any renderer can import to describe and resolve templates.

The deliverable is **a library + test suite**, not a running feature. Its job is to make the answer to "what is a template?" concrete enough that Phase 2 and Phase 3 cannot drift apart.

## Why first

The largest design risk for this feature is the block schema itself. If composite blocks cannot express `Fig {chapter}.{figure}: {caption}` with reset-on-chapter semantics cleanly, no UI will save us. Proving the schema on paper — with tests, not pixels — is the cheapest place to fail.

## Scope

Create a new workspace package:

```
packages/template-core/
├── src/
│   ├── schema/
│   │   ├── block-definition.ts
│   │   ├── template.ts
│   │   └── variable.ts
│   ├── resolve/
│   │   ├── counter-resolver.ts
│   │   ├── aggregation-resolver.ts
│   │   └── interpolate.ts
│   ├── validate/
│   │   └── validate-template.ts
│   ├── index.ts
│   └── __fixtures__/
│       └── reference-template.ts
├── src/__tests__/
│   ├── counter-resolver.test.ts
│   ├── aggregation-resolver.test.ts
│   ├── interpolate.test.ts
│   └── validate-template.test.ts
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

Register it in [../../pnpm-workspace.yaml](../../pnpm-workspace.yaml) and [../../turbo.json](../../turbo.json) as needed so `pnpm build` and `pnpm test` pick it up.

## Deliverables

### 1. Type definitions

**BlockDefinition** (`src/schema/block-definition.ts`) — the recursive shape of a composite block. Every field needed by either renderer must live here.

Required fields on a BlockDefinition:

- `id: string` — stable identifier unique within the template (e.g. `"captioned-image"`).
- `displayName: string` — label shown in the `/` menu.
- `category: "page-layout" | "block" | "inline"` — controls where it can be inserted. `page-layout` is only valid at document root.
- `children: BlockNode[]` — the composition tree.
- `insertBehavior` — object describing editor reactions: `atomic: boolean`, `allowDelete: boolean`, `onEnterInSlot: "newline" | "exitBlock" | "newInstance"`.
- `presentation: PresentationStyle` — font family, size, weight, alignment, spacing, color (see below).

Required `BlockNode` union (discriminated on `kind`):

- `{ kind: "static-text", text, presentation }`
- `{ kind: "editable-slot", slotId, placeholder, multiline, presentation }`
- `{ kind: "variable", variableId, presentation }`
- `{ kind: "primitive", type: "paragraph" | "heading" | "image" | "list" | "listitem", presentation, children? }`
- `{ kind: "nested-block", blockDefinitionId, presentation }`
- `{ kind: "aggregator", aggregatorId, presentation }` — renders the resolved list at this position. The aggregator config (`collects`, `scope`, `itemTemplate`, `numberAs`) lives on `BlockDefinition.aggregator`, not inline, so one block definition = one aggregator and the config is reusable.
- `{ kind: "cross-ref", refSlotId, presentation }` — renders the resolved number/label for the cross-reference target. The target identifier is taken from the value of slot `refSlotId` on the *same* block instance (author types the target key into that slot). If the aggregator has not numbered the target, renders as `"[?]"`.

When `BlockDefinition.category === "aggregator"`, the definition must include an `aggregator` object with:

- `collects: string` — either a `blockDefinitionId` (e.g. `"reference"`) or a primitive selector (`"heading-1"`, `"heading-2"`, `"heading-3"`).
- `scope: "document" | "chapter"` — `"chapter"` means "reset at each `Chapter` block", applicable only to document-order collections.
- `itemTemplate: BlockNode[]` — rendered once per collected item. Inside `itemTemplate`, `{ kind: "editable-slot", slotId }` reads from the *collected item's* slot values (not the aggregator block's), and a special `{ kind: "item-index", format }` node renders the 1-based position of the item within the collection.
- `numberAs?: string` — if set, each collected item is published back into the variable/cross-ref map under the key `<numberAs>:<instancePath>` with its rendered `item-index` value. This is how `Bibliography` gives each `Reference` a number that `CrossRef` can resolve to.
- `sortBy?: "document-order" | "slot:<slotId>"` — default `"document-order"`.

`PresentationStyle` is a flat, optional record — fontFamily, fontSize, fontWeight, fontStyle, textAlign, color, lineHeight, marginTop, marginBottom, paddingX, paddingY. Renderers consume this directly; no CSS strings.

**Variable** (`src/schema/variable.ts`) — tagged union:

- `{ kind: "static", id, label, valueType: "string" | "number" | "date" }`
- `{ kind: "global-computed", id, source: "pageNumber" | "totalPages" | "date" | "documentTitle" }`
- `{ kind: "counter", id, incrementsOn: string /* blockDefinitionId */, resetsOn?: string /* variableId of another counter */, format?: "arabic" | "roman-upper" | "roman-lower" | "alpha-upper" | "alpha-lower" }`

**Template** (`src/schema/template.ts`):

- `id, name, version: number`
- `pageDefaults: { width, height, marginTop, marginRight, marginBottom, marginLeft }` (units: points)
- `typography: PresentationStyle` — base applied to everything unless overridden
- `blockDefinitions: BlockDefinition[]`
- `variables: Variable[]`

### 2. Counter resolver (`src/resolve/counter-resolver.ts`)

Signature:

```ts
resolveCounters(
  document: DocumentTree,
  template: Template
): Map<InstancePath, Record<VariableId, string>>
```

- `DocumentTree` is a minimal shape: an ordered list of block instances, each with a `blockDefinitionId` and an `instancePath` (stable identity). Phase 2 will adapt Lexical's tree into this shape; Phase 1 only needs the type.
- Walks the document in document order. Maintains a counter map keyed by variable id.
- On encountering a block whose id matches a counter's `incrementsOn`, increments that counter by 1.
- When a counter increments, any counter with `resetsOn` pointing at that counter is reset to 0.
- Global-computed variables are resolved by the same function; the page-number case can be stubbed (returns `"?"`) since pagination is PDF-layer business.
- Returns a map from `instancePath` → resolved variable values at that point in the document, so a block instance renders `{chapter}.{figure}` using the values *at its position*.

Must be a pure function. No I/O, no side effects, no mutation of inputs.

### 3. Aggregation resolver (`src/resolve/aggregation-resolver.ts`)

Signature:

```ts
resolveAggregations(
  document: DocumentTree,
  template: Template,
  counters: ReturnType<typeof resolveCounters>
): {
  collections: Map<InstancePath /* aggregator instance */, CollectedItem[]>;
  publishedRefs: Map<string /* "<numberAs>:<sourcePath>" */, string /* rendered index */>;
}
```

Where `CollectedItem` is `{ sourcePath: InstancePath, slotValues: Record<SlotId, string>, itemIndex: string }`.

Behavior:

1. For each aggregator block instance in document order, walk the document and gather every block whose definition (or primitive kind) matches `aggregator.collects` and whose position is within `scope`.
2. Sort by `sortBy`.
3. Assign `itemIndex` to each collected item using the requested format (defaults to arabic).
4. If `numberAs` is set, emit `publishedRefs["<numberAs>:<sourcePath>"] = itemIndex`.
5. Return collections keyed by aggregator instance path; renderers walk `itemTemplate` once per item, injecting that item's slot values and `itemIndex`.

Pure. No DOM, no React. Depends only on `document`, `template`, and counter output.

### 4. Interpolator (`src/resolve/interpolate.ts`)

```ts
interpolate(
  template: string,
  values: Record<string, string>,
  slotValues: Record<string, string>,
  publishedRefs?: Record<string, string>
): string
```

- Syntax: `{variable_id}` for variables, `{slot:slot_id}` for editable slot content, `{ref:<numberAs>:<targetKey>}` for cross-references resolved against `publishedRefs`.
- Unknown references render as the literal placeholder (e.g. `{foo}`) so debug output stays readable.

### 5. Template validator (`src/validate/validate-template.ts`)

```ts
validateTemplate(t: Template): { ok: true } | { ok: false, errors: string[] }
```

Must catch at minimum:

- Duplicate block definition ids.
- Duplicate variable ids.
- `nested-block` referring to an unknown block definition id.
- `variable` node referring to an unknown variable id.
- `counter` whose `resetsOn` points to a non-counter variable or itself.
- `page-layout` block appearing in another block's `children` as a `nested-block`.
- `BlockDefinition.category === "aggregator"` missing the `aggregator` config, or vice versa.
- An aggregator whose `collects` references an unknown block definition id or an unsupported primitive selector.
- An aggregator whose `scope: "chapter"` is used when no `Chapter`-kind block (i.e. a block definition whose id matches the counter's `incrementsOn`) exists in the template.
- A `cross-ref` node whose `refSlotId` is not an `editable-slot` on the same block definition.
- Two aggregators declaring the same `numberAs` value (collision in the published refs namespace).

### 6. Reference template fixture

`src/__fixtures__/reference-template.ts` exports one hand-authored `Template` object used by tests and by Phase 2 as its hardcoded starter. It must include:

- One `PageLayout` block (A4, standard margins).
- A `Chapter` block: atomic, renders a static `"Chapter "` prefix, the `chapter_number` variable as a pill, and an editable-slot `chapter_title`.
- A `CaptionedImage` block: an `image` primitive, then a paragraph containing static `"Fig "`, the `chapter_number` variable, static `"."`, the `figure_number` variable, static `": "`, and an editable-slot `caption`.
- A `TableOfContents` aggregator block: category `"aggregator"`, renders a static header `"Contents"`, then iterates `collects: "heading-1"` with `scope: "document"`, `sortBy: "document-order"`, and an `itemTemplate` of `[item-index] [slot:text] ... [page_number]`.
- A `Reference` block: atomic, renders an editable-slot `citation_key` (hidden pill) and an editable-slot `full_citation`. The `citation_key` is what authors point to from `CrossRef` nodes.
- A `Bibliography` aggregator block: category `"aggregator"`, `collects: "reference"`, `scope: "document"`, `sortBy: "slot:citation_key"`, `numberAs: "bib"`, and an `itemTemplate` that renders `[item-index]. [slot:full_citation]`.
- A `CrossRef` inline block: renders `"["`, a `cross-ref` node with `refSlotId: "target"` (and an editable-slot `target` where the author types the citation key), `"]"`. Resolves via `{ref:bib:<sourcePath of the Reference whose citation_key matches target>}`. Note: to keep Phase 1 simple, cross-ref target matching is by `citation_key` slot value — the aggregation resolver builds a map of `citation_key → sourcePath` when `numberAs` is set and `sortBy: "slot:<id>"` is used.
- Variables: `chapter_number` (counter, incrementsOn `Chapter`), `figure_number` (counter, incrementsOn `CaptionedImage`, resetsOn `chapter_number`), `student_name` (static), `page_number` (global-computed).

This fixture is the viability benchmark — if the schema cannot express **all** of it, the schema is wrong.

## Acceptance criteria

A reviewer must be able to check each of these mechanically.

1. **Package builds.** `pnpm --filter @blockeditor/template-core build` (or equivalent) exits 0.
2. **No React, Lexical, or Yjs imports.** `grep -rE "(react|lexical|yjs)" packages/template-core/src` returns nothing.
3. **Reference template validates.** `validateTemplate(referenceTemplate)` returns `{ ok: true }`.
4. **Negative validation tests.** For each check enumerated under "Template validator", a test builds a bad template and asserts the specific error string is returned.
5. **Counter resolver — chapter/figure sequence.** Given a document of `[Chapter, CaptionedImage, CaptionedImage, Chapter, CaptionedImage]`:
   - At figure 1: `chapter_number="1", figure_number="1"`.
   - At figure 2: `chapter_number="1", figure_number="2"`.
   - At figure 3 (after second chapter): `chapter_number="2", figure_number="1"` (reset proven).
6. **Counter resolver — format.** A counter with `format: "roman-upper"` renders `"I", "II", "III"`.
7. **Interpolator.** `interpolate("Fig {chapter}.{figure}: {slot:caption}", {chapter:"2", figure:"1"}, {caption:"A cat"})` returns `"Fig 2.1: A cat"`.
8. **Aggregation — TOC.** Given a document of `[Heading1("Intro"), Paragraph, Heading1("Methods"), Heading2("Setup"), TableOfContents]`, `resolveAggregations` returns, for the TOC instance, a collection of three items with `itemIndex` values `"1"`, `"2"`, `"3"` and slot values containing the heading text in document order. Aggregator position within the document does not affect what it collects (it sees the whole document).
9. **Aggregation — Bibliography with cross-refs.** Given a document of `[CrossRef(target:"smith2020"), Reference(citation_key:"jones2019"), Reference(citation_key:"smith2020"), Bibliography]` with `Bibliography.sortBy: "slot:citation_key"`:
   - The `CrossRef` at position 0 resolves to `"[2]"` (smith2020 is alphabetically second).
   - The `Bibliography` collection contains two items, numbered `1` (jones2019) and `2` (smith2020).
   - `publishedRefs` contains entries keyed `"bib:<sourcePath of jones2019>"` → `"1"` and `"bib:<sourcePath of smith2020>"` → `"2"`.
10. **Scope — chapter.** An aggregator with `scope: "chapter"` placed after the second `Chapter` block only collects items that appear between the preceding `Chapter` and the next `Chapter` (or end of document).
11. **Resolver ordering.** `resolveAggregations` accepts counter output and can depend on it (e.g. a TOC item template may include a counter-based variable). A test confirms dependency direction: counters resolved, then aggregations, then interpolation.
12. **Purity.** Running `resolveCounters` and `resolveAggregations` twice on the same inputs produces deep-equal outputs and does not mutate the inputs.
13. **Type exports.** `import { Template, BlockDefinition, Variable, resolveCounters, resolveAggregations, interpolate, validateTemplate } from "@blockeditor/template-core"` succeeds in a consumer package.
14. **Reference template round-trip.** `JSON.parse(JSON.stringify(referenceTemplate))` is deep-equal to the original (schema is plain data; no classes, no functions).
15. **Test coverage.** All four test files in the layout above exist and every exported function has at least one passing test, including the TOC and Bibliography scenarios above.

## Out of scope

Explicitly **not** in Phase 1 — do not build these here, even if tempting:

- Any Lexical node class or React component.
- Any PDF code.
- Persistence (no DB schema, no migrations).
- A template editor UI.
- Yjs integration.
- Real page-number resolution (stub is fine; actual pagination is Phase 3).
- Template inheritance, "extends", or theming beyond the flat `typography` base.

## Open questions to resolve during Phase 1

Answer these in code (by picking one) and leave a one-line comment in the schema file explaining the choice. Do not open a meta-discussion; pick the simpler option unless a test forces otherwise.

- Can an `editable-slot` contain rich text, or only plain text? Recommendation: plain text + a small set of inline marks (bold, italic, underline) expressed as a flat list — avoid nested Lexical trees inside slots for now.
- Do counters start at 0 or 1 after increment? Recommendation: 1 (first occurrence renders `"1"`, not `"0"`).
- How are counters rendered before their first increment? Recommendation: empty string; the validator should flag any variable used in a position where it might render empty.
- How does an aggregator handle zero collected items? Recommendation: render only the definition's non-itemTemplate children (e.g. the `"Contents"` header); renderers never emit an empty list node. If the author wants an empty-state message, the template must include a separate static block.
- Can an aggregator collect from within another aggregator's `itemTemplate`? Recommendation: no — validator rejects this. Aggregation is single-pass; nested aggregation opens the door to cycles.
- What happens if a `CrossRef` target slot is empty or doesn't match any collected item? Recommendation: renders as `"[?]"`; warning logged by the renderer, not an error.

## Handoff to Phase 2

When this phase closes, Phase 2 can begin with:

- A versioned `@blockeditor/template-core` it can depend on.
- The `referenceTemplate` fixture, which Phase 2 will wire into the Lexical runtime as the hardcoded template.
- `resolveCounters` + `interpolate`, which Phase 2 will call whenever a variable node needs to render.

Phase 2 must not modify Phase 1 types to fit Lexical. If Lexical integration reveals a schema gap, update the schema *and* its tests first, then continue.
