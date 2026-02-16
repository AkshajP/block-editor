# Collaborative Block Editor Setup Guide

This document explains how to set up and use the collaborative editing features of the block editor.

## Overview

The block editor uses:

- **Lexical** for rich text editing
- **Yjs** for collaborative synchronization
- **y-websocket** for WebSocket-based real-time communication between clients
- **@y/websocket-server** as the server implementation

## Installation

Dependencies have been added to `package.json`. Install them by running:

```bash
npm install
```

This installs:

- `@lexical/yjs` - Lexical bindings for Yjs
- `yjs` - CRDT (Conflict-free Replicated Data Type) library
- `y-websocket` - WebSocket provider for Yjs
- `@y/websocket-server` (dev) - WebSocket server implementation

## Running the Application

### Option 1: Automated Setup (Recommended)

Run both the WebSocket server and Next.js dev server together:

```bash
npm run dev:collab
```

This command:

1. Starts the y-websocket server on `localhost:1234`
2. Starts the Next.js dev server on `localhost:3000`
3. Persists Yjs documents in `./yjs-wss-db` directory

### Option 2: Manual Setup

**Terminal 1 - Start WebSocket Server:**

```bash
npm run collab-server
```

Expected output:

```
y-websocket-server started on localhost:1234
```

**Terminal 2 - Start Next.js Dev Server:**

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

## Testing Collaborative Editing

1. Open the editor at `http://localhost:3000` in multiple browser windows/tabs or different browsers
2. Type or edit content in one editor - changes will appear in real-time in all other connected editors
3. The changes persist even if you refresh the browser

## Architecture

### Editor Component (`src/components/Editor.tsx`)

The Editor component now includes:

- **LexicalCollaboration**: Context provider that manages collaborative state
- **CollaborationPlugin**: Syncs editor state with Yjs documents
- **WebsocketProvider**: Connects to the WebSocket server for real-time synchronization

Key configuration:

```tsx
// Critical: Set editorState to null so CollaborationPlugin initializes content
editorState: null,

// Provider factory creates WebSocket connections
const providerFactory = useCallback(
  (id: string, yjsDocMap: Map<string, Y.Doc>) => {
    const doc = getDocFromMap(id, yjsDocMap);
    return new WebsocketProvider(getWebSocketUrl(), id, doc, {
      connect: true,
    });
  },
  [getDocFromMap]
);
```

### Collaboration Utilities (`src/lib/collaboration.ts`)

Provides helper functions for collaborative setup:

- `getWebSocketUrl()` - Returns the WebSocket server URL
- `withHeadlessCollaborationEditor()` - Creates a headless editor for server-side Yjs initialization
- `createBootstrappedYDoc()` - Creates a pre-initialized Yjs document (dev/testing)

## Configuration

Edit the WebSocket connection settings in `.env.local`:

```env
NEXT_PUBLIC_WS_HOST=localhost        # WebSocket server hostname
NEXT_PUBLIC_WS_PORT=1234             # WebSocket server port
```

For production, adjust these values to match your server deployment.

## Data Persistence

When using the automated scripts, Yjs documents are automatically persisted to `./yjs-wss-db/`:

- Documents are saved to disk after client updates
- Clients reconnecting to the same document ID will retrieve the persisted state
- This allows offline-first collaboration patterns in development

## Troubleshooting

### WebSocket Connection Fails

- Ensure the WebSocket server is running: `npm run collab-server`
- Check that `NEXT_PUBLIC_WS_HOST` and `NEXT_PUBLIC_WS_PORT` are correct
- If using HTTPS, the WebSocket server must also use WSS (secure WebSocket)

### Editors Not Syncing

- Verify all editor instances are connected to the same WebSocket server
- Check browser console for connection errors
- Ensure the `id` prop in CollaborationPlugin is identical across all instances

### Performance Issues with Large Documents

- Yjs efficiently handles large documents, but very large documents may take time to sync initially
- Monitor network tab to see sync operations
- Consider implementing pagination for extremely large documents

### Development vs Production

**Development:**

- WebSocket server runs with persistence (`./yjs-wss-db`)
- Ideal for testing and prototyping

**Production:**

- Deploy the WebSocket server separately (or use a managed Yjs provider)
- Use environment variables to configure server endpoints
- Consider using a database to persist Yjs documents between restarts

## Next Steps

### Building Collaborative Features

Based on the Lexical documentation, you can also build:

1. **Comments Plugin** - Separate provider and Yjs room for comment synchronization
2. **Image Component** - Nested composer with collaboration support
3. **Sticky Notes** - Real-time position sync using Yjs awareness
4. **Presence Indicators** - Show other users' cursor positions and selections

See `src/components/plugins/` for plugin examples.

## Resources

- [Lexical Collaboration Guide](https://lexical.dev/docs/concepts/collaborative)
- [Yjs Documentation](https://docs.yjs.dev/)
- [y-websocket Repository](https://github.com/yjs/y-websocket)
- [Yjs Provider List](https://docs.yjs.dev/ecosystem/providers)
