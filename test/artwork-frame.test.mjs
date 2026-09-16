import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createArtworkFrame, disposeArtworkFrame } from '../lib/discovery/artwork-frame.mjs';

test('frame is dimensional, surrounds the artwork and keeps the opening clear',()=>{
  const frame=createArtworkFrame(THREE,3.1,2);
  const rim=frame.getObjectByName('baroque-rim');
  rim.geometry.computeBoundingBox();
  const box=rim.geometry.boundingBox;
  assert.ok(box.max.x>1.55&&box.min.x< -1.55);
  assert.ok(box.max.z-box.min.z>.1);
  const hole=rim.geometry.parameters.shapes.holes[0].getPoints();
  assert.ok(Math.min(...hole.map(p=>Math.abs(p.x)))>=1.55);
  assert.ok(Math.min(...hole.map(p=>Math.abs(p.y)))>=1);
});
test('all three baroque variants retain the opening and carry ornament geometry',()=>{
  for(let variant=0;variant<3;variant++){
    const frame=createArtworkFrame(THREE,2,3,{variant});
    assert.ok(frame.getObjectByName('carved-surface'));
    assert.ok(frame.getObjectByName('beaded-lip'));
    if(variant===2)assert.ok(frame.getObjectByName('floral-crest'));
    const surface=frame.getObjectByName('carved-surface').geometry;
    assert.equal(surface.getAttribute('position').count,48);
  }
});
test('frame resources are released on replacement',()=>{
  const frame=createArtworkFrame(THREE,2,3);let geometry=0,material=0;
  frame.traverse(n=>{n.geometry?.addEventListener('dispose',()=>geometry++);n.material?.addEventListener('dispose',()=>material++);});
  disposeArtworkFrame(frame);
  assert.ok(geometry>=2);assert.ok(material>=2);
});
