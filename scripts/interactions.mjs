import assert from 'node:assert/strict';
import React, { useState } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { createServer } from 'vite';

// These are in-memory React component tests, not browser automation or visual QA.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.window = { innerWidth:1280 };
const stored = new Map();
globalThis.localStorage = {
  getItem(key) { return stored.get(key) ?? null; },
  setItem(key,value) { stored.set(key,value); }
};
const server = await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
const textOf=node=>typeof node==='string'?node:(node?.children||[]).map(textOf).join('');
const findButton=(renderer,label)=>renderer.root.findAllByType('button').find(button=>textOf(button).trim()===label);
const click=async button=>{assert.ok(button,'Expected button was not rendered');await act(async()=>button.props.onClick());};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

try {
  const { Editor } = await server.ssrLoadModule('/src/main.jsx');
  const { initialWorks } = await server.ssrLoadModule('/src/data.js');
  const { DismantleDesk, NovelDesk } = await server.ssrLoadModule('/src/ProductDesk.jsx');
  const { ReferenceTools, ReferenceHome } = await server.ssrLoadModule('/src/Workbench.jsx');
  const { WorksPage } = await server.ssrLoadModule('/src/Library.jsx');
  const { ScriptDesk } = await server.ssrLoadModule('/src/ScriptDesk.jsx');
  const { readStoredArray, writeStoredValue } = await server.ssrLoadModule('/src/storage.js');
  const notices=[];
  const notify=message=>notices.push(message);
  let modal;
  let editedWork;
  let renderer;
  const initialText=initialWorks[0].chapters[0].text;
  function EditorHarness() {
    const [work,setWork]=useState(initialWorks[0]);
    editedWork=work;
    return React.createElement(Editor,{work,onChange:setWork,onBack(){},notify,setModal:value=>{modal=value;}});
  }
  await act(async()=>{renderer=TestRenderer.create(React.createElement(EditorHarness));});
  const generate=renderer.root.findByProps({'aria-label':'生成创作示例'});
  await act(async()=>{generate.props.onClick();await delay(1000);});
  assert.equal(editedWork.chapters[0].text,initialText,'Generating a candidate must not modify the manuscript');
  await click(findButton(renderer,'预览并采纳'));
  assert.equal(modal.type,'draft-review');
  assert.equal(modal.before,initialText);
  assert.equal(editedWork.chapters[0].text,initialText,'Opening preview must not modify the manuscript');
  await act(async()=>modal.onApply('确认后的新正文','replace'));
  assert.equal(editedWork.chapters[0].text,'确认后的新正文');
  await click(findButton(renderer,'撤销采纳'));
  assert.equal(editedWork.chapters[0].text,initialText,'Undo must restore the actual source text');
  await click(findButton(renderer,'预览并采纳'));
  await act(async()=>modal.onApply('追加段落','append'));
  assert.equal(editedWork.chapters[0].text,initialText+'\n\n追加段落');
  await act(async()=>renderer.root.findByProps({'aria-label':'章节正文'}).props.onChange({target:{value:'后续手动编辑'}}));
  assert.equal(findButton(renderer,'撤销采纳'),undefined,'Old adoption undo must not discard later manual editing');
  assert.equal(editedWork.chapters[0].text,'后续手动编辑');
  await act(async()=>renderer.unmount());
  console.log('PASS candidate preview, replace, append, undo and subsequent manual editing');

  globalThis.window.innerWidth=375;
  await act(async()=>{renderer=TestRenderer.create(React.createElement(EditorHarness));});
  const aiPanels=()=>renderer.root.findAll(node=>node.type==='aside'&&node.props.className==='ai-panel');
  const chapterOpen=()=>renderer.root.findAll(node=>node.type==='aside'&&node.props.className.includes('chapter-open')).length>0;
  assert.equal(aiPanels().length,0,'Small screens should start with the manuscript visible');
  await click(renderer.root.findByProps({'aria-label':'打开章节目录'}));
  assert.ok(chapterOpen());
  await click(findButton(renderer,'AI 助手'));
  assert.equal(aiPanels().length,1);
  assert.equal(chapterOpen(),false,'Opening AI should close the chapter drawer');
  await click(renderer.root.findByProps({'aria-label':'打开章节目录'}));
  assert.equal(aiPanels().length,0,'Opening chapters should close the AI drawer');
  assert.ok(chapterOpen());
  await click(renderer.root.findByProps({'aria-label':'显示或隐藏 AI 面板'}));
  assert.equal(chapterOpen(),false,'The toolbar should also close the chapter drawer');
  assert.equal(aiPanels().length,1);
  await act(async()=>renderer.unmount());
  globalThis.window.innerWidth=1280;
  console.log('PASS small-screen editor starts on the manuscript and keeps drawers mutually exclusive');

  const deskProps={works:initialWorks,notify,setModal:value=>{modal=value;}};
  await act(async()=>{renderer=TestRenderer.create(React.createElement(DismantleDesk,deskProps));});
  await click(findButton(renderer,'体验示例'));
  await act(async()=>{findButton(renderer,'开始拆解').props.onClick();await delay(700);});
  assert.ok(textOf(renderer.root).includes('预置示例解析'));
  await act(async()=>renderer.root.findByProps({'aria-label':'我的阅读笔记'}).props.onChange({target:{value:'用熟悉事物中的异常，打开新的故事。'}}));
  await click(findButton(renderer,'保存笔记'));
  const saved=JSON.parse(stored.get('mdd-reading-v1'));
  assert.equal(saved.length,1);
  assert.equal(saved[0].note,'用熟悉事物中的异常，打开新的故事。');
  await act(async()=>renderer.unmount());
  await act(async()=>{renderer=TestRenderer.create(React.createElement(DismantleDesk,deskProps));});
  await click(renderer.root.findAllByType('button').find(button=>textOf(button).startsWith('我的拆书')));
  assert.ok(textOf(renderer.root).includes(saved[0].note),'Saved notes must survive component remount');
  await click(findButton(renderer,'继续阅读'));
  assert.equal(renderer.root.findByProps({'aria-label':'我的阅读笔记'}).props.value,saved[0].note);
  await act(async()=>renderer.unmount());
  console.log('PASS sample reading report, editable note, persistence, history and reopening');

  function ToolsHarness() {
    const [favorites,setFavorites]=useState([]);
    return React.createElement(ReferenceTools,{favorites,toggleFavorite:id=>setFavorites(prev=>prev.includes(id)?prev.filter(value=>value!==id):[...prev,id]),setModal(){},navigate(){}});
  }
  await act(async()=>{renderer=TestRenderer.create(React.createElement(ToolsHarness));});
  await click(renderer.root.findByProps({'aria-label':'收藏故事灵感发生器'}));
  await click(renderer.root.findAllByType('button').find(button=>textOf(button).startsWith('我的收藏')));
  assert.equal(renderer.root.findAll(node=>node.type==='article'&&node.props.className==='market-card').length,1);
  await click(renderer.root.findByProps({'aria-label':'取消收藏故事灵感发生器'}));
  assert.ok(textOf(renderer.root).includes('还没有收藏这类工具'));
  await click(findButton(renderer,'浏览全部工具'));
  await act(async()=>renderer.root.findByProps({'aria-label':'搜索工具'}).props.onChange({target:{value:'完全不存在的关键词'}}));
  assert.ok(textOf(renderer.root).includes('暂时没有找到相关工具'));
  await click(findButton(renderer,'浏览全部工具'));
  assert.equal(renderer.root.findAll(node=>node.type==='article'&&node.props.className==='market-card').length,8);
  await act(async()=>renderer.unmount());
  console.log('PASS favorite, unfavorite, favorite filter, search and empty-state recovery');
  let homeRoute,homeImport=false;
  function HomeHarness(){const [favorites,setFavorites]=useState([]);return React.createElement(ReferenceHome,{works:initialWorks,favorites,toggleFavorite:id=>setFavorites(prev=>prev.includes(id)?prev.filter(v=>v!==id):[...prev,id]),setModal:m=>modal=m,navigate:route=>homeRoute=route,onImport(){homeImport=true;},notify});}
  await act(async()=>{renderer=TestRenderer.create(React.createElement(HomeHarness));});
  const home=renderer.root.findByProps({className:'home-v2'});const composer=home.findAllByType('section')[0];assert.equal(composer.props['aria-label'],'一句话创作');assert.equal(textOf(renderer.root.findByType('h1')),'一句话生成爆款小说');assert.ok(textOf(composer).includes('小说大纲、人物设定和开篇正文'));assert.equal(composer.findAllByProps({'aria-label':'继续创作与创作概况'}).length,0);assert.equal(home.findByProps({className:'home-books-section'}).findAllByProps({'aria-label':'继续创作与创作概况'}).length,1);
  await click(findButton(renderer,'导入文稿'));assert.equal(homeImport,true);
  assert.equal(renderer.root.findAll(node=>node.type==='article'&&node.props.className?.includes('home-tool-card')).length,8);
  await click(renderer.root.findAllByType('button').find(button=>textOf(button).startsWith('我的收藏')));assert.ok(textOf(renderer.root).includes('还没有收藏工具'));
  await click(findButton(renderer,'看看推荐工具'));assert.equal(renderer.root.findAll(node=>node.type==='article'&&node.props.className?.includes('home-tool-card')).length,8);
  await click(renderer.root.findByProps({'aria-label':'使用故事灵感发生器'}));assert.equal(modal.type,'tool');assert.equal(modal.tool.id,'ideas');
  await click(renderer.root.findByProps({'aria-label':`继续最近作品：${initialWorks[0].title}`}));assert.equal(homeRoute,`editor/${initialWorks[0].id}`);
  await click(renderer.root.findByProps({'aria-label':`打开作品：${initialWorks[1].title}`}));assert.equal(homeRoute,`editor/${initialWorks[1].id}`);
  await click(findButton(renderer,'创作设置'));assert.equal(modal.type,'settings');
  await click(findButton(renderer,'备份恢复'));assert.equal(modal.type,'settings');
  await click(renderer.root.findByProps({'aria-label':'使用帮助'}));assert.equal(modal.type,'help');
  await act(async()=>renderer.root.findByType('form').props.onSubmit({preventDefault(){}}));assert.ok(notices.at(-1).includes('先写下一点灵感'));
  const choose=async(label,value)=>click(renderer.root.findByProps({'aria-label':label}).findAllByType('button').find(b=>textOf(b).trim()===value));
  await choose('故事题材','悬疑');await choose('目标读者','女频');await choose('叙述视角','第一人称');await choose('作品篇幅','短篇故事');
  await act(async()=>renderer.root.findByProps({'aria-label':'一句话故事灵感'}).props.onChange({target:{value:'  停摆钟楼里的明日来信  '}}));
  await act(async()=>renderer.root.findByProps({'aria-label':'创作模式'}).props.onChange({target:{value:'长篇规划'}}));
  await act(async()=>renderer.root.findByType('form').props.onSubmit({preventDefault(){}}));
  assert.deepEqual({type:modal.type,idea:modal.idea,genre:modal.genre,audience:modal.audience,perspective:modal.perspective,kind:modal.kind,mode:modal.mode,autoGenerate:modal.autoGenerate},{type:'quick-start',idea:'停摆钟楼里的明日来信',genre:'悬疑',audience:'女频',perspective:'第一人称',kind:'短篇故事',mode:'长篇规划',autoGenerate:true});
  await click(renderer.root.findByProps({'aria-label':'创作快捷入口'}).findAllByType('button').find(b=>textOf(b).startsWith('投稿中心')));assert.equal(homeRoute,'submit');
  await click(renderer.root.findByProps({'aria-label':'收藏故事灵感发生器'}));await click(renderer.root.findAllByType('button').find(b=>textOf(b).startsWith('我的收藏')));assert.equal(renderer.root.findAll(node=>node.type==='article'&&node.props.className?.includes('home-tool-card')).length,1);
  assert.equal(textOf(renderer.root.findByProps({className:'home-service-status'})),'示例体验');assert.equal(renderer.root.findAllByProps({className:'home-model-button'}).length,0);await act(async()=>renderer.unmount());
  await act(async()=>{renderer=TestRenderer.create(React.createElement(ReferenceHome,{works:[],favorites:[],toggleFavorite(){},setModal:m=>modal=m,navigate(){},onImport(){},notify}));});assert.ok(textOf(renderer.root).includes('创建第一部作品'));assert.ok(!textOf(renderer.root).includes('NaN'));await click(findButton(renderer,'新建我的第一部作品'));assert.equal(modal.type,'create');await click(renderer.root.findByProps({'aria-label':'创建第一部作品'}));assert.equal(modal.type,'create');await act(async()=>renderer.unmount());
  console.log('PASS redesigned home creation settings, continue-writing, book navigation, tool launch, favorites, services and empty workspace');


  await act(async()=>{renderer=TestRenderer.create(React.createElement(NovelDesk,{works:initialWorks,navigate(){},setModal:value=>{modal=value;},onImport(){}}));});
  await click(renderer.root.findAllByType('button').find(button=>button.props.className==='novel-start start-short'));
  assert.equal(modal.kind,'短篇故事');
  await act(async()=>renderer.unmount());
  console.log('PASS short-story creation entry');
  let scriptRoute,favoriteTool;
  const scriptProps={works:initialWorks,favorites:[],toggleFavorite:id=>favoriteTool=id,setModal:value=>modal=value,navigate:value=>scriptRoute=value};
  await act(async()=>{renderer=TestRenderer.create(React.createElement(ScriptDesk,scriptProps));});
  await click(findButton(renderer,'新建剧本'));assert.equal(modal.kind,'剧本');
  await click(findButton(renderer,'创作原创剧本'));assert.equal(modal.type,'create');assert.equal(modal.kind,'剧本');
  await click(findButton(renderer,'从小说改编'));assert.equal(modal.flow.id,'script');
  await click(renderer.root.findByProps({'aria-label':'剧本创作步骤'}).findAllByType('button')[2]);assert.equal(modal.tool.id,'dialogue');
  await click(renderer.root.findByProps({'aria-label':'收藏立体人物设计'}));assert.equal(favoriteTool,'character');
  await click(findButton(renderer,'创建第一部剧本'));assert.equal(modal.kind,'剧本');assert.ok(textOf(renderer.root).includes('第一场戏，就从这里开始。'));await act(async()=>renderer.unmount());
  const existingScript={...initialWorks[0],id:'script-test',kind:'剧本',title:'雨夜来信 · 文字剧本'};
  await act(async()=>{renderer=TestRenderer.create(React.createElement(ScriptDesk,{...scriptProps,works:[...initialWorks,existingScript]}));});
  assert.ok(!textOf(renderer.root).includes('第一场戏，就从这里开始。'));await click(renderer.root.findByProps({'aria-label':'继续写作：雨夜来信 · 文字剧本'}));assert.equal(scriptRoute,'editor/script-test');await click(renderer.root.findByProps({'aria-label':'管理雨夜来信 · 文字剧本'}));assert.equal(modal.work.id,'script-test');await act(async()=>renderer.unmount());
  console.log('PASS refined script desk creation, adaptation, dialogue, favorites, empty state and existing-script editing');


  let destination;
  await act(async()=>{renderer=TestRenderer.create(React.createElement(WorksPage,{works:initialWorks,navigate:route=>{destination=route;},setModal:value=>{modal=value;},notify,onImport(){}}));});
  assert.equal(renderer.root.findAll(node=>node.type==='article'&&node.props.className.startsWith('work-card ')).length,3);
  await click(renderer.root.findByProps({'aria-label':'列表视图'}));
  assert.equal(renderer.root.findAllByProps({className:'work-list-row'}).length,3);
  await click(findButton(renderer,'短篇故事'));
  assert.equal(renderer.root.findAllByProps({className:'work-list-row'}).length,1);
  await click(renderer.root.findByProps({className:'work-list-row'}).findAllByType('button').find(button=>textOf(button).trim()==='继续写作'));
  assert.equal(destination,'editor/spring');
  await act(async()=>renderer.root.findByProps({'aria-label':'搜索作品'}).props.onChange({target:{value:'不存在的书名'}}));
  assert.ok(textOf(renderer.root).includes('没有找到这部作品'));
  await click(findButton(renderer,'清空筛选'));
  assert.equal(renderer.root.findAllByProps({className:'work-list-row'}).length,3);
  await click(renderer.root.findByProps({'aria-label':'卡片视图'}));
  assert.equal(renderer.root.findAll(node=>node.type==='article'&&node.props.className.startsWith('work-card ')).length,3);
  await act(async()=>renderer.unmount());
  console.log('PASS redesigned work library, view switching, filtering, empty-state recovery and correct editor navigation');

  const unavailable={getItem(){throw new Error('Access denied');},setItem(){throw new Error('Quota exceeded');}};
  assert.deepEqual(readStoredArray(unavailable,'works',['fallback']),['fallback']);
  assert.equal(writeStoredValue(unavailable,'works',[]),false);
  assert.deepEqual(readStoredArray({getItem(){return '{invalid';}},'works',[]),[]);
  assert.deepEqual(readStoredArray({getItem(){return '{"wrong":"shape"}';}},'works',[]),[]);
  assert.equal(writeStoredValue(localStorage,'test-value',['saved']),true);
  assert.deepEqual(readStoredArray(localStorage,'test-value',[]),['saved']);
  console.log('PASS blocked storage, quota failure, invalid records and normal persistence');
} finally {
  await server.close();
}
