# Phase 5 — Template Builder UI

**Track:** Feature (largest surface; smallest remaining architectural risk)
**Prerequisite reading:** [overview.md](overview.md), all earlier phase docs.
**Depends on:** Phases 1–4 complete.
**Blocks:** Phase 6 only for polish; this phase delivers the user-facing template authoring experience.

## Objective

Let a user build a new template from scratch through a Word-like UI: ribbon at the top with formatting/insert controls, the block editor in the middle showing what they're composing, a panel for the variable registry and typography base. At save time, the UI emits a `Template` JSON matching the Phase 1 schema. No new document-authoring features — reuse everything from Phases 2–4.

## Scope

### 1. Persistence

New Postgres table `templates`:

- `id, owner_id, tenant_id, name, version, json` (the full Template JSON).
- Multiple versions per template (new row per version; never mutate published rows).

New table `template_block_definitions` is **not** created — block definitions live inside the template JSON. A separate table is tempting but fights the "one schema" rule.

API routes:

- `GET /api/templates` — list owned templates.
- `POST /api/templates` — create new (starts from a minimal built-in base).
- `GET /api/templates/[id]` — fetch latest version.
- `PUT /api/templates/[id]` — new version (bumps `version`).
- `GET /api/templates/[id]/versions/[v]` — specific version.

### 2. Routes

- `/templates` — list page. Create, open, rename, archive.
- `/templates/[id]/edit` — builder. Reuses `Editor` core with a different plugin set (see §3).
- `/templates/[id]/preview` — renders a sample document using the template, both as an HTML preview and an on-demand PDF (reuses Phase 3 renderer).

### 3. Builder = editor with a different plugin set

The big insight is that template authoring is content authoring with different metadata intent. Reuse the Lexical composer; swap plugins.

Specifically:

- Replace `SlashMenuPlugin` with a `RibbonPlugin` that exposes typography, alignment, spacing, color, insert-primitive, insert-variable, insert-editable-slot, and group-selection-as-block controls.
- Inserting a primitive with the ribbon creates a `BlockNodePrimitiveMarker` — a transient node used only in builder mode that captures presentation on save.
- Selecting a range and pressing "Group as block" opens a dialog asking for `displayName`, `id`, `category`, and `insertBehavior`, then serializes the selection into a `BlockDefinition` appended to the template's `blockDefinitions`.

### 4. Variable registry editor

A side panel listing all variables in the template:

- Add / remove / edit.
- Static: label, valueType.
- Counter: incrementsOn (dropdown of block definition ids), resetsOn (dropdown of counter ids, optional), format.
- Global-computed: source (dropdown of the fixed set).

### 5. Typography & page defaults

A second side panel for `pageDefaults` and `typography` base. Changes reflect live in the builder preview.

### 6. Save flow

"Save" validates the current template via `validateTemplate` from Phase 1. Errors are surfaced inline in the panel that owns the offending field. Only on `{ ok: true }` does the template persist as a new version.

### 7. Publish

A "Publish" action marks a template version as usable by documents. Unpublished versions are drafts; documents can only reference published versions. This is the minimum versioning safety net.

### 8. Template picker on document create

Modify [apps/web/src/app/page.tsx](../../apps/web/src/app/page.tsx) / [DashboardClient.tsx](../../apps/web/src/components/DashboardClient.tsx) so creating a new document prompts for a template. Selection stores `{templateId, templateVersion}` on the document row.

## Deliverables

- Migrations for `templates` table and a `document_template` reference on the existing documents table.
- API routes listed in §1.
- New pages: `/templates`, `/templates/[id]/edit`, `/templates/[id]/preview`.
- New components: `RibbonPlugin`, `VariableRegistryPanel`, `TypographyPanel`, `GroupAsBlockDialog`.
- Dashboard updates for template selection on document create.
- End-to-end tests that build a template matching the reference fixture from Phase 1, save it, then create a document that uses it and reproduces the Phase 3 acceptance scenario.

## Acceptance criteria

1. **Round-trip the reference template.** A user can, through the builder UI, recreate `referenceTemplate` (Phase 1 fixture). Saving it and diffing the stored JSON against the fixture shows equivalence (ids/order may differ; structure and behavior must match).
2. **Create → use.** Creating a document that references the saved template and inserting `Chapter` + `CaptionedImage` produces the same result as Phase 2 criterion #2.
3. **Validation surfaces errors.** Creating a variable with a duplicate id, or a counter that resets on itself, prevents save with an error pointing at the offending field.
4. **Preview matches export.** The HTML preview of a template against a sample document and the PDF export of the same inputs show the same text content (reuse Phase 3's text-comparison helper).
5. **Versions are immutable.** Publishing version 1, editing, saving produces version 2 without altering version 1's stored JSON. Documents referencing version 1 continue to render as version 1.
6. **Ownership enforced.** A user cannot read or write another user's unshared templates.
7. **Ribbon is sufficient.** A user can author the reference template without touching JSON or developer tools. This is a manual acceptance — document the steps in the PR description.

## Out of scope

- Drag-and-drop reordering of block definitions (nice-to-have, not required).
- Template marketplace / sharing beyond simple ownership.
- Importing `.docx` as a starting point.
- AI-assisted template authoring.
- Custom font upload (flag for Phase 6).

## Risks to watch

- **Scope explosion.** The builder is where "one more control" destroys the schedule. Everything must reduce to a field in the Phase 1 schema. If the UI wants to express something the schema can't, stop and update the schema (and all renderers) first.
- **Two editors, two plugin sets.** Keep them cleanly separated. A bug where slash-menu UX leaks into the builder, or vice versa, signals that plugins are reaching into shared state they shouldn't.

## Handoff to Phase 6

Phase 6 polishes and protects. When Phase 5 closes, everything a user needs exists; Phase 6 makes it survive real use.
