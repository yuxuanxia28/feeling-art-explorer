export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  const finishCell = () => {
    row.push(cell);
    cell = "";
  };
  const finishRow = () => {
    finishCell();
    rows.push(row);
    row = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      finishCell();
    } else if (character === "\n") {
      finishRow();
    } else if (character !== "\r") {
      cell += character;
    }
  }

  if (cell !== "" || row.length > 0) {
    finishRow();
  }

  const [headers = [], ...dataRows] = rows;
  return dataRows
    .filter((values) => values.some((value) => value !== ""))
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

export function normalizeText(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/_/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function* parseCsvStream(chunks) {
  let headers=null,row=[],cell="",quoted=false;
  const finishRow=()=>{row.push(cell);cell="";const values=row;row=[];return values;};
  for await (const chunk of chunks) for(let i=0;i<chunk.length;i+=1){const c=chunk[i];if(quoted){if(c==='"'&&chunk[i+1]==='"'){cell+='"';i+=1;}else if(c==='"')quoted=false;else cell+=c;}else if(c==='"')quoted=true;else if(c===','){row.push(cell);cell="";}else if(c==='\n'){const values=finishRow();if(!headers)headers=values;else if(values.some(Boolean))yield Object.fromEntries(headers.map((header,index)=>[header,values[index]??""]));}else if(c!=='\r')cell+=c;}
  if(cell||row.length){const values=finishRow();if(!headers)headers=values;else yield Object.fromEntries(headers.map((header,index)=>[header,values[index]??""]));}
}
