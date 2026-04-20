# Phase 2 — Lexical Runtime with Hardcoded Template

**Track:** Viability
**Prerequisite reading:** [overview.md](overview.md), [phase-1.md](phase-1.md)
**Depends on:** `@blockeditor/template-core` (Phase 1).
**Blocks:** Phase 3 (PDF) needs the same Lexical tree to validate WYSIWYG.

## Objective

Get the existing block editor to render composite blocks from a hardcoded template, inserted via the existing `/` menu. End users see their first custom block: a `Chapter` pill and a `CaptionedImage` block with a live-resolving `Fig {chapter}.{figure}: {caption}` caption. No builder UI yet — just proof that the Phase 1 schema drives the editor.

## Why now

Phase 1 proves the schema on paper. Phase 2 proves it against a real Lexical tree with real Yjs sync. If a composite block cannot be expressed as a single Lexical node without fighting Yjs, we need to know before touching PDF or builder UI.

## Scope

All work is in [apps/web/](../../apps/web/). Import everything schema-related from `@blockeditor/template-core`; do not redefine types.

### 1. `CustomBlockNode` — one Lexical node to rule them all

Create [apps/web/src/components/nodes/CustomBlockNode.tsx](../../apps/web/src/components/nodes/CustomBlockNode.tsx) (new folder). A single `DecoratorNode` (or `ElementNode` — decide based on editable-slot needs) that:

- Stores a `blockDefinitionId` and the current slot values keyed by `slotId`.
- Serializes to/from JSON so Yjs can sync it (`exportJSON` / `importJSON` / `static getType()` / `static clone()`).
- On render, reads the `BlockDefinition` from the active template and walks its `children` tree, rendering each `BlockNode` kind as React:
  - `static-text` → styled `<span>`.
  - `editable-slot` → a nested Lexical editor or contentEditable region bound to slot state. Slot changes propagate through Yjs like any other edit.
  - `variable` → a pill component that reads the resolved value from the counter resolver (see §3).
  - `primitive` → the matching Lexical primitive.
  - `nested-block` → recursively render another BlockDefinition.
  - `aggregator` → reads the collection for this instance from the resolver context (see §3), then renders `itemTemplate` once per collected item. `item-index` nodes render the index; inside the template, `editable-slot` references read the **collected item's** slot values, not the aggregator block's. Items are rendered read-only — editing is done on the source block.
  - `cross-ref` → looks up `publishedRefs[<numberAs>:<target from sibling slot>]` and renders the resolved number, or `"[?]"` if unresolved.
- Honors `insertBehavior.atomic` (block cannot be partially selected) and `allowDelete`.

Register the node in [apps/web/src/components/Editor.tsx](../../apps/web/src/components/Editor.tsx) alongside the existing `HeadingNode`, `ListNode`, `ListItemNode`.

### 2. Template context

Create a `TemplateProvider` React context that exposes the active `Template` object to any descendant. Wire it around the Lexical composer in `Editor.tsx`. For Phase 2, hardcode `referenceTemplate` from Phase 1 as the value. Do not fetch from the server yet.

### 3. Counter resolution in the editor

On every document change (`OnChangePlugin`):

1. Walk the current Lexical tree and adapt it to the `DocumentTree` shape expected by `resolveCounters`.
2. Call `resolveCounters(documentTree, template)` → counter values map.
3. Call `resolveAggregations(documentTree, template, counters)` → collections map + publishedRefs map.
4. Publish all three results via `ResolvedVariablesProvider` (rename from Phase 1 draft — context now carries counters, collections, and publishedRefs). Variable pills, aggregator renderers, and cross-ref nodes all subscribe and re-render.

Performance: coalesce to animation frame. Both resolvers are pure; run them together, not separately. Under collaborative bursts the two passes still run O(n) over the document so latency should be indistinguishable from a single pass.

### 4. Slash menu integration

Modify [apps/web/src/components/plugins/SlashMenuPlugin.tsx](../../apps/web/src/components/plugins/SlashMenuPlugin.tsx) so that, in addition to the current primitives, it lists every BlockDefinition from the active template whose `category !== "inline"`. Selecting one inserts a `CustomBlockNode` with that `blockDefinitionId` and default slot values. Aggregator-category blocks appear in the menu like any other block and can be inserted anywhere a regular block is allowed.

Keep the existing primitive options (Heading 1–6, lists, paragraph) for now — they are orthogonal and Phase 6 will decide whether to hide them behind a template flag.

### 5. Page-layout handling in the editor

For Phase 2, a `PageLayout` block renders as a visible container (border + label showing layout name) so authors can see page boundaries. Actual page breaks are a PDF concern (Phase 3). At root level only — enforce in `CustomBlockNode.canBeChildOf` or the insert logic.

## Deliverables

- New files:
  - `apps/web/src/components/nodes/CustomBlockNode.tsx`
  - `apps/web/src/components/nodes/VariablePill.tsx`
  - `apps/web/src/components/nodes/AggregatorView.tsx`
  - `apps/web/src/components/nodes/CrossRefPill.tsx`
  - `apps/web/src/components/TemplateContext.tsx` (provider + `useTemplate` hook)
  - `apps/web/src/components/ResolvedVariablesContext.tsx` (provider + `useResolvedVariables` hook — exposes counters, collections, publishedRefs)
