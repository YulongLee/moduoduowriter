import React,{useState} from 'react';
import {Check,ListTree,LoaderCircle,Plus,Sparkles,X} from 'lucide-react';
import {useGeneration,GenerationStatus} from './Generation';
import {TaskMeter,useTaskMeter} from './Billing.jsx';
import {ContextPicker} from './StoryMemory.jsx';
import {buildStoryContext} from './storyMemory';
import {newId} from './works';

export function ChapterPlanner({work,onChange,notify,onClose,onOpenQueue,initialPlans=[]}) {
 const [count,setCount]=useState(3),[prompt,setPrompt]=useState(''),[plans,setPlans]=useState(()=>initialPlans.map(plan=>({...plan,id:newId()}))),[busy,setBusy]=useState(false),[referenceIds,setReferenceIds]=useState(()=>[work.outline?.trim()?'work:outline':null,work.characters?.trim()?'work:characters':null].filter(Boolean));
 const references=buildStoryContext(work,{referenceIds});
 const generation=useGeneration(),meter=useTaskMeter('outline',{inputChars:references.inputChars+prompt.length});
 const generate=()=>meter.run(async()=>{
  setBusy(true);
  try {
   const result=await generation.generate({task:'chapterPlan',prompt,context:{workId:work.id,title:work.title,...references.context,existingChapterCount:work.chapters.length,count},target:1500,mode:meter.model},()=>({structured:{chapters:Array.from({length:count},(_,index)=>({title:`第${work.chapters.length+index+1}章 · 待命名`,summary:`示例章纲：承接总纲，围绕第 ${index+1} 个关键事件推动人物行动。请按自己的故事修改。`}))},source:'demo'}));
   if(!Array.isArray(result.structured?.chapters)||!result.structured.chapters.every(plan=>typeof plan.title==='string'&&plan.title.trim()&&typeof plan.summary==='string'&&plan.summary.trim()))throw new Error('返回的章节规划不完整，请重试。');
   setPlans(result.structured.chapters.map(plan=>({...plan,id:newId()})));
  } finally {setBusy(false);}
 });
 const apply=(openQueue=false)=>{
  const selected=plans.filter(plan=>plan.title.trim()&&plan.summary.trim());if(!selected.length)return;
  const emptyFirst=work.chapters.length===1&&!work.chapters[0].text.trim()&&!work.chapters[0].plan;
  const additions=selected.map(plan=>({id:plan.id,title:plan.title.trim(),text:'',plan:plan.summary.trim(),summary:''}));
  const updated={...work,chapters:emptyFirst?additions:[...work.chapters,...additions]};
  onChange(updated);notify(`已创建 ${selected.length} 个带章纲的新章节`);onClose();
  if(openQueue)onOpenQueue?.(updated);
 };
 const validCount=plans.filter(plan=>plan.title.trim()&&plan.summary.trim()).length;
 return <><span className="modal-symbol"><ListTree/></span><h2>把总纲拆成章节</h2><p className="modal-desc">结合已选资料规划接下来的故事。确认后创建空白章节，再逐章生成、核对正文。</p><label className="field">本次规划数量<select aria-label="规划章节数量" value={count} onChange={event=>setCount(Number(event.target.value))}>{[3,5,8,10].map(value=><option value={value} key={value}>{value} 个章节</option>)}</select></label><label className="field">这一段想推进什么？<textarea rows={3} value={prompt} onChange={event=>setPrompt(event.target.value)} placeholder="比如：让主角发现钟楼修复名单中被删去的第七人…"/></label><ContextPicker work={work} value={referenceIds} onChange={setReferenceIds} prompt={prompt}/><GenerationStatus generation={generation} busy={busy}/><TaskMeter meter={meter}/><button className="button primary full" disabled={busy} onClick={generate}>{busy?<LoaderCircle size={15} className="spin"/>:<Sparkles size={15}/>}生成章节规划</button><button className="button secondary full" disabled={busy||plans.length>=30} onClick={()=>setPlans(previous=>[...previous,{id:newId(),title:`第${work.chapters.length+previous.length+1}章 · 待命名`,summary:''}])}><Plus size={15}/>手工添加章纲</button>{plans.map((plan,index)=><section className="chapter-plan-item" key={plan.id}><div><strong>章节 {index+1}</strong><button className="icon-button" aria-label={`移除规划${index+1}`} onClick={()=>setPlans(previous=>previous.filter(value=>value.id!==plan.id))}><X size={14}/></button></div><label className="field">章节标题<input value={plan.title} onChange={event=>setPlans(previous=>previous.map(value=>value.id===plan.id?{...value,title:event.target.value}:value))}/></label><label className="field">本章目标与事件<textarea rows={3} value={plan.summary} onChange={event=>setPlans(previous=>previous.map(value=>value.id===plan.id?{...value,summary:event.target.value}:value))}/></label></section>)}{plans.length>0&&<><button className="button primary full" disabled={busy||!validCount} onClick={()=>apply()}><Check size={15}/>确认创建章节</button>{onOpenQueue&&<button className="button secondary full" disabled={busy||!validCount} onClick={()=>apply(true)}><ListTree size={15}/>创建章节并打开正文队列</button>}</>}
 </>;
}
