import {wordCount} from './data.js';

const hasText=value=>typeof value==='string'&&Boolean(value.trim());
const finishedQueueStates=new Set(['succeeded','discarded']);
const queueCopy={
  awaiting_confirmation:['确认章节候选','已有章节候选等待你确认，采纳后再继续后面的章节。'],
  interrupted:['恢复正文队列','上次任务已中断，可以在队列中核对状态后手动继续。'],
  failed:['处理失败章节','先查看失败原因，再决定是否重试这一章。'],
  conflict:['核对章节变化','章节已发生变化，请先核对现有正文与保留的候选。'],
  running:['查看正文队列','查看当前章节任务，也可以在队列中暂停。'],
  pending:['打开正文队列','已有章纲等待创作，打开队列确认后才会开始生成。']
};

// Derived only from saved author data. No fabricated progress or generation is performed here.
export function getHomeWorkState(work) {
  if(!work)return null;
  const chapters=Array.isArray(work.chapters)?work.chapters:[];
  const words=chapters.reduce((total,chapter)=>total+wordCount(typeof chapter.text==='string'?chapter.text:''),0);
  const rememberedChapter=chapters.find(chapter=>chapter.id===work.lastEditedChapterId);
  const chapter=rememberedChapter||chapters[0]||null;
  const isScript=work.kind==='剧本',unit=isScript?'场':'章',firstPart=isScript?'第一场':'第一章';
  const memoryCharacters=Array.isArray(work.memory?.entries)&&work.memory.entries.some(entry=>entry?.type==='character'&&hasText(entry.content));
  const hasOutline=hasText(work.outline),hasCharacters=hasText(work.characters)||memoryCharacters,hasProse=words>0;
  const jobs=work.chapterQueue?.version===1&&Array.isArray(work.chapterQueue.jobs)?work.chapterQueue.jobs:[];
  const queued=jobs.find(job=>!finishedQueueStates.has(job.status));
  let nextAction;
  if(queued&&queueCopy[queued.status]) {
    const [label,description]=queueCopy[queued.status];
    nextAction={type:'chapter-queue',label,description};
  } else if(!hasOutline) {
    nextAction={type:'tool',toolId:'outline',label:isScript?'搭建剧本大纲':'搭建故事大纲',description:isScript?'先理清场景、冲突与人物行动，让接下来的场次有方向。':'先理清主线、冲突与结局，让接下来的章节有方向。'};
  } else if(!hasCharacters) {
    nextAction={type:'tool',toolId:'character',label:'补全人物设定',description:'写清角色的目标、动机与关系，让人物推动故事。'};
  } else if(!hasProse) {
    nextAction=isScript?{type:'tool',toolId:'outline',label:'梳理场次安排',description:'明确每一场的目标、冲突与场景，再开始分场正文。'}:{type:'chapter-plan',label:'规划接下来的章节',description:'大纲与人物已有内容，可以先拆出章纲，再开始第一章。'};
  } else {
    const reviewChapter=hasText(chapter?.text)?chapter:chapters.find(value=>hasText(value.text));
    nextAction={type:'tool',toolId:'review',chapterId:reviewChapter?.id,label:reviewChapter?.id===chapter?.id?(isScript?'检查当前场次':'检查当前章节'):(isScript?'检查已有场次':'检查已有章节'),description:'带着已有正文，检查人物、逻辑和衔接，再决定怎样修改。'};
  }
  return {
    words,chapter,rememberedChapter,chapterCount:chapters.length,hasOutline,hasCharacters,hasProse,isScript,unit,firstPart,
    actionLabel:hasProse?'继续写作':'开始'+firstPart,nextAction,
    context:{workId:work.id,...(chapter?{chapterId:chapter.id}:{})},
    readiness:[
      {id:'outline',label:'故事大纲',ready:hasOutline,value:hasOutline?'已有内容':'待补充'},
      {id:'characters',label:'人物设定',ready:hasCharacters,value:hasCharacters?'已有内容':'待补充'},
      {id:'prose',label:isScript?'分场正文':'章节正文',ready:hasProse,value:hasProse?`${words.toLocaleString()} 字`:'尚未落笔'}
    ]
  };
}
