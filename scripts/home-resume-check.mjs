import assert from 'node:assert/strict';
import React from 'react';
import TestRenderer,{act} from 'react-test-renderer';
import {createServer} from 'vite';
import {placeRecentlyEdited} from '../src/works.js';
import {validateBackup,collectBackup,restoreBackup} from '../src/backup.js';

// Controlled sample documents and in-memory rendering only; no real manuscripts or paid calls.
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.window={innerWidth:1280};
globalThis.localStorage={getItem(){return null;},setItem(){}};
const original={id:'resume-story',title:'续写测试',genre:'悬疑',kind:'长篇小说',chapters:[{id:'first',title:'第一章',text:'第一章的正文。'},{id:'second',title:'雨夜来信',text:'第二章的正文。'}]};
const edited=placeRecentlyEdited([original],{...original,chapters:original.chapters.map(chapter=>chapter.id==='second'?{...chapter,text:'第二章修改后的正文。'}:chapter)})[0];
assert.equal(edited.lastEditedChapterId,'second');
assert.equal(original.lastEditedChapterId,undefined,'Tracking recent editing must not mutate existing data');
const renamed=placeRecentlyEdited([edited],{...edited,title:'更名后的作品'})[0];
assert.equal(renamed.lastEditedChapterId,'second','Metadata edits must preserve the remembered chapter');
const reordered=placeRecentlyEdited([renamed],{...renamed,chapters:[...renamed.chapters].reverse()})[0];
assert.equal(reordered.lastEditedChapterId,'second','Ordering alone must not invent a new last-edited chapter');
const removed=placeRecentlyEdited([edited],{...edited,chapters:edited.chapters.filter(chapter=>chapter.id!=='second')})[0];
assert.equal(removed.lastEditedChapterId,undefined,'Deleting the remembered chapter must clear the stale pointer');
const map=new Map(),storage={getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)};
restoreBackup(storage,validateBackup({format:'mdd-workspace',version:1,works:[edited]}));
const restored=collectBackup(storage).works[0];
assert.equal(restored.lastEditedChapterId,'second');
assert.throws(()=>validateBackup({format:'mdd-workspace',version:1,works:[{...edited,lastEditedChapterId:42}]}),/最近编辑章节/);
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
let renderer;
try{
 const {Editor}=await server.ssrLoadModule('/src/main.jsx');
 for(const [work,expected] of [[restored,'第二章修改后的正文。'],[original,'第一章的正文。'],[{...original,lastEditedChapterId:'missing'},'第一章的正文。'],[removed,'第一章的正文。']]){
  await act(async()=>{renderer=TestRenderer.create(React.createElement(Editor,{work,onChange(){},onBack(){},notify(){},setModal(){}}));});
  assert.equal(renderer.root.findByProps({'aria-label':'章节正文'}).props.value,expected);
  await act(async()=>renderer.unmount());renderer=null;
 }
 console.log('PASS genuine last-edited chapter tracking, metadata/order preservation, backup round-trip, editor resumption and deleted/legacy fallbacks');
}finally{if(renderer)await act(async()=>renderer.unmount());await server.close();}
