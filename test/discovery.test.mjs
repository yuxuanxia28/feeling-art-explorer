import assert from "node:assert/strict";
import test from "node:test";
import { nextQuestion } from "../lib/discovery/questions.mjs";
test("questions progress from feeling to subject and stop after three answers",()=>{assert.equal(nextQuestion([{kind:"feeling",value:"calm"}]).id,"feeling-kind");assert.equal(nextQuestion([{kind:"feeling",value:"calm"},{kind:"feeling-kind",value:"nature"}]).id,"nature-subject");assert.equal(nextQuestion([{kind:"feeling",value:"calm"},{kind:"feeling-kind",value:"nature"},{kind:"nature-subject",value:"water"}]),null);});
