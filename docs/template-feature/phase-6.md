# Phase 6 — Protection, Versioning, Polish

**Track:** Feature
**Prerequisite reading:** [overview.md](overview.md), all earlier phase docs.
**Depends on:** Phases 1–5 complete.
**Blocks:** nothing — this is the hardening phase before general availability.

## Objective

Make the template system safe to use in anger: authors cannot corrupt templated structure, templates can evolve without breaking existing documents, and a small library of starter templates exists so users aren't staring at a blank builder.

## Scope

### 1. Protected-region UX

The Phase 2 `insertBehavior.allowDelete` flag handles atomic deletion. Phase 6 extends protection to granular cases:

- Static-text nodes inside a block cannot be typed into or deleted via normal editing.
- Variable pills cannot be typed into — only deleted as a unit.
- Attempts to edit protected regions show a subtle toast ("This part of the template is fixed") rather than silently failing.
- A "Force edit" mode (keyboard shortcut, gated behind a confirmation) lets authors with write permission override protection for one-off needs. Off by default.

### 2. Template versioning — upgrade flow

Documents store `{templateId, templateVersion}`. When a new version is published:

- Documents referencing the old version keep rendering against that version.
- The editor shows a banner: "Template version 3 available. Upgrade this document?"
- Upgrading runs a migration step that diffs block definitions and variable registries between versions and reports any incompatibilities (e.g., a block definition was removed; a variable was renamed).
- A `template_version_migrations` table records the upgrade event.

Incompatibilities are listed; the user confirms per-document before upgrade applies. No automatic upgrades.

### 3. Starter template library

Ship 3–5 built-in templates covering common cases:

- Academic paper (chapters, captioned figures, references).
- Technical report (executive summary, sections, appendix).
- Blank — minimum `PageLayout` + paragraph primitive.
- Letter / memo.
- Recipe or similar "complex composite" to stress-test the builder.

Stored as seed data, owned by a system user, marked read-only in the UI. Users can "duplicate to edit."

### 4. Custom font registration

The Phase 3 PDF layer uses built-in fonts. Phase 6 allows tenants to upload a `.ttf` / `.woff`. Fonts are registered with `@react-pdf/renderer` at export time and referenced by `fontFamily` in `PresentationStyle`. Upload path and storage TBD per tenant infrastructure.

### 5. Audit and observability

- Log every template publish, upgrade, and document-template-change event.
- Surface errors in PDF export (failed font loads, missing block definitions) to the user via the export UI rather than swallowed server-side.

### 6. Performance pass

- Benchmark counter resolution on documents with 500+ custom blocks. If jank appears, add memoization keyed by instance path and tree hash.
- Benchmark PDF export; move to a background job if sync requests exceed a few seconds.

## Deliverables

- Protected-region enforcement in `CustomBlockNode` and related plugins.
- Version upgrade API + banner UI + migration diff helper.
- Seed data for starter templates + admin-only flag for system templates.
- Font upload API + storage integration + render-time registration.
- Audit log entries for template operations.
- Benchmarks committed under `packages/template-core/benchmarks/` and `packages/pdf/benchmarks/`.

## Acceptance criteria

1. **Cannot edit static text.** In a document using the reference template, clicking inside "Chapter " or "Fig " static text does not place a cursor. Typing does nothing. Deleting with Backspace removes nothing (unless the whole block is selected).
2. **Cannot type into variable pills.** Same behavior: pills are atomic.
3. **Force-edit gate.** Entering force-edit mode requires a confirmation dialog and is visually distinct (banner or outline around the editor). Exiting restores protection.
4. **Version upgrade surfaces diff.** Publishing a v2 that removes a block definition used in a document shows a banner that lists the block definition name and refuses to upgrade until the user acknowledges.
5. **Old version renders.** A document referencing v1 renders against v1 even after v2 is published. Verified by test using a stored fixture.
6. **Starter templates load.** Logging in with a fresh account shows the starter templates in the template picker. Duplicating one creates an editable copy owned by the user.
7. **Custom font in PDF.** Uploading a font, referencing it in a template's typography, and exporting produces a PDF whose embedded font list contains the uploaded font.
8. **Resolver stays fast.** On a document with 1,000 custom blocks, counter resolution completes within a budget (pick and document one — e.g. 20 ms). Benchmark is green in CI.
9. **Export errors surface.** Removing a font after some templates reference it and exporting produces an actionable error message in the UI, not a blank PDF.
10. **Audit log populated.** Publishing a template, upgrading a document, and changing its template all produce audit rows queryable by document id.

## Out of scope (and deliberately stays so)

- Real-time collaborative template editing — single-author for now.
- Template marketplace across tenants.
- AI template generation or "import from PDF".
- Accessibility tagging in PDF output (PDF/UA) — plan as a separate epic.
- Non-Latin-script-aware typography rules (kerning, BiDi) beyond `@react-pdf/renderer` defaults.

## Closing the feature

After Phase 6 passes, the template feature is complete as defined in [../GOALS.md](../GOALS.md) §4–§6. Remaining work (marketplace, AI assists, accessibility) becomes its own epic.
