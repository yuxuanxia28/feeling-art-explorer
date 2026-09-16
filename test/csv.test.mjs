import assert from "node:assert/strict";
import test from "node:test";

import { parseCsv } from "../lib/nga/csv.mjs";
import { parseCsvStream } from "../lib/nga/csv.mjs";

test("parses quoted commas and escaped quotes", () => {
  assert.deepEqual(parseCsv('id,title\n1,"Flower, ""Blue"""\n'), [
    { id: "1", title: 'Flower, "Blue"' },
  ]);
});

test("keeps newlines inside quoted cells", () => {
  assert.deepEqual(parseCsv('id,description\n1,"First line\nSecond line"\n'), [
    { id: "1", description: "First line\nSecond line" },
  ]);
});

test("parses chunked CSV without retaining the source text", async () => {
  const rows = [];
  for await (const row of parseCsvStream(["id,title\n1,Flow", "er\n2,Study\n"])) rows.push(row);
  assert.deepEqual(rows, [{ id: "1", title: "Flower" }, { id: "2", title: "Study" }]);
});
