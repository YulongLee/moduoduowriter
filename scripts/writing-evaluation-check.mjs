import assert from 'node:assert/strict';
import React from 'react';
import TestRenderer,{act} from 'react-test-renderer';
import {createServer} from 'vite';
import {FIXED_WRITING_CASES,createWritingEvaluation,evaluationCandidateSummary,newEvaluationCandidate,parseEvaluationCandidateImport,saveWritingEvaluation,validateWritingEvaluation,writingEvaluationsCsv,writingRevisionStats,writingTextStats} from '../src/writingEvaluation.js';

assert.equal(FIXED_WRITING_CASES.length,8);assert.equal(new Set(FIXED_WRITING_CASES.map(item=>item.id)).size,8);
for(const sample of FIXED_WRITING_CASES){assert.ok(sample.sourceText.trim()&&sample.prompt.trim());assert.ok(sample.checks.length>=3);assert.ok(['continue','dialogue','character','outline','review','polish','title'].includes(sample.task));}
const blank=createWritingEvaluation();
assert.equal(blank.blind,true);assert.equal(blank.method,'manual');assert.equal(blank.candidates.length,2);
for(const candidate of blank.candidates){assert.equal(candidate.elapsedMs,null);assert.equal(candidate.costCredits,null);assert.equal(candidate.costCny,null);assert.equal(candidate.finalConfirmed,false);assert.equal(candidate.text,'');assert.deepEqual(Object.values(candidate.scores),[null,null,null]);}
assert.throws(()=>validateWritingEvaluation(blank),/原始文本/);
const repeated=writingTextStats('林渡拿起那把旧钥匙。林渡拿起那把旧钥匙。顾明离开了仓库。');
assert.equal(repeated.repeatedSentenceKinds,1);assert.equal(repeated.repeatedOccurrences,1);
const change=writingRevisionStats('她拿起钥匙。','她拿起旧钥匙。');
assert.equal(change.addedChars,1);assert.equal(change.removedChars,0);assert.equal(change.retentionRate,1);assert.equal(change.approximate,false);
assert.equal(writingRevisionStats('她 拿起钥匙。\n','她拿起钥匙。').removedChars,0);
const large=writingRevisionStats('甲'.repeat(100),'乙'.repeat(100),{maxSteps:1});assert.equal(large.approximate,true);
const lcs=(left,right)=>{const row=Array(right.length+1).fill(0);for(const char of left){let previous=0;for(let index=1;index<=right.length;index++){const old=row[index];row[index]=char===right[index-1]?previous+1:Math.max(row[index],row[index-1]);previous=old;}}return row.at(-1);};
for(let index=0;index<50;index++){const left=Array.from({length:10},()=>String.fromCharCode(97+Math.floor(Math.random()*4))).join(''),right=Array.from({length:12},()=>String.fromCharCode(97+Math.floor(Math.random()*4))).join('');assert.equal(writingRevisionStats(left,right).retainedChars,lcs(left,right),'Retained characters must equal a controlled reference LCS');}
let record={...blank,title:'固定素材 A/B',candidates:[newEvaluationCandidate({text:'林渡拿起钥匙。',label:'私有来源版本',editedText:'林渡拿起旧钥匙。',finalConfirmed:true,scores:{consistency:4},elapsedMs:12340,costCny:0.025,costCredits:12}),newEvaluationCandidate({text:'顾明推开仓门。',label:'第二个隐藏版本'})]};
record={...record,preferredId:record.candidates[0].id};
const records=saveWritingEvaluation([],record),reopened=JSON.parse(JSON.stringify(records))[0];
assert.equal(reopened.id,record.id);assert.equal(reopened.preferredId,record.preferredId);assert.equal(reopened.candidates[0].elapsedMs,12340);assert.equal(reopened.candidates[1].elapsedMs,null);assert.equal(reopened.candidates[1].costCny,null);
assert.equal(evaluationCandidateSummary(record.candidates[0]).score,4);assert.equal(evaluationCandidateSummary(record.candidates[0]).scoredDimensions,1);assert.equal(evaluationCandidateSummary(record.candidates[1]).score,null);
assert.equal(saveWritingEvaluation(records,{...record,notes:'已核对人物能力边界。'}).length,1,'Saving updates the same record');
assert.throws(()=>validateWritingEvaluation({...record,candidates:record.candidates.map((candidate,index)=>index?candidate:{...candidate,elapsedMs:-1})}),/非负/);
assert.throws(()=>validateWritingEvaluation({...record,candidates:record.candidates.map((candidate,index)=>index?candidate:{...candidate,scores:{...candidate.scores,consistency:6}})}),/1–5/);
const csv=writingEvaluationsCsv(records);assert.ok(!csv.includes('私有来源版本'));assert.ok(csv.includes('12340')&&csv.includes('0.025'));assert.ok(csv.includes('"未记录"')===false,'Unknown measurements stay empty in CSV');
assert.ok(writingEvaluationsCsv([{...record,blind:false}]).includes('私有来源版本'));
const formulaCsv=writingEvaluationsCsv([{...record,title:'=HYPERLINK("bad")'}]);assert.ok(formulaCsv.includes("'=HYPERLINK"),'CSV user text must not become spreadsheet formulas');
assert.equal(parseEvaluationCandidateImport('正文候选','候选文件')[0].costCny,null);
assert.equal(parseEvaluationCandidateImport(JSON.stringify({candidates:['候选一','候选二']})).length,2);
assert.throws(()=>parseEvaluationCandidateImport('字'.repeat(20001)),/2 万/);
assert.throws(()=>parseEvaluationCandidateImport(JSON.stringify({candidates:[{text:''}]})),/不能为空/);
console.log('PASS eight fixed cases, empty measurements, manual score handling, exact/bounded revision statistics, repetition counts, validated save/reopen, private labels and safe exports');

globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const storage=new Map(),originalFetch=globalThis.fetch;let fetchCalls=0,renderer,vite,routedCase;
globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
globalThis.fetch=async()=>{fetchCalls++;throw new Error('Evaluation must not call a model or service');};
const text=node=>typeof node==='string'?node:(node?.children||[]).map(text).join('');
const button=label=>renderer.root.findAllByType('button').find(node=>text(node).trim()===label);
const click=async node=>{assert.ok(node,'Expected visible control');await act(async()=>await node.props.onClick());};
const input=async(label,value)=>act(async()=>renderer.root.findByProps({'aria-label':label}).props.onChange({target:{value}}));
try {
 vite=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});
 const {WritingEvaluation}=await vite.ssrLoadModule('/src/WritingEvaluation.jsx');
 const mount=async()=>act(async()=>{renderer=TestRenderer.create(React.createElement(WritingEvaluation,{onRunCase:value=>{routedCase=value;}}));});
 await mount();assert.equal(fetchCalls,0);assert.equal(renderer.root.findAllByProps({'aria-label':'候选 A 版本备注'}).length,0,'Version labels must be hidden by default');
 await click(button('带入写作工具'));assert.equal(routedCase.id,'opening');assert.equal(fetchCalls,0,'Routing a case must not generate automatically');
 await input('候选 A 原始文本','林渡拿起钥匙，推开仓门。');await input('候选 B 原始文本','林渡握紧旧钥匙，听见门内咳嗽。');
 assert.ok(text(renderer.root).includes('未记定稿'),'Pasting a candidate is not automatically considered adoption');
 await input('候选 A 人物与事实一致性','4');await input('候选 A 情节因果与衔接','5');await input('候选 A 定稿文本','林渡拿起旧钥匙，推开仓门。');
 await input('候选 A 耗时秒','12.5');await input('候选 A 实际成本元','0.02');
 await act(async()=>renderer.root.findByProps({'aria-label':'首选候选 A'}).props.onChange());
 await click(button('揭示版本备注'));await input('候选 A 版本备注','人工记录的版本一');await click(button('隐藏版本备注'));assert.ok(!text(renderer.root).includes('人工记录的版本一'));
 await click(button('保存人工评估'));
 const saved=JSON.parse(storage.get('mdd-evaluations-v1'))[0];assert.equal(saved.candidates[0].elapsedMs,12500);assert.equal(saved.candidates[0].costCny,0.02);assert.equal(saved.candidates[0].finalConfirmed,true);assert.equal(saved.candidates[1].elapsedMs,null);assert.equal(saved.candidates[1].costCny,null);
 await act(async()=>renderer.unmount());await mount();
 await click(renderer.root.findAllByType('button').find(node=>text(node).trim()==='已保存评估 1'));
 await click(renderer.root.findAllByType('button').find(node=>text(node).includes(saved.title)&&text(node).includes('人工评估')));
 assert.equal(renderer.root.findByProps({'aria-label':'候选 A 原始文本'}).props.value,saved.candidates[0].text);assert.equal(renderer.root.findByProps({'aria-label':'候选 A 耗时秒'}).props.value,12.5);assert.equal(renderer.root.findAllByProps({'aria-label':'候选 A 版本备注'}).length,0);
 await click(renderer.root.findByProps({'aria-label':`删除评估 ${saved.title}`}));assert.deepEqual(JSON.parse(storage.get('mdd-evaluations-v1')),[]);
 assert.equal(fetchCalls,0);
 console.log('PASS mounted blind evaluation, explicit tool routing, real manual measurements, unconfirmed adoption, save/reopen and deletion without any generation request');
} finally {if(renderer)await act(async()=>renderer.unmount());if(vite)await vite.close();globalThis.fetch=originalFetch;}
