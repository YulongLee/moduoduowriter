import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {createApi} from '../server/api.mjs';
import {createStore,collections} from '../server/store.mjs';
import {collectionKeys,createWorkspaceClient,workspaceBackup} from '../src/workspace.js';
import {backupKeys,validateBackup,collectBackup,restoreBackup,mergeBackup} from '../src/backup.js';
import {scopedStorage} from '../src/storage.js';

// Only disposable stores, fixture accounts and in-memory browser caches are used.
// No real workspace, model, email, SMS or OSS service is read or contacted.
const memory=()=>{const values=new Map();return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};};
const at='2026-11-04T08:15:00.000Z';
const task={id:'task-alice',text:'核对第一章的人物动机',done:false,createdAt:at};
const activity={id:'activity-alice',workId:'work-alice',at,type:'edit'};
const payload=(tasks=[task],events=[activity])=>({format:'mdd-workspace',version:1,works:[],workspaceTasks:tasks,workspaceActivity:events});
const valid=validateBackup(payload());
for(const name of ['workspaceTasks','workspaceActivity']){
 assert.equal(collectionKeys[name],`mdd-${name}-v1`);assert.equal(backupKeys[name],collectionKeys[name]);assert.ok(collections.includes(name));
}
const old=validateBackup({format:'mdd-workspace',version:1,works:[]});
assert.deepEqual(old.workspaceTasks,[]);assert.deepEqual(old.workspaceActivity,[]);
const local=memory();restoreBackup(local,valid);assert.deepEqual(collectBackup(local).workspaceTasks,[task]);assert.deepEqual(collectBackup(local).workspaceActivity,[activity]);
assert.deepEqual(mergeBackup(valid,old).workspaceTasks,[task],'Merging an old backup must retain current-account tasks');
const maxTasks=Array.from({length:100},(_,index)=>({...task,id:`task-${index}`}));
const maxActivity=Array.from({length:3650},(_,index)=>({...activity,id:`activity-${index}`}));
validateBackup(payload(maxTasks,maxActivity));
validateBackup(payload([{...task,createdAt:'2026-11-04T16:15:00+08:00'}],[{...activity,at:'2026-11-04T08:15:00Z'}]));
const malformed=[
 ['missing tasks array',value=>{value.workspaceTasks={};}],
 ['empty task',value=>{value.workspaceTasks[0].text='   ';}],
 ['long task',value=>{value.workspaceTasks[0].text='文'.repeat(121);}],
 ['nonboolean completion',value=>{value.workspaceTasks[0].done=1;}],
 ['missing task timestamp',value=>{delete value.workspaceTasks[0].createdAt;}],
 ['plain-date task timestamp',value=>{value.workspaceTasks[0].createdAt='2026-11-04';}],
 ['impossible task day',value=>{value.workspaceTasks[0].createdAt='2026-02-30T08:15:00Z';}],
 ['task timestamp hour',value=>{value.workspaceTasks[0].createdAt='2026-11-04T24:15:00Z';}],
 ['empty task id',value=>{value.workspaceTasks[0].id=' ';}],
 ['duplicate task',value=>{value.workspaceTasks.push({...value.workspaceTasks[0]});}],
 ['task capacity',value=>{value.workspaceTasks=[...maxTasks,{...task,id:'task-overflow'}];}],
 ['missing activity array',value=>{value.workspaceActivity=null;}],
 ['missing work id',value=>{delete value.workspaceActivity[0].workId;}],
 ['empty work id',value=>{value.workspaceActivity[0].workId=' ';}],
 ['relative activity time',value=>{value.workspaceActivity[0].at='yesterday';}],
 ['impossible activity month',value=>{value.workspaceActivity[0].at='2026-13-01T08:15:00Z';}],
 ['unknown activity',value=>{value.workspaceActivity[0].type='published';}],
 ['duplicate activity',value=>{value.workspaceActivity.push({...value.workspaceActivity[0]});}],
 ['activity capacity',value=>{value.workspaceActivity=[...maxActivity,{...activity,id:'activity-overflow'}];}],
];
for(const [label,mutate] of malformed){const value=structuredClone(payload());mutate(value);assert.throws(()=>validateBackup(value),undefined,label);}
const beforeInvalidRestore=[...local.values];assert.throws(()=>restoreBackup(local,payload([{...task,done:'yes'}])));assert.deepEqual([...local.values],beforeInvalidRestore);
console.log('PASS dashboard backup round-trip, old-backup defaults, ISO dates, task/activity limits and malformed-record rejection without cache changes');

