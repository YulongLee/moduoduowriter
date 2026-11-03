import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {act} from 'react';
import {createServer} from 'vite';

// In-memory DOM regression only: no browser permissions, remote pages or assets.
const dom=new JSDOM(await readFile('dist/index.html','utf8'),{url:'https://moduoduowriter.com/',pretendToBeVisual:true});
const names=['window','document','location','navigator','localStorage','HTMLElement','requestAnimationFrame','cancelAnimationFrame','IS_REACT_ACT_ENVIRONMENT','fetch'];
const originals=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
const errors=[],calls=[];const error=console.error;
let vite,entry;
try{
 for(const name of ['window','document','location','navigator','localStorage','HTMLElement'])Object.defineProperty(globalThis,name,{configurable:true,value:dom.window[name]});
 globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window);globalThis.cancelAnimationFrame=dom.window.cancelAnimationFrame.bind(dom.window);globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 dom.window.scrollTo=()=>{};dom.window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
 globalThis.fetch=async(url)=>{
  calls.push(String(url));
  if(url==='/api/auth/status')return Response.json({configured:true,user:null,spaceId:null,canRegister:true});
  if(url==='/api/auth/methods')return Response.json({ownerConfigured:true,phone:{enabled:true,configured:true,available:true},email:{enabled:true,configured:true,available:true},wechat:{enabled:false,configured:false,available:false}});
  throw Error('Unexpected private/provider request during SEO hydration: '+url);
 };
 console.error=(...args)=>{errors.push(args.map(String).join(' '));};
 vite=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});
 const input=document.querySelector('textarea[aria-label="故事灵感输入"]');assert.ok(input);
 const h1=document.querySelector('h1'),initialText=h1.textContent;
 await act(async()=>{entry=await vite.ssrLoadModule('/src/entry.jsx');await new Promise(resolve=>setTimeout(resolve,40));});
 assert.equal(document.querySelector('h1'),h1,'Hydration must preserve the initial rendered heading node');
 assert.equal(document.querySelector('textarea[aria-label="故事灵感输入"]'),input,'Hydration must preserve the composer node and its useId label');
 assert.equal(document.querySelector('h1').textContent,initialText);assert.ok(document.querySelector('label[for="'+input.id+'"]'));
 assert.deepEqual(calls,['/api/auth/status'],'Public hydration must not read workspace data');
 assert.equal(errors.length,0,'Hydration should produce no mismatch warnings: '+errors.join('\n'));
 await act(async()=>{document.querySelector('button[aria-label="登录"]').click();await new Promise(resolve=>setTimeout(resolve,30));});
 assert.ok(document.querySelector('[role="dialog"][aria-label="登录或注册"]'));
 assert.ok(document.querySelector('input[type="tel"]'),'Phone login must stay available after hydration');
 await act(async()=>{document.querySelector('button[aria-label="关闭公共首页弹窗"]').click();});
 assert.ok(!document.querySelector('[role="dialog"]'));
 await act(async()=>{location.hash='#works';await new Promise(resolve=>setTimeout(resolve,30));});
 assert.match(document.querySelector('meta[name="robots"]').content,/noindex/);
 assert.ok(document.querySelector('[data-public-home]').hidden);assert.ok(document.querySelector('.account-gate'));
 assert.deepEqual([...new Set(calls)].sort(),['/api/auth/methods','/api/auth/status']);
 await act(async()=>{location.hash='#home';await new Promise(resolve=>setTimeout(resolve,30));});
 assert.match(document.querySelector('meta[name="robots"]').content,/^index,/);assert.ok(!document.querySelector('[data-public-home]').hidden);
 assert.equal(errors.length,0,'No hydration or transition warnings: '+errors.join('\n'));
 console.log('PASS actual entry hydration preserves server DOM/useId, phone login works, private hash routes receive noindex and no private requests leak');
}finally{
 if(entry?.mountedRoot)await act(async()=>entry.mountedRoot.unmount());
 if(vite)await vite.close();console.error=error;dom.window.close();
 for(const [name,descriptor] of originals){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
}
