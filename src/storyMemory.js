export const MEMORY_TYPES = {
  character:'人物', relationship:'人物关系', location:'地点', setting:'世界设定', timeline:'时间线', foreshadow:'伏笔'
};
const id = () => globalThis.crypto?.randomUUID?.() || `memory-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;
const now = () => new Date().toISOString();
const text = value => typeof value === 'string' ? value : '';

export function memoryEntries(work) {
  return Array.isArray(work?.memory?.entries) ? work.memory.entries.filter(entry => entry && MEMORY_TYPES[entry.type] && typeof entry.id === 'string') : [];
}

export function saveMemoryEntry(work, draft, {unlock=false}={}) {
  const entries=memoryEntries(work), existing=entries.find(entry=>entry.id===draft.id);
  if(existing?.locked && !unlock) throw new Error('这条事实已锁定，请先解锁后再修改。');
  if(!MEMORY_TYPES[draft.type] || !text(draft.title).trim() || !text(draft.content).trim()) throw new Error('请填写资料名称和具体内容。');
  const entry={id:existing?.id||id(),type:draft.type,title:draft.title.trim().slice(0,120),content:draft.content.trim().slice(0,16000),summary:text(draft.summary).trim().slice(0,1200),relatedIds:Array.isArray(draft.relatedIds)?draft.relatedIds.filter(v=>typeof v==='string').slice(0,30):[],locked:!!draft.locked,sourceChapterId:text(draft.sourceChapterId),evidence:text(draft.evidence).slice(0,1200),updatedAt:now()};
  return {...work,memory:{version:1,entries:existing?entries.map(value=>value.id===entry.id?entry:value):[...entries,entry]}};
}

export function setMemoryLocked(work, entryId, locked) {
  return {...work,memory:{version:1,entries:memoryEntries(work).map(entry=>entry.id===entryId?{...entry,locked:!!locked,updatedAt:now()}:entry)}};
}

export function deleteMemoryEntry(work, entryId) {
  const entry=memoryEntries(work).find(value=>value.id===entryId);
  if(entry?.locked) throw new Error('这条事实已锁定，请先解锁后再删除。');
  return {...work,memory:{version:1,entries:memoryEntries(work).filter(value=>value.id!==entryId).map(value=>({...value,relatedIds:(value.relatedIds||[]).filter(v=>v!==entryId)}))}};
}

export function parseMemoryExtraction(result, sourceText) {
  let data=result?.structured;
  if(!data) {
    try {data=JSON.parse(text(result?.text).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));}
    catch {throw new Error('模型没有返回可核实的资料结构，未写入作品。请重试或手工整理。');}
  }
  if(!data || typeof data.summary!=='string' || !data.summary.trim() || data.summary.length>3000 || !Array.isArray(data.entries) || data.entries.length>30) throw new Error('摘要或资料格式不完整，未写入作品。');
  const entries=data.entries.map(entry=>{
    if(!entry || !MEMORY_TYPES[entry.type] || !text(entry.title).trim() || !text(entry.content).trim() || !text(entry.evidence).trim() || !sourceText.includes(entry.evidence.trim()) || entry.title.length>120 || entry.content.length>16000) throw new Error('有条目缺少可在本章找到的原文依据，未写入作品。请重试或手工整理。');
    return {id:id(),type:entry.type,title:entry.title.trim(),content:entry.content.trim(),summary:text(entry.summary).slice(0,1200),evidence:entry.evidence.trim().slice(0,1200),locked:false,relatedIds:[]};
  });
  return {summary:data.summary.trim(),entries};
}

// Author confirmation adds a new observation; it never silently rewrites an established fact.
export function applyMemoryExtraction(work, chapterId, extraction, entryIds, {includeSummary=true,sourceText}={}) {
  const chapter=work.chapters.find(value=>value.id===chapterId);
  if(!chapter) throw new Error('原章节已被删除，请重新整理。');
  if(sourceText!==undefined && chapter.text!==sourceText) throw new Error('本章正文已改变，请重新提取，或手工保存仍适用的资料。');
  let next=work;
  for(const entry of extraction.entries.filter(value=>entryIds.includes(value.id))) {
    const matching=memoryEntries(next).find(value=>value.type===entry.type&&value.title===entry.title);
    if(matching?.locked) continue;
    next=saveMemoryEntry(next,{...entry,id:matching?.id,sourceChapterId:chapterId});
  }
  if(includeSummary) next={...next,chapters:next.chapters.map(value=>value.id===chapterId?{...value,summary:extraction.summary,summaryUpdatedAt:now()}:value)};
  return next;
}

export function referenceCatalog(work) {
  const references=memoryEntries(work).map(entry=>({id:`memory:${entry.id}`,type:entry.type,title:entry.title,content:entry.content,summary:entry.summary||'',locked:entry.locked,sourceChapterId:entry.sourceChapterId||''}));
  if(text(work?.outline).trim()) references.push({id:'work:outline',type:'outline',title:'作品大纲',content:work.outline,summary:''});
  if(text(work?.characters).trim()) references.push({id:'work:characters',type:'character',title:'人物设定文档',content:work.characters,summary:''});
  for(const chapter of work?.chapters||[]) if(text(chapter.text).trim()||text(chapter.summary).trim()) references.push({id:`chapter:${chapter.id}`,type:'chapter',title:chapter.title,content:text(chapter.text),summary:text(chapter.summary),sourceChapterId:chapter.id});
  return references;
}

const termsFor = query => {
  const segments=text(query).toLowerCase().replace(/@/g,'').match(/[a-z0-9]+|[\u3400-\u9fff]{2,}/g)||[];
  return [...new Set(segments.flatMap(term=>term.length>3&&/[\u3400-\u9fff]/.test(term)?[term,...Array.from({length:term.length-1},(_,i)=>term.slice(i,i+2))]:[term]))];
};
export function suggestReferences(work,{chapterId,query='',limit=8,recent=2}={}) {
  const catalog=referenceCatalog(work), terms=termsFor(query), currentIndex=work.chapters.findIndex(chapter=>chapter.id===chapterId);
  const prior=work.chapters.slice(0,currentIndex>=0?currentIndex:work.chapters.length).filter(chapter=>text(chapter.text).trim()||text(chapter.summary).trim()).slice(-recent).map(chapter=>`chapter:${chapter.id}`);
  return catalog.filter(reference=>reference.id!==`chapter:${chapterId}`).map(reference=>{
    const body=`${reference.title} ${reference.content} ${reference.summary}`.toLowerCase();
    const matches=terms.filter(term=>body.includes(term));
    return {...reference,score:matches.length*4+(prior.includes(reference.id)?3:0),reason:matches.length?'与需求关键词相关':prior.includes(reference.id)?'近期已确认章节':''};
  }).filter(reference=>reference.score>0).sort((a,b)=>b.score-a.score).slice(0,limit);
}

export function buildStoryContext(work,{chapterId,query='',referenceIds=[],budget=12000}={}) {
  const requested=[...new Set(referenceIds)], catalog=referenceCatalog(work);
  const cap=Math.max(200,Math.min(50000,Number(budget)||12000));
  const selected=requested.map(referenceId=>catalog.find(reference=>reference.id===referenceId)).filter(Boolean);
  const missing=requested.length-selected.length;
  const references=selected.map(reference=>({...reference,originalChars:reference.content.length,compressed:false}));
  let context={references:references.map(reference=>({id:reference.id,type:reference.type,title:reference.title,content:reference.content}))};
  let compressed=false,omitted=0;
  if(JSON.stringify(context).length>cap) {
    compressed=true;
    const share=Math.max(32,Math.floor((cap-32)/Math.max(1,references.length))-180);
    references.forEach(reference=>{
      reference.content=(reference.summary||reference.content).slice(0,share);
      reference.compressed=reference.content.length<reference.originalChars;
      reference.compressionLabel=reference.summary?'使用作者已保存的摘要':'原文节选（未生成摘要）';
    });
    const packed=[];
    for(const reference of references) {
      const packedReference={id:reference.id,type:reference.type,title:reference.title,content:reference.content,compression:reference.compressionLabel};
      if(JSON.stringify({references:[...packed,packedReference]}).length<=cap) packed.push(packedReference);
      else {reference.omitted=true;omitted++;}
    }
    context={references:packed};
  }
  return {context,references,inputChars:JSON.stringify(context).length,compressed,omitted,missing,notice:compressed?`引用超过 ${cap.toLocaleString()} 字符预算，已改用已存摘要或明确标示的原文节选${omitted?`；${omitted} 项暂未发送`:''}。本次未读取全书。`:missing?`${missing} 项引用已不存在，未发送。`:''};
}

export function previousConfirmedChapter(work, chapterId) {
  const index=work.chapters.findIndex(chapter=>chapter.id===chapterId);
  if(index<=0)return null;
  return work.chapters.slice(0,index).reverse().find(chapter=>text(chapter.text).trim())||null;
}
