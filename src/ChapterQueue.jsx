import React,{useEffect,useRef,useState} from 'react';
import {Check,Copy,ListTree,LoaderCircle,Pause,Play,RotateCcw,SkipForward} from 'lucide-react';
import {GenerationStatus,useGeneration} from './Generation';
import {TaskMeter,useTaskMeter} from './Billing.jsx';
import {quoteTask} from './billing';
import {ContextPicker} from './StoryMemory.jsx';
import {QUEUE_STATES,buildQueueRequest,completeQueueJob,confirmQueueJob,createChapterQueue,nextQueueJob,prepareQueueJob,recoverChapterQueue,retryQueueJob,skipQueueJob,updateQueueJob} from './chapterQueue';
import './story-memory.css';

export function ChapterQueue({work,onChange,notify=()=>{},onClose}) {
 const [chosen,setChosen]=useState(()=>work.chapters.filter(chapter=>chapter.plan?.trim()&&!chapter.text.trim()).map(chapter=>chapter.id));
 const [referenceIds,setReferenceIds]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const workRef=useRef(work),alive=useRef(true),busyRef=useRef(false),pauseRef=useRef(false),changeRef=useRef(onChange);
 workRef.current=work;changeRef.current=onChange;
 const generation=useGeneration(),queue=work.chapterQueue;
 const next=queue?nextQueueJob(queue):null;
 let inputChars=0;
 if(next)try{inputChars=JSON.stringify(buildQueueRequest(work,queue,next.id).context).length;}catch{}
 const meter=useTaskMeter('continue',{inputChars,outputChars:queue?.outputChars||1000});
 const persist=nextWork=>{workRef.current=nextWork;changeRef.current(nextWork);};
 const persistQueue=nextQueue=>persist({...workRef.current,chapterQueue:nextQueue});
 useEffect(()=>{
  alive.current=true;
  const original=workRef.current.chapterQueue,recovered=recoverChapterQueue(original);
  if(recovered&&recovered!==original)persistQueue(recovered);
  return()=>{
   alive.current=false;pauseRef.current=true;
   const current=workRef.current.chapterQueue;
   if(current?.jobs.some(job=>job.status==='running'))persistQueue(recoverChapterQueue(current));
  };
 },[]);
 useEffect(()=>{if(queue){meter.setModel(queue.model);meter.setOutputChars(queue.outputChars);}},[queue?.id]);
 const create=()=>{try{persistQueue(createChapterQueue(workRef.current,{chapterIds:chosen,referenceIds,outputChars:meter.outputChars,model:meter.model}));setError('');notify('队列已保存，点击开始后才会生成');}catch(value){setError(value.message);}};
 const runJob=async(startWork=workRef.current)=>{
  if(busyRef.current)return;
  if(generation.mode!=='ai'){setError('请先在服务设置中启用智能创作。队列已保存，当前没有发起请求。');return;}
  const currentQueue=startWork.chapterQueue,job=nextQueueJob(currentQueue);
  if(!job)return;
  let prepared;
  try{prepared=prepareQueueJob(startWork,currentQueue,job.id);}catch(value){setError(value.message);return;}
  persist({...startWork,chapterQueue:prepared});
  if(prepared.jobs.find(value=>value.id===job.id).status==='conflict')return;
  pauseRef.current=false;busyRef.current=true;setBusy(true);setError('');
  let started=false;
  try {
   await meter.run(async()=>{
    started=true;
    try {
     const result=await generation.generate(buildQueueRequest(workRef.current,prepared,job.id));
     if(!alive.current||pauseRef.current)return;
     const latest=workRef.current.chapterQueue;
     if(latest?.id!==prepared.id||latest.jobs.find(value=>value.id===job.id)?.status!=='running')return;
     persistQueue(completeQueueJob(latest,job.id,result));
     notify('本章候选已保存，请核对后确认写入');
    }catch(value){
     if(alive.current){
      const latest=workRef.current.chapterQueue;
      if(latest?.id===prepared.id&&latest.jobs.find(entry=>entry.id===job.id)?.status==='running')persistQueue(updateQueueJob({...latest,status:'paused'},job.id,{status:pauseRef.current?'interrupted':'failed',error:value.message||'生成失败，可单章重试。'}));
      if(!pauseRef.current)setError(value.message);
     }
     throw value;
    }
   });
  }finally{
   busyRef.current=false;
   if(alive.current){
    setBusy(false);
    const latest=workRef.current.chapterQueue;
    if(latest?.id===prepared.id&&latest.jobs.find(value=>value.id===job.id)?.status==='running')persistQueue(updateQueueJob({...latest,status:'paused'},job.id,{status:started?'interrupted':'pending',error:started?'本次没有收到完整结果，请手动恢复。':'任务未开始，请检查用量提示后重试。'}));
   }
  }
 };
 const pause=()=>{pauseRef.current=true;generation.cancel();const current=workRef.current.chapterQueue;if(current)persistQueue(recoverChapterQueue(current));notify('队列已暂停，候选和已确认章节均已保存');};
 const confirm=async(jobId,continueAfter=false)=>{
  try {
   const updated=confirmQueueJob(workRef.current,jobId);
   persist(updated);setError('');
   if(updated.chapterQueue.jobs.find(value=>value.id===jobId)?.status==='conflict')return;
   notify('已确认写入正文');
   if(continueAfter)await runJob(updated);
  }catch(value){setError(value.message);}
 };
 const retry=async jobId=>{const updated={...workRef.current,chapterQueue:retryQueueJob(workRef.current.chapterQueue,jobId)};persist(updated);await runJob(updated);};
 const skip=jobId=>persistQueue(skipQueueJob(workRef.current.chapterQueue,jobId));
 const updateCandidate=(jobId,candidate)=>persistQueue(updateQueueJob(workRef.current.chapterQueue,jobId,{candidate}));
 const quoteFor=job=>{
  try{return quoteTask({taskId:'continue',inputChars:JSON.stringify(buildQueueRequest(work,queue,job.id).context).length,outputChars:queue.outputChars,model:queue.model}).credits;}catch{return '—';}
 };
 const planned=work.chapters.filter(chapter=>chapter.plan?.trim());
 const canCreate=!queue||queue.status==='completed';
 return <div className="chapter-queue"><span className="modal-symbol"><ListTree/></span><h2>章纲到正文队列</h2><p className="modal-desc">按章节顺序生成，每章先预览，作者确认后才写入。下一章只承接此前已确认的正文与摘要。</p>{error&&<p className="memory-notice error" role="alert">{error}</p>}
 {canCreate&&<><div className="queue-options">{planned.length?planned.map(chapter=><label key={chapter.id}><input type="checkbox" aria-label={`加入队列 ${chapter.title}`} checked={chosen.includes(chapter.id)} onChange={event=>setChosen(event.target.checked?[...chosen,chapter.id]:chosen.filter(value=>value!==chapter.id))}/><span><strong>{chapter.title}</strong><small>{chapter.plan.slice(0,120)}</small>{chapter.text.trim()&&<small>已有正文。生成候选将在确认后替换，原文先保存到章节版本。</small>}</span></label>):<p className="memory-empty">还没有带章纲的章节，请先使用「把总纲拆成章节」，或为章节填写规划。</p>}</div><ContextPicker work={work} value={referenceIds} onChange={setReferenceIds} prompt={planned.filter(chapter=>chosen.includes(chapter.id)).map(chapter=>chapter.plan).join('\n')}/><TaskMeter meter={meter}/><button className="button primary" disabled={!chosen.length||busy} onClick={create}>建立并保存队列</button>{queue&&<p className="subtle-note">建立新队列会替换下面已完成的任务记录；已确认正文保留在章节中。</p>}</>}
 {queue&&<><div className="queue-estimate">{queue.jobs.filter(job=>job.status==='succeeded').length} / {queue.jobs.length} 章已确认 · 每章目标 {queue.outputChars} 字 · {queue.model==='refine'?'精修模式':'灵感模式'}<br/>自动承接前章已确认摘要与末尾最多 6,000 字；不会使用待确认候选。刷新、关页会暂停，须手动恢复。{queue.referenceNotice&&<><br/>{queue.referenceNotice}</>}</div><div className="queue-controls">{next&&<button className="button primary" disabled={busy||generation.mode!=='ai'} onClick={()=>runJob()}>{busy?<LoaderCircle className="spin" size={14}/>:<Play size={14}/>} {next.status==='interrupted'?'恢复这一章':'生成下一章'}</button>}{busy&&<button className="button secondary" onClick={pause}><Pause size={14}/>暂停队列</button>}{onClose&&<button className="button secondary" onClick={()=>{if(busy)pause();onClose();}}>保存并关闭</button>}</div>{!canCreate&&<><GenerationStatus generation={generation} busy={busy}/>{(meter.error||meter.invalid)&&<p className="memory-notice error" role="alert">{meter.invalid||meter.error.message}</p>}<p className="subtle-note">队列使用建队时保存的模式和篇幅。预计墨点为演示用量，真实模型费用以服务商账单为准。</p></>}{generation.mode!=='ai'&&<p className="memory-notice">当前为示例模式。队列与手动操作可保存；启用智能创作后才能生成真实正文。</p>}<div className="queue-list">{queue.jobs.map((job,index)=><article className="queue-item" key={job.id}><div className="queue-topline"><h3>{index+1}. {job.snapshot.title}</h3><span className={`queue-status ${job.status}`}>{QUEUE_STATES[job.status]||job.status}</span></div><p>本章预计 {quoteFor(job)} 演示墨点 · 目标 {queue.outputChars} 字{job.usage?.totalTokens?` · 实际返回 ${job.usage.totalTokens} tokens`:''}</p><details><summary>查看建队时的章纲快照</summary><p>{job.snapshot.plan}</p></details>{job.error&&<p className="memory-notice error" role="status">{job.error}</p>}{job.candidate&&<><label className="field">{job.status==='succeeded'?'已确认正文':'本章候选（确认前不会写入）'}<textarea aria-label={`队列候选 ${job.snapshot.title}`} rows={10} readOnly={job.status!=='awaiting_confirmation'} value={job.candidate} onChange={event=>updateCandidate(job.id,event.target.value)}/></label>{job.source&&<p className="subtle-note">来源：{job.source==='ai'?'智能创作':job.source==='demo'?'示例体验':'生成结果'}，请核对人物、事实与承接。</p>}</>}<div className="queue-candidate-actions">{job.status==='awaiting_confirmation'&&<><button className="button primary" disabled={busy||!job.candidate.trim()} onClick={()=>confirm(job.id)}><Check size={14}/>确认写入本章</button>{index<queue.jobs.length-1&&<button className="button secondary" disabled={busy||!job.candidate.trim()} onClick={()=>confirm(job.id,true)}>确认并生成下一章</button>}</>}{job.status==='failed'&&<button className="button secondary" disabled={busy} onClick={()=>retry(job.id)}><RotateCcw size={14}/>只重试这一章</button>}{job.candidate&&job.status!=='succeeded'&&<button className="button secondary" onClick={async()=>{try{await navigator.clipboard.writeText(job.candidate);notify('候选正文已复制');}catch{setError('未能复制，请在候选框中手动选择并复制。');}}}><Copy size={14}/>复制候选</button>}{['failed','interrupted','pending','conflict','awaiting_confirmation'].includes(job.status)&&<button className="text-button" disabled={busy} onClick={()=>skip(job.id)}><SkipForward size={13}/>{job.candidate?'放弃候选并跳过':'跳过本章'}</button>}</div></article>)}</div></>}
 </div>;
}
export default ChapterQueue;
