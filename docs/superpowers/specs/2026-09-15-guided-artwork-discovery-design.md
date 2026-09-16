# Guided Artwork Discovery

## Goal

Replace the DNA-first discovery flow with an adaptive, optional-question journey that begins with a feeling and gradually exposes visual and research-grade constraints. Artwork DNA remains a detail-level explanation only.

## Primary flow

1. The landing screen offers six feeling chips: `calm`, `dreamlike`, `intense`, `warm`, `melancholic`, and `curious`, plus free text.
2. Selecting a feeling starts a trail with a removable token and returns an initial mixed result set.
3. The canvas presents a compact question card and live artwork preview. Every question has a Skip action.
4. Answers add tokens and update result ranking or filters immediately.
5. Users may select an artwork as **More like this** or exclude it as **Less like this**; selected visual anchors alter vector ranking only for indexed works.
6. The user may open **Research filters** at any point for date range, medium, classification, artist, NGA collection term, and open-access status.
7. At 20–50 results, a research list shows each work’s inclusion reasons and links to NGA.

## Adaptive question model

The question engine is deterministic and transparent. It uses the current trail and available metadata, not inferred user identity.

| Trail context | Question | Answers | Effect |
| --- | --- | --- | --- |
| Feeling selected | What kind of feeling? | solitude, domestic, nature, spiritual, minimal | Adds term/prompt preference. |
| Nature-related response | What leads the image? | water/sky, plants, landscape, animals, people in nature | Adds NGA term preference. |
| Any result set | Colour atmosphere | muted, earthy, bright, blue-toned, golden | Reranks vector-indexed works; stored as a transparent preference. |
| Any result set | Period or material | before 1800, 19th century, modern, painting, print, photograph | Applies deterministic metadata filters. |

No question is mandatory. The engine stops after three answers or when the user opens Research filters.

## Result evidence

Each result provides short inclusion reasons: `matches your visual anchor`, `fits “muted” preference`, `NGA term: landscape`, or `created 1880–1920`. Model inference is labelled; NGA metadata is labelled separately.

## Progressive data availability

All indexed NGA records support research filters. Visual-anchor reranking and visual colour preferences apply only to works with embeddings. A result without an embedding remains visible and can still be filtered, saved, compared, and opened.

## UI boundaries

- Preserve the free-form canvas, pan, zoom, and result scatter.
- Replace the bottom temperature slider with the visible search trail and progress indicator.
- The question card is compact and dismissible; it never blocks results.
- Research filters are an optional right-side sheet, not an upfront form.
- DNA stays inside the selected-work detail sheet.

## Verification

- Unit test question selection and token-to-filter conversion.
- API test structured filtering and inclusion-reason output.
- Browser check for chip start, skipped question, visual anchor, research-filter entry, and all result evidence states.
