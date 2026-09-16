import test from 'node:test';
import assert from 'node:assert/strict';
import * as state from '../lib/discovery/spatial-state.mjs';

test('artwork stays in place even during sustained hover',()=>{
  assert.equal(typeof state.artworkFocus,'function');
  assert.equal(state.artworkFocus(0,true,1299,.016),0);
  const moving=state.artworkFocus(0,true,1300,.016);
  assert.equal(moving,0);
  assert.equal(state.artworkFocus(0,false,500,.016),0);
});

test('extended hover never adds positional displacement',()=>{
  let focus=0;
  for(let i=0;i<10;i++)focus=state.artworkFocus(focus,true,2000,.05);
  assert.equal(focus,0);
  for(let i=0;i<200;i++)focus=state.artworkFocus(focus,true,2000,.05);
  assert.equal(focus,0);
});

test('moving artwork retains hover at its original position or its new position',()=>{
  assert.equal(typeof state.insidePreview,'function');
  const origin={x:10,y:10,w:100,h:100},current={x:300,y:200,w:100,h:100};
  assert.equal(state.insidePreview({x:50,y:50},[origin,current]),true);
  assert.equal(state.insidePreview({x:340,y:240},[origin,current]),true);
  assert.equal(state.insidePreview({x:600,y:500},[origin,current]),false);
});
