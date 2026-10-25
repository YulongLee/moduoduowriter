export function placeRecentlyEdited(works, edited) {
  const existing = works.find(work => work.id === edited.id);
  if (!existing) return works;
  const chapters = edited.chapters || existing.chapters || [];
  const previousChapters = new Map((existing.chapters || []).map(chapter => [chapter.id, chapter]));
  const changedChapters = chapters.filter(chapter => {
    const previous = previousChapters.get(chapter.id);
    return !previous || previous.title !== chapter.title || previous.text !== chapter.text;
  });
  const remembered = edited.lastEditedChapterId || existing.lastEditedChapterId;
  const lastEditedChapterId = changedChapters.length === 1 ? changedChapters[0].id : chapters.some(chapter => chapter.id === remembered) ? remembered : undefined;
  return [
    { ...existing, ...edited, lastEditedChapterId, updated:'刚刚', updatedAt:new Date().toISOString() },
    ...works.filter(work => work.id !== edited.id)
  ];
}

export const newId=()=>globalThis.crypto?.randomUUID?.()||`${Date.now().toString(36)}${Math.random().toString(36).slice(2,9)}`;
export function splitManuscript(text) {
 const lines=String(text).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').split('\n');
 const chapters=[];let title='',body=[];
 const push=()=>{if(title||body.join('\n').trim())chapters.push({id:newId(),title:title||'序章 · 导入文稿',text:body.join('\n').trim()});};
 for(const line of lines){if(/^\s*(第[零〇一二三四五六七八九十百千万两\d]+[章回节卷幕场][^\n]{0,80}|chapter\s+\d+[^\n]{0,80})\s*$/i.test(line)){push();title=line.trim();body=[];}else body.push(line);}
 push();return chapters.length?chapters:[{id:newId(),title:'第一章 · 导入文稿',text:''}];
}
export function saveChapterVersion(work,chapter,label='手动保存') {
 const version={id:newId(),chapterId:chapter.id,title:chapter.title,text:chapter.text,label,savedAt:new Date().toISOString()};
 let versions=[version,...(work.versions||[])].slice(0,12);
 let size=0;versions=versions.filter((item,index)=>{size+=item.text.length;return index===0||size<=500000;});
 return {...work,versions};
}
export function moveChapter(work,id,offset) {
 const index=work.chapters.findIndex(c=>c.id===id),target=index+offset;
 if(index<0||target<0||target>=work.chapters.length)return work;
 const chapters=[...work.chapters];[chapters[index],chapters[target]]=[chapters[target],chapters[index]];return {...work,chapters};
}
