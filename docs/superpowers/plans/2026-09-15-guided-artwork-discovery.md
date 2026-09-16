# Guided Artwork Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let visitors begin with a feeling, answer optional adaptive questions, and graduate into explainable research filters.

**Architecture:** Store a trail of explicit tokens in React. A deterministic question engine maps tokens to NGA text filters, metadata filters, or labelled visual-preference reranking. The server returns metadata-filtered results plus inclusion reasons; vector anchors operate only where embeddings exist.

**Tech Stack:** React UMD, Node HTTP server, SQLite FTS, existing CLIP vector index.

**Spec:** `docs/superpowers/specs/2026-09-15-guided-artwork-discovery-design.md`

## Tasks

### Task 1: Trail and question engine

**Files:** Create `lib/discovery/questions.mjs`, `test/discovery.test.mjs`; modify `index.html`.

- [ ] Write tests asserting `nextQuestion(trail, resultFacets)` returns the feeling refinement first, nature subject second, and `null` after three answers.
- [ ] Implement typed token objects `{ kind, label, value, source }`, six initial feelings, deterministic question selection, and token-to-query mapping.
- [ ] Add a canvas-side question card, removable trail tokens, Skip, and a visible progress count; replace the temperature footer.
- [ ] Run `node --test test/discovery.test.mjs && npm test`.
- [ ] Commit: `feat: add guided discovery trail`.

### Task 2: Metadata research filters and result reasons

**Files:** Modify `lib/nga/search.mjs`, `server.mjs`, `test/search.test.mjs`, `test/server.test.mjs`, `index.html`.

- [ ] Write failing tests for date, medium, classification, artist, and collection-term filters, plus reason strings that identify metadata matches.
- [ ] Extend search input parsing with parameterized SQLite conditions; reject invalid date bounds and preserve the current query response shape.
- [ ] Add optional research-filter sheet with only applicable facet values and inclusion reason rows in the result list/detail sheet.
- [ ] Run `npm test` and manually verify that an empty research filter changes no existing search results.
- [ ] Commit: `feat: add research discovery filters`.

### Task 3: Visual anchors and preference reranking

**Files:** Modify `lib/vector/search.mjs`, `server.mjs`, `test/server.test.mjs`, `index.html`.

- [ ] Write failing tests for averaging included anchor vectors, excluding “less like this” vectors, and retaining non-vector metadata matches.
- [ ] Add a `/api/discovery` endpoint that combines metadata candidates with available vector scores and returns evidence labels.
- [ ] Add More like this / Less like this actions to result details; visibly label visual ranking as available only for indexed works.
- [ ] Run `npm test`; verify an unembedded result stays visible under research filters.
- [ ] Commit: `feat: rank discovery results from visual anchors`.

### Task 4: Guide, responsive review, and verification

**Files:** Modify `index.html`, `docs/superpowers/plans/2026-09-15-guided-artwork-discovery.md`.

- [ ] Rewrite `What am I looking at?` to explain the feeling-to-research journey and evidence labels.
- [ ] Verify desktop and mobile: feeling chip, skipped question, three-answer stop, visual anchor, research sheet, and selected artwork DNA.
- [ ] Run `npm test` and the Impeccable detector once; record only feature-relevant findings in this plan.
- [ ] Commit: `test: verify guided artwork discovery`.
