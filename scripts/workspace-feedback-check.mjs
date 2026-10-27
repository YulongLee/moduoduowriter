import assert from 'node:assert/strict';
import React from 'react';
import TestRenderer,{act} from 'react-test-renderer';
import {createServer} from 'vite';
import {collectionKeys,createWorkspaceClient} from '../src/workspace.js';
import {workspaceFeedback} from '../src/workspaceFeedback.js';

// Synthetic in-memory documents only. All requests below are controlled; no real API or account is used.
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const sample={id:'feedback-story',title:'保存反馈测试',kind:'长篇小说',genre:'悬疑',chapters:[{id:'chapter',title:'第一章',text:'受控测试正文。'}],outline:'',characters:''};
const collections=()=>Object.fromEntries(Object.keys(collectionKeys).map(name=>[name,{data:name==='works'?[structuredClone(sample)]:[],revision:1}]));
let remote=collections(),online=true,cacheBlocked=false,pendingBlocked=false;
const cache=new Map();
const storage={getItem:key=>cache.get(key)??null,setItem:(key,value)=>{if(cacheBlocked||(pendingBlocked&&key==='mdd-sync-pending-v1'))throw Error('Cache unavailable');cache.set(key,value);},removeItem:key=>cache.delete(key)};
const request=async(path,body)=>{
 if(!online)throw Error('本地服务暂未连接');
 if(path==='/api/data')return {collections:structuredClone(remote)};
 const name=path.split('/').at(-1),entry=remote[name];assert.ok(entry,'Unexpected synthetic endpoint');
 entry.data=structuredClone(body.data);entry.revision++;return {revision:entry.revision};
};
const client=createWorkspaceClient({storage,request});
try{
 await client.initialize();assert.equal(client.state.status,'saved');
 online=false;await assert.rejects(client.refresh());assert.equal(client.state.status,'offline');
 client.set('works',[{...sample,chapters:[{...sample.chapters[0],text:'断线期间的新正文。'}]}]);
 assert.equal(client.state.status,'offline','Offline editing must not claim the service is saving');
 assert.equal(workspaceFeedback(client.state).label,'离线缓存待同步');
 online=true;await client.refresh();assert.equal(client.state.status,'saved');assert.equal(client.state.error,'');
 assert.equal(remote.works.data[0].chapters[0].text,'断线期间的新正文。');
 cacheBlocked=true;assert.equal(client.set('works',[{...sample,title:'设备缓存失败，服务仍可保存'}]),false);
 await client.flush();assert.equal(client.state.status,'saved');assert.ok(client.state.cacheError);
 assert.equal(workspaceFeedback(client.state).label,'已保存，离线缓存不可用');
 online=false;await assert.rejects(client.refresh());
 assert.equal(workspaceFeedback(client.state).tone,'error');assert.ok(!workspaceFeedback(client.state).label.includes('已保存'));
 cacheBlocked=false;online=true;await client.refresh();assert.equal(client.state.status,'saved');assert.equal(client.state.cacheError,'');
 pendingBlocked=true;assert.equal(client.set('favorites',['outline']),false,'Pending-marker failures must also be visible');
 await client.flush();assert.ok(client.state.cacheError);
 pendingBlocked=false;await client.refresh();assert.equal(client.state.cacheError,'');
 console.log('PASS offline editing, automatic reconnect and flush, independent cache health, pending-marker failure and recovery');
}finally{client.stop();}

