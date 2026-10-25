import { newId } from './works.js';
import {validateWritingEvaluation} from './writingEvaluation.js';
export const backupKeys={works:'mdd-works-v1',favorites:'mdd-favorites-v1',submissions:'mdd-submissions-v1',reading:'mdd-reading-v1',workflows:'mdd-workflows-v1',video:'mdd-video-v1',planningDrafts:'mdd-planningDrafts-v1',evaluations:'mdd-evaluations-v1'};
const array=(v,label)=>{if(!Array.isArray(v))throw new Error(`${label}格式不正确`);return v;};
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const string=(value,max=1500000)=>typeof value==='string'&&value.length<=max;
const id=value=>string(value,500)&&value.length>0;
const time=value=>string(value,64)&&Number.isFinite(Date.parse(value));
const unique=rows=>new Set(rows.map(row=>row?.id)).size===rows.length;
const strings=(value,max=1000)=>Array.isArray(value)&&value.length<=max&&value.every(item=>string(item,1000));
const memoryTypes=['character','relationship','location','setting','timeline','foreshadow'];
const queueStates=['pending','running','awaiting_confirmation','succeeded','failed','interrupted','conflict','discarded'];
function validateMemory(memory) {
 if(!object(memory)||memory.version!==1||!Array.isArray(memory.entries)||memory.entries.length>10000||!unique(memory.entries)||memory.entries.some(entry=>!object(entry)||!id(entry.id)||!memoryTypes.includes(entry.type)||!string(entry.title,120)||!entry.title.trim()||!string(entry.content,16000)||!entry.content.trim()||!string(entry.summary??'',1200)||!strings(entry.relatedIds??[],30)||typeof entry.locked!=='boolean'||!string(entry.evidence??'',1200)||!string(entry.sourceChapterId??'',500)||(entry.updatedAt!==undefined&&!time(entry.updatedAt))))throw new Error('作品资料库格式不正确');
}
const validContext=context=>object(context)&&Array.isArray(context.references)&&context.references.length<=1000&&context.references.every(reference=>object(reference)&&id(reference.id)&&string(reference.type,100)&&string(reference.title,500)&&string(reference.content,50000)&&(reference.compression===undefined||string(reference.compression,500)));
function validateQueue(queue) {
 const snap=value=>object(value)&&['title','text','plan','summary'].every(key=>string(value[key]??''));
 const usage=value=>value===null||(object(value)&&JSON.stringify(value).length<=16000);
 if(!object(queue)||queue.version!==1||!id(queue.id)||!['paused','running','completed'].includes(queue.status)||!time(queue.createdAt)||!time(queue.updatedAt)||!Number.isFinite(queue.outputChars)||queue.outputChars<300||queue.outputChars>4000||!['standard','refine'].includes(queue.model)||!strings(queue.referenceIds)||!validContext(queue.referenceContext)||!string(queue.referenceNotice??'',16000)||!Array.isArray(queue.jobs)||!queue.jobs.length||queue.jobs.length>10000||!unique(queue.jobs)||queue.jobs.some(job=>!object(job)||!id(job.id)||!id(job.chapterId)||!snap(job.snapshot)||!queueStates.includes(job.status)||!Number.isSafeInteger(job.attempt)||job.attempt<1||job.attempt>10000||!id(job.requestId)||!string(job.candidate)||!string(job.error,16000)||!usage(job.usage)||!string(job.source,100)||!time(job.createdAt)||!time(job.updatedAt)||(job.confirmedAt!==undefined&&!time(job.confirmedAt))))throw new Error('章节队列格式不正确');
}
function validateSnapshot(snapshot) {
 if(!object(snapshot)||!id(snapshot.id)||!time(snapshot.capturedAt)||!string(snapshot.title,500)||!string(snapshot.genre,200)||!string(snapshot.description,100000)||!string(snapshot.versionLabel,500)||!Array.isArray(snapshot.chapters)||!snapshot.chapters.length||snapshot.chapters.length>10000||!unique(snapshot.chapters)||snapshot.chapters.some(chapter=>!object(chapter)||!id(chapter.id)||!string(chapter.title,500)||!string(chapter.text))||!Number.isSafeInteger(snapshot.wordCount)||snapshot.wordCount<0||snapshot.wordCount!==snapshot.chapters.reduce((sum,chapter)=>sum+chapter.text.replace(/\s/g,'').length,0))throw new Error('投稿版本快照格式不正确');
}
function validateSubmission(record) {
 if(record.snapshot!==undefined)validateSnapshot(record.snapshot);
 if(record.versions!==undefined){if(!Array.isArray(record.versions)||record.versions.length>1000||!unique(record.versions))throw new Error('投稿版本记录格式不正确');record.versions.forEach(validateSnapshot);}
 if(record.activeVersionId!==undefined&&(!id(record.activeVersionId)||![...(record.versions||[]),...(record.snapshot?[record.snapshot]:[])].some(snapshot=>snapshot.id===record.activeVersionId)))throw new Error('投稿当前版本编号不正确');
}
const planningFields=['title','outline','characters','text'];
const validPlanning=planning=>object(planning)&&planningFields.every(key=>string(planning[key]));
const validAnchor=anchor=>anchor===null||(object(anchor)&&id(anchor.workId)&&(anchor.chapterId===undefined||id(anchor.chapterId))&&['text','outline','characters','notes'].includes(anchor.field)&&string(anchor.before)&&Number.isInteger(anchor.start)&&Number.isInteger(anchor.end)&&anchor.start>=0&&anchor.end>=anchor.start&&anchor.end<=anchor.before.length&&string(anchor.selectedText)&&anchor.selectedText===anchor.before.slice(anchor.start,anchor.end)&&string(anchor.revision,200));
function validatePlanningDraft(record) {
 if(!object(record)||!id(record.id)||(record.updatedAt!==undefined&&!time(record.updatedAt)))throw new Error('创作草稿格式不正确');
 if(record.type==='quick-start') {
  const candidate=record.candidate;
  if(!object(record.initial)||(record.initial.autoGenerate!==undefined&&typeof record.initial.autoGenerate!=='boolean')||['idea','genre','audience','perspective','kind','mode'].some(key=>record.initial[key]!==undefined&&!string(record.initial[key],100000))||!validPlanning(record.planning)||!['all',...planningFields].includes(record.scope)||!Array.isArray(record.chosen)||record.chosen.length>4||record.chosen.some(key=>!planningFields.includes(key))||!string(record.requirement,100000)||typeof record.hasGenerated!=='boolean'||(candidate!==null&&(!object(candidate)||!validPlanning(candidate.baseline)||!object(candidate.values)||!Object.keys(candidate.values).length||Object.keys(candidate.values).some(key=>!planningFields.includes(key)||!string(candidate.values[key]))||!string(candidate.source,100))))throw new Error('一句话创作规划草稿格式不正确');
 } else if(record.type==='revision-thread') {
  if(!string(record.prompt,100000)||typeof record.continuing!=='boolean'||!Array.isArray(record.versions)||record.versions.length>1000||!unique(record.versions)||record.versions.some(version=>!object(version)||!Number.isSafeInteger(version.id)||version.id<1||!string(version.text)||!time(version.createdAt)||(version.anchor!==undefined&&!validAnchor(version.anchor))||['requirement','source','task','action','scopeKey'].some(key=>version[key]!==undefined&&!string(version[key],100000))||(version.selection!==undefined&&typeof version.selection!=='boolean'))||(record.currentId!==null&&(!Number.isSafeInteger(record.currentId)||!record.versions.some(version=>version.id===record.currentId)))||(record.referenceIds!==undefined&&!strings(record.referenceIds)))throw new Error('改稿候选记录格式不正确');
 } else throw new Error('未知的创作草稿类型');
 if(JSON.stringify(record).length>10000000)throw new Error('单条创作草稿过大，请减少候选版本后重试');
}
export function validateWork(work) {
 if(!work||typeof work.id!=='string'||!work.id||typeof work.title!=='string'||!Array.isArray(work.chapters)||!work.chapters.length||work.chapters.some(ch=>!ch||typeof ch.id!=='string'||typeof ch.title!=='string'||typeof ch.text!=='string'||(ch.plan!==undefined&&typeof ch.plan!=='string'))||new Set(work.chapters.map(ch=>ch.id)).size!==work.chapters.length)throw new Error('备份中存在不完整的作品或章节');
 if(!id(work.id)||!string(work.title,500)||work.chapters.length>10000||work.chapters.some(ch=>!id(ch.id)||!string(ch.title,500)||!string(ch.text)||(ch.summary!==undefined&&!string(ch.summary,3000))||(ch.summaryUpdatedAt!==undefined&&!time(ch.summaryUpdatedAt))))throw new Error('作品章节或摘要格式不正确');
 if(work.memory!==undefined)validateMemory(work.memory);
 if(work.chapterQueue!==undefined&&work.chapterQueue!==null)validateQueue(work.chapterQueue);
 if(work.summary!==undefined&&!string(work.summary,30000))throw new Error('作品摘要格式不正确');
 if(work.lastEditedChapterId!==undefined&&!id(work.lastEditedChapterId))throw new Error('最近编辑章节格式不正确');
 if(work.versions!==undefined&&(!Array.isArray(work.versions)||work.versions.some(v=>!v||typeof v.id!=='string'||typeof v.chapterId!=='string'||typeof v.title!=='string'||typeof v.text!=='string'||typeof v.savedAt!=='string')))throw new Error('作品版本记录格式不正确');
 for(const key of ['outline','characters','notes','description','deletedAt','genre','kind'])if(work[key]!==undefined&&typeof work[key]!=='string')throw new Error('作品资料格式不正确');
 return {...work,kind:work.kind||'长篇小说',genre:work.genre||'其他',outline:work.outline||'',characters:work.characters||''};
}
export function validateBackup(data) {
 if(!data||data.format!=='mdd-workspace'||data.version!==1)throw new Error('请选择墨多多导出的 JSON 备份文件');
 if(JSON.stringify(data).length>20000000)throw new Error('备份超过容量限制，请分批导出作品');
 const works=array(data.works,'作品').map(validateWork);if(new Set(works.map(w=>w.id)).size!==works.length)throw new Error('备份包含重复作品编号');
 const result={...data,works};
 for(const key of Object.keys(backupKeys).filter(k=>k!=='works'))result[key]=array(data[key]===undefined?[]:data[key],key);
 for(const key of Object.keys(backupKeys))if(result[key].length>10000||(key!=='favorites'&&!unique(result[key])))throw new Error('备份记录过多或包含重复编号');
 if(result.favorites.some(v=>typeof v!=='string'))throw new Error('工具收藏格式不正确');
 if(result.reading.some(r=>!r||typeof r.id!=='string'||typeof r.title!=='string'||typeof r.text!=='string'||!r.facts||typeof r.facts.words!=='number'||!Array.isArray(r.dimensions)||!Array.isArray(r.sections)||r.sections.some(s=>!s||typeof s.id!=='string'||typeof s.title!=='string'||!Array.isArray(s.items)||!s.items.length||s.items.some(i=>typeof i?.label!=='string'||typeof i?.body!=='string'))))throw new Error('拆书记录格式不正确');
 if(result.submissions.some(s=>!s||typeof s.id!=='string'||typeof s.title!=='string'||typeof s.platform!=='string'||typeof s.status!=='string'))throw new Error('投稿记录格式不正确');
 result.submissions.forEach(validateSubmission);
 result.planningDrafts.forEach(validatePlanningDraft);
 if(result.evaluations.length>100)throw new Error('评估记录最多100份，请先导出归档');
 result.evaluations.forEach(validateWritingEvaluation);
 if(result.workflows.some(w=>!w||typeof w.id!=='string'||!Number.isInteger(w.step)||typeof w.idea!=='string'||typeof w.content!=='string'||!w.results||typeof w.results!=='object'||Object.values(w.results).some(v=>typeof v!=='string')))throw new Error('工作流草稿格式不正确');
 if(result.video.some(v=>!v||typeof v.id!=='string'||typeof v.script!=='string'||!Array.isArray(v.boards)||v.boards.some(b=>!b||typeof b.name!=='string'||typeof b.text!=='string')))throw new Error('分镜草稿格式不正确');
 return result;
}
export function collectBackup(storage,fallbackWorks=[]) {
 const result={format:'mdd-workspace',version:1,exportedAt:new Date().toISOString()};
 for(const [key,value] of Object.entries(backupKeys)){const raw=storage.getItem(value);result[key]=raw===null?(key==='works'?fallbackWorks:[]):JSON.parse(raw);}
 return validateBackup(result);
}
export function mergeBackup(current,incoming) {
 const merged={...current,exportedAt:new Date().toISOString()};
 for(const key of Object.keys(backupKeys)) {
  if(key==='favorites'){merged[key]=[...new Set([...(current[key]||[]),...(incoming[key]||[])])];continue;}
  const next=[...(current[key]||[])];
  for(const item of incoming[key]||[]){const existing=next.find(v=>v.id===item.id);if(!existing)next.push(item);else if(JSON.stringify(existing)!==JSON.stringify(item))next.push({...item,id:newId(),...(key==='works'?{title:`${item.title}（恢复副本）`,deletedAt:undefined}:key==='workflows'?{flowId:item.flowId||item.id}:{} )});}
  merged[key]=next;
 }
 return validateBackup(merged);
}
export function restoreBackup(storage,incoming,{fallbackWorks=[]}={}) {
 const valid=validateBackup(incoming);const current=collectBackup(storage,fallbackWorks);const merged=mergeBackup(current,valid);
 const previous=new Map(Object.values(backupKeys).map(key=>[key,storage.getItem(key)]));
 try{for(const [key,value] of Object.entries(backupKeys))storage.setItem(value,JSON.stringify(merged[key]));}
 catch(error){for(const [key,value] of previous){try{if(value===null)storage.removeItem(key);else storage.setItem(key,value);}catch{}}throw new Error('空间不足，备份未能完整导入。请导出当前内容后释放存储空间');}
 return merged;
}
export function downloadJSON(name,data){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
