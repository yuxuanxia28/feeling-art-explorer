import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SearchInputError, searchArtworks } from "./lib/nga/search.mjs";
import { embedText } from "./lib/vector/clip.mjs";
import { searchVisuals } from "./lib/vector/search.mjs";
import { getArtworkDnaPayload } from "./lib/dna/payload.mjs";
import { discover } from "./lib/discovery/search.mjs";
import { spatialPayload } from "./lib/discovery/spatial.mjs";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8" };
function sendJson(res, status, body) { res.writeHead(status, { "content-type": "application/json; charset=utf-8" }); res.end(JSON.stringify(body)); }
export function createServer({ indexPath = path.join(__dirname, "data/nga-artworks.sqlite"), rootDirectory = __dirname } = {}) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    if (url.pathname === '/api/spatial') {
      try { return sendJson(res,200,spatialPayload(indexPath,Object.fromEntries(url.searchParams))); }
      catch(error) { return sendJson(res,400,{error:error.message}); }
    }
    if (url.pathname === '/api/discovery') {
      try { return sendJson(res,200,discover(indexPath,Object.fromEntries(url.searchParams))); }
      catch(error) { return sendJson(res,400,{error:error.message}); }
    }
    if (url.pathname === "/api/search") {
      try { return sendJson(res, 200, searchArtworks(indexPath, Object.fromEntries(url.searchParams))); }
      catch (error) { const status = error instanceof SearchInputError && /required/.test(error.message) ? 400 : 503; return sendJson(res, status, { error: error.message, hint: status === 503 ? "Run npm run import:nga to build the NGA search index." : undefined }); }
    }
    if (url.pathname === "/api/semantic-search") {
      const query=url.searchParams.get("q")?.trim();
      if(!query)return sendJson(res,400,{error:"A search query is required"});
      try{return sendJson(res,200,{query,results:searchVisuals(indexPath,await embedText(query))});}
      catch(error){return sendJson(res,503,{error:error.message});}
    }
    const dnaMatch=url.pathname.match(/^\/api\/artwork-dna\/(\d+)$/);
    if(dnaMatch){try{const payload=getArtworkDnaPayload(indexPath,Number(dnaMatch[1]));return payload?sendJson(res,200,payload):sendJson(res,404,{error:"Artwork DNA is not indexed yet"});}catch(error){return sendJson(res,503,{error:error.message});}}
    const filePath = path.join(rootDirectory, url.pathname === "/" ? "/spatial.html" : url.pathname);
    if (!filePath.startsWith(rootDirectory)) { res.writeHead(403); return res.end("Forbidden"); }
    try { const content=await fs.readFile(filePath); res.writeHead(200, { "content-type": mime[path.extname(filePath)] ?? "application/octet-stream" }); res.end(content); }
    catch { res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }); res.end("Not found"); }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4173);
  createServer().listen(port, process.env.HOST || "127.0.0.1", () => console.log(`NGA prototype running at http://127.0.0.1:${port}`));
}
