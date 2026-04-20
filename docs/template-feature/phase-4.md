# Phase 4 — Variable UX

**Track:** Feature
**Prerequisite reading:** [overview.md](overview.md), [phase-1.md](phase-1.md)
**Depends on:** Phases 1–3 complete (viability proven).
**Blocks:** Phase 5 (builder UI needs a known-good variable UX to reuse).

## Objective

Make variables first-class in both authoring and export. Authors can see, fill, and preview static variable values. Computed variables render as recognizable pills in the editor and resolve correctly on export. The goal is that a non-technical author understands "the template asks me for these things; I type them here."

## Scope

### 1. Per-document static-variable form

A side panel on the editor page listing every `kind: "static"` variable in the active template. Each entry:

- Label from `variable.label`.
- Input appropriate to `valueType` (string → text, number → number, date → date picker from existing shadcn Calendar).
- Saves to a new `document_variable_values` table (Postgres): `{ documentId, variableId, value }`.

Create:

- Migration in `packages/collab-server/` or wherever existing migrations live — identify by checking how snapshots persist (`apps/web/src/app/api/documents/[id]/snapshots/`).
- API route `apps/web/src/app/api/documents/[id]/variables/route.ts` — GET returns the current map, PATCH updates one.
- Component `apps/web/src/components/VariablesPanel.tsx`.
- Wire into `EditorPage.tsx` as a collapsible panel next to `SnapshotPanel.tsx`.

### 2. Editor pill rendering

Upgrade `VariablePill.tsx` from Phase 2 to render distinctly by kind:

- Static variables: show the current value inline with subtle background; hover reveals the variable name and "edit" affordance that focuses the corresponding input in the VariablesPanel.
- Counter / global-computed variables: show the resolved value with a dotted underline; hover tooltip reads "Computed: {variable_id}".
- Unresolved variable (no value yet): pill shows the label in italics with a muted background.

### 3. Live resolution with static values

Extend the `ResolvedVariablesProvider` from Phase 2 to merge static values (from the API) with counter values (from the resolver). Variable pills read from the merged map.

### 4. Export substitution

The export route from Phase 3 must accept the static-variable map and pass it through to `renderDocumentToPdf`. Unresolved static variables render as the variable label wrapped in brackets (e.g. `[Student Name]`) in the PDF so missing values are obvious.

## Deliverables

- DB migration for `document_variable_values`.
- API route for GET/PATCH of variable values.
- `VariablesPanel.tsx` component.
- Updated `VariablePill.tsx`.
- Updated `ResolvedVariablesContext` to merge static + computed.
- Updated export route to accept and forward static values.
- Tests: variable panel interactions (Testing Library), export with static values (integration test on the route).

## Acceptance criteria

1. **Panel lists template variables.** Opening a document using the reference template shows a panel with `Student Name` and no others (the rest are computed).
2. **Persistence.** Entering a value, reloading the page, the value is still there.
3. **Live pill update.** Typing in the `Student Name` input updates every `{student_name}` pill in the editor within one animation frame.
4. **Unresolved rendering.** Before any value is entered, `{student_name}` pills show the label in italics. After entering a value, they show the value.
5. **Export reflects values.** Exporting a PDF after filling `Student Name: "Alex"` contains the string `"Alex"` wherever the template placed `{student_name}`.
6. **Missing values in export.** Exporting a PDF without filling `Student Name` contains the literal `"[Student Name]"` in the PDF, not an empty string.
7. **Counter pills unchanged.** All Phase 2 / Phase 3 acceptance tests for counters still pass.
8. **Access control.** The variables API routes enforce the same read/write authorization as the existing document routes — verified by a request from an unauthorized user returning 403.
9. **Collaboration.** Two users editing the same document see each other's static-variable changes in near real-time (acceptable implementation: polling on PATCH success, or a cheap Postgres LISTEN/NOTIFY; Yjs sync of static values is overkill).

## Out of scope

- Variable value validation (min/max, regex) — add in Phase 6 if needed.
- Conditional variables ("only show X if Y is set") — not a requirement.
- Variable value history / undo beyond the browser's native form behavior.
- A dedicated "fill variables" wizard — the side panel is enough.

## Handoff to Phase 5

Phase 5 can reuse:

- `ResolvedVariablesContext` for the template builder's preview mode.
- `VariablesPanel` rendering logic for the variable registry editor.
- The `document_variable_values` pattern as a template for `template_variable_registry` storage.
