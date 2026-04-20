# Template Feature — Path Overview

This document is the entry point for any agent or contributor picking up the template feature. Read this file and [phase-1.md](phase-1.md) in full before starting work; later phases can be opened as needed.

## What this feature is

The block editor is becoming a **bring-your-content** platform: authors focus on writing, and a **template** owns all presentation decisions. A template is a set of **composite custom blocks** (e.g. "Chapter", "Captioned Image", "Page Layout") plus typography, page geometry, and a **variable registry**. Authors write a document by pressing `/`, picking a block, and filling editable slots — nothing else. A PDF renderer converts the same document tree to print using the same template metadata.

See [../GOALS.md](../GOALS.md) for the product-level pillars this feature delivers on (§4 Template Engine, §5 Variable System, §6 PDF Presentation Layer).

## Mental model — three things kept strictly separate

1. **Document** — content only. References a `{templateId, templateVersion}`. No style, no layout.
2. **Template** — presentation only. Block definitions + variable registry + page defaults + typography. Owned by a user/tenant.
3. **Renderers** — the editor runtime and the PDF package both consume the same schema. One schema, two renderers. If the two diverge, WYSIWYG is dead.

### Key concepts

- **BlockDefinition** — the schema for a composite custom block. A tree of child nodes where each child is one of: static text, editable slot, variable placeholder, nested block, or a primitive (paragraph/heading/image/etc.). Each node carries presentation metadata and editor-behavior flags.
- **Editable slot** — the only place an author can type. The rest of the block is locked.
- **Variable** — a named value resolved at render time. Three kinds:
  - *Static* — supplied per-document (e.g. `{{student_name}}`).
  - *Global computed* — derived from document state (e.g. `{{page_number}}`, `{{total_pages}}`, `{{date}}`).
  - *Scoped counter* — increments on a block type; optionally **resets on** another counter. Example: `figure_number` increments on each `CaptionedImage` block and **resets whenever `chapter_number` increments**. Rendered form: `Fig {chapter_number}.{figure_number}: {caption}`.
- **Counter resolver** — a deterministic, renderer-agnostic pass over the document tree that assigns values to every computed variable. Same resolver used by the editor (for pill previews) and the PDF layer (for final output).
- **Aggregator** — a block node that collects other blocks from the document (all `Heading 1` + `Heading 2`, or all `Reference` blocks, etc.) and renders a derived list at its own location. Table of contents and bibliography are the canonical cases. Runs as a second resolver pass (`resolveAggregations`) after counters.
- **Cross-reference** — an inline node pointing at a specific instance collected by an aggregator (e.g. `[3]` resolving to the third item in the bibliography). Aggregators can publish numbering back into the variable map so cross-refs resolve during interpolation.
- **Page layout block** — a top-level block kind that switches page geometry (e.g. title page vs. body vs. landscape). The PDF renderer reads this to start a new page with new dimensions.

### Resolver pipeline (runs in this order in both renderers)

1. `resolveCounters(document, template)` — assigns counter values per instance.
2. `resolveAggregations(document, template, counters)` — gathers collected items, publishes numbering for any aggregator with `numberAs` set.
3. `interpolate(...)` — substitutes variables, slot values, and cross-refs into static strings.

All three functions are pure and live in `@blockeditor/template-core`.

## Repo orientation for a fresh agent