// Reconnecting and saving must not race an old snapshot back over a newer acknowledged draft.
{
 const values=new Map(),cacheStore={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
 let records=collections(),holdRead=false,holdWrite=false,releaseRead,releaseWrite,reads=0,staleRead=null;
 const wire=async(path,body)=>{
  if(path==='/api/data'){
   reads++;const response=structuredClone(staleRead||{collections:records});
   if(holdRead)return new Promise(resolve=>{releaseRead=()=>resolve(response);});
   return response;
  }
  const name=path.split('/').at(-1),commit=()=>{records[name]={data:structuredClone(body.data),revision:records[name].revision+1};return {revision:records[name].revision};};
  if(holdWrite)return new Promise(resolve=>{releaseWrite=()=>resolve(commit());});
  return commit();
 };
 const subject=createWorkspaceClient({storage:cacheStore,request:wire});
 try{
  await subject.initialize();const originalSnapshot=structuredClone({collections:records});
  holdWrite=true;subject.set('works',[{...sample,title:'最新已确认稿'}]);const saving=subject.flush();
  const readsBefore=reads;await subject.initialize();assert.equal(reads,readsBefore,'Reconnect must not read over an in-flight save');
  releaseWrite();await saving;holdWrite=false;
  staleRead=originalSnapshot;await subject.initialize();staleRead=null;
  assert.equal(subject.entries.works.data[0].title,'最新已确认稿');assert.equal(subject.entries.works.revision,2);
  assert.ok(values.get(collectionKeys.works).includes('最新已确认稿'),'A stale read must not downgrade browser cache');
  holdRead=true;const reconnecting=subject.initialize();const initializingReads=reads;
  await subject.initialize();assert.equal(reads,initializingReads,'Repeated reconnect clicks must not create overlapping initialization reads');
  subject.set('works',[{...sample,title:'重连期间的作者修改'}]);await subject.flush();
  assert.equal(records.works.data[0].title,'最新已确认稿','Saving waits for initialization to resolve its snapshot');
  releaseRead();await reconnecting;holdRead=false;
  assert.equal(subject.state.status,'saved');assert.equal(subject.entries.works.data[0].title,'重连期间的作者修改');
  assert.equal(records.works.data[0].title,'重连期间的作者修改');
  console.log('PASS reconnect/save serialization, stale-revision rejection, repeated reconnect deduplication and edits during reconnect');
 }finally{subject.stop();}
}

for(const status of ['saved','pending','saving','offline','space-mismatch','loading']){
 const feedback=workspaceFeedback({status,error:'',conflicts:0});
 assert.equal(feedback.retry,status==='offline');
 assert.equal(feedback.tone==='success',status==='saved');
 if(status!=='saved')assert.ok(!feedback.label.includes('已保存'));
}

const original={fetch:globalThis.fetch,window:globalThis.window,document:globalThis.document,location:globalThis.location,localStorage:globalThis.localStorage};
const listeners=new Map();
globalThis.window={innerWidth:1440,scrollTo(){},addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},removeEventListener(type,fn){listeners.get(type)?.delete(fn);}};
globalThis.document={body:{style:{}},activeElement:null,getElementById(){return null;},querySelector(){return null;},addEventListener(){},removeEventListener(){}};
globalThis.location={hash:'#home'};globalThis.localStorage=storage;
globalThis.fetch=async(url,options={})=>{
 const body=options.body?JSON.parse(options.body):undefined;
 try{return Response.json(await request(url,body));}catch(error){throw error;}
};
remote=collections();cache.clear();cacheBlocked=false;pendingBlocked=false;online=true;
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
const text=node=>typeof node==='string'?node:(node?.children||[]).map(text).join('');
let renderer,workspace;
try{
 const {WorkspaceProvider,useWorkspace}=await server.ssrLoadModule('/src/Workspace.jsx');
 const {BillingProvider}=await server.ssrLoadModule('/src/Billing.jsx');
 const {WritingApp}=await server.ssrLoadModule('/src/main.jsx');
 function Observe(){workspace=useWorkspace();return null;}
 await act(async()=>{renderer=TestRenderer.create(React.createElement(WorkspaceProvider,null,React.createElement(Observe),React.createElement(BillingProvider,null,React.createElement(WritingApp))));await new Promise(resolve=>setTimeout(resolve,0));});
 const status=()=>renderer.root.findByProps({'aria-label':'保存状态'});
 const footer=()=>renderer.root.findByProps({className:'page-footer'});
 assert.equal(renderer.root.findAllByProps({'aria-label':'保存状态'}).length,1,'Save feedback must have a single source in the workbench header');
 assert.ok(text(status()).includes('已保存到本地服务'));
 assert.ok(!text(footer()).includes('自动保存')&&!text(footer()).includes('已保存'));
 online=false;await act(async()=>{await workspace.client.refresh().catch(()=>{});});
 assert.ok(text(status()).includes('离线缓存待同步'));assert.ok(!text(status()).includes('已保存到本地服务'));
 online=true;await act(async()=>{await status().findAllByType('button').find(node=>text(node).includes('重新连接')).props.onClick();});
 assert.ok(text(status()).includes('已保存到本地服务'));
 assert.equal(renderer.root.findAllByProps({'aria-label':'保存状态'}).length,1);
 console.log('PASS real workbench header feedback, single saved/offline source, explicit reconnect and no contradictory footer claim');
}finally{
 if(renderer)await act(async()=>renderer.unmount());await server.close();
 for(const [key,value]of Object.entries(original)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
}
