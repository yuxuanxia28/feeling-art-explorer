import { mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { normalizeText } from "./csv.mjs";

function value(record, ...names) {
  for (const name of names) {
    if (record[name] !== undefined) return record[name];
  }
  return "";
}

function append(map, key, item) {
  if (!key) return;
  map.set(key, [...(map.get(key) ?? []), item]);
}

function createGroupedRows(rows, keyNames) {
  const grouped = new Map();
  for (const row of rows) append(grouped, value(row, ...keyNames), row);
  return grouped;
}

export async function buildNgaIndex({ tables, outputPath }) {
  const outputDirectory = path.dirname(outputPath);
  const temporaryPath = `${outputPath}.tmp`;
  await mkdir(outputDirectory, { recursive: true });
  await rm(temporaryPath, { force: true });

  const constituentById = new Map((tables.constituents ?? []).map((row) => [
    value(row, "constituentID", "constituentid"),
    normalizeText(value(row, "displayName", "displayname", "preferredName", "preferredname")),
  ]));
  const termById = new Map((tables.terms ?? []).map((row) => [
    value(row, "termID", "termid"),
    normalizeText(value(row, "term", "name")),
  ]));
  const creatorsByObject = createGroupedRows(tables.objectsConstituents ?? [], ["objectID", "objectid"]);
  const termsByObject = createGroupedRows(tables.objectsTerms ?? [], ["objectID", "objectid"]);
  const imagesByObject = createGroupedRows(tables.publishedImages ?? [], ["depictsTmsObjectID", "depictstmsobjectid"]);

  const database = new DatabaseSync(temporaryPath);
  try {
    database.exec(`
      CREATE TABLE artwork (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        date TEXT NOT NULL,
        medium TEXT NOT NULL,
        classification TEXT NOT NULL,
        terms TEXT NOT NULL,
        thumbnail_url TEXT NOT NULL,
        object_url TEXT NOT NULL
      );
      CREATE VIRTUAL TABLE artwork_search USING fts5(
        title, artist, medium, classification, terms,
        content='artwork', content_rowid='id'
      );
    `);
    const insertArtwork = database.prepare(`
      INSERT INTO artwork (id, title, artist, date, medium, classification, terms, thumbnail_url, object_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertSearch = database.prepare(`
      INSERT INTO artwork_search (rowid, title, artist, medium, classification, terms)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    database.exec("BEGIN");
    let indexedCount = 0;
    for (const object of tables.objects ?? []) {
      const id = value(object, "objectID", "objectid");
      const image = (imagesByObject.get(id) ?? []).find((candidate) =>
        value(candidate, "openAccess", "openaccess") === "1"
        && value(candidate, "viewType", "viewtype").toLowerCase() === "primary"
        && value(candidate, "iiifThumbUrl", "iiifthumburl"),
      );
      if (!id || !image) continue;

      const artist = (creatorsByObject.get(id) ?? [])
        .filter((relation) => {
          const role = value(relation, "roleType", "roletype").toLowerCase();
          return !role || role === "artist" || role === "maker";
        })
        .map((relation) => constituentById.get(value(relation, "constituentID", "constituentid")))
        .filter(Boolean)
        .join("; ") || "Unknown artist";
      const terms = (termsByObject.get(id) ?? [])
        .map((relation) => normalizeText(value(relation, "term")) || termById.get(value(relation, "termID", "termid")))
        .filter(Boolean)
        .join("; ");
      const title = normalizeText(value(object, "title")) || "Untitled";
      const date = normalizeText(value(object, "displayDate", "displaydate"));
      const medium = normalizeText(value(object, "medium"));
      const classification = normalizeText(value(object, "classification"));
      const thumbnailUrl = value(image, "iiifThumbUrl", "iiifthumburl");
      const objectUrl = normalizeText(value(object, "objectUrl", "objecturl"))
        || `https://www.nga.gov/collection/art-object-page.${id}.html`;

      insertArtwork.run(id, title, artist, date, medium, classification, terms, thumbnailUrl, objectUrl);
      insertSearch.run(id, title, artist, medium, classification, terms);
      indexedCount += 1;
    }
    database.exec("COMMIT");
    if (indexedCount === 0) throw new Error("NGA import produced no searchable artworks");
    database.close();
    await rename(temporaryPath, outputPath);
    return { indexedCount };
  } catch (error) {
    database.close();
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

export async function buildNgaIndexFromStreams({ streams, outputPath }) {
  const temporaryPath = `${outputPath}.tmp`;
  await mkdir(path.dirname(outputPath), { recursive: true });
  await rm(temporaryPath, { force: true });
  const db = new DatabaseSync(temporaryPath);
  try {
    db.exec(`CREATE TABLE objects (id TEXT,title TEXT,date TEXT,medium TEXT,classification TEXT,url TEXT);
      CREATE TABLE images (object_id TEXT,open_access TEXT,view_type TEXT,thumbnail TEXT);
      CREATE TABLE constituents (id TEXT,name TEXT); CREATE TABLE relations (object_id TEXT,constituent_id TEXT,role TEXT);
      CREATE TABLE terms (object_id TEXT,term TEXT);`);
    const inserts = {
      objects: db.prepare("INSERT INTO objects VALUES (?,?,?,?,?,?)"), images: db.prepare("INSERT INTO images VALUES (?,?,?,?)"),
      constituents: db.prepare("INSERT INTO constituents VALUES (?,?)"), objectsConstituents: db.prepare("INSERT INTO relations VALUES (?,?,?)"), objectsTerms: db.prepare("INSERT INTO terms VALUES (?,?)"),
    };
    const values = {
      objects: (r) => [value(r,"objectID","objectid"),normalizeText(value(r,"title")),normalizeText(value(r,"displayDate","displaydate")),normalizeText(value(r,"medium")),normalizeText(value(r,"classification")),normalizeText(value(r,"objectUrl","objecturl"))],
      images: (r) => [value(r,"depictsTmsObjectID","depictstmsobjectid"),value(r,"openAccess","openaccess"),value(r,"viewType","viewtype"),value(r,"iiifThumbUrl","iiifthumburl")],
      constituents: (r) => [value(r,"constituentID","constituentid"),normalizeText(value(r,"displayName","displayname"))],
      objectsConstituents: (r) => [value(r,"objectID","objectid"),value(r,"constituentID","constituentid"),value(r,"roleType","roletype")],
      objectsTerms: (r) => [value(r,"objectID","objectid"),normalizeText(value(r,"term"))],
    };
    for (const name of Object.keys(inserts)) { const streamName=name === "images" ? "publishedImages" : name; db.exec("BEGIN"); for await (const row of streams[streamName] ?? []) inserts[name].run(...values[name](row)); db.exec("COMMIT"); }
    db.exec(`CREATE INDEX image_object ON images(object_id); CREATE INDEX relation_object ON relations(object_id); CREATE INDEX term_object ON terms(object_id); CREATE INDEX constituent_id ON constituents(id);
      CREATE TABLE artwork (id INTEGER PRIMARY KEY,title TEXT NOT NULL,artist TEXT NOT NULL,date TEXT NOT NULL,medium TEXT NOT NULL,classification TEXT NOT NULL,terms TEXT NOT NULL,thumbnail_url TEXT NOT NULL,object_url TEXT NOT NULL);
      INSERT INTO artwork SELECT CAST(o.id AS INTEGER),COALESCE(NULLIF(o.title,''),'Untitled'),COALESCE(a.artist,'Unknown artist'),o.date,o.medium,o.classification,COALESCE(t.terms,''),i.thumbnail,COALESCE(NULLIF(o.url,''),'https://www.nga.gov/collection/art-object-page.'||o.id||'.html') FROM objects o JOIN (SELECT object_id,MIN(thumbnail) thumbnail FROM images WHERE open_access='1' AND lower(view_type)='primary' AND thumbnail<>'' GROUP BY object_id) i ON i.object_id=o.id LEFT JOIN (SELECT r.object_id,GROUP_CONCAT(c.name,'; ') artist FROM relations r JOIN constituents c ON c.id=r.constituent_id WHERE lower(r.role) IN ('artist','maker') GROUP BY r.object_id) a ON a.object_id=o.id LEFT JOIN (SELECT object_id,GROUP_CONCAT(term,'; ') terms FROM terms WHERE term<>'' GROUP BY object_id) t ON t.object_id=o.id;
      CREATE VIRTUAL TABLE artwork_search USING fts5(title,artist,medium,classification,terms,content='artwork',content_rowid='id'); INSERT INTO artwork_search(rowid,title,artist,medium,classification,terms) SELECT id,title,artist,medium,classification,terms FROM artwork;`);
    const indexedCount = db.prepare("SELECT count(*) AS count FROM artwork").get().count;
    if (!indexedCount) throw new Error("NGA import produced no searchable artworks");
    db.close(); await rename(temporaryPath, outputPath); return { indexedCount };
  } catch (error) { db.close(); await rm(temporaryPath,{force:true}); throw error; }
}
