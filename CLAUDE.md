# Block Editor

A collaborative rich text editor built on [Lexical](https://lexical.dev/) (Meta's editor framework). See [GOALS.md](docs/GOALS.md) for the full product vision and planned features.

## Monorepo Structure

```
block-editor/
├── apps/
│   └── web/                 # Next.js 16 frontend — editor UI
├── packages/
│   └── collab-server/       # Node.js WebSocket collaboration server
├── docker-compose.yml       # PostgreSQL 16 + PgAdmin 4
├── pnpm-workspace.yaml
└── turbo.json
```

Managed with **pnpm workspaces + Turborepo**.

## Tech Stack

### Frontend — `apps/web`

- **Framework:** Next.js 16, React 19, TypeScript
- **Editor:** Lexical 0.41
- **Collaboration:** Yjs 13.6, y-websocket 3.0
- **Styling:** Tailwind CSS 4, shadcn/ui, Radix UI
- **Forms/Validation:** React Hook Form 7, Zod
- **Testing:** Vitest 4, Testing Library

### Collaboration Server — `packages/collab-server`

- **Runtime:** Node.js, TypeScript (tsx)
- **WebSocket:** ws, @y/websocket-server
- **Persistence:** PostgreSQL 16 via y-postgresql + pg

## Key Source Files

- `apps/web/src/components/Editor.tsx` — Lexical editor wired to Yjs
- `apps/web/src/components/AwarenessContext.tsx` — presence/cursor state
- `apps/web/src/components/plugins/MultiCursorPlugin.tsx` — real-time cursors
- `apps/web/src/components/plugins/SlashMenuPlugin.tsx` — slash-command menu
- `apps/web/src/lib/collaboration.ts` — Yjs/WebSocket setup
- `packages/collab-server/index.ts` — WebSocket server with Postgres persistence

## Running the Project

```bash
pnpm docker:up   # start Postgres + PgAdmin
pnpm dev         # all workspaces in parallel
pnpm build
pnpm test
```

Default ports: frontend `3000`, collab server `1234`, Postgres `5432`, PgAdmin `5050`.

## Architectural Notes

- **Lexical** is the source of truth for document structure. Yjs wraps it via `@lexical/yjs` for real-time collaboration.
- **Yjs** provides CRDT-based conflict-free merging; the collab server persists Yjs state to Postgres so documents survive restarts.
- Presentation concerns (PDF rendering, template rules) should live in dedicated packages, not inside the Next.js app.
