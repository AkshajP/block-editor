# Project Goals

The aim is a near-enterprise-grade collaborative document editor with a strong separation of **content** from **presentation**. Authors focus on writing; the template handles how it looks.

## Core Pillars

### 1. Collaboration

Real-time multi-user editing with presence awareness (live cursors, selections). Already partially implemented via Yjs + y-websocket.

### 2. Snapshot / Diff / Restore

- Save named snapshots of a document at any point in time
- Diff any two snapshots to see what changed (structural diff of Lexical nodes)
- One-click restore to any prior snapshot
- Stored in Postgres

### 3. Authentication & Authorization

- User identity (NextAuth.js or equivalent)
- Document ownership model: owner / editor / viewer roles
- Access enforced on the WebSocket connection (only authorized users join a room)

### 4. Template Engine

A template encodes **presentation rules** so the author only touches content:

- Page dimensions, margins, column layouts
- Header / footer content and styles
- Font and typography rules
- Named variable slots (static and computed)

Templates are imported into a blank document. The structure and styles they define are protected from accidental deletion.

### 5. Variable System

Variables are Lexical nodes that are visually distinct and safely updatable:

- **Static variables** — supplied per-document by the user, e.g. `{{institute_name}}`, `{{student_name}}`
- **Computed variables** — evaluated at render/export time, e.g. `{{page_number}}`, `{{total_pages}}`, `{{date}}`

Variables show a placeholder at edit-time and resolve to real values at export-time.

### 6. PDF Presentation Layer

Maps the Lexical document tree + template metadata → PDF:

- Custom constructs: pages, headers, footers, columns, alignment, page breaks, watermarks
- The template defines how constructs look; the presentation layer applies them
- Implemented as a standalone package (not inside the Next.js app) — likely `@react-pdf/renderer` or `pdfkit`

## Implementation Priorities

1. Auth + document ownership (gates everything else)
2. Snapshot / diff / restore
3. Template engine (format + import flow)
4. Variable system
5. PDF presentation layer
