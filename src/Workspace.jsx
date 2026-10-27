import React,{createContext,useContext,useEffect,useRef,useState} from 'react';
import {ChevronDown,Cloud,RefreshCw} from 'lucide-react';
import {workspaceFeedback} from './workspaceFeedback.js';
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
 const localRef=useRef(local);localRef.current=local;
 const set=updater=>{if(workspace){const cached=workspace.client.set(name,updater);setError(!cached);return cached;}const next=typeof updater==='function'?updater(localRef.current):updater;localRef.current=next;setLocal(next);const cached=writeStoredValue(globalThis.localStorage,key,next);setError(!cached);return cached;};
 return [workspace?workspace.client.entries[name].data:local,set,error];
}
export function useWorkspace(){return useContext(Context);}
export function WorkspaceStatusView({workspace,compact=false}) {
 const feedback=workspaceFeedback(workspace),detailsRef=useRef(null);
 if(!feedback)return null;
 const content=<>{feedback.detail&&<p>{feedback.detail}</p>}{feedback.retry&&<button type="button" onClick={()=>workspace.client?.initialize()}><RefreshCw size={13}/>重新连接</button>}</>;
 return <div className={`workspace-save-status status-${feedback.tone}${compact?' compact':''}${feedback.status==='offline'||feedback.status==='space-mismatch'?' offline':''}`} role="status" aria-label="保存状态" aria-live="polite" data-save-state={feedback.status}>
  <Cloud size={14} aria-hidden="true"/><span className="workspace-save-label">{feedback.label}</span>
  {compact&&(feedback.detail||feedback.retry)?<details className="workspace-status-details" ref={detailsRef} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();if(detailsRef.current){detailsRef.current.open=false;detailsRef.current.querySelector('summary')?.focus();}}}}><summary aria-label="查看保存详情"><ChevronDown size={14}/></summary><div className="workspace-status-popover"><strong>保存详情</strong>{content}</div></details>:!compact&&(feedback.detail||feedback.retry)?<div className="workspace-status-message">{content}</div>:null}
 </div>;
}
export function WorkspaceStatus({compact=false}) {const workspace=useContext(Context);return <WorkspaceStatusView workspace={workspace} compact={compact}/>;}
