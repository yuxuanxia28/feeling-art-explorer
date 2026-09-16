export const DNA_PROMPTS = [
  ["devotional / solemn", "a solemn devotional religious painting"],
  ["communal / ceremonial", "a religious ceremony with a group of worshippers"],
  ["intimate / tender", "a tender mother and child religious painting"],
  ["saintly portrait", "a single saint portrait"],
  ["gold-ground sacred art", "a medieval gold ground religious painting"],
  ["quiet / contemplative", "a quiet contemplative religious painting"],
];
const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const hex = rgb => `#${rgb.map(value => value.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
const label = ([r, g, b]) => { const max=Math.max(r,g,b), min=Math.min(r,g,b); if(max-min<22)return max>190?"ivory / pale gold":max<80?"charcoal / near-black":"warm gray"; if(r>g*1.35&&r>b*1.35)return r>150?"ochre gold":"earth brown"; if(b>r*1.15&&b>g*1.05)return "muted blue"; if(g>r*1.12&&g>b*1.05)return "olive green"; return r>120&&g>80?"warm umber":"dark brown"; };
export function analysePixels({ data, channels }) { const bins=new Map(), values=[]; for(let i=0;i<data.length;i+=channels){const rgb=[data[i],data[i+1],data[i+2]], key=rgb.map(v=>Math.floor(v/32)).join(","), bin=bins.get(key)??{count:0,sum:[0,0,0]};bin.count++;bin.sum=bin.sum.map((sum,index)=>sum+rgb[index]);bins.set(key,bin);values.push(luminance(rgb));} const palette=[...bins.values()].sort((a,b)=>b.count-a.count).slice(0,3).map(bin=>{const rgb=bin.sum.map(sum=>Math.round(sum/bin.count));return {hex:hex(rgb),label:label(rgb),share:Math.round(bin.count/values.length*100)};}); if(palette.length){palette[0].share+=100-palette.reduce((sum,item)=>sum+item.share,0);} const mean=values.reduce((sum,value)=>sum+value,0)/values.length; return {palette,luminanceMean:Math.round(mean),darkPct:Math.round(values.filter(value=>value<75).length/values.length*100),lightPct:Math.round(values.filter(value=>value>185).length/values.length*100)}; }
export function rankPromptScores(imageVector, promptVectors) { const dot=(a,b)=>a.reduce((sum,value,index)=>sum+value*b[index],0); return promptVectors.map(([label,prompt,vector])=>({label,prompt,score:dot(imageVector,vector)})).sort((a,b)=>b.score-a.score); }
