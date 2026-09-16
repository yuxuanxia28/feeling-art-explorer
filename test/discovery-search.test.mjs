import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { buildNgaIndex } from '../lib/nga/index.mjs';
import { discover } from '../lib/discovery/search.mjs';

test('guided discovery narrows real catalogue metadata and supports optional vectors', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'nga-discovery-'));
  t.after(() => rm(directory, { recursive:true, force:true }));
  const outputPath = path.join(directory, 'index.sqlite');
  await buildNgaIndex({outputPath,tables:{
    objects:[
      {objectID:'1',title:'Garden Water',classification:'Painting',displayDate:'1850'},
      {objectID:'2',title:'Garden Study',classification:'Drawing',displayDate:'1920'},
      {objectID:'3',title:'Winter',classification:'Painting',displayDate:'1700'},
    ],
    publishedImages:[1,2,3].map(id=>({depictsTmsObjectID:String(id),openAccess:'1',viewType:'primary',iiifThumbUrl:'https://api.nga.gov/test'})),
  }});
  assert.equal(discover(outputPath,{feeling:'calm'}).total,2);
  assert.equal(discover(outputPath,{feeling:'calm'}).vectorCount,0);
  assert.equal(discover(outputPath,{q:'garden water'}).total,1);
  assert.equal(discover(outputPath,{subject:'garden',medium:'Drawing',from:'1900'}).results[0].id,2);
  assert.equal(discover(outputPath,{subject:'garden',to:'1800'}).total,0);
  assert.equal(discover(outputPath,{subject:'garden',exclude:'1,2'}).total,0);
  assert.equal(discover(outputPath,{q:'garden',artist:'%'}).total,0);
  assert.equal(discover(outputPath,{scope:'catalogue',medium:'Painting'}).total,2);
  assert.throws(()=>discover(outputPath,{from:'2000',to:'1800'}),/valid year/);
  assert.throws(()=>discover(outputPath,{anchor:'1'}),/not indexed/);
  const db = new DatabaseSync(outputPath);
  db.exec('CREATE TABLE visual_embedding (id INTEGER PRIMARY KEY, vector BLOB)');
  for(const id of [1,2])db.prepare('INSERT INTO visual_embedding VALUES (?,?)').run(id,new Uint8Array(new Float32Array([1,0]).buffer));
  db.close();
  const anchored=discover(outputPath,{q:'garden',anchor:'1'});
  assert.equal(anchored.total,1);
  assert.equal(anchored.results[0].similarity,1);
  assert.equal(discover(outputPath,{q:'garden',anchor:''}).total,2);
});
