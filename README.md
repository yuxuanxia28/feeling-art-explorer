# Feeling Art Explorer

### Follow a feeling.

A spatial artwork explorer built around the National Gallery of Art collection. Start with a feeling, follow related words, and gradually narrow your exploration with research-oriented filters.

This independent repository contains the interactive explorer prototype. It is a **runnable source project, not a hosted demo**. It requires the included Node server to run the catalogue search.

## The experience

- A typewriter entrance opens into a scrolling Three.js gallery.
- Floating glass keyword pills lead into related selections of real catalogue records.
- Framed artworks occupy different depths, with gold and silver Baroque-inspired treatments.
- Open a work to see its catalogue details and how you arrived there.
- Refine by title or subject, artist, type of work and date range.
- Retrace your choices through the exploration trail.
- Still view and reduced-motion support provide alternatives to spatial motion.

## Run locally

Use Node.js 22.13 or newer with built-in `node:sqlite` support. The project was tested locally with Node.js 25.9.

```bash
git clone https://github.com/yuxuanxia28/feeling-art-explorer.git
cd feeling-art-explorer
npm ci
npm run import:nga
npm start
```

Open **http://localhost:4173/**. The import downloads NGA CSV files and builds a local SQLite index; allow time for this first step. Internet access is also needed for artwork images and Adobe Fonts. The generated database and dependencies are not committed.

## Search and interpretation

The default exploration uses catalogue text and metadata filtering. Feeling routes are editorial interpretations of catalogue themes, **not measured emotions or full-collection vector search**. Spatial placement is composed for browsing and does not represent similarity scores.

Optional visual-similarity and artwork-DNA experiments require separate indexing. They are not necessary for the core explorer and are only available for works actually indexed:

```bash
npm run index:visuals
npm run index:dna
```

These commands may download model assets and take additional time and storage.

## Project structure

| Files | Purpose |
| --- | --- |
| `spatial.html`, `spatial.css`, `spatial.js` | Current explorer interface |
| `spatial-scene.js` | Three.js scene and projected controls |
| `lib/discovery/` | Search routes, entrance timing and frame geometry |
| `server.mjs` | Local HTTP server and search endpoints |
| `scripts/import-nga.mjs` | Catalogue importer |
| `discover.html` | Earlier guided-discovery interface |
| `index.html` | Original prototype, retained for reference |

## Verification

```bash
npm test
```

## Data, typography and frame references

Catalogue data comes from [NGA Open Data](https://github.com/NationalGalleryOfArt/opendata). Search includes works with a primary image marked open access and links back to NGA catalogue records. This is an independent prototype, not an official NGA product.

New Spirit Condensed is served through the configured Adobe Fonts kit, not bundled here. Frame reference images were supplied for this prototype; see [frame asset notes](assets/frames/README.md) for provenance and implementation limits. Their inclusion is not a grant of reuse rights. Confirm appropriate permissions before reusing the assets or publishing your own deployment.

The standalone Exposure typography experiment and its trial font payloads are deliberately excluded from this explorer release.

## Hosting

The current explorer requires a Node-compatible host and a generated NGA SQLite index. GitHub Pages alone cannot run its API routes. `HOST` and `PORT` configure the server binding; do not expose the development server publicly without reviewing its static-file access, deployment configuration and asset permissions.
