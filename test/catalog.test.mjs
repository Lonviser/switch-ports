import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compareProjects, imageKey, repositoryKey} from '../public/catalog-utils.js';
import {imageScore} from '../scripts/enrichment-utils.mjs';
test('default popularity puts stars ahead of recency and missing data below real zero',()=>{
  const entries=[{title:'Missing',stars:null,updatedAt:'2026-10-20'},{title:'Small',stars:0,updatedAt:'2026-10-19'},{title:'Popular',stars:150,updatedAt:'2020-01-01'},{title:'Medium',stars:12,updatedAt:'2026-10-21'}];
  assert.deepEqual(entries.toSorted((a,b)=>compareProjects(a,b)).map(e=>e.title),['Popular','Medium','Small','Missing']);
  assert.equal(entries.toSorted((a,b)=>compareProjects(a,b,'updated'))[0].title,'Medium');
});
test('popularity ties use update dates; explicit alphabetical sorting remains available',()=>{
  const entries=[{title:'Z',stars:20,updatedAt:'2026-10-20'},{title:'A',stars:20,updatedAt:'2026-10-10'}];
  assert.equal(entries.toSorted((a,b)=>compareProjects(a,b))[0].title,'Z');
  assert.equal(entries.toSorted((a,b)=>compareProjects(a,b,'title'))[0].title,'A');
});
test('artwork names and repository URLs are normalized consistently',()=>{
  assert.equal(imageKey('Half-Life'),imageKey('Half Life'));
  assert.equal(repositoryKey('http://github.com/FWGS/xash3d-fwgs/tree/switch'),'FWGS/xash3d-fwgs');
  assert.equal(repositoryKey('https://example.com'),null);
});
test('project icons are preferred over screenshots and unrelated dependency assets',()=>{
  assert.ok(imageScore('switch/icon.jpg')>imageScore('docs/screenshot.png'));
  assert.equal(imageScore('third_party/icon.png'),0);
  assert.equal(imageScore('README.md'),0);
});
