import {useEffect,useRef,useState} from 'react';
import {requestApi} from './Generation';
import {activePlan,balanceOf} from './billing';

const emptyAccount = {version:1,enabled:false,member:null,buckets:[],orders:[],ledger:[]};
const requestId = () => globalThis.crypto?.randomUUID?.() || `billing-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const errorCode = error => error.code || (error.status === 402 ? 'insufficient' : 'server');

export function useServerBilling({generationMode='demo',spaceId}={}) {
  const [snapshot,setSnapshot]=useState({account:emptyAccount,mode:'server-demo',paymentConfigured:false});
  const [ready,setReady]=useState(false),[storageError,setStorageError]=useState(''),[busy,setBusy]=useState(false);
  const [destinationTab,setDestinationTab]=useState('plans'),[navigationKey,setNavigationKey]=useState(0);
  const current=useRef(snapshot),available=useRef(false),alive=useRef(true),sequence=useRef(0),applied=useRef(0),mutations=useRef(0);
  const markError=error=>{available.current=false;if(alive.current){setReady(false);setStorageError(error.message||'账本暂未连接，请重试。');}};
  const accept=(result,id)=>{
    const account=result?.account;
    if(!account||!Array.isArray(account.buckets)||!Array.isArray(account.ledger)||!Array.isArray(account.orders))throw new Error('账本响应不完整，请重新连接。');
    const revision=Number.isSafeInteger(result.revision)?result.revision:null;
    if(revision!==null&&current.current.revision!==undefined&&revision<current.current.revision)return result;
    if(revision===null&&id<applied.current)return result;
    applied.current=Math.max(applied.current,id);current.current={account,...(revision!==null?{revision}:{}),mode:result.mode||'server-demo',paymentConfigured:result.paymentConfigured===true};available.current=true;
    if(alive.current){setSnapshot(current.current);setReady(true);setStorageError('');}
    return result;
  };
  const request=async(path,body,options)=>{const id=++sequence.current;try{return accept(await requestApi(path,body,{...options,...(spaceId?{spaceId}:{})}),id);}catch(error){if(id>=applied.current){if(!error.status||error.status>=500||error.status===401||error.status===403||error.status===412)markError(error);else if(alive.current&&error.status!==402)setStorageError(error.message);}throw error;}};
  const refresh=async()=>{try{await request('/api/billing',undefined,{method:'GET'});return true;}catch{return false;}};
  useEffect(()=>{alive.current=true;refresh();const timer=setInterval(refresh,60000);return()=>{alive.current=false;clearInterval(timer);};},[]);
  const go=tab=>{setDestinationTab(tab||'plans');setNavigationKey(value=>value+1);if(globalThis.location)globalThis.location.hash='membership';};
  const mutate=async(path,body)=>{
    if(!available.current)return false;
    mutations.current++;if(alive.current)setBusy(true);
    try{await request(path,body);return true;}catch{return false;}finally{mutations.current--;if(alive.current)setBusy(mutations.current>0);}
  };
  const purchase=(offer,id)=>mutate('/api/billing/purchase',{offer,requestId:id});
  const setEnabled=enabled=>mutate('/api/billing/settings',{enabled});
  const reset=()=>mutate('/api/billing/reset',{});
  const runTask=async(quote,producer,{force=false}={})=>{
    if(!available.current)return {ok:false,code:'server',message:'账本尚未连接，任务没有开始。请重新连接后再试。'};
    // Real generation owns its reservation and settlement at /api/generate.
    if(generationMode==='ai'&&!force){
      let failure;
      try{await producer();}catch(error){failure=error;}
      const refreshed=await refresh();
      if(failure)return {ok:false,code:errorCode(failure),message:failure.message||'任务未完成，请重试。'};
      return {ok:true,message:refreshed?'':'内容已生成，账本暂未刷新，请重新连接以核对余额。'};
    }
    if(!current.current.account.enabled&&!force){
      try{await producer();return {ok:true};}catch(error){return {ok:false,code:'failed',message:error.message||'任务未完成，请重试。'};}
    }
    let reserved;
    try{reserved=await request('/api/billing/reservations',{request:quote.request,requestId:requestId()});if(typeof reserved.ticket!=='string'||!reserved.ticket){const error=new Error('服务未确认额度预留，任务没有开始。');markError(error);throw error;}}
    catch(error){return {ok:false,code:errorCode(error),message:error.message||'额度预留未完成，任务没有开始。'};}
    let failure;
    try{await producer();}catch(error){failure=error;}
    try{
      await request(`/api/billing/reservations/${encodeURIComponent(reserved.ticket)}`,{success:!failure});
      return failure?{ok:false,code:'failed',message:`${failure.message||'任务未完成'}；模拟墨点已退回。`}:{ok:true};
    }catch(error){
      return {ok:!failure,code:'server',message:failure?'任务未完成，服务端结算状态尚未确认，请重新连接后核对账本。':'内容已生成，服务端结算状态尚未确认，请重新连接后核对账本。'};
    }
  };
  return {...snapshot,account:snapshot.account,balance:balanceOf(snapshot.account),plan:activePlan(snapshot.account),ready,busy,server:true,storageError,destinationTab,navigationKey,go,runTask,purchase,setEnabled,reset,refresh};
}
