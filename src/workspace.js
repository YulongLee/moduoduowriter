import {newId} from './works.js';
export const collectionKeys={works:'mdd-works-v1',favorites:'mdd-favorites-v1',submissions:'mdd-submissions-v1',reading:'mdd-reading-v1',workflows:'mdd-workflows-v1',video:'mdd-video-v1'};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function mergeCollection(name,base,local,remote) {
 if(name==='favorites'){const values=new Set([...base,...local,...remote]);return [...values].filter(value=>local.includes(value)===base.includes(value)?remote.includes(value):local.includes(value));}
 const ids=[...new Set([...local,...remote,...base].map(item=>item.id))],result=[];
 for(const id of ids){const before=base.find(v=>v.id===id),mine=local.find(v=>v.id===id),theirs=remote.find(v=>v.id===id);if(same(mine,before)){if(theirs)result.push(theirs);continue;}if(same(theirs,before)||same(mine,theirs)){if(mine)result.push(mine);continue;}if(theirs)result.push(theirs);if(mine)result.push({...mine,id:newId(),...(name==='works'?{title:`${mine.title}（冲突副本）`}:name==='workflows'?{flowId:mine.flowId||mine.id}:{})});}
 return result;
}
export function workspaceBackup(client){return {format:'mdd-workspace',version:1,exportedAt:new Date().toISOString(),...Object.fromEntries(Object.entries(client.entries).map(([name,entry])=>[name,entry.data]))};}
export function createWorkspaceClient({storage,request,defaults={},onChange=()=>{}}) {
 let pending={};try{pending=JSON.parse(storage.getItem('mdd-sync-pending-v1')||'{}');}catch{}
 const persistPending=()=>{try{storage.setItem('mdd-sync-pending-v1',JSON.stringify(Object.fromEntries(Object.entries(entries).map(([name,entry])=>[name,entry.dirty]))));}catch{}};
 const entries=Object.fromEntries(Object.entries(collectionKeys).map(([name,key])=>{let data=defaults[name]||[];try{const raw=storage.getItem(key);if(raw!==null){const value=JSON.parse(raw);if(!Array.isArray(value))throw Error();data=value;}}catch{}return [name,{data,base:[],revision:0,dirty:pending[name]===true,version:0}];}));
 let ready=false,active=false,stopped=false,retryTimer,flushTimer;
 const state={status:'loading',error:'',conflicts:0};
 const emit=()=>onChange({...state});
 const cache=(name,value)=>{try{storage.setItem(collectionKeys[name],JSON.stringify(value));return true;}catch{state.error='浏览器缓存空间不足，正在保留本机服务端副本；请导出备份';return false;}};
 const flush=async()=>{
  if(!ready||active||stopped)return;active=true;state.status='saving';emit();
  try{
   for(const [name,entry] of Object.entries(entries)){
    let attempts=0;while(entry.dirty&&attempts++<4){const version=entry.version,data=entry.data;try{const saved=await request(`/api/data/${name}`,{revision:entry.revision,data},{method:'PUT'});entry.revision=saved.revision;entry.base=data;if(entry.version===version)entry.dirty=false;persistPending();}catch(e){if(e.status!==409)throw e;const latest=await request('/api/data',undefined,{method:'GET'});const remote=latest.collections[name];const merged=mergeCollection(name,entry.base,entry.data,remote.data||[]);state.conflicts+=merged.filter(item=>item.title?.endsWith('（冲突副本）')).length;entry.data=merged;entry.base=remote.data||[];entry.revision=remote.revision;entry.version++;cache(name,merged);emit();}}
   }
   state.status=Object.values(entries).some(e=>e.dirty)?'pending':'saved';state.error='';
  }catch(e){state.status='offline';state.error=e.message||'暂未保存到本机服务端';}
  finally{active=false;emit();if(Object.values(entries).some(e=>e.dirty)&&!stopped){clearTimeout(retryTimer);retryTimer=setTimeout(flush,state.status==='offline'?5000:100);}}
 };
 const initialize=async()=>{
  try{const remote=await request('/api/data',undefined,{method:'GET'});if(stopped)return;for(const [name,entry] of Object.entries(entries)){const row=remote.collections[name];if(row.data===null){entry.base=[];entry.dirty=true;}else if(entry.dirty){entry.data=mergeCollection(name,entry.base,entry.data,row.data);entry.base=row.data;}else{entry.data=row.data;entry.base=row.data;}entry.revision=row.revision;cache(name,entry.data);}ready=true;state.status='saved';emit();await flush();}
  catch(e){state.status='offline';state.error=e.message;emit();if(!stopped)retryTimer=setTimeout(initialize,5000);}
 };
 return {
  entries,state,initialize,flush,
  set(name,updater){const entry=entries[name],next=typeof updater==='function'?updater(entry.data):updater;entry.data=next;entry.dirty=true;entry.version++;persistPending();const cached=cache(name,next);state.status='pending';emit();if(ready){clearTimeout(flushTimer);flushTimer=setTimeout(flush,350);}return cached;},
  async refresh(){if(!ready||active)return;const remote=await request('/api/data',undefined,{method:'GET'});if(stopped)return;for(const [name,row] of Object.entries(remote.collections)){const entry=entries[name];if(!entry.dirty&&row.revision>entry.revision){entry.data=row.data;entry.base=row.data;entry.revision=row.revision;cache(name,row.data);}}emit();},
  stop(){stopped=true;clearTimeout(retryTimer);clearTimeout(flushTimer);}
 };
}
