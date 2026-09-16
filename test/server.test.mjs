import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { buildNgaIndex } from "../lib/nga/index.mjs";
import { createServer } from "../server.mjs";

test("GET /api/search returns a paginated response", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "nga-server-"));
  const indexPath = path.join(directory, "nga.sqlite");
  t.after(() => rm(directory, { recursive: true, force: true }));
  await buildNgaIndex({ indexPath, outputPath: indexPath, tables: {
    objects: [{ objectID: "1", title: "Monet Garden" }], constituents: [], objectsConstituents: [], objectsTerms: [], terms: [],
    publishedImages: [{ depictsTmsObjectID: "1", openAccess: "1", viewType: "primary", iiifThumbUrl: "https://image" }],
  }});
  const server = createServer({ indexPath, rootDirectory: directory });
  t.after(() => server.close());
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  const response = await fetch(`http://127.0.0.1:${port}/api/search?q=monet`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).query, "monet");
});

test("GET /api/search rejects an empty query", async (t) => {
  const server = createServer({ indexPath: "missing.sqlite", rootDirectory: process.cwd() });
  t.after(() => server.close());
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  assert.equal((await fetch(`http://127.0.0.1:${port}/api/search?q=`)).status, 400);
});

test("missing static files return 404 without crashing the server", async (t) => {
  const server = createServer({ indexPath: "missing.sqlite", rootDirectory: process.cwd() });
  t.after(() => server.close());
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  assert.equal((await fetch(`http://127.0.0.1:${port}/favicon.ico`)).status, 404);
});