- Modified files:
  - `apps/web/src/components/Editor.tsx` (register node + wrap with providers)
  - `apps/web/src/components/plugins/SlashMenuPlugin.tsx` (dynamic options from template)
- Tests:
  - `apps/web/src/components/nodes/__tests__/CustomBlockNode.test.tsx`
  - `apps/web/src/components/nodes/__tests__/AggregatorView.test.tsx`
  - An end-to-end Vitest + Testing Library scenario covering the acceptance criteria below.

## Acceptance criteria

1. **Render fidelity.** Open the editor on a blank document. Via the `/` menu, insert `PageLayout` → `Chapter` (title: "Introduction") → `CaptionedImage` (caption: "Sample"). The rendered DOM shows:
   - "Chapter" label + pill reading `1` + the title "Introduction".
   - An image placeholder, followed by `Fig 1.1: Sample`.
2. **Counter reset.** After the above, insert another `Chapter` ("Methods") and another `CaptionedImage` ("Graph"). The second caption reads `Fig 2.1: Graph`. The first caption still reads `Fig 1.1: Sample`.
3. **Live update.** Editing the `caption` slot of any `CaptionedImage` updates the rendered caption in place without remounting.
4. **Collaboration.** Opening the same document in a second browser shows both custom blocks with correct resolved values. Editing a slot in one tab reflects in the other. (Uses existing Yjs infra — no server changes expected.)
5. **Persistence.** Refreshing the page restores all custom blocks with the same slot values. (The Postgres-backed Yjs persistence should handle this once serialization is correct.)
6. **Slot isolation.** Typing into a slot does not allow the cursor to enter static-text, variable, or structural regions of the block.
7. **Atomic delete.** Pressing Backspace with the cursor just after a `Chapter` block deletes the entire block as a unit (behavior dictated by `insertBehavior.allowDelete`).
8. **Live TOC.** Insert a `TableOfContents` block, then insert two `Heading 1` primitives ("Intro", "Methods"). The TOC body lists `1. Intro` and `2. Methods` in document order, updating as headings are added, renamed, reordered, or deleted — within one animation frame. Moving the TOC block to a different position in the document does not change what it collects.
9. **Live Bibliography + cross-ref.** Insert a `CrossRef` block with target `"smith2020"`, then insert two `Reference` blocks with citation keys `"jones2019"` and `"smith2020"`, then a `Bibliography` block. The `CrossRef` renders `[2]`, and the `Bibliography` lists the two references alphabetically with numbers `1` and `2`. Editing a citation key updates the cross-ref within one animation frame.
10. **Unresolved cross-ref.** A `CrossRef` targeting a key that no `Reference` uses renders `[?]` and does not throw.
11. **Aggregated items are read-only in place.** Clicking an item inside the TOC does not place a cursor there; the source heading remains the only editable location.
12. **Schema imports only.** `apps/web` imports `Template`, `BlockDefinition`, `resolveCounters`, `resolveAggregations`, `interpolate` from `@blockeditor/template-core`. It does not redeclare any of those types.
13. **No template hardcoding outside the provider.** `TemplateProvider` is the only place that references `referenceTemplate`. `CustomBlockNode`, `AggregatorView`, and `SlashMenuPlugin` all read from `useTemplate()`.
14. **Tests pass.** `pnpm --filter web test` is green; new tests cover insertion, slot editing, counter resolution, TOC live update, and cross-ref resolution.

## Out of scope

- Loading templates from the server/DB.
- Switching templates on an existing document.
- Template authoring UI.
- PDF rendering.
- Variable UX beyond pills (no forms for static variables yet).
- Protected-region UX polish; basic `allowDelete` behavior is enough for now.

## Risks to watch

- **Nested editors inside atomic nodes** can fight Lexical's selection model. If you find yourself implementing custom selection handlers, pause and consider modeling slots as ordinary Lexical children of an `ElementNode` with a `isShadowRoot`-style protection on the non-slot children.
- **Yjs + DecoratorNode state** — if slot values aren't syncing, it's almost always because state lives in React and not in the Lexical node's JSON. Serialize all slot values in `exportJSON`.
- **Counter resolver performance** under collaborative bursts. If resolution runs on every keystroke for every peer update, add a simple `requestAnimationFrame` coalescer.
- **Aggregator render loops.** If an aggregator re-renders on every resolution cycle regardless of whether its collection actually changed, the TOC will flicker. Memoize the aggregator view on a stable fingerprint of its collection (length + concatenated source paths + item indices) rather than object identity.

## Handoff to Phase 3

When this phase closes, Phase 3 can begin with:

- A working editor whose document tree can be serialized to JSON.
- The same `Template` shape Phase 3 will consume.
- A reproducible scenario (the one from acceptance criterion #2) used as Phase 3's PDF parity test.
