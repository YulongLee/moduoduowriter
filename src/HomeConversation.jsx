import React,{useCallback,useEffect,useId,useRef,useState} from 'react';
import {ArrowRight,BookOpen,ChevronDown,Copy,Download,LoaderCircle,Plus,Send,Sparkles,Trash2,WandSparkles,X} from 'lucide-react';
import {Brand} from './Art';
import {requestApi,useGeneration} from './Generation';
import {TaskMeter,useTaskMeter} from './Billing.jsx';
import {quoteTask} from './billing';
import {useCollection} from './Workspace.jsx';
import {ContextPicker} from './StoryMemory.jsx';
import {buildStoryContext} from './storyMemory.js';
import {tools} from './data';
import {buildConversationHistory,beginConversationTurn,completeConversationTurn,conversationText,createConversation,failConversationTurn,recoverConversations,restartConversationTurn,saveConversation,updateConversation} from './conversation.js';
import {conversationExamples,conversationDemoReply} from './conversationExamples.js';
import './home-conversation.css';

const makeId=()=>globalThis.crypto?.randomUUID?.()||`chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
const stamp=()=>new Date().toISOString();
const statuses={sending:'正在整理回复…',completed:'',failed:'本轮未完成',cancelled:'已停止接收',interrupted:'上次未收到完整结果'};
const defaultReferences=work=>{
 if(!work)return [];
 const chapter=work.chapters?.find(value=>value.id===work.lastEditedChapterId)||work.chapters?.[0];
 return [work.outline?.trim()?'work:outline':null,work.characters?.trim()?'work:characters':null,chapter?.text?.trim()?`chapter:${chapter.id}`:null].filter(Boolean);
};
const latestFor=(records,workId)=>records.filter(item=>item.workId===workId).sort((left,right)=>String(right.updatedAt).localeCompare(String(left.updatedAt)))[0];
const errorText=error=>error?.message||'本轮没有完成，请稍后恢复结果或重试。';
const quoteForRequest=request=>quoteTask({taskId:'chat',model:request.mode,inputChars:JSON.stringify({prompt:request.prompt||'',context:request.context||{},previous:{}}).length,outputChars:Math.min(4000,Math.max(300,Number(request.target)||1000))});

export function HomeConversation({works=[],work=null,setModal,notify=()=>{},appearance='default',initialPrompt=''}) {
 const [records,setRecords,saveError]=useCollection('conversations',[]),generation=useGeneration();
 const recordsRef=useRef(records),setterRef=useRef(setRecords),generationRef=useRef(generation),alive=useRef(true),running=useRef(null),restoring=useRef(null),viewToken=useRef(0),draftTimer=useRef(null),draftPending=useRef(null),inputRef=useRef(null),logRef=useRef(null),heroControlsRef=useRef(null);
 recordsRef.current=records;setterRef.current=setRecords;generationRef.current=generation;
 const available=works.filter(item=>item&&!item.deletedAt),initialWorkId=work?.id||'';
 const [scopeId,setScopeId]=useState(initialWorkId);
 const seed=typeof initialPrompt==='string'?initialPrompt.slice(0,4000):'';
 const [scratch,setScratch]=useState(()=>createConversation({workId:initialWorkId,referenceIds:defaultReferences(work),draft:seed}));
 const [activeId,setActiveId]=useState(()=>seed?'':latestFor(records,initialWorkId)?.id||'');
 const session=records.find(item=>item.id===activeId)||scratch;
 const associated=available.find(item=>item.id===session.workId)||null;
 const orphan=Boolean(session.workId&&!associated);
 const [input,setInput]=useState(()=>seed||latestFor(records,initialWorkId)?.draft||''),[referenceIds,setReferenceIds]=useState(()=>seed?defaultReferences(work):latestFor(records,initialWorkId)?.referenceIds||defaultReferences(work));
 const [busy,setBusy]=useState(false),[cancelling,setCancelling]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[deleteConfirm,setDeleteConfirm]=useState(false),[persistenceError,setPersistenceError]=useState(false),[checkedTask,setCheckedTask]=useState(null);
 const inputValue=useRef(input),sessionRef=useRef(session);inputValue.current=input;sessionRef.current=session;
 const contextId=useId(),meterId=useId();
 const history=buildConversationHistory(session,{maxTurns:8,budget:16000});
 const chapter=associated?.chapters?.find(value=>value.id===associated.lastEditedChapterId)||associated?.chapters?.[0];
 const references=associated?buildStoryContext(associated,{chapterId:chapter?.id,referenceIds,budget:12000}):{context:{},inputChars:0,notice:''};
 const preparedContext={...references.context,...(session.workId?{workId:session.workId,title:associated?.title||'',genre:associated?.genre||'',kind:associated?.kind||'',...(chapter?{chapterId:chapter.id}:{})}:{}),history:history.history};
 const inputChars=JSON.stringify({prompt:input.trim(),context:preparedContext,previous:{}}).length;
 const meter=useTaskMeter('chat',{inputChars,outputChars:1000});
 const frozenRequest=running.current?.request||session.turns.find(turn=>turn.requestId===checkedTask?.requestId)?.request;
 const displayedMeter=frozenRequest?{...meter,quote:quoteForRequest(frozenRequest),model:frozenRequest.mode,outputChars:frozenRequest.target}:meter;

 const write=useCallback(producer=>{
  const saved=setterRef.current(previous=>{
   const next=producer(previous);recordsRef.current=next;return next;
  });
  if(alive.current)setPersistenceError(saved===false);return saved!==false;
 },[]);
 const patch=useCallback((id,updater)=>write(previous=>updateConversation(previous,id,updater)),[write]);
 const flushDraft=useCallback(()=>{
  clearTimeout(draftTimer.current);const pending=draftPending.current;
  if(!pending)return true;
  const saved=write(previous=>{
   const existing=previous.find(item=>item.id===pending.session.id)||pending.session;
   return saveConversation(previous,{...existing,draft:pending.draft,referenceIds:pending.referenceIds,updatedAt:stamp()});
  });
  if(saved&&draftPending.current===pending)draftPending.current=null;
  return saved;
 },[write]);
 const queueDraft=(value,refs=referenceIds)=>{
  setCheckedTask(null);
  inputValue.current=value;setInput(value);
  draftPending.current={session:sessionRef.current,draft:value,referenceIds:[...refs]};
  clearTimeout(draftTimer.current);draftTimer.current=setTimeout(()=>{try{flushDraft();}catch(value){if(alive.current)setError(errorText(value));}},400);
 };
 const chooseReferences=value=>{setReferenceIds(value);queueDraft(inputValue.current,value);};
 const chooseSession=(item,newWorkId)=>{
  viewToken.current++;
  setActiveId(item?.id||'');
  const selectedWork=available.find(value=>value.id===(item?.workId??newWorkId));
  const next=item||createConversation({workId:newWorkId||'',referenceIds:defaultReferences(selectedWork)});
  if(!item)setScratch(next);
  setScopeId(next.workId);inputValue.current=next.draft||'';setInput(next.draft||'');setReferenceIds(next.referenceIds||[]);setError('');setNotice('');setDeleteConfirm(false);setCheckedTask(null);
 };
 const stop=useCallback((status='cancelled',message='本次接收已停止。结果未知时，请先恢复上次结果。')=>{
  const checking=restoring.current;
  if(checking){checking.cancelled=true;checking.controller.abort();restoring.current=null;if(alive.current){setBusy(false);setCancelling(false);setNotice('已停止检查上次结果，没有重新生成。');}}
  const task=running.current;if(!task)return;
  task.cancelled=true;generationRef.current.cancel();
  try{patch(task.sessionId,value=>failConversationTurn(value,task.turnId,{status,error:message}));}catch{}
  if(alive.current)setCancelling(true);
 },[patch]);
 const previousWork=useRef(initialWorkId);
 useEffect(()=>{
  if(previousWork.current===initialWorkId)return;
  previousWork.current=initialWorkId;
  stop('interrupted','作品已切换，本轮停止接收。可回到原对话恢复结果。');
  try{if(!flushDraft()){setError('当前草稿尚未缓存，请先导出对话或恢复保存后再切换讨论作品。');return;}}catch(value){setError(errorText(value));return;}
  chooseSession(latestFor(recordsRef.current,initialWorkId),initialWorkId);
 },[initialWorkId]);
 useEffect(()=>{
  alive.current=true;
  if(seed)draftPending.current={session:sessionRef.current,draft:seed,referenceIds:[...sessionRef.current.referenceIds]};
  const recovered=recoverConversations(recordsRef.current);
  if(JSON.stringify(recovered)!==JSON.stringify(recordsRef.current))write(()=>recovered);
  return()=>{
   try{flushDraft();}catch{}
   stop('interrupted','页面已离开，本轮停止接收。重新打开后可手动恢复结果。');
   alive.current=false;viewToken.current++;clearTimeout(draftTimer.current);
  };
 },[]);
 useEffect(()=>{
  const element=logRef.current;if(element&&(busy||element.scrollHeight-element.scrollTop-element.clientHeight<100))element.scrollTop=element.scrollHeight;
 },[session.turns.length,session.turns.at(-1)?.assistantText,busy]);

 const applyResult=(sessionId,turnId,result)=>{
  if(typeof result?.text!=='string'||!result.text.trim())throw new Error('没有收到可用的回复，请先恢复结果再决定是否重试。');
  patch(sessionId,value=>completeConversationTurn(value,turnId,{...result,text:result.text}));
 };
 const runTurn=async(thread,turn)=>{
  if(running.current)return;
  const task={sessionId:thread.id,turnId:turn.id,requestId:turn.requestId,request:turn.request,cancelled:false};running.current=task;
  setBusy(true);setCancelling(false);setError('');setNotice('');
  let started=false,completed=false;
  try{
   const producer=async()=>{
    if(task.cancelled||running.current!==task||!alive.current)throw new Error('生成已取消');
    started=true;
    try{
     const result=await generationRef.current.generate(turn.request,()=>({text:conversationDemoReply(turn.userText),source:'demo'}));
     if(task.cancelled||running.current!==task||!alive.current)throw new Error('生成已取消');
     applyResult(thread.id,turn.id,result);completed=true;
    }catch(value){
     if(!task.cancelled&&running.current===task&&alive.current){
      patch(thread.id,current=>failConversationTurn(current,turn.id,{status:value.status?'failed':'interrupted',error:errorText(value)}));setError(errorText(value));
     }
     throw value;
    }
   };
   const quote=quoteForRequest(turn.request);
   const result=meter.billing?await meter.billing.runTask(quote,producer):await producer().then(()=>({ok:true}));
   if(!started&&!task.cancelled&&alive.current){const message=result?.message||'任务没有开始，请查看用量说明或重新连接账本。';patch(thread.id,current=>failConversationTurn(current,turn.id,{status:'failed',error:message}));setError(message);}
   else if(result?.message&&!task.cancelled&&alive.current){if(result.ok)setNotice(result.message);else setError(result.message);}
  }catch(value){if(!task.cancelled&&alive.current)setError(errorText(value));}
  finally{
   if(running.current===task){running.current=null;if(alive.current){setBusy(false);setCancelling(false);if(completed)inputRef.current?.focus();}}
  }
 };
 const send=async event=>{
  event?.preventDefault?.();if(running.current||restoring.current||busy||orphan)return;
  const prompt=inputValue.current.trim();if(!prompt){setError('先写下你想讨论的故事或问题。');inputRef.current?.focus();return;}
  if(prompt.length>4000){setError('每条消息最多 4,000 字符，请分次讨论。');return;}
  try{
   if(!flushDraft())throw new Error('对话尚未缓存，任务没有开始。请先导出对话或恢复保存。');
   const base=recordsRef.current.find(item=>item.id===sessionRef.current.id)||{...sessionRef.current,draft:prompt,referenceIds};
   const bundle=associated?buildStoryContext(associated,{chapterId:chapter?.id,referenceIds,budget:12000}):{context:{},notice:''};
   const prior=buildConversationHistory(base,{maxTurns:8,budget:16000});
   const requestId=makeId();
   const request={task:'chat',prompt,context:{...bundle.context,...(base.workId?{workId:base.workId,title:associated?.title||'',genre:associated?.genre||'',kind:associated?.kind||'',...(chapter?{chapterId:chapter.id}:{})}:{}),history:prior.history},target:meter.outputChars,mode:meter.model,requestId};
   const next=beginConversationTurn({...base,referenceIds},{userText:prompt,request,requestId});
   const turn=next.turns.at(-1);
   if(!write(previous=>saveConversation(previous,next))){
    const halted={...failConversationTurn(next,turn.id,{status:'interrupted',error:'本轮未能缓存，任务没有开始。请恢复保存后再继续。'}),draft:inputValue.current};
    write(previous=>saveConversation(previous,halted));setActiveId(next.id);
    throw new Error('本轮未能缓存，尚未开始生成。请先恢复保存。');
   }
   setActiveId(next.id);inputValue.current='';setInput('');draftPending.current=null;
   await runTurn(next,turn);
  }catch(value){setError(errorText(value));}
 };
 const recover=async(turn,explicitContinue=false)=>{
  if(running.current||restoring.current||busy||!turn.request)return;
  setBusy(true);setError('');setNotice('');
  const sessionId=session.id,operation={sessionId,token:viewToken.current,controller:new AbortController(),cancelled:false};
  restoring.current=operation;
  const stillCurrent=()=>alive.current&&!operation.cancelled&&restoring.current===operation&&viewToken.current===operation.token;
  try{
   let task;
   try{task=await requestApi(`/api/tasks/${encodeURIComponent(turn.requestId)}`,undefined,{method:'GET',signal:operation.controller.signal});}catch(value){if(!stillCurrent())return;if(value.status!==404)throw new Error('尚未确认上次任务的状态，本次没有重新生成。请恢复连接后再试。');}
   if(!stillCurrent())return;
   if(task?.task&&task.task!=='chat')throw new Error('生成记录与本次对话不一致，未采用结果。');
   if(task&&JSON.stringify(task.request)!==JSON.stringify(turn.request))throw new Error('生成记录与本轮原始问题或引用资料不一致，未采用结果，也没有重新生成。');
   if(task?.status==='succeeded'){
    if(typeof task.result?.text!=='string'||!task.result.text.trim())throw new Error('生成记录尚未包含可用回复，本次没有重新生成。');
    patch(sessionId,current=>completeConversationTurn(restartConversationTurn(current,turn.id),turn.id,task.result));
    setCheckedTask(null);setNotice('已从生成记录恢复回复，没有重新生成。');return;
   }
   if(task?.status==='running'){setNotice('上次任务仍在处理。本次没有重新发送，请稍后手动恢复结果。');return;}
   if(task&&!['failed','cancelled','interrupted'].includes(task.status))throw new Error('上次任务状态尚未确认，本次没有重新生成。');
   const newAttempt=task?.status==='failed';
   if(!explicitContinue){
    setCheckedTask({requestId:turn.requestId,status:newAttempt?'failed':'resumable'});
    if(newAttempt){patch(sessionId,current=>failConversationTurn(restartConversationTurn(current,turn.id),turn.id,{status:'failed',error:task.error||'已确认上次生成失败，可手动重新生成。'}));setNotice('已确认上次生成失败，本次没有重新生成。若要继续，请点击“重新生成此回复”开始一次新任务。');}
    else setNotice('尚未找到已完成回复。本次没有重新发送；点击“继续本轮讨论”后，将按原始问题和引用资料继续同一任务。');
    return;
   }
   const requestId=newAttempt?makeId():turn.requestId;
   const request={...turn.request,requestId};
   const current=recordsRef.current.find(item=>item.id===sessionId);
   if(!current)throw new Error('对话已不存在，请重新选择会话。');
   const next=restartConversationTurn(current,turn.id,{requestId,request});
   if(!write(previous=>saveConversation(previous,next))){
    const halted=failConversationTurn(next,turn.id,{status:'interrupted',error:'本轮未能缓存，任务没有重新开始。请恢复保存后再继续。'});
    write(previous=>saveConversation(previous,halted));setCheckedTask(null);
    throw new Error('本轮未能缓存，尚未重新生成。');
   }
   setCheckedTask(null);restoring.current=null;await runTurn(next,next.turns.find(value=>value.id===turn.id));
  }catch(value){if(stillCurrent())setError(errorText(value));}
  finally{if(restoring.current===operation){restoring.current=null;if(!running.current&&alive.current)setBusy(false);}}
 };
 const changeScope=value=>{if(busy)return;try{if(!flushDraft())throw new Error('草稿尚未缓存，请先导出对话或恢复保存后再切换。');chooseSession(latestFor(recordsRef.current,value),value);}catch(error){setError(errorText(error));}};
 const changeHistory=id=>{if(busy)return;try{if(!flushDraft())throw new Error('草稿尚未缓存，请先导出对话或恢复保存后再切换。');const selected=recordsRef.current.find(item=>item.id===id);if(selected)chooseSession(selected,selected.workId);}catch(error){setError(errorText(error));}};
 const newSession=()=>{if(busy)return;try{if(!flushDraft())throw new Error('草稿尚未缓存，请先导出对话或恢复保存后再开始新对话。');chooseSession(null,scopeId);inputRef.current?.focus();}catch(error){setError(errorText(error));}};
 const deleteSession=()=>{
  if(busy)return;
  clearTimeout(draftTimer.current);draftPending.current=null;
  write(previous=>previous.filter(item=>item.id!==session.id));
  chooseSession(latestFor(recordsRef.current,scopeId),scopeId);notify('对话已从当前创作空间移除');
 };
 const copy=async turn=>{try{if(!navigator?.clipboard?.writeText)throw Error();await navigator.clipboard.writeText(turn.assistantText);notify('回复已复制');}catch{setNotice('复制未完成，请直接选择回复文字复制。');}};
 const exportText=()=>{
  try{
   const saved=recordsRef.current.find(item=>item.id===session.id)||session;
   const latest={...saved,draft:inputValue.current,referenceIds};
   const url=URL.createObjectURL(new Blob(['\ufeff'+conversationText(latest)],{type:'text/plain;charset=utf-8'}));
   const anchor=document.createElement('a');anchor.href=url;anchor.download=`墨多多对话-${latest.title||'新讨论'}.txt`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('对话已导出');
  }catch(value){setError('未能导出，请先复制需要的回复内容。');}
 };
 const handoff=(turn,type)=>{
  if(busy)return;
  const prompt=`讨论需求：${turn.userText}\n\n已确认用于下一步的讨论参考：\n${turn.assistantText}`.slice(0,12000);
  if(type==='plan')setModal({type:'quick-start',autoGenerate:false,idea:prompt,genre:associated?.genre||'悬疑',audience:'全频',perspective:'第三人称',kind:associated?.kind||'长篇小说',mode:'灵感共创'});
  else setModal({type:'tool',tool:tools.find(item=>item.id==='outline'),prompt,...(associated?{workId:associated.id,...(chapter?{chapterId:chapter.id}:{})}:{})});
 };
 const previousPending=session.turns.findLast?.(turn=>turn.request&&turn.status!=='completed');
 const historyOptions=[...records].sort((left,right)=>String(right.updatedAt).localeCompare(String(left.updatedAt)));
 const messageLog=<div className="home-chat-log" ref={logRef} role="log" aria-label="创作对话消息" aria-live="polite" aria-relevant="additions text">{session.turns.map(turn=><React.Fragment key={turn.id}><article className="home-chat-message from-user"><span className="home-chat-user-avatar" aria-hidden="true">你</span><div><strong>你</strong><p>{turn.userText}</p></div></article><article className={`home-chat-message from-assistant turn-${turn.status}`}><Brand small/><div><header><strong>墨多多</strong>{turn.status==='completed'&&<span>{turn.source==='ai'?'智能创作':'预置示例'}</span>}</header>{turn.status==='sending'?<p className="home-chat-working"><LoaderCircle size={15} className="spin"/>正在整理回复…</p>:turn.assistantText?<p>{turn.assistantText}</p>:<p className="home-chat-turn-error">{statuses[turn.status]}{turn.error?`：${turn.error}`:''}</p>}{turn.status==='completed'?<div className="home-chat-reply-actions"><button type="button" aria-label={`复制创作回复 ${turn.id}`} onClick={()=>copy(turn)}><Copy size={13}/>复制</button><button type="button" disabled={busy} aria-label={`用于故事规划 ${turn.id}`} onClick={()=>handoff(turn,'plan')}><BookOpen size={13}/>用于故事规划</button><button type="button" disabled={busy} aria-label={`交给写作工具 ${turn.id}`} onClick={()=>handoff(turn,'tool')}><WandSparkles size={13}/>交给写作工具</button></div>:turn.request&&turn.status!=='sending'?<button type="button" className="home-chat-recover" disabled={busy} aria-label={`${checkedTask?.requestId===turn.requestId?(checkedTask.status==='failed'?'重试创作消息':'继续本轮讨论'):'恢复创作回复'} ${turn.id}`} onClick={()=>recover(turn,checkedTask?.requestId===turn.requestId)}>{checkedTask?.requestId===turn.requestId?(checkedTask.status==='failed'?'重新生成此回复':'继续本轮讨论'):'恢复上次结果'}<ArrowRight size={13}/></button>:turn.status!=='sending'?<small className="home-chat-archived-notice">原消息已保留。可在<a href="#history">生成记录</a>中查找这次任务。</small>:null}</div></article></React.Fragment>)}</div>;
 if(appearance==='hero')return <section className={`home-chat home-chat-hero ${session.turns.length?'has-messages':'is-empty'}`} aria-label="创作对话" onKeyDown={event=>{if(event.key==='Escape'){const details=event.target.closest?.('details[open]');if(details){event.preventDefault();event.stopPropagation();details.open=false;details.querySelector('summary')?.focus();}}}}>
  <div className="home-chat-hero-toolbar">
   <details className="home-chat-hero-session-manager" ref={heroControlsRef} name={contextId+'-panels'}>
    <summary aria-label="对话记录与关联作品">对话记录 / 关联作品<ChevronDown size={14}/></summary>
    <div className="home-chat-hero-session-popover">
     <label><span>关联作品</span><select aria-label="对话关联作品" value={scopeId} disabled={busy} onChange={event=>changeScope(event.target.value)}><option value="">独立讨论</option>{available.map(item=><option value={item.id} key={item.id}>{item.title}</option>)}{scopeId&&!available.some(item=>item.id===scopeId)&&<option value={scopeId}>原关联作品已移除</option>}</select></label>
     <label><span>对话记录</span><select aria-label="对话记录" value={records.some(item=>item.id===session.id)?session.id:''} disabled={busy} onChange={event=>changeHistory(event.target.value)}><option value="">新的讨论</option>{historyOptions.map(item=><option value={item.id} key={item.id}>{item.title||'未命名讨论'}{item.workId?` · ${available.find(value=>value.id===item.workId)?.title||'原作品已移除'}`:' · 独立讨论'}</option>)}</select></label>
     <div className="home-chat-hero-session-actions"><button type="button" className="home-chat-text-button" aria-label="导出当前对话" disabled={busy||(!session.turns.length&&!input.trim())} onClick={exportText}><Download size={15}/>导出对话</button><button type="button" className="home-chat-text-button" aria-label="删除当前对话" disabled={busy||(!records.some(item=>item.id===session.id)&&!input.trim())} onClick={()=>setDeleteConfirm(!deleteConfirm)}><Trash2 size={15}/>删除对话</button></div>
    </div>
   </details>
   <span className="home-chat-hero-scope">{associated?`关联《${associated.title}》`:orphan?'原关联作品已移除':'独立讨论'}</span>
   <button type="button" className="home-chat-text-button" aria-label="新建对话" disabled={busy} onClick={newSession}><Plus size={14}/>新对话</button>
  </div>
  {deleteConfirm&&<div className="home-chat-delete-confirm" role="alert"><span>删除这段对话及其草稿？作品正文和生成记录会保留。</span><button type="button" className="home-chat-text-button" aria-label="取消删除" onClick={()=>setDeleteConfirm(false)}>取消</button><button type="button" className="home-chat-text-button danger" aria-label="确认删除对话" onClick={deleteSession}>确认删除</button></div>}
  {(saveError||persistenceError)&&<p className="home-chat-error" role="alert">对话暂未完整缓存，请保持页面打开并导出重要内容。</p>}
  {orphan&&<p className="home-chat-error" role="status">原关联作品已移除。这段历史可以查看和导出；请选择其他作品或独立讨论开启新对话。</p>}
  {session.turns.length>0&&messageLog}
  <div className="home-chat-hero-composer">
   <form id={contextId+'-form'} className="home-chat-hero-form" onSubmit={send}>
    <label className="home-chat-sr-only" htmlFor={contextId+'-input'}>告诉墨多多你的想法</label>
    <textarea id={contextId+'-input'} ref={inputRef} aria-label="创作对话输入" maxLength={4000} rows={2} value={input} disabled={busy||orphan} onChange={event=>queueDraft(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&!event.nativeEvent?.isComposing&&event.keyCode!==229&&event.nativeEvent?.keyCode!==229){event.preventDefault();send();}}} placeholder={session.turns.length?'继续聊聊你的想法，或者告诉墨多多下一步想怎么写…':'输入一个故事灵感，或告诉墨多多你想写什么…'}/>
    {!session.turns.length&&<div className="home-chat-hero-inspirations"><span>试试灵感</span>{conversationExamples.map(example=><button type="button" key={example.id} aria-label={example.aria} disabled={busy} onClick={()=>{queueDraft(example.prompt);inputRef.current?.focus();}}>{example.label}<ArrowRight size={12}/></button>)}</div>}
   </form>
   <div className="home-chat-hero-footer">
    <div className="home-chat-hero-tools">
     <details className="home-chat-hero-reference" name={contextId+'-panels'}><summary aria-controls={contextId}><Plus size={15}/>添加参考资料<ChevronDown size={13}/></summary><fieldset id={contextId} disabled={busy}>{associated?<><ContextPicker work={associated} value={referenceIds} onChange={chooseReferences} chapterId={chapter?.id} prompt={input} budget={12000}/><p className="home-chat-reference-note">每次最多发送 12,000 字符参考资料；超过预算使用已存摘要或原文节选，可移除引用。</p></>:<div className="home-chat-hero-reference-empty"><BookOpen size={20}/><strong>关联作品后，讨论更有依据</strong><p>选择作品，即可引用大纲、人物设定和章节。</p><button type="button" className="home-chat-text-button" onClick={()=>{if(heroControlsRef.current){heroControlsRef.current.open=true;heroControlsRef.current.querySelector('select')?.focus();}}}>选择关联作品<ArrowRight size={14}/></button></div>}</fieldset></details>
     <details className="home-chat-hero-settings" name={contextId+'-panels'}><summary aria-controls={meterId}><WandSparkles size={15}/>创作设置<ChevronDown size={13}/></summary><fieldset id={meterId} disabled={busy||Boolean(frozenRequest)}><TaskMeter meter={displayedMeter} compact/>{frozenRequest&&<p className="home-chat-reference-note">继续本轮沿用原始问题、引用资料、创作模式与目标篇幅；新问题可重新调整。</p>}</fieldset></details>
    </div>
    <span className="home-chat-hero-count">{input.length} / 4,000</span>
    {busy?<button type="button" className="button secondary" aria-label="取消本次对话" disabled={cancelling} onClick={()=>stop()}>{cancelling?<LoaderCircle size={16} className="spin"/>:<X size={16}/>} {cancelling?'正在停止…':'停止生成'}</button>:<button type="submit" form={contextId+'-form'} className="button primary" aria-label="发送创作消息" disabled={!input.trim()||orphan}>{session.turns.length?'继续讨论':'开始创作'}<ArrowRight size={16}/></button>}
   </div>
  </div>
  <div className="home-chat-hero-footnote"><span>Enter 发送 · Shift+Enter 换行</span><span>讨论不会自动改写作品</span></div>
  {history.truncated&&<p className="home-chat-notice">{history.notice}</p>}{references.notice&&<p className="home-chat-notice">{references.notice}</p>}{previousPending&&input.trim()&&<p className="home-chat-notice">发送新问题后，上一轮未完成请求不再提供恢复按钮，原消息仍会保留。</p>}
  {generation.mode!=='ai'&&<p className="home-chat-notice">预置示例体验：回复为预先编写的内容，未进行实时推理。</p>}
  {notice&&<p className="home-chat-notice" role="status">{notice}</p>}{error&&<p className="home-chat-error" role="alert">{error}</p>}
 </section>;
 return <section className="home-chat" aria-label="创作对话">
  <header className="home-chat-header"><div><h2><Sparkles size={20}/>创作对话</h2><p>先把想法聊清楚，再带着结果继续写。</p></div><div className="home-chat-session-actions"><button type="button" className="home-chat-text-button" aria-label="新建对话" disabled={busy} onClick={newSession}><Plus size={15}/>新对话</button><button type="button" className="home-chat-icon-button" aria-label="导出当前对话" title="导出当前对话" disabled={busy||(!session.turns.length&&!input.trim())} onClick={exportText}><Download size={16}/></button><button type="button" className="home-chat-icon-button" aria-label="删除当前对话" title="删除当前对话" disabled={busy||(!records.some(item=>item.id===session.id)&&!input.trim())} onClick={()=>setDeleteConfirm(!deleteConfirm)}><Trash2 size={16}/></button></div></header>
  <div className="home-chat-context-bar"><label><span>讨论作品</span><select aria-label="对话关联作品" value={scopeId} disabled={busy} onChange={event=>changeScope(event.target.value)}><option value="">独立讨论</option>{available.map(item=><option value={item.id} key={item.id}>{item.title}</option>)}{scopeId&&!available.some(item=>item.id===scopeId)&&<option value={scopeId}>原关联作品已移除</option>}</select></label><label><span>对话记录</span><select aria-label="对话记录" value={records.some(item=>item.id===session.id)?session.id:''} disabled={busy} onChange={event=>changeHistory(event.target.value)}><option value="">新的讨论</option>{historyOptions.map(item=><option value={item.id} key={item.id}>{item.title||'未命名讨论'}{item.workId?` · ${available.find(value=>value.id===item.workId)?.title||'原作品已移除'}`:' · 独立讨论'}</option>)}</select></label><span className="home-chat-mode">{generation.mode==='ai'?'智能创作':'预置示例'}</span></div>
  {deleteConfirm&&<div className="home-chat-delete-confirm" role="alert"><span>删除这段对话及其草稿？作品正文和生成记录会保留。</span><button type="button" className="home-chat-text-button" aria-label="取消删除" onClick={()=>setDeleteConfirm(false)}>取消</button><button type="button" className="home-chat-text-button danger" aria-label="确认删除对话" onClick={deleteSession}>确认删除</button></div>}
  {(saveError||persistenceError)&&<p className="home-chat-error" role="alert">对话暂未完整缓存，请保持页面打开并导出重要内容。</p>}
  {orphan&&<p className="home-chat-error" role="status">原关联作品已移除。这段历史可以查看和导出；请选择其他作品或独立讨论开启新对话。</p>}
  {!session.turns.length?<div className="home-chat-empty"><h3>今天想把哪个故事往前推进一点？</h3><p>聊灵感、讨论情节，或者一起找出人物的下一步。</p><div className="home-chat-examples">{conversationExamples.map(example=><button type="button" key={example.id} aria-label={example.aria} disabled={busy} onClick={()=>{queueDraft(example.prompt);inputRef.current?.focus();}}><strong>{example.label}</strong><span>{example.description}</span><ArrowRight size={15}/></button>)}</div></div>:messageLog}
  <form className="home-chat-form" onSubmit={send}><label className="home-chat-input-label" htmlFor={contextId+'-input'}>告诉墨多多你的想法</label><textarea id={contextId+'-input'} ref={inputRef} aria-label="创作对话输入" maxLength={4000} rows={3} value={input} disabled={busy||orphan} onChange={event=>queueDraft(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&!event.nativeEvent?.isComposing&&event.keyCode!==229&&event.nativeEvent?.keyCode!==229){event.preventDefault();send();}}} placeholder="例如：我想写一本悬疑小说，先陪我一起确定主角和核心冲突…"/>
   <div className="home-chat-send-row"><span>{input.length} / 4,000 <i/>Enter 发送 · Shift+Enter 换行</span>{busy?<button type="button" className="button secondary" aria-label="取消本次对话" disabled={cancelling} onClick={()=>stop()}>{cancelling?<LoaderCircle size={15} className="spin"/>:<X size={15}/>} {cancelling?'正在停止…':'停止生成'}</button>:<button type="submit" className="button primary" aria-label="发送创作消息" disabled={!input.trim()||orphan}><Send size={16}/>发送</button>}</div>
  </form>
  <div className="home-chat-options">{associated&&<details className="home-chat-reference-details"><summary aria-controls={contextId}>本次参考资料<ChevronDown size={14}/></summary><fieldset id={contextId} disabled={busy}><ContextPicker work={associated} value={referenceIds} onChange={chooseReferences} chapterId={chapter?.id} prompt={input} budget={12000}/><p className="home-chat-reference-note">每次最多发送 12,000 字符参考资料；超过预算会采用已存摘要或原文节选，可随时移除引用。</p></fieldset></details>}<details className="home-chat-cost-details"><summary aria-controls={meterId}>用量与创作设置<ChevronDown size={14}/></summary><fieldset id={meterId} disabled={busy||Boolean(frozenRequest)}><TaskMeter meter={displayedMeter} compact/>{frozenRequest&&<p className="home-chat-reference-note">继续本轮时沿用原始问题、引用资料、创作模式与目标篇幅；开始新问题后可重新调整。</p>}</fieldset></details><p>讨论不会自动改写作品，采用前由你确认。</p></div>
  {history.notice&&<p className="home-chat-notice">{history.notice}</p>}{references.notice&&<p className="home-chat-notice">{references.notice}</p>}{previousPending&&input.trim()&&<p className="home-chat-notice">发送新问题后，上一轮未完成请求不再提供恢复按钮，原消息仍会保留。</p>}
  {generation.mode!=='ai'&&<p className="home-chat-notice">当前为预置示例体验，不会根据任意问题实时推理；启用智能创作后可继续真实讨论。</p>}
  {notice&&<p className="home-chat-notice" role="status">{notice}</p>}{error&&<p className="home-chat-error" role="alert">{error}</p>}
 </section>;
}
