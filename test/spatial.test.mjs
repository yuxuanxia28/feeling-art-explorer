import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceQuery, artworkPosition, safeImageUrl } from '../lib/discovery/spatial-state.mjs';
import { spatialPayload } from '../lib/discovery/spatial.mjs';
import { buildNgaIndex } from '../lib/nga/index.mjs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('spatial choices accumulate filters without mutating the previous branch',()=>{
  const previous={feeling:'calm',q:'garden'};
  assert.deepEqual(advanceQuery(previous,{kind:'medium',value:'Painting'}),{feeling:'calm',q:'garden',medium:'Painting'});
  assert.deepEqual(previous,{feeling:'calm',q:'garden'});
  assert.deepEqual(advanceQuery(previous,{kind:'term',value:'French'}),{feeling:'calm',q:'garden French'});
  assert.deepEqual(advanceQuery(previous,{kind:'feeling',value:'warm'}),{feeling:'warm'});
  assert.throws(()=>advanceQuery(previous,{kind:'script',value:'x'}),/choice/);
});
test('artwork depth is stable and progresses in bounded rows',()=>{
  const first=artworkPosition(0), next=artworkPosition(3);
  assert.deepEqual(first,artworkPosition(0));
  assert.ok(next.z<first.z);
  for(let i=0;i<24;i++){const p=artworkPosition(i);assert.ok(Math.abs(p.x)<8);assert.ok(Math.abs(p.y)<4);assert.ok(Number.isFinite(p.z));}
});
test('image paths accept only NGA images and reject foreign URLs',()=>{
  assert.equal(safeImageUrl('https://api.nga.gov/iiif/a/full/!200,200/0/default.jpg'),'https://api.nga.gov/iiif/a/full/!200,200/0/default.jpg');
  assert.equal(safeImageUrl('https://api.nga.gov.evil.test/a'),'');
  assert.equal(safeImageUrl('javascript:alert(1)'),'');
});

test('spatial suggestions have real matches under current filters',async t=>{
  const dir=await mkdtemp(path.join(tmpdir(),'nga-spatial-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const indexPath=path.join(dir,'index.sqlite');
  await buildNgaIndex({outputPath:indexPath,tables:{
    objects:[{objectID:'1',title:'Garden',classification:'Painting',displayDate:'1850'},{objectID:'2',title:'Garden Study',classification:'Drawing',displayDate:'1920'}],
    publishedImages:[1,2].map(id=>({depictsTmsObjectID:String(id),openAccess:'1',viewType:'primary',iiifThumbUrl:'https://api.nga.gov/test'})),
  }});
  const data=spatialPayload(indexPath,{feeling:'calm',q:'garden'});
  assert.equal(data.total,2);
  assert.ok(data.choices.some(c=>c.value==='Painting'&&c.count===1));
  assert.ok(!data.choices.some(c=>c.value==='Print'));
  assert.equal(spatialPayload(indexPath,{feeling:'calm',q:'nonexistent'}).choices.length,0);
  assert.equal(spatialPayload(indexPath,{feeling:'calm',q:'garden',medium:'Painting'}).total,1);
});