- Monorepo: **pnpm workspaces + Turborepo**. See [../../CLAUDE.md](../../CLAUDE.md) for the top-level map.
- Frontend: [apps/web/](../../apps/web/) — Next.js 16, React 19, Lexical 0.41, Yjs 13.6.
- Collab server: [packages/collab-server/](../../packages/collab-server/) — WebSocket + Postgres persistence of Yjs state.
- Editor entry: [apps/web/src/components/Editor.tsx](../../apps/web/src/components/Editor.tsx) — Lexical composer wired to Yjs via `@lexical/yjs`.
- Slash menu (today's block-insert UX): [apps/web/src/components/plugins/SlashMenuPlugin.tsx](../../apps/web/src/components/plugins/SlashMenuPlugin.tsx).
- Collaboration setup: [apps/web/src/lib/collaboration.ts](../../apps/web/src/lib/collaboration.ts).
- Existing custom-content plugins live under [apps/web/src/components/plugins/](../../apps/web/src/components/plugins/).

Run the project:

```bash
pnpm docker:up   # Postgres + PgAdmin
pnpm dev         # all workspaces
pnpm test
```

Ports: frontend `3000`, collab `1234`, Postgres `5432`, PgAdmin `5050`.

## Architectural commitments (do not break)

- **Lexical is the source of truth for document structure.** Yjs is the sync layer; never persist our own parallel tree.
- **One schema, two renderers.** A BlockDefinition must describe everything needed to render both in-editor and to PDF. If the renderer needs information, it goes in the schema, not in renderer-side special cases.
- **Presentation lives in the template, never in the document.** Changing a template must re-render documents that reference it without mutating document content.
- **The PDF renderer is a standalone package** (likely `packages/pdf/` with `@react-pdf/renderer`). Not inside `apps/web`. The Next.js app must not import `@react-pdf/renderer` directly.
- **Counter resolution is pure.** Given a document tree + template + variable registry, the output is deterministic. No DOM, no React, no side effects.

## Phase map — viability vs. full feature

Phases marked **[Viability]** exist to prove the architecture end-to-end with the thinnest possible slice. If these three succeed, the rest is execution. Phases marked **[Feature]** build out the real product on top of a proven foundation.

| Phase | Purpose | Track | Doc |
|-------|---------|-------|-----|
| 0 | Auth, document ownership, snapshots | Foundation (largely done) | (see [../GOALS.md](../GOALS.md)) |
| 1 | Block schema & variable model — types and resolver, no UI | **Viability** | [phase-1.md](phase-1.md) |
| 2 | Lexical runtime + `/` menu driven by a hardcoded template | **Viability** | [phase-2.md](phase-2.md) |
| 3 | PDF package rendering the same schema | **Viability** | [phase-3.md](phase-3.md) |
| 4 | Variable UX — per-doc form, pill rendering, export substitution | Feature | [phase-4.md](phase-4.md) |
| 5 | Template builder UI — ribbon panel, save-as-block, preview | Feature | [phase-5.md](phase-5.md) |
| 6 | Protection, versioning, starter templates | Feature | [phase-6.md](phase-6.md) |

### Viability exit criterion

When Phase 3 closes, one hand-authored JSON template must render identically in the editor and the PDF output. The reference template must contain:

- A `PageLayout` block.
- `Chapter` and `CaptionedImage` composite blocks, with the `Fig {chapter}.{figure}: {caption}` construct resetting figure numbers per chapter.
- A `TableOfContents` aggregator block collecting `Heading 1` and `Heading 2` in document order.
- A `Bibliography` aggregator block collecting `Reference` blocks and assigning numbers `[1]`, `[2]`, … that `CrossRef` inline nodes elsewhere in the document resolve to.

If either renderer disagrees on any of these — counter resets, TOC ordering, cross-reference numbering — **stop and revise the schema** before touching Phase 4.

## Phase 0 — Foundation status (as of 2026-04-21)

Parts of phase 0 already exist in the repo. A fresh agent should verify before assuming:

- Auth / ownership — `apps/web/src/app/api/auth/`, members/blocklist APIs in `apps/web/src/app/api/documents/[id]/`.
- Snapshots — `apps/web/src/app/api/documents/[id]/snapshots/*`, `SnapshotPanel.tsx`.
- Room authorization — `apps/web/src/app/api/documents/[id]/ws-token/route.ts`.

These are not blockers for Phase 1, which is pure type/logic work.

## How to use this documentation

- A new agent should read `overview.md` + the current phase's file. Do not read all six phase files up front.
- Each phase file is structured: **Objective → Scope → Deliverables → Acceptance Criteria → Out of Scope → Handoff to next phase**.
- Acceptance criteria are testable. If you cannot write a check that verifies a criterion, the criterion is wrong — fix the doc, then the code.
- If reality disagrees with these docs (schemas change, a phase needs to split), update the docs in the same PR as the code. Stale docs are worse than no docs.

## Start here

New agent? Open [phase-1.md](phase-1.md) now.
