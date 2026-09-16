import assert from "node:assert/strict";
import test from "node:test";
import { analysePixels, rankPromptScores } from "../lib/dna/analyze.mjs";
import { DatabaseSync } from "node:sqlite";
import { ensureArtworkDnaTable, getArtworkDna, upsertArtworkDna } from "../lib/dna/store.mjs";

test("analysePixels reports palette shares and tonal distribution", () => {
  const dna = analysePixels({ data: Uint8Array.from([250, 240, 200, 20, 20, 20]), channels: 3 });
  assert.equal(dna.palette.reduce((total, swatch) => total + swatch.share, 0), 100);
  assert.equal(dna.darkPct, 50);
});

test("rankPromptScores orders prompt vectors by cosine score", () => {
  const scores = rankPromptScores(Float32Array.from([1, 0]), [["quiet / contemplative", "quiet", [1, 0]], ["intimate / tender", "tender", [0, 1]]]);
  assert.equal(scores[0].label, "quiet / contemplative");
});

test("DNA records round-trip from SQLite", () => {
  const db = new DatabaseSync(":memory:"); ensureArtworkDnaTable(db);
  upsertArtworkDna(db,{id:5,palette:[],luminanceMean:102,darkPct:22,lightPct:0,semanticScores:[],dnaVersion:1});
  assert.equal(getArtworkDna(db,5).dnaVersion,1);
});
