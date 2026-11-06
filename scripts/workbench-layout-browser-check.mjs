import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';

// Render synthetic works only. Chrome receives an offline file, a fresh temporary
// profile, and disabled network resolution; no production or user data is used.
const chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const dir=await mkdtemp(path.join(tmpdir(),'mdd-layout-test-'));
const vite=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});
try {
 const html=await readFile('dist/index.html','utf8');
 const cssPath=html.match(/href="(\/assets\/[^\"]+\.css)"/)?.[1];
 assert.ok(cssPath,'Build the application before running the layout check');
 const css=await readFile(path.join('dist',cssPath),'utf8');
 const {WorksPage}=await vite.ssrLoadModule('/src/Library.jsx');
 const {default:WorkspaceDashboard}=await vite.ssrLoadModule('/src/WorkspaceDashboard.jsx');
 const {default:CreateWorkPage}=await vite.ssrLoadModule('/src/CreateWorkPage.jsx');
 const fixture=Array.from({length:3},(_,i)=>({id:`fixture-${i}`,title:`测试作品${i+1}`,kind:'长篇小说',genre:'玄幻',chapters:[{id:`chapter-${i}`,title:'第一章',text:'离线测试文稿'}]}));
 const works=renderToStaticMarkup(React.createElement(WorksPage,{works:fixture,navigate(){},setModal(){},onImport(){},notify(){}}));
 const dashboard=renderToStaticMarkup(React.createElement(WorkspaceDashboard,{works:fixture,navigate(){},setModal(){},notify(){}}));
 const create=renderToStaticMarkup(React.createElement(CreateWorkPage,{initial:{},onCreate(){},onCancel(){}}));
 const cases=[{name:'作品',content:works,main:'library-content',selectors:['.novel-library-hero','.novel-library-shortcuts','.novel-library-shelf','.novel-work-card']},{name:'旧布局回归样例',broken:true,content:works.replace('class="works-library-view"','class="novel-library"'),main:'library-content',selectors:['.novel-library-hero','.novel-library-shortcuts','.novel-library-shelf','.novel-work-card']},{name:'工作台',content:dashboard,main:'dashboard-content',selectors:['.workspace-dashboard-welcome','.workspace-dashboard-quick-actions','.workspace-dashboard-works','.workspace-dashboard-work']},{name:'新建作品',content:create,main:'creation-content',selectors:['.create-work-page','.create-work-form','.create-work-sidebar','.create-work-template']}];
 const document=(item, expanded=true)=>`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css.replaceAll('</style','<\\/style')}</style></head><body><div class="app-shell commercial private-workbench sidebar-auto" data-sidebar-expanded="${expanded}"><div class="sidebar-hover-zone" data-open="${expanded}"><aside class="sidebar"></aside></div><div class="workspace"><main class="main-content ${item.main}">${item.content}</main></div></div><script>window.addEventListener('load',()=>{const r=s=>{let x=document.querySelector(s);if(!x)return null;let b=x.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,display:getComputedStyle(x).display,flexDirection:getComputedStyle(x).flexDirection}}; document.body.dataset.result=JSON.stringify({viewport:innerWidth,scroll:document.documentElement.scrollWidth,workspace:r('.workspace'),sidebar:r('.sidebar'),main:r('.main-content'),root:r('.works-library-view'),hero:r('${item.selectors[0]}'),shortcuts:r('${item.selectors[1]}'),shelf:r('${item.selectors[2]}'),card:r('${item.selectors[3]}')});});</script></body></html>`;
 for(const item of cases) for(const width of (item.broken?[1440]:item.name==='工作台'?[2694,1536,1440,500]:[1440,500])) for(const expanded of (item.name==='工作台' && width>1024?[true,false]:[true])) {
  const file=path.join(dir,'fixture.html');await writeFile(file,document(item,expanded));
  const output=execFileSync(chrome,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--host-resolver-rules=MAP * ~NOTFOUND',`--user-data-dir=${path.join(dir,`profile-${width}`)}`,`--window-size=${width},900`,'--dump-dom',pathToFileURL(file).href],{encoding:'utf8',timeout:30000,stdio:['ignore','pipe','ignore']});
  const encoded=output.match(/data-result="([^"]+)"/)?.[1];assert.ok(encoded,'Browser must expose fixture measurements');
  const m=JSON.parse(encoded.replaceAll('&quot;','"').replaceAll('&amp;','&'));
  assert.ok(m.hero && m.shortcuts && m.shelf && m.card,'Core regions and a synthetic work must be rendered');
  if(item.broken && width===1440) assert.ok(m.shortcuts.y < m.hero.y+m.hero.height-2,'Regression fixture reproduces the original horizontal layout collision');
  if(item.name==='作品') assert.ok(m.shortcuts.y>=m.hero.y+m.hero.height-2,`At ${width}px shortcuts must be below the header`);
  if(item.name==='作品') assert.ok(m.shelf.y>=m.shortcuts.y+m.shortcuts.height-2,`At ${width}px works must be below the shortcuts`);
  if(item.name==='作品') assert.ok(m.card.width>=Math.min(210,width*.5),`At ${width}px work cards must not collapse into narrow vertical strips`);
  if(!item.broken) assert.ok(m.scroll<=m.viewport+2,`At ${width}px the document must not overflow horizontally`);
  if(item.name==='工作台' && width>1024) {
   assert.ok(Math.abs(m.main.x-(m.sidebar.x+m.sidebar.width))<=2,`At ${width}px dashboard must start beside the ${expanded?'expanded':'collapsed'} sidebar; got main ${m.main.x} sidebar end ${m.sidebar.x+m.sidebar.width}`);
   assert.ok(m.hero.x-m.main.x<=32,`At ${width}px dashboard content must not be pushed away from its main container`);
  }
  console.log(item.broken?`PASS original class collision reproduced at ${m.viewport}px`:`PASS offline Chrome ${width}px (viewport ${m.viewport}px) ${item.name} ${expanded?'expanded':'collapsed'}: required sections present; no page overflow`);
 }
} finally {await vite.close();await rm(dir,{recursive:true,force:true});}
