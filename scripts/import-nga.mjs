import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsvStream } from "../lib/nga/csv.mjs";
import { buildNgaIndexFromStreams } from "../lib/nga/index.mjs";
const rootDirectory=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const baseUrl="https://raw.githubusercontent.com/NationalGalleryOfArt/opendata/main/data";
const sources={objects:"objects.csv",constituents:"constituents.csv",objectsConstituents:"objects_constituents.csv",objectsTerms:"objects_terms.csv",publishedImages:"published_images.csv"};
async function* streamCsv(file){const response=await fetch(`${baseUrl}/${file}`);if(!response.ok)throw new Error(`Unable to download ${file}: ${response.status}`);yield* parseCsvStream(response.body.pipeThrough(new TextDecoderStream()));}
const streams=Object.fromEntries(Object.entries(sources).map(([name,file])=>[name,streamCsv(file)]));
const result=await buildNgaIndexFromStreams({streams,outputPath:path.join(rootDirectory,"data/nga-artworks.sqlite")});
console.log(`Indexed ${result.indexedCount} NGA artworks.`);
