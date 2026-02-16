# 🚀 Collaborative Block Editor - Quick Start

Your block editor now has full collaborative editing capabilities! Multiple users can edit the same document in real-time.

## What's Been Added

✅ **Lexical Collaboration** - Built-in collaborative editing support  
✅ **Yjs Synchronization** - Conflict-free replicated data type for real-time sync  
✅ **WebSocket Provider** - Real-time communication between clients  
✅ **Data Persistence** - Documents saved to disk, survives server restarts  
✅ **Environment Config** - Easy setup with `.env.local`

## Quick Start (3 Steps)

### 1️⃣ Install Dependencies

```bash
npm install
```

### 2️⃣ Start the Collaboration Server + App

```bash
npm run dev:collab
```

This starts:

- WebSocket server on `ws://localhost:1234`
- Next.js app on `http://localhost:3000`

### 3️⃣ Test Collaboration

Open http://localhost:3000 in **2+ browser tabs or windows**:

- Edit in one tab → changes appear in other tabs instantly ✨
- Refresh any tab → content persists and re-syncs
- Works across different browsers too!

## Files Created/Modified

### New Files:

- `src/lib/collaboration.ts` - Collaboration utilities
- `COLLABORATION.md` - Detailed setup guide
- `.env.local` - Environment configuration
- `collab-server.js` - Alternative server startup script

### Modified Files:

- `src/components/Editor.tsx` - Integrated collaboration
- `package.json` - Added dependencies & npm scripts

## Key Components

### Editor Component

```tsx
<LexicalCollaboration>
  <LexicalComposer initialConfig={initialConfig}>
    <CollaborationPlugin
      id="block-editor/collaborative"
      providerFactory={providerFactory}
    />
    {/* ... your plugins ... */}
  </LexicalComposer>
</LexicalCollaboration>
```

### Important: Set `editorState: null`

The `editorState: null` in initialConfig is **critical** - it tells Lexical to let CollaborationPlugin initialize the content instead.

## Environment Variables

Configure in `.env.local`:

```env
NEXT_PUBLIC_WS_HOST=localhost    # WebSocket server address
NEXT_PUBLIC_WS_PORT=1234         # WebSocket server port
```

## npm Scripts

```bash
npm run dev           # Just Next.js (no collaboration)
npm run collab-server # Just WebSocket server
npm run dev:collab    # Both server + Next.js (recommended)
npm run build         # Build for production
npm run start         # Production server
```

## Architecture Overview

```
Browser 1                 Browser 2                 Browser 3
    ↓                         ↓                         ↓
LexicalEditor          LexicalEditor              LexicalEditor
    ↓                         ↓                         ↓
CollaborationPlugin    CollaborationPlugin       CollaborationPlugin
    ↓                         ↓                         ↓
    └─────────────────────────┴──────────────────────────┘
                              ↓
                      WebSocket Server
                    (localhost:1234)
                              ↓
                      Yjs Document Store
                      (./yjs-wss-db)
```

## Data Persistence

- Documents are persisted to `./yjs-wss-db/` directory
- When the server restarts, clients reconnect and retrieve their documents
- No data is lost between server restarts (during development)

## Next Steps

### 🎨 Customize

- Adjust ThemeProvider styling in Editor.tsx
- Add custom plugins in `src/components/plugins/`
- Extend with comment plugins, sticky notes, etc.

### 🔧 Production Ready

For production deployment:

1. Deploy WebSocket server to a reliable host
2. Set environment variables for your production server
3. Consider using managed Yjs providers (e.g., Fluence, Dye)
4. Implement user authentication/authorization
5. Add document-level access control

### 📚 Learn More

- [Lexical Collaboration Docs](https://lexical.dev/docs/concepts/collaborative)
- [Yjs Documentation](https://docs.yjs.dev/)
- See `COLLABORATION.md` for detailed configuration and troubleshooting

## Troubleshooting

**Editors not syncing?**

- Ensure WebSocket server is running
- Check browser console for errors
- Verify `NEXT_PUBLIC_WS_HOST` and `PORT` are correct

**Server won't start?**

- Run `npm install` first
- Clear `./yjs-wss-db` directory if corrupted
- Check if port 1234 is already in use

**Performance issues?**

- Monitor Network tab for large sync operations
- Yjs is optimized even for large documents
- Contact support for very large document handling (1M+ nodes)

---

**Happy collaborating! 🎉**
