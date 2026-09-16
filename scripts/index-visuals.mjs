import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { AutoProcessor, CLIPVisionModelWithProjection, RawImage } from "@huggingface/transformers";

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const db=new DatabaseSync(path.join(root,"data/nga-artworks.sqlite"));
db.exec("CREATE TABLE IF NOT EXISTS visual_embedding (id INTEGER PRIMARY KEY, vector BLOB NOT NULL)");
if(process.env.VECTOR_RESET==="1")db.exec("DELETE FROM visual_embedding");
const limit=Number(process.env.VECTOR_BATCH||100);
const rows=db.prepare("SELECT id, thumbnail_url FROM artwork WHERE id NOT IN (SELECT id FROM visual_embedding) LIMIT ?").all(limit);
const id="Xenova/clip-vit-base-patch32";
const processor=await AutoProcessor.from_pretrained(id);
const model=await CLIPVisionModelWithProjection.from_pretrained(id);
const insert=db.prepare("INSERT OR REPLACE INTO visual_embedding VALUES (?,?)");
let indexed=0,failed=0;
for(const row of rows){try{const image=await RawImage.read(row.thumbnail_url);const {image_embeds}=await model(await processor(image));const magnitude=Math.hypot(...image_embeds.data);const vector=Float32Array.from(image_embeds.data,value=>value/magnitude);insert.run(row.id,Buffer.from(vector.buffer));indexed+=1;}catch{failed+=1;}}
console.log(JSON.stringify({indexed,failed,remaining:db.prepare("SELECT count(*) AS count FROM artwork WHERE id NOT IN (SELECT id FROM visual_embedding)").get().count}));
db.close();
