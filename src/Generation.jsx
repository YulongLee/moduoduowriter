import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Settings2, LoaderCircle, X } from 'lucide-react';
const GenerationContext=createContext(null);
export async function requestApi(url,body,{method='POST',signal}={}) {
 let response;try{response=await fetch(url,{method,headers:{'Content-Type':'application/json','X-Mdd-Client':'workspace-v1'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal});}catch(e){if(e.name==='AbortError')throw new Error('生成已取消');throw new Error('本地服务未连接，请确认网站服务正在运行');}
 let data;try{data=await response.json();}catch{throw new Error('本地服务尚未就绪，请重启网站服务');}
 if(!response.ok)throw Object.assign(new Error(data.error||'服务暂时不可用，请重试'),{status:response.status});return data;
}
export function GenerationProvider({children}) {
 const [mode,setModeValue]=useState(()=>{try{return localStorage.getItem('mdd-ai-mode')==='ai'?'ai':'demo';}catch{return 'demo';}});
 const [settings,setSettings]=useState(null);
 const refresh=async()=>{try{const data=await requestApi('/api/settings',undefined,{method:'GET'});setSettings(data);try{if(localStorage.getItem('mdd-ai-mode')===null&&data.configured&&data.defaultMode==='ai')setModeValue('ai');}catch{}return data;}catch{return null;}};
 useEffect(()=>{refresh();},[]);
 const setMode=value=>{setModeValue(value);try{localStorage.setItem('mdd-ai-mode',value);}catch{}};
 return <GenerationContext.Provider value={{mode,setMode,settings,refresh}}>{children}</GenerationContext.Provider>;
}
export function useGeneration() {
 const service=useContext(GenerationContext);
 const mode=service?.mode||'demo';
 const active=useRef(null);const alive=useRef(true);const [error,setError]=useState('');const [source,setSource]=useState('demo');
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;active.current?.abort();};},[]);
 const cancel=()=>active.current?.abort();
 const generate=async(payload,demo)=>{
  if(active.current)throw new Error('已有生成任务进行中');
  const controller=new AbortController();active.current=controller;setError('');
  try {
   let result;
   if(mode==='ai')result=await requestApi('/api/generate',{...payload,requestId:globalThis.crypto?.randomUUID?.()||`task-${Date.now()}-${Math.random().toString(36).slice(2)}`},{signal:controller.signal});
   else {await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,100);controller.signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new Error('生成已取消'));},{once:true});});result=typeof demo==='function'?demo():{text:demo,source:'demo'};}
   if(controller.signal.aborted||!alive.current)throw new Error('生成已取消');
   setSource(result.source||mode);return result;
  }catch(e){if(alive.current)setError(e.message);throw e;}finally{active.current=null;}
 };
 return {...service,mode,source,error,generate,cancel};
}
export function GenerationStatus({generation,busy=false,onSettings}) {
 return <div className="generation-status"><span className="soft-label">{generation.mode==='ai'?'真实 AI 模式':'示例模式'}</span>{generation.mode==='ai'&&generation.settings?.model&&<small className="generation-model">{generation.settings.model}</small>}{onSettings&&<button className="text-button" onClick={onSettings}><Settings2 size={13}/>配置</button>}{busy&&<button className="text-button" onClick={generation.cancel}><X size={13}/>取消生成</button>}{generation.error&&<p role="alert">{generation.error}</p>}</div>;
}
