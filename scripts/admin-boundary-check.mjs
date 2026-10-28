import assert from 'node:assert/strict';
import React from 'react';
import TestRenderer,{act} from 'react-test-renderer';
import {createServer} from 'vite';
import {collectionKeys} from '../src/workspace.js';

// Memory-only application rendering. This test never opens a browser, reads
// real account files, seeds credentials, or talks to a login/AI/OSS provider.
const names=['fetch','window','document','location','localStorage','requestAnimationFrame','cancelAnimationFrame','IS_REACT_ACT_ENVIRONMENT'];
const originals=Object.fromEntries(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const calls=[],reads=[],writes=[],listeners=new Map();
let hash='#admin',state={configured:true,user:null,spaceId:null,canRegister:true},behavior='ready',renderer;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const text=node=>typeof node==='string'?node:(node?.children||[]).map(text).join('');
globalThis.location={get hash(){return hash;},set hash(value){hash=value;queueMicrotask(()=>{for(const fn of listeners.get('hashchange')||[])fn();});}};
globalThis.window={innerWidth:1440,addEventListener(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);},removeEventListener(name,fn){listeners.get(name)?.delete(fn);},scrollTo(){}};
globalThis.document={activeElement:null,body:{style:{}},querySelector(){return null;},querySelectorAll(){return [];},getElementById(){return null;},addEventListener(){},removeEventListener(){},createElement(){return {style:{},click(){},remove(){}};}};
globalThis.requestAnimationFrame=fn=>setTimeout(fn,0);globalThis.cancelAnimationFrame=clearTimeout;
globalThis.localStorage={getItem(key){reads.push(key);return null;},setItem(key){writes.push(key);},removeItem(){}};
const empty={items:[],total:0,page:1,pageSize:20};
const config={phone:{enabled:false,accessKeyId:'',accessKeySecret:'',signName:'',templateCode:'',codeParam:'code',hasAccessKeyId:false,hasAccessKeySecret:false},email:{enabled:false,host:'',port:465,secure:true,user:'',password:'',from:'',fromName:'墨多多',hasPassword:false},wechat:{enabled:false,appId:'',appSecret:'',redirectUri:'',hasAppSecret:false}};
globalThis.fetch=async(url,options={})=>{
 calls.push({url,method:options.method||'GET'});
 if(url==='/api/auth/status')return behavior==='failure'?Response.json({error:'controlled status failure'},{status:503}):Response.json(behavior==='malformed'?{}:state);
 if(url==='/api/admin/overview')return Response.json({users:{total:1,active:1,disabled:0,admins:1},works:{total:0,words:0,chapters:0},generations:{total:0,succeeded:0,failed:0,running:0,interrupted:0,totalTokens:0},orders:{total:0,mode:'server-demo'},trend:[],recentAudit:[]});
 if(String(url).startsWith('/api/admin/'))return Response.json(empty);
 if(url==='/api/service/status')return Response.json({configured:false,defaultMode:'demo'});
 if(url==='/api/settings')return Response.json({baseUrl:'',model:'',protocol:'chat',apiKey:'',jsonMode:false,defaultMode:'demo',hasKey:false});
 if(url==='/api/auth/settings')return Response.json(config);
 throw Error('Unexpected admin-boundary fixture request: '+url);
};
const mock=()=>({focus(){},contains(){return false;},querySelector(){return null;},querySelectorAll(){return [];},addEventListener(){},removeEventListener(){},scrollTo(){},scrollIntoView(){},getBoundingClientRect(){return {left:0,top:0,width:1440,height:900};},style:{}});
const vite=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const {App}=await vite.ssrLoadModule('/src/main.jsx');
 const {setRequestSpace}=await vite.ssrLoadModule('/src/sessionScope.js');
 const account=role=>({configured:true,user:{id:role==='admin'?'local':'fixture-author',username:'fixture-'+role,role,createdAt:'2026-10-28T00:00:00.000Z',hasPassword:true},spaceId:role==='admin'?'local':'fixture-author',canRegister:true});
 const mount=async({route='#admin',auth={configured:true,user:null,spaceId:null,canRegister:true},status='ready'}={})=>{
  if(renderer)await act(async()=>renderer.unmount());
  hash=route;state=auth;behavior=status;calls.length=0;reads.length=0;writes.length=0;setRequestSpace(null);
  await act(async()=>{renderer=TestRenderer.create(React.createElement(App),{createNodeMock:mock});await delay(20);});
 };
 const assertNoWorkspace=label=>{
  assert.deepEqual(calls.filter(call=>call.url==='/api/data'||call.url==='/api/billing'||String(call.url).startsWith('/api/data/')),[],label+': no workspace/ledger requests');
  assert.deepEqual(reads.filter(key=>Object.values(collectionKeys).some(collection=>key===collection||key.endsWith(':'+collection))||/mdd-billing/.test(key)),[],label+': no personal workspace caches');
  assert.deepEqual(writes,[],label+': opening admin never creates workspace records');
  assert.equal(renderer.root.findAll(node=>typeof node.type==='string'&&node.props['data-public-home']).length,0,label+': admin must not also mount public home');
  assert.equal(renderer.root.findAllByProps({id:'main-sidebar'}).length,0,label+': author sidebar must not mount');
 };
 for(const route of ['#admin','#admin/users','#service-admin']){
  await mount({route});assertNoWorkspace(route+' guest');assert.deepEqual(calls.map(call=>call.url),['/api/auth/status']);assert.ok(renderer.root.findAllByProps({'aria-label':'创作账号'}).length,'password login is reachable for backend guests');
  await mount({route,auth:account('author')});assertNoWorkspace(route+' author');assert.deepEqual(calls.map(call=>call.url),['/api/auth/status']);assert.ok(text(renderer.root).includes('没有后台权限'));
  await mount({route,auth:account('admin')});assertNoWorkspace(route+' administrator');assert.ok(renderer.root.findAllByProps({'data-admin-console':'true'}).length);
  const expected=route==='#service-admin'?'/api/settings':route==='#admin/users'?'/api/admin/users?page=1&pageSize=20':'/api/admin/overview';assert.ok(calls.some(call=>call.url===expected),route+': expected safe administrator endpoint');
 }
 console.log('PASS full App admin routes and legacy service-admin alias isolate guest/author/admin views from workspace providers, cached manuscripts and billing');
 for(const status of ['failure','malformed']){
  await mount({auth:account('admin'),status});assertNoWorkspace(status);assert.deepEqual(calls.map(call=>call.url),['/api/auth/status']);assert.ok(!renderer.root.findAllByProps({'data-admin-console':'true'}).length);
 }
 await mount({auth:{configured:false,user:null,spaceId:'local',canRegister:true}});assertNoWorkspace('legacy unconfigured');assert.deepEqual(calls.map(call=>call.url),['/api/auth/status']);assert.ok(!renderer.root.findAllByProps({'data-admin-console':'true'}).length);assert.ok(!text(renderer.root).includes('设置首个创作账号'),'backend cannot treat unconfigured local compatibility as admin authorization');
 console.log('PASS failed/malformed status and unconfigured legacy-local state never authorize the administrator console or management requests');
}finally{
 if(renderer)await act(async()=>renderer.unmount());await vite.close();
 for(const name of names){const value=originals[name];if(value)Object.defineProperty(globalThis,name,value);else delete globalThis[name];}
}
