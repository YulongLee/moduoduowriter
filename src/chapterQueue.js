import {buildStoryContext,previousConfirmedChapter} from './storyMemory.js';
import {saveChapterVersion} from './works.js';
const makeId=()=>globalThis.crypto?.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
const now=()=>new Date().toISOString();
export const QUEUE_STATES={pending:'等待生成',running:'正在生成',awaiting_confirmation:'待作者确认',succeeded:'已写入正文',failed:'生成失败',interrupted:'中断待恢复',conflict:'正文有变化',discarded:'已跳过'};
export const chapterSnapshot=chapter=>({title:chapter.title||'',text:chapter.text||'',plan:chapter.plan||'',summary:chapter.summary||''});
export const matchesChapterSnapshot=(chapter,snapshot)=>!!chapter&&chapter.title===snapshot.title&&(chapter.text||'')===snapshot.text&&(chapter.plan||'')===snapshot.plan;

export function createChapterQueue(work,{chapterIds=[],referenceIds=[],outputChars=1000,model='standard',budget=12000}={}) {
 const selected=work.chapters.filter(chapter=>chapterIds.includes(chapter.id)&&chapter.plan?.trim());
 if(!selected.length)throw new Error('请先选择至少一个有章纲的章节。');
 const queueId=makeId(),createdAt=now(),referenceBundle=buildStoryContext(work,{referenceIds,budget});
 return {version:1,id:queueId,status:'paused',createdAt,updatedAt:createdAt,outputChars:Math.max(300,Math.min(4000,Number(outputChars)||1000)),model:model==='refine'?'refine':'standard',referenceIds:[...new Set(referenceIds)],referenceContext:referenceBundle.context,referenceNotice:referenceBundle.notice,jobs:selected.map(chapter=>{const jobId=makeId();return {id:jobId,chapterId:chapter.id,snapshot:chapterSnapshot(chapter),status:'pending',attempt:1,requestId:`queue:${queueId}:${jobId}:1`,candidate:'',error:'',usage:null,source:'',createdAt,updatedAt:createdAt};})};
}

export function updateQueueJob(queue,jobId,patch) {
 return {...queue,updatedAt:now(),jobs:queue.jobs.map(job=>job.id===jobId?{...job,...patch,updatedAt:now()}:job)};
}

export function recoverChapterQueue(queue) {
 if(!queue||queue.version!==1||!Array.isArray(queue.jobs))return null;
 const interrupted=queue.jobs.some(job=>job.status==='running');
 if(!interrupted&&queue.status!=='running')return queue;
 return {...queue,status:'paused',updatedAt:now(),jobs:queue.jobs.map(job=>job.status==='running'?{...job,status:'interrupted',error:'上次生成已中断。请手动恢复；恢复将沿用同一请求编号，避免重复提交。',updatedAt:now()}:job)};
}

export function nextQueueJob(queue) {
 const next=queue.jobs.find(job=>!['succeeded','discarded'].includes(job.status));
 return next&&['pending','interrupted'].includes(next.status)?next:null;
}

export function prepareQueueJob(work,queue,jobId) {
 const job=queue.jobs.find(value=>value.id===jobId);
 if(!job||!['pending','interrupted'].includes(job.status))throw new Error('这章无需重新生成。失败章节请明确选择单章重试。');
 const first=queue.jobs.find(value=>!['succeeded','discarded'].includes(value.status));
 if(first?.id!==job.id)throw new Error('请先确认或跳过前面的章节，再生成本章。');
 const chapter=work.chapters.find(value=>value.id===job.chapterId);
 if(!matchesChapterSnapshot(chapter,job.snapshot))return updateQueueJob({...queue,status:'paused'},job.id,{status:'conflict',error:'建队后章节标题、章纲或正文已改变，已阻止覆盖。请保留现有正文，重新建立队列。'});
 return updateQueueJob({...queue,status:'running'},job.id,{status:'running',error:''});
}

export function buildQueueRequest(work,queue,jobId) {
 const job=queue.jobs.find(value=>value.id===jobId);
 if(!job)throw new Error('找不到队列章节。');
 const previous=previousConfirmedChapter(work,job.chapterId);
 const prior=previous?{id:previous.id,title:previous.title,summary:previous.summary||'',text:(previous.text||'').slice(-6000),excerpt:(previous.text||'').length>6000}:null;
 return {task:'chapterDraft',requestId:job.requestId,mode:queue.model,target:queue.outputChars,prompt:'依据本章章纲创作本章完整正文，仅返回正文。遵守已选资料中的事实、人物和叙述口吻；承接前面已确认的章节，不重复前章。已有本章正文是作者的旧稿，候选由作者确认后才会替换。不得把后续章纲或尚未确认的生成内容当成已发生事件。',context:{workId:work.id,chapterId:job.chapterId,title:work.title,chapterTitle:job.snapshot.title,plan:job.snapshot.plan,existingDraft:job.snapshot.text,previousChapter:prior,references:queue.referenceContext?.references||[]}};
}

export function completeQueueJob(queue,jobId,result) {
 if(typeof result?.text!=='string'||!result.text.trim())throw new Error('模型没有返回正文，本章可单独重试。');
 return updateQueueJob({...queue,status:'paused'},jobId,{status:'awaiting_confirmation',candidate:result.text,error:'',source:result.source||'ai',usage:result.usage||null});
}

export function retryQueueJob(queue,jobId) {
 const job=queue.jobs.find(value=>value.id===jobId);
 if(!job||job.status!=='failed')return queue;
 const attempt=(job.attempt||1)+1;
 return updateQueueJob({...queue,status:'paused'},jobId,{status:'pending',attempt,requestId:`queue:${queue.id}:${job.id}:${attempt}`,error:''});
}

export function confirmQueueJob(work,jobId,candidate) {
 const queue=work.chapterQueue,job=queue?.jobs.find(value=>value.id===jobId);
 if(!job||job.status!=='awaiting_confirmation')throw new Error('只有待确认的候选可以写入正文。');
 const chapter=work.chapters.find(value=>value.id===job.chapterId);
 if(!matchesChapterSnapshot(chapter,job.snapshot))return {...work,chapterQueue:updateQueueJob({...queue,status:'paused'},jobId,{status:'conflict',error:'作者在生成后修改了这一章，候选已保留，但不会覆盖现有正文。请复制需要的部分，或重新建立队列。'})};
 const body=typeof candidate==='string'?candidate:job.candidate;
 if(!body.trim())throw new Error('候选正文为空，无法写入。');
 const saved=updateQueueJob(queue,jobId,{status:'succeeded',candidate:body,confirmedAt:now(),error:''});
 const complete=saved.jobs.every(value=>['succeeded','discarded'].includes(value.status));
 const versioned=chapter.text?.trim()?saveChapterVersion(work,chapter,'队列写入前'):work;
 return {...versioned,chapters:work.chapters.map(value=>value.id===chapter.id?{...value,text:body,summary:'',summaryUpdatedAt:now()}:value),chapterQueue:{...saved,status:complete?'completed':'paused'}};
}

export function skipQueueJob(queue,jobId) {
 const next=updateQueueJob({...queue,status:'paused'},jobId,{status:'discarded',error:''});
 return {...next,status:next.jobs.every(job=>['succeeded','discarded'].includes(job.status))?'completed':'paused'};
}
