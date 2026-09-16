import test from 'node:test';
import assert from 'node:assert/strict';
import * as layout from '../lib/discovery/spatial-state.mjs';
test('overlapping pill moves outside art and stays on screen',()=>{
  assert.equal(typeof layout.clearArtwork,'function');
  const p=layout.clearArtwork({x:200,y:200,w:120,h:50},{x:190,y:150,w:200,h:200},800,600);
  assert.ok(p.x+120<=178||p.x>=402||p.y+50<=138||p.y>=362);
  assert.ok(p.x>=12&&p.x+120<=788&&p.y>=90&&p.y+50<=510);
});
test('unobstructed pill does not move',()=>{
  assert.equal(typeof layout.clearArtwork,'function');
  assert.deepEqual(layout.clearArtwork({x:20,y:100,w:100,h:50},{x:400,y:200,w:100,h:100},800,600),{x:20,y:100});
});
