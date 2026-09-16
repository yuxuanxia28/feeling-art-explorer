# DNA-first Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the explorer’s coordinate-system explanation with evidence-backed Artwork DNA cards for the three featured vector-indexed works, while preserving search and free-form exploration.

**Architecture:** A deterministic local indexing script computes palette, luminance, and fixed CLIP prompt scores, then stores them in SQLite beside the existing vector embeddings. A small API reads one artwork’s DNA and its nearest vector neighbours. The existing React detail panel becomes a DNA card; the canvas stays a scatter field with no semantic axes or positional claims.

**Tech Stack:** Node.js `node:sqlite`, `sharp`, `@huggingface/transformers` CLIP, HTTP server, React 18 UMD in `index.html`, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-15-artwork-dna-design.md`

## Global Constraints

- Keep NGA metadata, measured pixels, and model inferences visibly separate.
- Treat CLIP scores as fixed-prompt comparison values, never percentages or historical facts.
- Initial DNA indexing covers artwork IDs `0`, `1`, and `5`; normal text search remains unchanged.
- Remove all `By Name / By Vibe / Mainstream / Niche` axes, labels, mini-maps, preset positions, and quadrant explanations.
- Preserve scatter layout, pan, zoom, hover spacing, temperature-based breadth, and desktop/mobile usability.
- Do not require image processing or model inference during a user interaction.

---

### Task 1: Add tested, deterministic DNA analysis primitives

**Files:**
- Create: `lib/dna/analyze.mjs`
- Create: `test/dna.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces `DNA_PROMPTS`, `analysePixels({ data, channels })`, and `rankPromptScores(imageVector, promptVectors)`.
- `analysePixels` returns `{ palette: Array<{ hex, label, share }>, luminanceMean, darkPct, lightPct }`.
- `rankPromptScores` returns descending `{ label, prompt, score }` entries rounded only at presentation time.

- [ ] **Step 1: Write failing pure-function tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { analysePixels, rankPromptScores } from "../lib/dna/analyze.mjs";

test("analysePixels reports palette shares and tonal distribution", () => {
  const dna = analysePixels({ data: Uint8Array.from([250, 240, 200, 20, 20, 20]), channels: 3 });
  assert.equal(dna.palette.reduce((total, swatch) => total + swatch.share, 0), 100);
  assert.equal(dna.darkPct, 50);
});

