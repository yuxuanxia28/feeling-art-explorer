import { DatabaseSync } from 'node:sqlite';

export const FEELING_TERMS = {
  calm: ['landscape', 'water', 'garden'], dreamlike: ['dream', 'moon', 'night'],
  intense: ['storm', 'battle', 'fire'], warm: ['sun', 'summer', 'flowers'],
  melancholic: ['winter', 'solitude', 'ruins'], curious: ['animals', 'architecture', 'study'],
};
const quote = word => `"${word.replaceAll('"', '""')}"`;
export function discover(indexPath, params = {}) {
  const db = new DatabaseSync(indexPath, { readOnly: true });
  try {
    const feeling = FEELING_TERMS[params.feeling] ? params.feeling : 'calm';
    const words = String(params.q || params.subject || '').trim().split(/\s+/).filter(Boolean);
    const terms = words.length ? words : FEELING_TERMS[feeling];
    const match = terms.map(quote).join(words.length ? ' AND ' : ' OR ');
    const catalogueOnly=params.scope==='catalogue'&&!words.length;
    const where = [catalogueOnly?'1=1':'artwork_search MATCH ?'];
    const args = catalogueOnly?[]:[match];
    for (const [key, column] of [['medium','classification'],['artist','artist']]) {
      if (params[key]) { where.push(`a.${column} LIKE ? ESCAPE '\\'`); args.push(key === 'medium' ? params[key] : `%${params[key].replace(/[\\%_]/g, '\\$&')}%`); }
    }
    const from = params.from ? Number(params.from) : null, to = params.to ? Number(params.to) : null;
    if ((from !== null && !Number.isInteger(from)) || (to !== null && !Number.isInteger(to)) || (from !== null && to !== null && from > to)) throw new Error('Enter a valid year range.');
    let rows = db.prepare(`SELECT a.id,a.title,a.artist,a.date,a.medium,a.classification,a.terms,a.thumbnail_url AS thumbnailUrl,a.object_url AS objectUrl FROM ${catalogueOnly?'artwork a':'artwork_search JOIN artwork a ON a.id=artwork_search.rowid'} WHERE ${where.join(' AND ')} ORDER BY ${catalogueOnly?'':'bm25(artwork_search),'}a.id`).all(...args);
    if (from !== null || to !== null) rows = rows.filter(row => { const years = row.date.match(/\b\d{4}\b/g)?.map(Number); return years && (from === null || Math.min(...years) >= from) && (to === null || Math.max(...years) <= to); });
    const facets = [...new Set(rows.map(row => row.classification))].filter(Boolean).sort();
    const vectorRows = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='visual_embedding'").get() ? db.prepare('SELECT id,vector FROM visual_embedding').all() : [];
    const vectors = new Map(vectorRows.map(row => [row.id, new Float32Array(row.vector.buffer,row.vector.byteOffset,row.vector.byteLength/4)]));
    const anchor = params.anchor !== undefined && params.anchor !== '' ? vectors.get(Number(params.anchor)) : null;
    if (params.anchor !== undefined && params.anchor !== '' && !anchor) throw new Error('Visual comparison is not indexed for this artwork yet.');
    if (anchor) rows = rows.filter(row => row.id !== Number(params.anchor)).map(row => ({...row,similarity:vectors.has(row.id) ? vectors.get(row.id).reduce((sum,v,i)=>sum+v*anchor[i],0) : null})).sort((a,b)=>(b.similarity ?? -1)-(a.similarity ?? -1));
    const excluded = new Set(String(params.exclude || '').split(',').filter(Boolean).map(Number));
    rows = rows.filter(row => !excluded.has(row.id));
    const total = rows.length, offset = Math.max(0,Number(params.offset)||0);
    return {total,facets,feeling,terms,vectorCount:vectors.size,results:rows.slice(offset,offset+24).map(row=>({...row,hasVector:vectors.has(row.id),reasons:[catalogueOnly?'Catalogue filters':words.length ? `Catalogue match: ${words.join(' ')}` : `Suggested ${feeling} route: ${terms.join(', ')}`, ...(params.medium ? [`Classification: ${row.classification}`] : []), ...(from !== null || to !== null ? [`Catalogue date: ${row.date}`] : []), ...(row.similarity !== null && row.similarity !== undefined ? [`Visual similarity: ${row.similarity.toFixed(3)}`] : [])]}))};
  } finally { db.close(); }
}
