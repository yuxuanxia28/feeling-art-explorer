# Artwork DNA Cards

## Purpose

Add an explainable visual-reading panel to the NGA artwork explorer. A card combines image-derived visual signals, CLIP vector comparisons, and NGA collection metadata without presenting model output as art-historical fact.

The first release covers three featured works already present in the visual index:

- *Saint James Major* (c. 1310)
- *Saint Paul and a Group of Worshippers* (1333)
- *The Madonna of Humility* (c. 1430)

## Principles

- Keep evidence types distinct: image measurements, model inferences, and NGA metadata never share an undifferentiated label.
- Treat CLIP cosine similarity as comparative within a fixed prompt set, never as a confidence percentage or a diagnosis of intent.
- Prefer readable bars and concise explanations over a radar chart that implies false precision.
- Preserve the existing spatial search canvas and reveal DNA only after a work is selected.

## Data model

Create an `artwork_dna` SQLite table keyed by `artwork.id`.

| Field | Source | Meaning |
| --- | --- | --- |
| `palette_json` | Artwork thumbnail pixels | Three representative RGB swatches and their image share. |
| `luminance_mean`, `dark_pct`, `light_pct` | Artwork thumbnail pixels | Overall brightness and image tonal distribution. |
| `semantic_scores_json` | CLIP image vector × fixed text vectors | Scores for the versioned prompt vocabulary. |
| `dna_version` | Indexing process | Makes prompt or image-analysis changes traceable. |

The existing `artwork` table remains the source of title, date, medium, classification, collection terms, thumbnail, and NGA object URL. The existing `visual_embedding` table remains the source of related-work ranking.

## Semantic vocabulary

Release one uses fixed, visible prompts:

- `devotional / solemn`
- `communal / ceremonial`
- `intimate / tender`
- `saintly portrait`
- `gold-ground sacred art`
- `quiet / contemplative`

The UI shows the three strongest matches and exposes the prompt wording in a disclosure. Prompts are labeled “model reading,” not “museum description.”

## API

`GET /api/artwork-dna/:id` returns:

```json
{
  "artwork": { "id": 5, "title": "The Madonna of Humility", "date": "c. 1430", "medium": "tempera on panel", "terms": ["Madonna and Child"] },
  "visual": { "palette": [], "luminanceMean": 102, "darkPct": 22, "lightPct": 0 },
  "modelReading": { "label": "Model reading", "scores": [] },
  "related": [{ "id": 0, "similarity": 0.768, "sharedSignals": ["gold-ground sacred art"] }],
  "provenance": { "museumMetadata": "National Gallery of Art", "model": "Xenova/clip-vit-base-patch32", "dnaVersion": 1 }
}
```

Missing DNA returns `404` with a clear message. The existing normal search path is unaffected.

## UI

Selecting a DNA-enabled work opens a right-side `ArtworkDNA` panel. It contains:

1. Thumbnail, title, date, and an “About this reading” disclosure.
2. **Visual character**: the top three model-reading bars with prompt text available on demand.
3. **Colour DNA**: three swatches, brightness, dark-area, and light-area readings.
4. **Subject and history**: date, medium, classification, and NGA terms, explicitly captioned “NGA collection metadata.”
5. **Vector neighbours**: up to three indexed works, each paired with shared prompt labels and its raw cosine score rounded to three decimals.

The panel is scrollable on small screens, traps no focus, uses the existing close action, and does not alter canvas positions or search-result visibility.

## DNA-first canvas

Artwork positions are decorative scatter positions only. Remove the `By Name / By Vibe` and `Mainstream / Niche` axes, quadrant labels, axis lines, quadrant mini-map, query preset positions, and their familiarity or retrieval claims. Preserve pan, zoom, hover spacing, temperature-based result breadth, and the current free-form artwork layout.

`What am I looking at?` becomes an Artwork DNA guide. It explains that the canvas is a search result field rather than a semantic coordinate system, then distinguishes:

- **NGA collection metadata**: title, date, medium, classification, and collection terms.
- **Measured visual signals**: palette and luminance taken from an artwork image.
- **Model reading**: fixed CLIP prompt comparisons and vector neighbours; these are comparative, not facts or confidence percentages.

The guide does not include the quadrant image or vocabulary.

## Indexing workflow

Add a deterministic script that reads selected visual-embedding rows, downloads their public NGA thumbnails, creates palette/luminance values, evaluates the fixed CLIP prompts, and upserts `artwork_dna`.

Release rollout:

1. Index and validate the three featured works.
2. Expand to a stratified 500-work sample across period, medium, classification, and visual style.
3. Only consider full-collection indexing after measuring import duration, image failures, storage size, and relevance quality.

## Error handling and accessibility

- A selected work without DNA continues to show the existing detail panel with a compact “DNA reading is not indexed yet” note.
- An unavailable thumbnail or failed analysis never deletes existing vector data; it is reported by the indexing script and skipped.
- Swatches include text labels and contrast-safe borders; color is never the sole carrier of a result.
- The panel identifies model inferences and provides source links for NGA metadata.

## Verification

- Unit tests: palette/luminance extraction, prompt-score ordering, related-work explanation, and missing-DNA API response.
- API test: verify exact field provenance for one seeded featured work.
- Browser check: select each featured work, ensure the panel presents all five sections, and ensure a non-indexed work still opens normally.
- Regression: `npm test` remains green and `/api/search` keeps its current response shape.
