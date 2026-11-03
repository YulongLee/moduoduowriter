import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {publicPaths,siteOrigin} from '../server/seo.mjs';
import {seoPages} from '../src/seo-content.mjs';
import {seoResources} from '../src/seo-resource-index.mjs';
import {renderSitemap} from './generate-search-files.mjs';

const map=JSON.parse(await readFile('.seo/research/keyword-map.json','utf8'));
assert.equal(map.keywords.length,20);assert.equal(new Set(map.keywords.map(item=>item.keyword)).size,20);
assert.equal(new Set(map.keywords.map(item=>item.cluster)).size,13);assert.equal(new Set(map.keywords.map(item=>item.path)).size,13);
assert.equal(publicPaths.length,14);assert.equal(seoPages.length,13);
assert.deepEqual(seoResources.map(item=>item.path),seoPages.map(item=>item.path),'The small navigation index must not drift from authored pages');
assert.equal(await readFile('public/sitemap.xml','utf8'),renderSitemap());assert.equal(await readFile('dist/sitemap.xml','utf8'),renderSitemap());
const docs=new Map();
try{
 for(const path of publicPaths){
  const html=await readFile(path==='/'?'dist/index.html':'dist'+path+'index.html','utf8');
  const dom=new JSDOM(html,{url:siteOrigin+path});docs.set(path,dom);
  const document=dom.window.document;
  assert.equal(document.querySelectorAll('h1').length,1);
  if(path!=='/'){
   assert.equal(document.querySelectorAll('script[src]').length,0,'Public reading pages should work without loading the writing app');
   const css=document.querySelector('link[rel="stylesheet"]')?.getAttribute('href');assert.match(css,/^\/assets\/seo-reading-[a-f0-9]+\.css$/);
   assert.ok((await readFile('dist'+css)).length<30000,'Reading pages use their own compact stylesheet');
   assert.equal(document.querySelector('time')?.getAttribute('datetime'),'2026-11-04');
   assert.ok((document.querySelector('article')?.textContent.match(/[\u4e00-\u9fff]/g)||[]).length>600,'Each page should contain substantial original guidance');
   assert.ok(document.querySelector('pre code'),'Each content page includes a concrete prompt or example');
  }
 }
 const compact=text=>text.replace(/\s+/gu,'').toLowerCase();
 for(const row of map.keywords){
  assert.ok(publicPaths.includes(row.path));assert.equal(row.primaryUrl,siteOrigin+row.path);
  assert.equal(row.volume,null);assert.equal(row.difficulty,null);assert.equal(row.ranking,null);
  const document=docs.get(row.path).window.document;
  assert.ok(compact(document.querySelector('main').textContent).includes(compact(row.keyword)),`${row.keyword} must be covered in useful visible content at ${row.path}, not only in metadata`);
  const group=map.keywords.filter(other=>other.cluster===row.cluster);assert.equal(new Set(group.map(other=>other.path)).size,1);
 }
 for(const path of ['/guides/ai-novel-prompts/','/guides/ai-long-novel/'])assert.ok(docs.get(path).window.document.querySelectorAll('pre code').length>=5,'Tutorials need multiple usable task examples');
 console.log('PASS 20 mapped keywords across 13 task groups with visible coverage, original guidance and no fabricated metrics');
 console.log('PASS 14 canonical pages, generated discovery/index alignment, current publication dates and script-free compact reading pages');
}finally{for(const dom of docs.values())dom.window.close();}
