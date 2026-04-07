#!/usr/bin/env node

import "dotenv/config";

import {
  docs,
  setPersistence,
  setupWSConnection,
} from "@y/websocket-server/utils";
import { createHmac, timingSafeEqual } from "crypto";
import http from "http";
import { WebSocketServer } from "ws";
import { PostgresqlPersistence } from "y-postgresql";
import * as Y from "yjs";

const CHECKPOINT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

function getWsSecret(): string {
  return process.env.WS_SECRET ?? process.env.AUTH_SECRET ?? "dev-ws-secret";
}

function verifyWsToken(token: string | null, documentId: string): boolean {
  if (!token) return false;

  const dotIndex = token.lastIndexOf(".");
  if (dotIndex === -1) return false;

  const payloadB64 = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);

  let payload: string;
  try {
    payload = Buffer.from(payloadB64, "base64url").toString("utf8");
  } catch {
    return false;
  }

  const parts = payload.split(":");
  if (parts.length !== 3) return false;
  const [tokenDocId, , expStr] = parts;

  if (tokenDocId !== documentId) return false;
  if (Date.now() > parseInt(expStr, 10)) return false;

  const expected = createHmac("sha256", getWsSecret())
    .update(payload)
    .digest("hex");

  try {
    return timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expected, "hex"),
    );
  } catch {
    return false;
  }
}

const server = http.createServer((_request, response) => {
  response.writeHead(200, { "Content-Type": "text/plain" });
  response.end("okay");
});

const wss = new WebSocketServer({ server });
wss.on("connection", (ws, req) => {
  try {
    const url = new URL(req.url!, `http://localhost`);
    // Room name is the first path segment (y-websocket convention)
    const documentId = decodeURIComponent(url.pathname.slice(1));
    const token = url.searchParams.get("token");

    if (!verifyWsToken(token, documentId)) {
      console.warn(
        `[Server] Rejected unauthorized connection for room "${documentId}"`,
      );
      ws.close(4001, "Unauthorized");
      return;
    }

    setupWSConnection(ws, req);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[Server] Error setting up connection", {
      error: err.message,
      name: err.name,
    });
    ws.close();
  }
});

async function flushActiveDocs(pgdb: PostgresqlPersistence) {
  if (docs.size === 0) return;
  console.log(`[Checkpoint] Flushing ${docs.size} active document(s)`);
  await Promise.allSettled(
    Array.from(docs.keys()).map((docName) =>
      pgdb
        .getStateVector(docName)
        .catch((err) =>
          console.error(`[Checkpoint] Failed to flush "${docName}":`, err),
        ),
    ),
  );
}

// Graceful shutdown: flush active docs, then close all connections
function makeShutdown(pgdb: PostgresqlPersistence) {
  return async () => {
    await flushActiveDocs(pgdb);
    wss.close(() => {
      server.close(() => {
        process.exit(0);
      });
    });
  };
}

async function main() {
  if (
    !process.env.PGHOST ||
    !process.env.PGPORT ||
    !process.env.PGDATABASE ||
    !process.env.PGUSER ||
    !process.env.PGPASSWORD
  ) {
    throw new Error(
      "Please define the PostgreSQL connection option environment variables",
    );
  }

  const pgdb = await PostgresqlPersistence.build({
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT, 10),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
  });

  setPersistence({
    bindState: async (docName, ydoc) => {
      // Apply persisted state FIRST, then register the listener.
      // Y.applyUpdate fires the "update" event — registering before apply would
      // re-store the entire document state on every connection, causing DB bloat
      // and cumulative drift in the reconstructed document.
      const persistedYdoc = await pgdb.getYDoc(docName);
      if (persistedYdoc) {
        Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(persistedYdoc));
        persistedYdoc.destroy();
      }
      ydoc.on("update", async (update) => {
        await pgdb.storeUpdate(docName, update);
      });
    },
    writeState: async (docName, ydoc) => {
      await pgdb.storeUpdate(docName, Y.encodeStateAsUpdate(ydoc));
    },
    provider: pgdb,
  });

  const checkpointInterval = setInterval(
    () => flushActiveDocs(pgdb),
    CHECKPOINT_INTERVAL_MS,
  );
  checkpointInterval.unref(); // don't keep the process alive for this alone

  const shutdown = makeShutdown(pgdb);
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  server.listen(1234, () => {
    console.log(`listening on port:1234`);
  });
}

// start the async part and catch errors
main().catch((err) => {
  console.error("[Server] Initialization error", err);
  process.exit(1);
});
