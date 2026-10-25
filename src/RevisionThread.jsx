import React,{useState} from 'react';
import {useCollection} from './Workspace.jsx';
import './revision.css';

export function useRevisionThread(scope) {
 const [records,setRecords,saveError]=useCollection('planningDrafts',[]);
 const record=records.find(item=>item.id===scope&&item.type==='revision-thread')||{id:scope,type:'revision-thread',prompt:'',versions:[],currentId:null,continuing:false};
 const update=patch=>setRecords(previous=>{
  const current=previous.find(item=>item.id===scope)||record;
  const next={...current,...(typeof patch==='function'?patch(current):patch),updatedAt:new Date().toISOString()};
  return [next,...previous.filter(item=>item.id!==scope)];
 });
 const candidate=record.versions.find(item=>item.id===record.currentId)||record.versions.at(-1);
 return {...record,candidate,update,saveError,beginFollowup:(text=candidate?.text)=>update(current=>({continuing:true,prompt:'',versions:current.versions.map(item=>item.id===(current.currentId||candidate?.id)?{...item,text}:item)})),addCandidate:(text,details={})=>update(current=>{
  const id=(current.versions.at(-1)?.id||0)+1;
  return {versions:[...current.versions,{id,text,createdAt:new Date().toISOString(),...details}],currentId:id,continuing:false};
 }),editCandidate:text=>update(current=>({versions:current.versions.map(item=>item.id===(current.currentId||candidate?.id)?{...item,text}:item)}))};
}

export function RevisionHistory({thread,disabled=false}) {
 const [show,setShow]=useState(false);
 if(!thread.versions.length)return null;
 return <div className="revision-history"><button className="text-button" disabled={disabled} onClick={()=>setShow(!show)}>候选版本 · {thread.versions.length} 轮{show?'（收起）':'（回看）'}</button>{show&&<div className="revision-version-list">{thread.versions.map(item=><article key={item.id}><div><strong>第 {item.id} 稿{item.id===thread.candidate?.id?' · 当前候选':''}</strong><p>{item.requirement||'首次生成'}</p></div><button className="text-button" disabled={disabled||item.id===thread.candidate?.id} onClick={()=>thread.update({currentId:item.id,continuing:false})}>恢复为候选</button><details><summary>查看文字</summary><pre>{item.text}</pre></details></article>)}</div>}</div>;
}
