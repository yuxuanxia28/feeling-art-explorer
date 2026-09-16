import { AutoTokenizer, CLIPTextModelWithProjection } from "@huggingface/transformers";
const id="Xenova/clip-vit-base-patch32";
let runtime;
const normalize=(values)=>{const magnitude=Math.hypot(...values);return Array.from(values,value=>value/magnitude);};
export async function embedText(text){runtime ??= Promise.all([AutoTokenizer.from_pretrained(id),CLIPTextModelWithProjection.from_pretrained(id)]);const [tokenizer,model]=await runtime;const {text_embeds}=await model(tokenizer([text],{padding:true,truncation:true}));return normalize(text_embeds.data);}