const directory=await mkdtemp(join(tmpdir(),'mdd-dashboard-data-'));
let store,handler,server,aliceClient,bobClient,reloaded;let providerCalls=0;
try{
 store=createStore(directory);
 const alice=await store.register('fixture_dashboard_alice','fixture-dashboard-password-123');
 const bob=await store.register('fixture_dashboard_bob','fixture-dashboard-password-456');store.close();store=null;
 handler=createApi({directory,requireAccount:true,fetchImpl:()=>{providerCalls++;throw Error('Dashboard data checks must never call providers');}});
 server=createServer(handler);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 const call=async(path,{user,spaceId=user?.user.id,method='GET',body}={})=>{
  const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json','X-Mdd-Client':'workspace-v1',...(user?{Cookie:`mdd_session=${user.token}`}:{ }),...(spaceId?{'X-Mdd-Space':spaceId}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:response.status,data:await response.json()};
 };
 for(const name of ['workspaceTasks','workspaceActivity']){
  assert.equal((await call('/api/data/'+name,{method:'PUT',body:{revision:0,data:[]}})).status,401);
  assert.equal((await call('/api/data')).status,401);
 }
 for(const name of ['workspaceTasks','workspaceActivity']){
  const data=valid[name],saved=await call('/api/data/'+name,{user:alice,method:'PUT',body:{revision:0,data}});assert.equal(saved.status,200);assert.equal(saved.data.revision,1);
  const aliceData=await call('/api/data',{user:alice});assert.deepEqual(aliceData.data.collections[name].data,data);
  const bobData=await call('/api/data',{user:bob});assert.equal(bobData.data.collections[name].data,null,'Another account cannot read Alice dashboard records');
  assert.equal((await call('/api/data/'+name,{user:alice,method:'PUT',body:{revision:0,data}})).status,409,'Stale writes must retain revision protection');
  assert.equal((await call('/api/data/'+name,{user:bob,spaceId:alice.user.id,method:'PUT',body:{revision:0,data}})).status,412);
 }
 for(const [label,mutate] of malformed){
  const value=structuredClone(payload());mutate(value);const name=label.includes('activity')||label.includes('work id')?'workspaceActivity':'workspaceTasks';
  const rejected=await call('/api/data/'+name,{user:alice,method:'PUT',body:{revision:1,data:value[name]}});assert.equal(rejected.status,400,label);
 }
 assert.equal((await call('/api/data/unknownDashboard',{user:alice,method:'PUT',body:{revision:0,data:[]}})).status,400);
 const unchanged=(await call('/api/data',{user:alice})).data;assert.deepEqual(unchanged.collections.workspaceTasks.data,[task]);assert.deepEqual(unchanged.collections.workspaceActivity.data,[activity]);
 console.log('PASS authenticated dashboard API persistence, strict validation, revision conflicts and cross-account read/write isolation');

 const cache=memory();cache.setItem(collectionKeys.workspaceTasks,JSON.stringify([{...task,text:'LEGACY_PRIVATE_TASK'}]));cache.setItem(collectionKeys.workspaceActivity,JSON.stringify([{...activity,workId:'LEGACY_PRIVATE_WORK'}]));
 let active=alice;
 const request=async(path,body,options={})=>{
  const result=await call(path,{user:active,spaceId:options.spaceId,method:options.method||(body===undefined?'GET':'POST'),body});
  if(result.status!==200)throw Object.assign(Error(result.data.error),{status:result.status,code:result.data.code});return result.data;
 };
 aliceClient=createWorkspaceClient({storage:cache,request,spaceId:alice.user.id});await aliceClient.initialize();
 assert.deepEqual(aliceClient.entries.workspaceTasks.data,[task]);
 aliceClient.set('workspaceTasks',[{...task,done:true}]);await aliceClient.flush();assert.equal(aliceClient.state.status,'saved');
 assert.equal((await call('/api/data',{user:alice})).data.collections.workspaceTasks.data[0].done,true);
 const exported=validateBackup(workspaceBackup(aliceClient));assert.equal(exported.workspaceTasks[0].done,true);assert.deepEqual(exported.workspaceActivity,[activity]);
 reloaded=createWorkspaceClient({storage:cache,request,spaceId:alice.user.id});await reloaded.initialize();assert.equal(reloaded.entries.workspaceTasks.data[0].done,true);reloaded.stop();reloaded=null;
 active=bob;bobClient=createWorkspaceClient({storage:cache,request,spaceId:bob.user.id});assert.deepEqual(bobClient.entries.workspaceTasks.data,[]);assert.deepEqual(bobClient.entries.workspaceActivity.data,[]);await bobClient.initialize();
 const bobStorage=scopedStorage(cache,bob.user.id);restoreBackup(bobStorage,old);assert.deepEqual(collectBackup(bobStorage).workspaceTasks,[]);assert.deepEqual(collectBackup(bobStorage).workspaceActivity,[]);
 assert.ok(cache.getItem(collectionKeys.workspaceTasks).includes(task.text),'Restoring an old backup in Bob scope must not alter Alice/local cache');
 bobClient.set('workspaceTasks',[{...task,id:'task-bob',text:'Bob private task'}]);bobClient.set('workspaceActivity',[{...activity,id:'activity-bob',workId:'work-bob',type:'create'}]);await bobClient.flush();assert.equal(bobClient.state.status,'saved');
 const aliceCopy=(await call('/api/data',{user:alice})).data;assert.equal(aliceCopy.collections.workspaceTasks.data[0].id,'task-alice');assert.equal(aliceCopy.collections.workspaceActivity.data[0].workId,'work-alice');
 aliceClient.set('workspaceTasks',[{...task,text:'Alice offline after session switch'}]);await aliceClient.flush();assert.equal(aliceClient.state.status,'space-mismatch');
 const bobCopy=(await call('/api/data',{user:bob})).data;assert.equal(bobCopy.collections.workspaceTasks.data[0].text,'Bob private task');assert.equal(bobCopy.collections.workspaceActivity.data[0].workId,'work-bob');assert.equal(providerCalls,0);
 console.log('PASS workspace-client reload, account-scoped caches/backups, real task completion and stale-session synchronization stop with no provider calls');
}finally{
 aliceClient?.stop();bobClient?.stop();reloaded?.stop();store?.close();
 if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}handler?.close();await rm(directory,{recursive:true,force:true});
}
