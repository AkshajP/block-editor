#!/usr/bin/env node

import "dotenv/config";

import { setPersistence, setupWSConnection } from "@y/websocket-server/utils";
import http from "http";
import { WebSocketServer } from "ws";
import { PostgresqlPersistence } from "y-postgresql";
import * as Y from "yjs";

const server = http.createServer((request, response) => {
  response.writeHead(200, { "Content-Type": "text/plain" });
  response.end("okay");
});

const wss = new WebSocketServer({ server });
wss.on("connection", (ws, req) => {
  try {
    setupWSConnection(ws, req);
  } catch (error) {
    console.log("[Server] Closing connection", {
      error: error.message,
      name: error.name,
    });
  }
});

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

  server.listen(1234, () => {
    console.log(`listening on port:1234`);
  });
}

// start the async part and catch errors
main().catch((err) => {
  console.error("[Server] Initialization error", err);
  process.exit(1);
});
