#!/usr/bin/env node

/**
 * Y-WebSocket Server
 *
 * This is a simple wrapper around the y-websocket server for local development.
 * The server persists Yjs documents to disk, allowing clients to reconnect and
 * continue editing where they left off.
 *
 * Usage:
 *   node collab-server.js
 *   HOST=0.0.0.0 PORT=1234 YPERSISTENCE=./db node collab-server.js
 */

import "@y/websocket-server";

const host = process.env.HOST || "localhost";
const port = process.env.PORT || "1234";
const persistence = process.env.YPERSISTENCE || "./yjs-wss-db";

console.log(`
╔════════════════════════════════════════════════════╗
║     Y-WebSocket Collaboration Server Started      ║
╠════════════════════════════════════════════════════╣
║ 🚀 Server:      ${host}:${port}${" ".repeat(Math.max(0, 20 - host.length - port.length))} ║
║ 💾 Persistence: ${persistence}${" ".repeat(Math.max(0, 26 - persistence.length))} ║
║                                                    ║
║ Ready for collaborative editing!                  ║
║ Open http://localhost:3000 in multiple tabs       ║
╚════════════════════════════════════════════════════╝
`);
