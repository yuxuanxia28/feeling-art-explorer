import test from 'node:test';
import assert from 'node:assert/strict';
import { typedCount, artworkArrival, openingDuration } from '../lib/discovery/opening.mjs';
test('title types in order and ends fully visible',()=>{
  assert.equal(typedCount(0),0);assert.ok(typedCount(800)>0);
  assert.ok(typedCount(800)<typedCount(1300));assert.equal(typedCount(2400),17);
});
test('artworks arrive sequentially and finish at original positions',()=>{
  assert.equal(artworkArrival(0,0),0);assert.equal(artworkArrival(100,3),0);
  assert.ok(artworkArrival(600,0)>artworkArrival(600,3));
  for(let i=0;i<24;i++)assert.equal(artworkArrival(openingDuration(24),i),1);
});
