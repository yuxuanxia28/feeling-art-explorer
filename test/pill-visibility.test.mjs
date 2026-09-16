import test from 'node:test';
import assert from 'node:assert/strict';
import * as layout from '../lib/discovery/spatial-state.mjs';
test('hide overlapping pills but never hide the active navigation target',()=>{
  assert.equal(typeof layout.hidePill,'function');
  const pill={x:100,y:100,w:100,h:40},art={x:90,y:90,w:160,h:160};
  assert.equal(layout.hidePill(pill,[art],false,false,null),true);
  assert.equal(layout.hidePill(pill,[art],true,false,null),false);
  assert.equal(layout.hidePill(pill,[],false,true,{x:120,y:120}),true);
  assert.equal(layout.hidePill(pill,[],false,true,{x:300,y:300}),false);
  assert.equal(layout.hidePill(pill,[{x:400,y:400,w:20,h:20}],false,false,null),false);
});

test('pills wait before fading and remain clickable until the fade finishes',()=>{
  const p={x:100,y:100,w:100,h:40}, art={x:0,y:0,w:500,h:500};
  assert.equal(typeof layout.pillVisibility,'function');
  const start=layout.pillVisibility(p,[art],false,null,{},0);
  assert.equal(start.hidden,false);
  const waiting=layout.pillVisibility(p,[art],false,null,start,500);
  assert.equal(waiting.hidden,false);
  const fading=layout.pillVisibility(p,[art],false,null,waiting,700);
  assert.equal(fading.hidden,true);
  assert.equal(fading.inert,false);
  assert.equal(layout.pillVisibility(p,[art],false,null,fading,1200).inert,true);
});

test('approaching a pill restores it and resets its hiding delay',()=>{
  const p={x:100,y:100,w:100,h:40}, art={x:0,y:0,w:500,h:500};
  assert.equal(typeof layout.pillVisibility,'function');
  const restored=layout.pillVisibility(p,[art],false,{x:65,y:120},{since:0},1200);
  assert.equal(restored.hidden,false);
  assert.equal(restored.inert,false);
  assert.equal(restored.since,null);
  assert.equal(layout.pillVisibility(p,[art],false,{x:0,y:0},restored,1300).hidden,false);
  assert.equal(layout.pillVisibility(p,[art],true,null,{since:0},2000).hidden,false);
  assert.equal(layout.pillVisibility(p,[],false,null,{since:0},2000).hidden,false);
});

test('resting near a pill on the artwork does not protect it forever',()=>{
  const p={x:100,y:100,w:100,h:40}, art={x:0,y:0,w:500,h:500};
  const pointer={x:65,y:120};
  let state=layout.pillVisibility(p,[art],false,pointer,{},0);
  state=layout.pillVisibility(p,[art],false,pointer,state,400);
  state=layout.pillVisibility(p,[art],false,pointer,state,1600);
  assert.equal(state.hidden,true);
  assert.equal(state.inert,true);
  const moving=layout.pillVisibility(p,[art],false,{x:90,y:120},state,1620);
  assert.equal(moving.hidden,false);
  assert.equal(moving.inert,false);
});
