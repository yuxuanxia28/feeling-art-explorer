import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import { buildNgaIndex, buildNgaIndexFromStreams } from "../lib/nga/index.mjs";

const tables = {
  objects: [{ objectID: "1", title: "Flower Study", displayDate: "1901", medium: "Oil", classification: "Painting" }],
  constituents: [{ constituentID: "10", displayName: "A. Artist" }],
  objectsConstituents: [{ objectID: "1", constituentID: "10", roleType: "artist" }],
  objectsTerms: [{ objectID: "1", termID: "20", term: "Botany" }],
  terms: [],
  publishedImages: [
    { depictsTmsObjectID: "1", openAccess: "0", viewType: "primary", iiifThumbUrl: "https://restricted" },
    { depictsTmsObjectID: "1", openAccess: "1", viewType: "primary", iiifThumbUrl: "https://open" },
  ],
};

test("indexes only the primary open-access image for an artwork", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "nga-index-"));
  const outputPath = path.join(directory, "nga.sqlite");
  t.after(() => rm(directory, { recursive: true, force: true }));

  assert.deepEqual(await buildNgaIndex({ tables, outputPath }), { indexedCount: 1 });

  const database = new DatabaseSync(outputPath, { readOnly: true });
  t.after(() => database.close());
  const artwork = database.prepare("SELECT title, artist, terms, thumbnail_url FROM artwork").get();
  assert.equal(artwork.title, "Flower Study");
  assert.equal(artwork.artist, "A. Artist");
  assert.equal(artwork.terms, "Botany");
  assert.equal(artwork.thumbnail_url, "https://open");
});

test("builds an index from streaming NGA rows", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "nga-stream-index-"));
  const outputPath = path.join(directory, "nga.sqlite");
  t.after(() => rm(directory, { recursive: true, force: true }));
  const stream = (rows) => (async function* () { yield* rows; })();
  const result = await buildNgaIndexFromStreams({ outputPath, streams: Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, stream(rows)])) });
  assert.equal(result.indexedCount, 1);
});
