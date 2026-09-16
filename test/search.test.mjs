import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { buildNgaIndex } from "../lib/nga/index.mjs";
import { SearchInputError, searchArtworks } from "../lib/nga/search.mjs";

test("returns title matches before weaker term matches", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "nga-search-"));
  const outputPath = path.join(directory, "nga.sqlite");
  t.after(() => rm(directory, { recursive: true, force: true }));
  await buildNgaIndex({ outputPath, tables: {
    objects: [
      { objectID: "1", title: "Monet in a Garden" },
      { objectID: "2", title: "Garden Study" },
    ], constituents: [], objectsConstituents: [],
    objectsTerms: [{ objectID: "2", termID: "4" }], terms: [{ termID: "4", term: "Monet" }],
    publishedImages: [
      { depictsTmsObjectID: "1", openAccess: "1", viewType: "primary", iiifThumbUrl: "https://one" },
      { depictsTmsObjectID: "2", openAccess: "1", viewType: "primary", iiifThumbUrl: "https://two" },
    ],
  }});
  const result = searchArtworks(outputPath, { q: "monet", page: "1", limit: "20" });
  assert.equal(result.total, 2);
  assert.equal(result.results[0].title, "Monet in a Garden");
});

test("rejects a blank search", () => {
  assert.throws(() => searchArtworks("missing.sqlite", { q: "   " }), SearchInputError);
});
