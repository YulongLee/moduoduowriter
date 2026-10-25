// A revision anchor describes the exact manuscript the author asked to edit.
// It is deliberately independent of dates and server revision counters.
export function revisionFingerprint(value='') {
 let hash=2166136261;for(let i=0;i<value.length;i++)hash=Math.imul(hash^value.charCodeAt(i),16777619);
 return `${value.length}-${(hash>>>0).toString(36)}`;
}
export function captureRevision({workId,chapterId,field='text',text='',start=0,end=text.length}) {
 return {workId,chapterId,field,before:text,start,end,selectedText:text.slice(start,end),revision:revisionFingerprint(text)};
}
export function revisionMatches(anchor,{workId,chapterId,field='text',text=''}) {
 return Boolean(anchor&&anchor.workId===workId&&anchor.chapterId===chapterId&&anchor.field===field&&anchor.before===text&&anchor.revision===revisionFingerprint(text));
}
export function replaceRevisionSelection(anchor,candidate,current) {
 if(!revisionMatches(anchor,current))throw new Error('原稿或章节已改变，请重新定位选段后再生成和采纳。');
 return anchor.before.slice(0,anchor.start)+candidate+anchor.before.slice(anchor.end);
}
export function revisionContext(context,previous,history=[],requirement='') {
 if(!previous)return context;
 return {...context,revision:{previousDraft:previous.text,requirements:[...history.filter(item=>item.id<=previous.id).map(item=>item.requirement).filter(Boolean),requirement].filter(Boolean),round:history.length+1,instruction:'基于上一稿继续修改，保留此前已确认的创作要求；本轮要求发生冲突时以本轮要求为准。'}};
}
function paragraphs(text='') {
 const parts=[];const pattern=/[\s\S]+?(?:\r?\n[ \t]*\r?\n+|$)/g;let match;
 while((match=pattern.exec(text)))parts.push(match[0]);return parts;
}
export function paragraphChanges(before='',candidate='') {
 const original=paragraphs(before),proposed=paragraphs(candidate);
 return Array.from({length:Math.max(original.length,proposed.length)},(_,index)=>({index,before:original[index]||'',candidate:proposed[index]||''})).filter(row=>row.before!==row.candidate);
}
export function applyParagraphChoices(before,candidate,chosen=[]) {
 const changes=paragraphChanges(before,candidate),selected=new Set(chosen);
 if(changes.every(row=>selected.has(row.index)))return candidate;
 const original=paragraphs(before),proposed=paragraphs(candidate);let output='';
 for(let index=0;index<Math.max(original.length,proposed.length);index++){
  let value=selected.has(index)?proposed[index]||'':original[index]||'';
  const following=Array.from({length:Math.max(original.length,proposed.length)-index-1},(_,offset)=>{const next=index+offset+1;return selected.has(next)?proposed[next]||'':original[next]||'';}).some(Boolean);
  if(selected.has(index)&&value&&following&&!/\r?\n[ \t]*\r?\n$/.test(value))value+=(original[index]?.match(/(\r?\n[ \t]*\r?\n+)$/)?.[1]||'\n\n');
  if(index>=original.length&&value&&output&&!/\r?\n[ \t]*\r?\n$/.test(output))output+='\n\n';
  output+=value;
 }
 return output;
}