test("rankPromptScores orders fixed prompt vectors by cosine score", () => {
  const scores = rankPromptScores(Float32Array.from([1, 0]), [["quiet / contemplative", "quiet", [1, 0]], ["intimate / tender", "tender", [0, 1]]]);
  assert.equal(scores[0].label, "quiet / contemplative");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/dna.test.mjs`

Expected: FAIL because `lib/dna/analyze.mjs` does not exist.

- [ ] **Step 3: Add direct image-processing dependency and minimal pure implementation**

Run: `npm install sharp`

Implement RGB-bin palette selection, WCAG relative luminance calculation, 75/185 dark-light thresholds, colour labels, cosine scoring, and the six fixed prompts from the approved spec. Keep `sharp` out of `analysePixels`; the function accepts decoded pixels so it is deterministic in unit tests.

- [ ] **Step 4: Run focused and full tests**

Run: `node --test test/dna.test.mjs && npm test`

Expected: all tests pass.

- [ ] **Step 5: Commit the tested primitive**

```bash
git add package.json package-lock.json lib/dna/analyze.mjs test/dna.test.mjs
git commit -m "feat: add artwork DNA analysis primitives"
```

### Task 2: Persist DNA and create the featured-work indexing command

**Files:**
- Create: `lib/dna/store.mjs`
- Create: `scripts/index-dna.mjs`
- Modify: `package.json`
- Modify: `test/dna.test.mjs`

**Interfaces:**
- Produces `ensureArtworkDnaTable(db)`, `upsertArtworkDna(db, record)`, and `getArtworkDna(db, id)`.
- Adds `npm run index:dna`; `DNA_IDS=0,1,5` is its default selection and `DNA_IDS` can override it for future batches.
- Stores `palette_json`, `luminance_mean`, `dark_pct`, `light_pct`, `semantic_scores_json`, and `dna_version` in `artwork_dna`.

- [ ] **Step 1: Extend the failing test with round-trip persistence**

```js
test("DNA records round-trip from SQLite with their provenance version", () => {
  const db = new DatabaseSync(":memory:");
  ensureArtworkDnaTable(db);
  upsertArtworkDna(db, { id: 5, palette: [], luminanceMean: 102, darkPct: 22, lightPct: 0, semanticScores: [], dnaVersion: 1 });
  assert.equal(getArtworkDna(db, 5).dnaVersion, 1);
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --test test/dna.test.mjs`

Expected: FAIL because the persistence functions are absent.

- [ ] **Step 3: Implement the table and batch command**

`index-dna.mjs` must:

1. Read only requested rows that already exist in both `artwork` and `visual_embedding`.
2. Fetch each public NGA thumbnail, decode and resize it with `sharp`, and pass raw pixels to `analysePixels`.
3. Embed each fixed prompt once per run with `embedText`, score the stored image vector with `rankPromptScores`, and upsert the record transactionally.
4. Log `{ indexed, failed, requested }`; retain existing records when an image fails.

Add `"index:dna": "node scripts/index-dna.mjs"` to `package.json`.

- [ ] **Step 4: Run deterministic tests and feature index**

Run: `npm test && npm run index:dna`

Expected: all tests pass; output reports three indexed records and no mutation to `visual_embedding`.

- [ ] **Step 5: Commit the indexer**

```bash
git add lib/dna/store.mjs scripts/index-dna.mjs package.json test/dna.test.mjs
git commit -m "feat: index featured artwork DNA"
```

### Task 3: Serve DNA and explain vector neighbours

**Files:**
- Modify: `lib/vector/search.mjs`
- Create: `lib/dna/payload.mjs`
- Modify: `server.mjs`
- Modify: `test/server.test.mjs`

**Interfaces:**
- Adds `relatedVisuals(databasePath, artworkId, limit = 3)` returning ranked rows excluding `artworkId`.
- Adds `getArtworkDnaPayload(databasePath, artworkId)` returning the response documented in the spec or `null` when no DNA row exists.
- Adds `GET /api/artwork-dna/:id`; returns `200` JSON or `404 { "error": "Artwork DNA is not indexed yet" }`.

- [ ] **Step 1: Write failing server tests for available and missing DNA**

```js
test("GET /api/artwork-dna returns separated DNA evidence", async () => {
  const db = new DatabaseSync(indexPath);
  db.exec("CREATE TABLE visual_embedding (id INTEGER PRIMARY KEY, vector BLOB NOT NULL)");
  db.prepare("INSERT INTO visual_embedding VALUES (?, ?)").run(1, Buffer.from(Float32Array.from([1, 0]).buffer));
  ensureArtworkDnaTable(db);
  upsertArtworkDna(db, { id: 1, palette: [], luminanceMean: 102, darkPct: 22, lightPct: 0, semanticScores: [], dnaVersion: 1 });
  db.close();
  const response = await fetch(`http://127.0.0.1:${port}/api/artwork-dna/1`);
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys((await response.json())), ["artwork", "visual", "modelReading", "related", "provenance"]);
});

test("GET /api/artwork-dna reports a work that has not been indexed", async () => {
  assert.equal((await fetch(`http://127.0.0.1:${port}/api/artwork-dna/999`)).status, 404);
});
```

- [ ] **Step 2: Run server tests to verify they fail**

Run: `node --test test/server.test.mjs`

Expected: FAIL because the endpoint does not exist.

- [ ] **Step 3: Implement payload construction and route**

Build neighbour scores from existing image vectors, exclude the selected work, and calculate `sharedSignals` from labels present in both works’ top prompt scores. Keep similarity raw in the API and attach `museumMetadata: "National Gallery of Art"`, model ID, and DNA version in `provenance`.

- [ ] **Step 4: Run API regression tests**

Run: `node --test test/server.test.mjs && npm test`

Expected: all endpoint and existing search tests pass.

- [ ] **Step 5: Commit the API**

```bash
git add lib/vector/search.mjs lib/dna/payload.mjs server.mjs test/server.test.mjs
git commit -m "feat: serve artwork DNA cards"
```

### Task 4: Remove coordinate-system semantics while retaining exploration controls

**Files:**
- Modify: `index.html`
- Create: `test/canvas-copy.test.mjs`

**Interfaces:**
- `ExploratoryCanvas` continues to use `spreadX`, `spreadY`, `visibleSet`, pan, zoom, and hover repulsion.
- Remove `QUERY_PRESETS`, `QuadrantMap`, `PositionMap`, `presetById`, axis/quadrant labels, axis line elements, and any UI copy that treats a canvas location as retrieval or popularity evidence.

- [ ] **Step 1: Write a failing source-level semantic regression test**

```js
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

test("the explorer contains no coordinate-system vocabulary", async () => {
  const page = await fs.readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.doesNotMatch(page, /By Name|By Vibe|Mainstream|Niche|QUERY_PRESETS|QUADRANT_PRESETS/);
});
```

- [ ] **Step 2: Confirm old coordinate terms currently exist**

Run: `node --test test/canvas-copy.test.mjs`

Expected: FAIL because the coordinate-system implementation and copy remain.

- [ ] **Step 3: Simplify canvas layout logic**

Use the current collision-aware scatter positions for both static and live results. Keep temperature as result breadth, not an interpretive coordinate. Delete coordinate-only `quadX`, `quadY`, `focusedX`, and `focusedY` fields from static artwork records; remove obsolete CSS for axes and mini-maps, including mobile overrides.

- [ ] **Step 4: Verify the semantic removal and interactions**

Run: `node --test test/canvas-copy.test.mjs && npm test`

Expected: no obsolete coordinate terms; automated tests pass.

- [ ] **Step 5: Commit the canvas refactor**

```bash
git add index.html test/canvas-copy.test.mjs
git commit -m "refactor: make artwork canvas DNA-first"
```

### Task 5: Replace the detail card with an evidence-labelled DNA card

**Files:**
- Modify: `index.html`

**Interfaces:**
- `ArtworkDNA({ artwork, dna, loading, onClose, onSelectRelated })` replaces `DetailPanel`.
- `ExploratoryCanvas` fetches `/api/artwork-dna/${selectedId}` on selection, cancels stale requests, and passes `null` for non-indexed works.
- A non-indexed work displays NGA metadata and “Visual reading is not indexed yet”; it must not invent palette, scores, or relations.

- [ ] **Step 1: Define the selected-work loading states**

Add `dnaStatus` (`idle`, `loading`, `ready`, `unavailable`, `error`) and `selectedDna` state. Reset both on close and when selection changes. Use an `AbortController` to prevent a late response from replacing a newly selected work.

- [ ] **Step 2: Replace coordinate-derived card content**

Remove the “Why you’re seeing this” coordinate badge, static `analysis` copy, coordinate mini-map, and Euclidean `quadX/quadY` similarity cards. Render, in this order:

1. Artwork title, artist, date, medium, thumbnail, and NGA link.
2. **Visual character — model reading**: top three bars, score formatted to three decimals, and a disclosure containing exact prompts plus the comparative limitation.
3. **Colour DNA — measured from image**: labelled swatches plus luminance, dark, and light readings.
4. **Subject and history — NGA collection metadata**: classification and parsed collection terms.
5. **Vector neighbours**: image, title, raw similarity, and shared-signal label; clicking selects that related work.

- [ ] **Step 3: Preserve desktop and mobile sheet behavior**

Keep existing centered desktop card and mobile bottom-sheet geometry. Add focus-visible styles to swatches, links, close button, and related cards. Ensure the scrollable body contains all DNA sections without color-only meaning.

- [ ] **Step 4: Inspect rendered states in a browser**

Run: `HOST=0.0.0.0 npm start`

Check desktop and mobile widths for: DNA-enabled work, non-indexed work, API-loading state, unavailable state, close via Escape, and related-artwork selection. Capture one screenshot per viewport in the review record.

- [ ] **Step 5: Commit the DNA card**

```bash
git add index.html
git commit -m "feat: show evidence-backed artwork DNA cards"
```

### Task 6: Rewrite “What am I looking at?” as the DNA guide

**Files:**
- Modify: `index.html`
- Delete: `quadrant-diagram.png`

**Interfaces:**
- The existing `showInfo` state and accessible modal remain.
- The modal describes the canvas as a search-result field, not a coordinate map.

- [ ] **Step 1: Replace axis-only content with evidence categories**

Use three small information cards headed exactly: `NGA collection metadata`, `Measured visual signals`, and `Model reading`. State their sources and limitations in concise factual language. Remove all quadrants, legend colours, matrix image, and mobile coordinate cards.

- [ ] **Step 2: Verify both modal layouts**

At desktop and mobile widths, open and close the modal with pointer and Escape. Confirm the new content is readable, scrollable, and that no removed coordinate vocabulary appears.

- [ ] **Step 3: Commit the guide**

```bash
git add index.html quadrant-diagram.png
git commit -m "feat: explain artwork DNA evidence"
```

### Task 7: Run feature verification and design-quality review

**Files:**
- Modify: `docs/superpowers/specs/2026-09-15-artwork-dna-design.md`
- Modify: `docs/superpowers/plans/2026-09-15-dna-first-canvas.md`

**Interfaces:**
- No new product interface; this task records the completed rollout coverage and verification evidence.

- [ ] **Step 1: Run all automated tests and the three-work index**

Run: `npm test && npm run index:dna`

Expected: all tests pass and the indexer reports IDs `0`, `1`, and `5` as indexed or retained.

- [ ] **Step 2: Run the required design detector once**

Run: `node /Users/xiayuxuan/Documents/GitHub/smile-ai-app/.agents/skills/impeccable/scripts/detect.mjs --json index.html`

Expected: review all findings; fix only issues introduced by this feature or those that block the DNA card’s usability.

- [ ] **Step 3: Perform the bounded browser review**

Review one desktop and one mobile pass, then make one batched correction pass if needed. Verify no result is hidden by the card, the DNA evidence hierarchy is readable, and all non-DNA results retain a useful detail state.

- [ ] **Step 4: Update the plan’s checkbox evidence and commit verification notes**

Record command outputs, browser scenarios, and detector findings under a new `## Verification Record` section in this plan. Do not claim full collection coverage; record the three-work scope.

- [ ] **Step 5: Commit final verification**

```bash
git add docs/superpowers/specs/2026-09-15-artwork-dna-design.md docs/superpowers/plans/2026-09-15-dna-first-canvas.md index.html
git commit -m "test: verify DNA-first explorer"
```
