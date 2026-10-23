import { newId } from './works.js';
export const backupKeys={works:'mdd-works-v1',favorites:'mdd-favorites-v1',submissions:'mdd-submissions-v1',reading:'mdd-reading-v1',workflows:'mdd-workflows-v1',video:'mdd-video-v1'};
const array=(v,label)=>{if(!Array.isArray(v))throw new Error(`${label}格式不正确`);return v;};
export function validateWork(work) {
 if(!work||typeof work.id!=='string'||!work.id||typeof work.title!=='string'||!Array.isArray(work.chapters)||!work.chapters.length||work.chapters.some(ch=>!ch||typeof ch.id!=='string'||typeof ch.title!=='string'||typeof ch.text!=='string'||(ch.plan!==undefined&&typeof ch.plan!=='string'))||new Set(work.chapters.map(ch=>ch.id)).size!==work.chapters.length)throw new Error('备份中存在不完整的作品或章节');
 if(work.versions!==undefined&&(!Array.isArray(work.versions)||work.versions.some(v=>!v||typeof v.id!=='string'||typeof v.chapterId!=='string'||typeof v.title!=='string'||typeof v.text!=='string'||typeof v.savedAt!=='string')))throw new Error('作品版本记录格式不正确');
 for(const key of ['outline','characters','notes','description','deletedAt','genre','kind'])if(work[key]!==undefined&&typeof work[key]!=='string')throw new Error('作品资料格式不正确');
 return {...work,kind:work.kind||'长篇小说',genre:work.genre||'其他',outline:work.outline||'',characters:work.characters||''};
}
export function validateBackup(data) {
 if(!data||data.format!=='mdd-workspace'||data.version!==1)throw new Error('请选择墨多多导出的 JSON 备份文件');
 const works=array(data.works,'作品').map(validateWork);if(new Set(works.map(w=>w.id)).size!==works.length)throw new Error('备份包含重复作品编号');
 const result={...data,works};
 for(const key of Object.keys(backupKeys).filter(k=>k!=='works'))result[key]=array(data[key]||[],key);
 if(result.favorites.some(v=>typeof v!=='string'))throw new Error('工具收藏格式不正确');
 if(result.reading.some(r=>!r||typeof r.id!=='string'||typeof r.title!=='string'||typeof r.text!=='string'||!r.facts||typeof r.facts.words!=='number'||!Array.isArray(r.dimensions)||!Array.isArray(r.sections)||r.sections.some(s=>!s||typeof s.id!=='string'||typeof s.title!=='string'||!Array.isArray(s.items)||!s.items.length||s.items.some(i=>typeof i?.label!=='string'||typeof i?.body!=='string'))))throw new Error('拆书记录格式不正确');
 if(result.submissions.some(s=>!s||typeof s.id!=='string'||typeof s.title!=='string'||typeof s.platform!=='string'||typeof s.status!=='string'))throw new Error('投稿记录格式不正确');
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
  if(key==='favorites'){merged[key]=[...new Set([...current[key],...incoming[key]])];continue;}
  const next=[...current[key]];
  for(const item of incoming[key]){const existing=next.find(v=>v.id===item.id);if(!existing)next.push(item);else if(JSON.stringify(existing)!==JSON.stringify(item))next.push({...item,id:newId(),...(key==='works'?{title:`${item.title}（恢复副本）`,deletedAt:undefined}:key==='workflows'?{flowId:item.flowId||item.id}:{} )});}
  merged[key]=next;
 }
 return merged;
}
export function restoreBackup(storage,incoming,{fallbackWorks=[]}={}) {
 const valid=validateBackup(incoming);const current=collectBackup(storage,fallbackWorks);const merged=mergeBackup(current,valid);
 const previous=new Map(Object.values(backupKeys).map(key=>[key,storage.getItem(key)]));
 try{for(const [key,value] of Object.entries(backupKeys))storage.setItem(value,JSON.stringify(merged[key]));}
 catch(error){for(const [key,value] of previous){try{if(value===null)storage.removeItem(key);else storage.setItem(key,value);}catch{}}throw new Error('空间不足，备份未能完整导入。请导出当前内容后释放存储空间');}
 return merged;
}
export function downloadJSON(name,data){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
