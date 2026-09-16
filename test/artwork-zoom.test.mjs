import test from 'node:test';
import assert from 'node:assert/strict';
const zoom = await import('../artwork-zoom.mjs').catch(()=>({}));
test('only NGA IIIF images can request a larger source',()=>{
  assert.equal(typeof zoom.highResolutionUrl,'function');
  assert.equal(zoom.highResolutionUrl('https://api.nga.gov/iiif/abc/full/!200,200/0/default.jpg'),'https://api.nga.gov/iiif/abc/full/!2400,2400/0/default.jpg');
  for(const url of ['https://evil.com/iiif/abc/full/200,/0/default.jpg','javascript:alert(1)','https://api.nga.gov.evil.com/iiif/a/full/200,/0/default.jpg']) assert.equal(zoom.highResolutionUrl(url),'');
});
test('pixel limit accounts for device density and small images',()=>{
  assert.equal(typeof zoom.zoomLimit,'function');
  assert.equal(zoom.zoomLimit(2400,600,2),2);
  assert.equal(zoom.zoomLimit(200,600,2),1);
  assert.equal(zoom.zoomLimit(2400,0,1),1);
});
test('panning cannot move the image beyond its edges',()=>{
  assert.equal(typeof zoom.clampPan,'function');
  assert.deepEqual(zoom.clampPan(500,-500,800,600,400,400),{x:200,y:-100});
  assert.deepEqual(zoom.clampPan(40,40,200,200,400,400),{x:0,y:0});
});
