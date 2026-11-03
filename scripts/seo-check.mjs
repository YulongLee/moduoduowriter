import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createProductionServer} from '../server/http.mjs';
import {publicPaths,siteOrigin,seoScriptHashes} from '../server/seo.mjs';
import {seoPages} from '../src/seo-content.mjs';

// Exercise the actual production build and HTTP layer with a disposable empty
// data directory. No live account, model, SMS or email provider is involved.
const directory=await mkdtemp(join(tmpdir(),'mdd-seo-'));
let server;
const titles=new Set(),descriptions=new Set(),htmlByPath=new Map();
try{
 assert.deepEqual(publicPaths.slice(1),seoPages.map(page=>page.path));
 server=await createProductionServer({directory,distDirectory:resolve('dist'),publicOrigin:siteOrigin,fetchImpl:()=>{throw Error('SEO tests must not call providers');}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 const request=(path,options={})=>fetch(base+path,{redirect:'manual',...options});
 for(const path of publicPaths){
  const response=await request(path,{headers:{Accept:'text/html'}}),html=await response.text();
  assert.equal(response.status,200,path);assert.match(response.headers.get('content-type'),/^text\/html/);
  assert.equal((html.match(/<h1(?:\s|>)/g)||[]).length,1,path+' must contain one visible H1 without JavaScript');
  assert.match(html,/<main\b/);assert.match(html,/<html lang="zh-CN"/);
  assert.ok(html.includes(`data-prerendered="${path}"`));
  assert.ok(html.includes(`<link rel="canonical" href="${siteOrigin}${path}">`));
  const title=html.match(/<title>(.*?)<\/title>/s)?.[1],description=html.match(/<meta name="description" content="([^"]+)">/)?.[1];
  assert.ok(title&&description);assert.ok(!titles.has(title));titles.add(title);assert.ok(!descriptions.has(description));descriptions.add(description);
  assert.match(html,/<meta name="robots" content="index,follow/);assert.ok(!response.headers.get('x-robots-tag'));
  for(const name of ['og:title','og:description','og:url','og:image','og:image:alt'])assert.ok(html.includes(`property="${name}"`));
  assert.match(html,/<meta name="twitter:card" content="summary_large_image">/);
  assert.ok(html.includes('浙ICP备2026052190号-6'));
  assert.ok(!/(?:api[_-]?key|accessKeySecret|PRIVATE MANUSCRIPT|X-Mdd-Space|deepseek|dashscope)/i.test(html),'No private data or model vendor details in public HTML');
  const csp=response.headers.get('content-security-policy'),scriptPolicy=csp.match(/script-src ([^;]+)/)?.[1];
  assert.ok(scriptPolicy?.includes("'self'"));assert.ok(!scriptPolicy.includes('unsafe-inline'));assert.ok(!scriptPolicy.includes('unsafe-eval'));
  for(const hash of seoScriptHashes(html))assert.ok(scriptPolicy.includes(hash),'JSON-LD needs an exact CSP hash');
  const scripts=[...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];assert.equal(scripts.length,1);JSON.parse(scripts[0][1]);
  const head=await request(path,{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal(head.headers.get('content-length'),String(Buffer.byteLength(html)));
  const bot=await request(path,{headers:{'User-Agent':'OAI-SearchBot'}});assert.equal(await bot.text(),html,'People and crawlers receive identical HTML');
  htmlByPath.set(path,html);
 }
 console.log('PASS all public pages: visible HTML, unique metadata, same visitor/bot content, JSON-LD CSP hashes, HEAD and private-data boundary');
 for(const [path,html] of htmlByPath){
  const fragmentIds=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]));
  for(const [,raw] of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)){
   if(raw.startsWith('#')){assert.ok(fragmentIds.has(raw.slice(1)),`${path} missing fragment ${raw}`);continue;}
   if(!raw.startsWith('/'))continue;
   const destination=new URL(raw,siteOrigin),target=destination.pathname;
   assert.ok(publicPaths.includes(target),`${path} links to unknown public path ${raw}`);
  }
 }
 for(const path of publicPaths.slice(1))assert.ok(htmlByPath.get('/').includes(`href="${path}"`),'Every public content page must be discoverable from home');
 console.log('PASS crawlable internal links, valid section anchors and no orphan product pages');
 for(const path of publicPaths.slice(1)){
  const response=await request(path.slice(0,-1)+'?utm_source=check');assert.equal(response.status,308);assert.equal(response.headers.get('location'),path+'?utm_source=check');
  const index=await request(path+'index.html');assert.equal(index.status,308);assert.equal(index.headers.get('location'),path);
 }
 assert.equal((await request('/index.html')).headers.get('location'),'/');
 for(const path of ['/a-page-that-does-not-exist','/features/not-a-feature/','/404.html','/admin','/works']){
  const response=await request(path,{headers:{Accept:'text/html'}});assert.equal(response.status,404,path);assert.match(response.headers.get('x-robots-tag'),/noindex/);
 }
 const api=await request('/api/data');assert.ok([401,503].includes(api.status));assert.match(api.headers.get('x-robots-tag'),/noindex/);
 assert.match((await request('/healthz')).headers.get('x-robots-tag'),/noindex/);
 console.log('PASS canonical redirects, genuine 404s and noindex for nonpublic responses');
 const sitemapResponse=await request('/sitemap.xml'),sitemap=await sitemapResponse.text();assert.equal(sitemapResponse.status,200);assert.match(sitemapResponse.headers.get('content-type'),/^application\/xml/);
 const locations=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(value=>value[1]);assert.deepEqual(locations,publicPaths.map(path=>siteOrigin+path));
 const robotsResponse=await request('/robots.txt'),robots=await robotsResponse.text();assert.equal(robotsResponse.status,200);assert.match(robotsResponse.headers.get('content-type'),/^text\/plain/);assert.match(robots,/Sitemap: https:\/\/moduoduowriter.com\/sitemap.xml/);
 assert.equal((robots.match(/^User-agent:/gmi)||[]).length,1,'Keep one wildcard group so public crawler restrictions do not diverge');
 for(const path of ['/api','/admin','/works','/account','/history','/settings'])assert.ok(robots.includes('Disallow: '+path));
 for(const path of ['/llms.txt','/llms-full.txt']){
  const response=await request(path),text=await response.text();assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/^text\/plain/);assert.ok(text.includes('墨多多'));
  assert.ok(!/(?:deepseek|dashscope|sk-[a-z\d]{12,}|accessKeySecret)/i.test(text));
 }
 for(const path of ['/og-image.png','/brand-mark.png']){const response=await request(path);assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');}
 const entry=await readFile('src/entry.jsx','utf8');assert.match(entry,/hydrateRoot\(root,app\)/);assert.match(entry,/hashchange/);assert.match(entry,/noindex, nofollow, nosnippet/);
 console.log('PASS sitemap, robots, machine-readable product summaries, share assets and client indexing hooks');
}finally{
 if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
 await rm(directory,{recursive:true,force:true});
}
