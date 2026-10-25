import React, { useEffect,useRef,useState } from 'react';
import { ArrowRight, Feather, Lightbulb, LoaderCircle, Sparkles } from 'lucide-react';
import { useGeneration, GenerationStatus } from './Generation';
import { TaskMeter,useTaskMeter } from './Billing.jsx';
import {useCollection} from './Workspace.jsx';
import {revisionFingerprint} from './Revision';
import './revision.css';
export { ReferenceHome, ReferenceTools, MarketCard, ToolPoster } from './Dashboard';

export function QuickStartDialog({ initial, createWork }) {
  const defaultNames={玄幻:'万象之外',都市:'长街来客',言情:'心动有回音',悬疑:'雨夜第七人',科幻:'第七次日落',仙侠:'山海问道',历史:'故城旧事',奇幻:'昨日来信',武侠:'风起时',末世:'黎明之前',游戏:'最后的玩家',现实:'人间小事',青春:'那年夏天',治愈:'等风来的日子'};
  const [drafts,setDrafts]=useCollection('planningDrafts',[]);
  const draftId=`planning:${revisionFingerprint(JSON.stringify([initial.idea,initial.genre,initial.audience,initial.perspective,initial.kind,initial.mode]))}`;
  const saved=drafts.find(item=>item.id===draftId&&item.type==='quick-start');
  const [restored]=useState(Boolean(saved));
  const [planning,setPlanning]=useState(()=>saved?.planning||{title:defaultNames[initial.genre]||'新的故事',outline:`最初的灵感\n${initial.idea}\n\n创作方向\n${initial.genre} · ${initial.audience} · ${initial.perspective} · ${initial.kind}\n\n故事起点\n让主角遇见一个打破日常的意外。从一个具体的场景切入，将灵感中的人物与冲突放进故事。\n\n中段推进\n主角主动寻找答案，逐步发现事件的另一面。每一条线索都带来新的选择，也让他付出代价。\n\n收束方向\n让主角面对最难的选择，回应最初的悬念，为故事留下有余韵的结尾。`,characters:'',text:''});
  const [scope,setScope]=useState(saved?.scope||'all'),[candidate,setCandidate]=useState(saved?.candidate||null),[chosen,setChosen]=useState(saved?.chosen||[]),[requirement,setRequirement]=useState(saved?.requirement||''),[hasGenerated,setHasGenerated]=useState(saved?.hasGenerated||false),[busy,setBusy]=useState(false),[saveError,setSaveError]=useState(false);
  const dirty=useRef(Boolean(saved));const current=useRef(planning);current.current=planning;
  const autoStarted=useRef(Boolean(saved));
  const generation=useGeneration();const meter=useTaskMeter('outline',{inputChars:(initial.idea?.length||0)+Object.values(planning).join('').length+requirement.length});
  const labels={title:'作品名称',outline:'初始创作规划',characters:'人物设定',text:'开篇正文'};
  const requestedFields=scope==='all'?Object.keys(labels):[scope];
  useEffect(()=>{setSaveError(!setDrafts(previous=>[{id:draftId,type:'quick-start',initial,planning,scope,candidate,chosen,requirement,hasGenerated,updatedAt:new Date().toISOString()},...previous.filter(item=>item.id!==draftId)]));},[planning,scope,candidate,chosen,requirement,hasGenerated]);
  const edit=(key,value)=>{dirty.current=true;setPlanning(previous=>({...previous,[key]:value}));};
  const run=()=>meter.run(async()=>{
    setBusy(true);const baseline={...current.current},fields=[...requestedFields];const firstPristine=!hasGenerated&&!dirty.current;
    try{
      const result=await generation.generate({task:'plan',prompt:[initial.idea,requirement&&`本轮改稿要求：${requirement}`,`本次只生成或重写：${fields.map(key=>labels[key]).join('、')}。未选择的内容保持现状。`].filter(Boolean).join('\n\n'),context:{creationMode:initial.mode||'灵感共创',genre:initial.genre,audience:initial.audience,perspective:initial.perspective,kind:initial.kind,currentPlanning:baseline,requestedFields:fields,instruction:'以作者当前已编辑的名称、总纲、人物与开篇为基础，保留已确认设定。'},target:meter.outputChars,mode:meter.model},()=>({structured:{...baseline,characters:baseline.characters||'主角：明确一个想要完成的目标，并为他设置一个必须克服的阻碍。'},source:'demo'}));
      const next=Object.fromEntries(fields.map(key=>[key,result.structured[key]??baseline[key]]));
      if(firstPristine&&JSON.stringify(current.current)===JSON.stringify(baseline)){setPlanning(previous=>({...previous,...next}));setCandidate(null);}else{setCandidate({values:next,baseline,source:result.source||generation.mode});setChosen(fields);}
      setHasGenerated(true);
    }finally{setBusy(false);}
  });
  useEffect(()=>{if(initial.autoGenerate&&generation.mode==='ai'&&!autoStarted.current){autoStarted.current=true;run();}},[generation.mode]);
  const stale=candidate&&JSON.stringify(candidate.baseline)!==JSON.stringify(planning);
  const adopt=()=>{if(stale)return;setPlanning(previous=>({...previous,...Object.fromEntries(chosen.map(key=>[key,candidate.values[key]]))}));dirty.current=true;setCandidate(null);};
  const save=()=>{setDrafts(previous=>previous.filter(item=>item.id!==draftId));createWork({...planning,title:planning.title.trim(),kind:initial.kind,genre:initial.genre,idea:initial.idea});};
  return <><div className="quick-start-heading"><span className="modal-symbol"><Feather size={24}/></span><GenerationStatus generation={generation} busy={busy}/></div><h2>确认创作规划</h2><p className="modal-desc">修改会保存为草稿。再次生成时，先对照候选内容，再决定采用哪些部分。</p>{restored&&<p className="revision-preview-note">已恢复这次创作的规划草稿。</p>}{saveError&&<p role="alert">规划草稿未能保存，请先复制内容备份。</p>}<label className="field">作品名称<input autoFocus maxLength={50} value={planning.title} onChange={e=>edit('title',e.target.value)}/></label><div className="quick-start-tags"><span>{initial.genre}</span><span>{initial.audience}</span><span>{initial.perspective}</span><span>{initial.kind}</span></div>{['outline','characters','text'].map(key=><label className="field" key={key}>{labels[key]}<textarea aria-label={labels[key]} rows={key==='outline'?8:key==='characters'?4:5} value={planning[key]} onChange={e=>edit(key,e.target.value)}/></label>)}<label className="field">本轮创作要求<span className="optional">选填</span><textarea aria-label="规划改稿要求" rows={2} value={requirement} onChange={e=>setRequirement(e.target.value)} placeholder="例如：保留人物关系，只把冲突推进得更紧凑"/></label><div className="quick-start-scope" aria-label="选择规划生成范围">{[['all','全部规划'],['outline','只重写总纲'],['characters','只重写人物'],['text','只重写开篇']].map(([value,label])=><button key={value} disabled={busy} aria-pressed={scope===value} onClick={()=>setScope(value)}>{label}</button>)}</div><TaskMeter meter={meter}/><button className="button secondary full" disabled={busy} onClick={run}>{busy?<LoaderCircle size={16} className="spin"/>:<Sparkles size={16}/>} {busy?'正在生成规划…':generation.mode==='ai'?'生成总纲、人物与开篇':'体验示例规划'}</button>{candidate&&<div className="planning-candidate"><h3>对照本轮候选</h3><p className="modal-desc">勾选要采用的部分，其余规划保持原样。</p>{Object.keys(candidate.values).map(key=><section key={key}><label className="field"><span><input type="checkbox" aria-label={`采纳${labels[key]}`} checked={chosen.includes(key)} onChange={e=>setChosen(previous=>e.target.checked?[...previous,key]:previous.filter(value=>value!==key))}/>{labels[key]}</span></label><div className="draft-comparison"><label className="field">当前内容<textarea readOnly value={planning[key]} rows={4}/></label><label className="field">候选内容<textarea aria-label={`${labels[key]}候选`} value={candidate.values[key]} rows={4} onChange={e=>setCandidate(previous=>({...previous,values:{...previous.values,[key]:e.target.value}}))}/></label></div></section>)}{stale&&<p className="revision-stale" role="alert">你在生成后又修改了规划，请重新生成候选后再采纳。</p>}<button className="button primary full" disabled={stale||!chosen.length||busy} onClick={adopt}>确认采纳所选规划</button><button className="text-button" onClick={()=>setCandidate(null)}>保留当前规划，放下候选</button></div>}<div className="soft-notice"><Lightbulb size={17}/>{generation.source==='ai'?'规划已根据本次灵感生成，保存前请确认。':'当前规划可自行编辑，选择智能创作后可继续完善。'}</div><button className="button primary full" disabled={!planning.title.trim()||busy} onClick={save}>保存规划，进入编辑器<ArrowRight size={16}/></button></>;
}
