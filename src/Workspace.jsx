import React,{createContext,useContext,useEffect,useRef,useState} from 'react';
import { Cloud, RefreshCw } from 'lucide-react';
import {createWorkspaceClient} from './workspace';
import {initialWorks} from './data';
import {requestApi} from './Generation';
import {readStoredArray,writeStoredValue} from './storage';
import {useAccount} from './Account';
const Context=createContext(null);
export function WorkspaceProvider({children}) {
 const account=useAccount();const spaceId=account?.spaceId||'local';
 const [snapshot,setSnapshot]=useState({status:'loading',error:'',conflicts:0}),[,tick]=useState(0);
 const clientRef=useRef();if(!clientRef.current)clientRef.current=createWorkspaceClient({storage:globalThis.localStorage,request:requestApi,...(account?{spaceId}:{}),defaults:{works:initialWorks,favorites:['ideas','polish']},onChange:status=>{setSnapshot(status);tick(v=>v+1);}});
 const client=clientRef.current;
 useEffect(()=>{client.initialize();const refresh=()=>client.refresh().catch(()=>{});const interval=setInterval(refresh,10000);window.addEventListener('focus',refresh);return()=>{clearInterval(interval);window.removeEventListener('focus',refresh);client.stop();};},[]);
 return <Context.Provider value={{client,spaceId,...snapshot}}>{snapshot.status==='loading'?<div className="account-gate"><p role="status">正在载入本机文稿…</p></div>:children}</Context.Provider>;
}
export function useCollection(name,fallback=[]) {
 const workspace=useContext(Context);const key=`mdd-${name==='video'?'video':name}-v1`;
 const [local,setLocal]=useState(()=>workspace?fallback:readStoredArray(globalThis.localStorage,key,fallback)),[error,setError]=useState(false);
 const set=updater=>{if(workspace){const cached=workspace.client.set(name,updater);setError(!cached);return cached;}const next=typeof updater==='function'?updater(local):updater;setLocal(next);const cached=writeStoredValue(globalThis.localStorage,key,next);setError(!cached);return cached;};
 return [workspace?workspace.client.entries[name].data:local,set,error];
}
export function useWorkspace(){return useContext(Context);}
export function WorkspaceStatus(){const workspace=useContext(Context);if(!workspace)return null;return <div className={`workspace-save-status ${workspace.status==='offline'||workspace.status==='space-mismatch'?'offline':''}`} role="status"><Cloud size={13}/><span>{workspace.status==='saved'?'已保存到本机':workspace.status==='saving'||workspace.status==='pending'?'正在保存…':workspace.status==='offline'?'离线缓存中':workspace.status==='space-mismatch'?'账号已切换 · 同步已停止':'正在连接存储…'}</span>{workspace.error&&<small>{workspace.error}</small>}{workspace.conflicts>0&&<small>并发修改已保留为副本</small>}{workspace.status==='offline'&&<button onClick={()=>workspace.client.initialize()}><RefreshCw size={12}/>重试</button>}</div>;}
