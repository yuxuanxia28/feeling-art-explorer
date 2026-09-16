import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

export class SearchInputError extends Error {}

function integer(value, fallback, maximum) {
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

function ftsQuery(query) {
  return query.trim().split(/\s+/).map((word) => `"${word.replaceAll('"', '""')}"`).join(" AND ");
}

export function searchArtworks(databasePath, { q, page = "1", limit = "20" }) {
  const query = String(q ?? "").trim();
  if (!query) throw new SearchInputError("A search query is required");
  if (!existsSync(databasePath)) throw new SearchInputError("The NGA search index has not been built");

  const safePage = integer(page, 1, Number.MAX_SAFE_INTEGER);
  const safeLimit = integer(limit, 20, 30);
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const match = ftsQuery(query);
    const total = database.prepare("SELECT count(*) AS total FROM artwork_search WHERE artwork_search MATCH ?").get(match).total;
    const results = database.prepare(`
      SELECT artwork.id, artwork.title, artwork.artist, artwork.date, artwork.medium, artwork.classification,
             artwork.thumbnail_url AS thumbnailUrl, artwork.object_url AS objectUrl
      FROM artwork_search JOIN artwork ON artwork.id = artwork_search.rowid
      WHERE artwork_search MATCH ?
      ORDER BY CASE WHEN lower(artwork.title) LIKE lower(?) THEN 0 ELSE 1 END, bm25(artwork_search)
      LIMIT ? OFFSET ?
    `).all(match, `%${query}%`, safeLimit, (safePage - 1) * safeLimit);
    return { query, page: safePage, limit: safeLimit, total, results };
  } finally {
    database.close();
  }
}
