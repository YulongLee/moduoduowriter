import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import React from 'react';
import {renderToString} from 'react-dom/server';
import {createServer} from 'vite';
import {renderSeoHead,publicPaths,defaultTitle,defaultDescription} from '../server/seo.mjs';
import {seoPages} from '../src/seo-content.mjs';

// Render the actual public React trees at build time. The same HTML is delivered
// to visitors and crawlers, with no provider calls or private account state.
const directory=resolve('dist');
const template=await readFile(join(directory,'index.html'),'utf8');
const readingCss='html,body{margin:0;padding:0;}\n'+await readFile(new URL('../src/seo-content.css',import.meta.url),'utf8');
const readingStyle='/assets/seo-reading-'+createHash('sha256').update(readingCss).digest('hex').slice(0,12)+'.css';
await writeFile(join(directory,readingStyle.slice(1)),readingCss);
if(!template.includes('<div id="root"></div>'))throw Error('Expected one empty Vite root before prerendering.');
const vite=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const {App}=await vite.ssrLoadModule('/src/main.jsx');
 const {default:SeoContentPage}=await vite.ssrLoadModule('/src/SeoContentPage.jsx');
 const originalFetch=globalThis.fetch;
 globalThis.fetch=()=>{throw Error('Public prerendering must never call a provider or an account API.');};
 try{
  for(const path of publicPaths){
   const page=seoPages.find(value=>value.path===path);
   if(path!=='/'&&!page)throw Error('Missing public content: '+path);
   const markup=renderToString(React.createElement(path==='/'?App:SeoContentPage,path==='/'?{}:{path}));
   if(!markup.includes('<h1'))throw Error('Missing public heading: '+path);
   const head=renderSeoHead({path,title:page?.title||defaultTitle,description:page?.description||defaultDescription,kind:path==='/about/'?'about':'page'});
   const pageTemplate=path==='/'?template:template.replace(/<script\b[^>]*type="module"[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*rel="(?:stylesheet|modulepreload)"[^>]*>/gi,'').replace('</head>',`<link rel="stylesheet" href="${readingStyle}">\n</head>`);
   const html=pageTemplate.replace(/<title>[\s\S]*?<\/title>/i,'').replace(/<meta\s+name="description"[^>]*>/i,'').replace('</head>',head+'\n</head>').replace('<div id="root"></div>',`<div id="root" data-prerendered="${path}">${markup}</div>`);
   const output=path==='/'?join(directory,'index.html'):join(directory,path.slice(1),'index.html');
   await mkdir(resolve(output,'..'),{recursive:true});await writeFile(output,html);
  }
 }finally{globalThis.fetch=originalFetch;}
 const notFound='<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>页面未找到 · 墨多多</title></head><body><main><h1>页面未找到</h1><p>这个地址不存在，回到墨多多开始你的故事。</p><a href="/">返回墨多多首页</a></main></body></html>';
 await writeFile(join(directory,'404.html'),notFound);
 console.log(`Prerendered ${publicPaths.length} public pages with visible HTML, canonical metadata and JSON-LD.`);
}finally{await vite.close();}
