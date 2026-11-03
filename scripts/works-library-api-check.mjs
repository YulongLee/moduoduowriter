import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {createApi} from '../server/api.mjs';
import {createStore} from '../server/store.mjs';

// All accounts, sessions and SQLite records are temporary fixtures. No private
// workspace, external service, SMS, email, model or cloud provider is used.
const directory=await mkdtemp(join(tmpdir(),'mdd-library-api-'));
let store,handler,server,base;let providerCalls=0;
const stop=async()=>{
 if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));server=null;}
 handler?.close();handler=null;
};
const start=async()=>{
 handler=createApi({directory,requireAccount:true,fetchImpl:()=>{providerCalls++;throw Error('Library checks must never call providers');}});
 server=createServer(handler);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;
};
const call=async(path,{user,spaceId=user?.user.id,method='GET',body}={})=>{
 const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json','X-Mdd-Client':'workspace-v1',...(user?{Cookie:`mdd_session=${user.token}`}:{ }),...(spaceId?{'X-Mdd-Space':spaceId}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 return {status:response.status,data:await response.json()};
};
const readWorks=async user=>{const response=await call('/api/data',{user});assert.equal(response.status,200);return response.data.collections.works;};
const saveWorks=(user,revision,data,extra={})=>call('/api/data/works',{user,method:'PUT',body:{revision,data},...extra});
try{
 store=createStore(directory);
 const alice=await store.register('fixture_library_alice','fixture-library-password-123');
 const bob=await store.register('fixture_library_bob','fixture-library-password-456');store.close();store=null;
 await start();
 assert.equal((await call('/api/data')).status,401);assert.equal((await saveWorks(undefined,0,[])).status,401);
 const legacy={id:'fixture-library-work',title:'原有作品',kind:'长篇小说',genre:'悬疑',description:'兼容没有新字段的旧作品',progress:38,updated:'今天 10:42',chapters:[{id:'fixture-chapter',title:'第一章',text:'她拆开一封旧信。'}]};
 assert.deepEqual(await readWorks(alice),{revision:0,data:null});
 let saved=await saveWorks(alice,0,[legacy]);assert.equal(saved.status,200);assert.equal(saved.data.revision,1);
 let current=await readWorks(alice);assert.equal(current.revision,1);assert.deepEqual(current.data,[legacy]);
 assert.equal(Object.hasOwn(current.data[0],'status'),false);assert.equal(Object.hasOwn(current.data[0],'targetWords'),false);
 console.log('PASS authenticated legacy work GET/PUT preserves old records without inventing new status or goals');

 const configured={...legacy,status:'serializing',targetWords:80000};
 saved=await saveWorks(alice,current.revision,[configured]);assert.equal(saved.status,200);assert.equal(saved.data.revision,2);
 current=await readWorks(alice);assert.deepEqual(current.data,[configured]);
 await stop();await start();current=await readWorks(alice);
 assert.equal(current.revision,2);assert.deepEqual(current.data,[configured],'Explicit metadata must survive a real API/store restart');
 const {targetWords:removedTarget,...withoutTarget}=configured;
 assert.equal(removedTarget,80000);
 saved=await saveWorks(alice,current.revision,[withoutTarget]);assert.equal(saved.status,200);
 current=await readWorks(alice);assert.equal(current.revision,3);assert.equal(Object.hasOwn(current.data[0],'targetWords'),false);assert.equal(current.data[0].status,'serializing');
 const baseline=structuredClone(current);
 console.log('PASS actual SQLite state/goal persistence, API restart and explicit goal removal without a null placeholder');

 for(const change of [
  {status:'已完结'},{status:'unknown'},{status:null},{status:123},
  {targetWords:1.5},{targetWords:'80000'},{targetWords:null},{targetWords:0},{targetWords:-1},{targetWords:100000001},
 ]){
  const response=await saveWorks(alice,baseline.revision,[{...withoutTarget,...change}]);assert.equal(response.status,400,JSON.stringify(change));
  assert.deepEqual(await readWorks(alice),baseline,'A rejected metadata update must not change data or revision');
 }
 const stale=await saveWorks(alice,0,[{...withoutTarget,status:'completed',targetWords:100000000}]);assert.equal(stale.status,409);assert.deepEqual(await readWorks(alice),baseline);
 console.log('PASS malformed states and decimal/string/null/nonpositive/oversized goals rejected without changing stored records or revision');

 assert.deepEqual(await readWorks(bob),{revision:0,data:null},'Another account must not read Alice works');
 const cross=await saveWorks(bob,baseline.revision,[{...withoutTarget,title:'Attempt to replace Alice work'}],{spaceId:alice.user.id});assert.equal(cross.status,412);assert.deepEqual(await readWorks(alice),baseline);
 const bobWork={...legacy,title:'Bob owns a separate same-id work',status:'completed',targetWords:100000000};
 const own=await saveWorks(bob,0,[bobWork]);assert.equal(own.status,200);assert.deepEqual((await readWorks(bob)).data,[bobWork]);assert.deepEqual(await readWorks(alice),baseline);
 assert.equal(providerCalls,0);
 console.log('PASS account-scoped metadata with cross-space writes rejected, same-id works isolated and zero provider calls');
}finally{
 store?.close();await stop();await rm(directory,{recursive:true,force:true});
}
