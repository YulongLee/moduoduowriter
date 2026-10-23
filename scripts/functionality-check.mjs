import assert from 'node:assert/strict';
import React,{useState} from 'react';
import TestRenderer,{act} from 'react-test-renderer';
import {createServer} from 'vite';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.window={innerWidth:1400};
const data=new Map();globalThis.localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
const text=node=>typeof node==='string'?node:(node?.children||[]).map(text).join('');
const button=(r,name)=>r.root.findAllByType('button').find(b=>text(b).trim()===name);
const click=async b=>{assert.ok(b,'Missing button');await act(async()=>{await b.props.onClick();});};
const change=async(node,value)=>act(async()=>node.props.onChange({target:{value}}));
let renderer;
try {
 const {initialWorks,workflows}=await server.ssrLoadModule('/src/data.js');
 const {splitManuscript,moveChapter,saveChapterVersion}=await server.ssrLoadModule('/src/works.js');
 const {collectBackup,validateBackup,restoreBackup}=await server.ssrLoadModule('/src/backup.js');
 assert.equal(splitManuscript('\ufeff序言\r\n\r\n第一章 启程\r\n第一段\r\n第二章 回声\r\n第二段').length,3);
 assert.equal(splitManuscript('单章文稿')[0].text,'单章文稿');
 const moved=moveChapter(initialWorks[0],'f3',-1);assert.equal(moved.chapters[1].id,'f3');assert.equal(initialWorks[0].chapters[1].id,'f2');
 localStorage.setItem('mdd-works-v1',JSON.stringify(initialWorks));
 const backup=collectBackup(localStorage);assert.equal(backup.works.length,3);assert.ok(!JSON.stringify(backup).includes('apiKey'));
 const incoming=structuredClone(backup);incoming.works[0].title='备份中的新标题';const merged=restoreBackup(localStorage,incoming);assert.equal(merged.works.length,4);assert.equal(merged.works[0].title,'长街雾未散');assert.ok(merged.works.some(w=>w.title==='备份中的新标题（恢复副本）'));
 assert.throws(()=>validateBackup({...backup,works:[{id:'bad'}]}));
 assert.throws(()=>validateBackup({...backup,reading:[{id:'bad',title:'坏记录'}]}));
 const before=localStorage.getItem('mdd-works-v1');let writes=0;const failStorage={getItem:localStorage.getItem,removeItem:localStorage.removeItem,setItem(k,v){if(++writes===2)throw Error('Quota');localStorage.setItem(k,v);}};assert.throws(()=>restoreBackup(failStorage,incoming));assert.equal(localStorage.getItem('mdd-works-v1'),before,'Failed restoration must roll back original data');
 console.log('PASS manuscript chapter splitting, chapter ordering, validated backup merge, conflict copies and rollback on failed import');
 const {ChapterManager,VersionDialog}=await server.ssrLoadModule('/src/WorkManagement.jsx');let work;
 function ChapterHarness(){const [value,setValue]=useState(initialWorks[0]);work=value;return React.createElement(ChapterManager,{work:value,chapterId:'f1',onChange:setValue,notify(){}});}
 await act(async()=>{renderer=TestRenderer.create(React.createElement(ChapterHarness));});await click(renderer.root.findByProps({'aria-label':'上移第三章 · 钟楼里的脚步'}));assert.equal(work.chapters[1].id,'f3');
 await click(button(renderer,'删除'));await click(button(renderer,'确认删除'));assert.equal(work.chapters.length,2);assert.equal(work.versions[0].chapterId,'f1');
 const deleted=work;await act(async()=>renderer.unmount());
 function VersionHarness(){const [value,setValue]=useState(deleted);work=value;return React.createElement(VersionDialog,{work:value,chapterId:'f2',onChange:setValue,notify(){}});}
 await act(async()=>{renderer=TestRenderer.create(React.createElement(VersionHarness));});await click(button(renderer,'恢复此版本'));assert.equal(work.chapters.length,2,'First click should ask to confirm');await click(button(renderer,'确认恢复此版本'));assert.equal(work.chapters.length,3);assert.equal(work.chapters.find(c=>c.id==='f1').text,initialWorks[0].chapters[0].text);assert.ok(work.versions.some(v=>v.label==='恢复前备份'));await act(async()=>renderer.unmount());
 console.log('PASS chapter deletion confirmation, automatic deleted-text version and restoring a deleted chapter');
 const {WorkflowDialog}=await server.ssrLoadModule('/src/main.jsx');
 localStorage.setItem('mdd-workflows-v1','[]');const props={flow:workflows[0],works:initialWorks,createWork(){}};
 await act(async()=>{renderer=TestRenderer.create(React.createElement(WorkflowDialog,props));});await change(renderer.root.findAllByType('textarea')[0],'蓝色邮筒会寄往明天');await click(button(renderer,'开始第一步'));await change(renderer.root.findAllByType('textarea')[0],'用户确认的第一步');await act(async()=>renderer.unmount());
 await act(async()=>{renderer=TestRenderer.create(React.createElement(WorkflowDialog,props));});assert.equal(renderer.root.findAllByType('textarea')[0].props.value,'用户确认的第一步');await click(button(renderer,'确认并继续'));await click(button(renderer,'返回上一步'));await change(renderer.root.findAllByType('textarea')[0],'修改后第一步');assert.ok(!text(renderer.root).includes('下一步已有结果'));await act(async()=>renderer.unmount());
 console.log('PASS workflow draft resumption, editable stages and invalidation of downstream results after source edits');
 const {VideoStudio,SubmissionDesk}=await server.ssrLoadModule('/src/StudioPages.jsx');
 await act(async()=>{renderer=TestRenderer.create(React.createElement(VideoStudio,{works:initialWorks,notify(){},setModal(){}}));});await change(renderer.root.findByProps({'aria-label':'分镜故事'}),'书店门响了。\n\n她带来了银色钥匙。');await click(button(renderer,'按原文整理分镜'));assert.equal(renderer.root.findByProps({'aria-label':'镜头1名称'}).props.value,'镜头 1');await click(button(renderer,'保存分镜'));assert.ok(JSON.parse(localStorage.getItem('mdd-video-v1'))[0].boards.some(b=>b.text.includes('银色钥匙')));await act(async()=>renderer.unmount());
 await act(async()=>{renderer=TestRenderer.create(React.createElement(VideoStudio,{works:initialWorks,notify(){},setModal(){}}));});await click(renderer.root.findAllByType('button').find(b=>text(b).includes('银色钥匙')));assert.ok(renderer.root.findByProps({'aria-label':'分镜故事'}).props.value.includes('银色钥匙'));await act(async()=>renderer.unmount());
 let submissions;function SubmissionHarness(){const [records,setRecords]=useState([]);submissions=records;return React.createElement(SubmissionDesk,{works:initialWorks,submissions:records,setSubmissions:setRecords,notify(){}});}
 await act(async()=>{renderer=TestRenderer.create(React.createElement(SubmissionHarness));});await change(renderer.root.findByProps({'aria-label':'投稿作品'}),'fog');await change(renderer.root.findByProps({'aria-label':'投稿日期'}),'2026-11-01');await change(renderer.root.findByProps({'aria-label':'投稿备注'}),'周五跟进编辑反馈');await act(async()=>renderer.root.findByType('form').props.onSubmit({preventDefault(){}}));assert.equal(submissions[0].date,'2026-11-01');assert.equal(submissions[0].workId,'fog');await change(renderer.root.findByProps({'aria-label':'长街雾未散投稿状态'}),'已投递');assert.equal(submissions[0].status,'已投递');await click(button(renderer,'编辑记录'));assert.equal(renderer.root.findByProps({'aria-label':'投稿备注'}).props.value,'周五跟进编辑反馈');await click(button(renderer,'删除'));await click(button(renderer,'确认删除记录'));assert.equal(submissions.length,0);await act(async()=>renderer.unmount());
 console.log('PASS input-based storyboard planning, saved draft resumption and editable submission dates, notes, statuses and deletion');
} finally {if(renderer)await act(async()=>renderer.unmount());await server.close();}
