import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React, {useState} from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import {createServer} from 'vite';

// In-memory interaction checks: no browser, network request or paid generation.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const server = await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
const text = node => typeof node === 'string' ? node : (node?.children || []).map(text).join('');
const click = async button => {assert.ok(button, 'Expected a reachable button');await act(async () => button.props.onClick());};
const button = (root,label) => root.findAllByType('button').find(item => text(item).trim() === label);
let renderer;
try {
  const {ReferenceHome} = await server.ssrLoadModule('/src/HomeDesk.jsx');
  const {ReferenceTools} = await server.ssrLoadModule('/src/Dashboard.jsx');
  const {ToolGuide} = await server.ssrLoadModule('/src/ToolGuide.jsx');
  const {toolGuides} = await server.ssrLoadModule('/src/toolGuides.js');
  const {initialWorks,tools,workWords} = await server.ssrLoadModule('/src/data.js');
  let modal,route;
  function Home() {
    const [favorites,setFavorites] = useState([]);
    return React.createElement(ReferenceHome,{works:[...initialWorks,{...initialWorks[0],id:'fourth',title:'第四部作品'}],favorites,toggleFavorite:id=>setFavorites(values=>values.includes(id)?values.filter(value=>value!==id):[...values,id]),setModal:value=>modal=value,navigate:value=>route=value,notify(){},onImport(){}});
  }
  await act(async () => {renderer=TestRenderer.create(React.createElement(Home));});
  const sections = renderer.toJSON().children.filter(node=>node && typeof node === 'object');
  assert.deepEqual(sections.map(node=>node.props.className),['home-composer','home-books-section','home-entry-grid','home-tools-section','home-support']);
  assert.equal(text(renderer.root.findByType('h1')),'一句话生成爆款小说');
  assert.equal(renderer.root.findAllByProps({className:'home-books-section'}).length,1);
  assert.equal(renderer.root.findAll(node=>node.type==='article' && node.props.className?.includes('home-book-card')).length,3);
  assert.ok(!text(renderer.root).includes('第四部作品'));
  assert.ok(!text(renderer.root).includes('累计字数'));
  assert.ok(text(renderer.root).includes(`${workWords(initialWorks[0]).toLocaleString()} 字 · ${initialWorks[0].chapters.length} 章`));
  await click(renderer.root.findByProps({'aria-label':`继续最近作品：${initialWorks[0].title}`}));
  assert.equal(route,`editor/${initialWorks[0].id}`);
  const entries=renderer.root.findByProps({'aria-label':'创作快捷入口'});
  for(const [label,expected] of [['小说写作','novels'],['剧本创作','scripts'],['小说拆书','dismantle'],['投稿中心','submit']]) {
    await click(entries.findAllByType('button').find(item=>text(item).startsWith(label)));assert.equal(route,expected);
  }
  const toolCards=renderer.root.findAll(node=>node.type==='article' && node.props.className?.includes('home-tool-card'));
  assert.equal(toolCards.length,8);
  assert.equal(renderer.root.findAll(node=>node.type==='div' && node.props.className?.includes('tool-artwork')).length,0);
  await click(renderer.root.findByProps({'aria-label':'更多故事题材'}));
  await click(renderer.root.findByProps({'aria-label':'故事题材'}).findAllByType('button').find(item=>text(item)==='治愈'));
  assert.equal(renderer.root.findByProps({'aria-label':'故事题材'}).findAllByType('button').find(item=>text(item)==='治愈').props['aria-pressed'],true);
  const before=renderer.root.findByProps({'aria-label':'一句话故事灵感'}).props.value;
  await click(renderer.root.findByProps({className:'home-prompt-ideas'}).findAllByType('button')[0]);
  assert.notEqual(renderer.root.findByProps({'aria-label':'一句话故事灵感'}).props.value,before);
  await click(renderer.root.findByProps({'aria-label':'换一批灵感'}));
  assert.ok(text(renderer.root.findByProps({className:'home-prompt-ideas'})).includes('穿越成小说里的反派'));
  for(const tool of tools) {
    await click(renderer.root.findByProps({'aria-label':`查看${tool.title}使用指南`}));
    const guide=renderer.root.findByProps({'aria-label':`${tool.title}使用指南`});
    assert.ok(text(guide).includes(toolGuides[tool.id].scene));
    await click(guide.findByProps({'aria-label':`使用${tool.title}示例`}));
    assert.equal(modal.tool.id,tool.id);assert.equal(modal.prompt,toolGuides[tool.id].prompt);assert.equal(modal.type,'tool');
  }
  await click(renderer.root.findByProps({'aria-label':'收起工具使用指南'}));
  await click(renderer.root.findByProps({'aria-label':'收藏故事灵感发生器'}));
  await click(renderer.root.findAllByType('button').find(item=>text(item).startsWith('我的收藏')));
  assert.equal(renderer.root.findAll(node=>node.type==='article' && node.props.className?.includes('home-tool-card')).length,1);
  await click(renderer.root.findByProps({'aria-label':'取消收藏故事灵感发生器'}));
  assert.ok(text(renderer.root).includes('还没有收藏工具'));
  await click(button(renderer.root,'看看推荐工具'));
  assert.equal(renderer.root.findAll(node=>node.type==='article' && node.props.className?.includes('home-tool-card')).length,8);
  for(const label of ['创作设置','备份恢复']) {await click(button(renderer.root,label));assert.equal(modal.type,'settings');}
  await click(renderer.root.findByProps({'aria-label':'使用帮助'}));assert.equal(modal.type,'help');
  await click(button(renderer.root,'查看创作方案'));assert.equal(route,'membership');
  await click(button(renderer.root,'查看工作流'));assert.equal(route,'workflows');
  await act(async()=>renderer.unmount());
  console.log('PASS homepage order, maximum three works, original routes, compact icon tools, preferences, ideas, guides, favorites and services');

  let copied;
  const originalNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{async writeText(value){copied=value;}}}});
  for(const tool of tools) {
    const guide=toolGuides[tool.id];
    assert.equal(guide.requirements.length,2);
    assert.ok(guide.prompt.length>50 && guide.result.length>50);
    await act(async()=>{renderer=TestRenderer.create(React.createElement(ToolGuide,{toolId:tool.id,onUseExample:value=>modal=value}));});
    await click(renderer.root.findByProps({'aria-label':`复制${tool.title}示例`}));
    assert.equal(copied,guide.prompt);assert.ok(text(renderer.root.findByProps({role:'status'})).includes('已复制'));
    await click(renderer.root.findByProps({'aria-label':`使用${tool.title}示例`}));assert.equal(modal,guide.prompt);
    assert.ok(text(renderer.root.findByType('details')).includes('预先编写的示例'));
    assert.ok(text(renderer.root.findByType('details')).includes(guide.result));
    await act(async()=>renderer.unmount());
  }
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{}});
  await act(async()=>{renderer=TestRenderer.create(React.createElement(ToolGuide,{toolId:'ideas'}));});
  await click(renderer.root.findByProps({'aria-label':'复制故事灵感发生器示例'}));assert.ok(text(renderer.root.findByProps({role:'status'})).includes('直接选择'));
  await act(async()=>renderer.unmount());
  if(originalNavigator)Object.defineProperty(globalThis,'navigator',originalNavigator);else delete globalThis.navigator;
  console.log('PASS all eight authored guides, exact example handoff, clipboard success and copy fallback');

  await act(async()=>{renderer=TestRenderer.create(React.createElement(ReferenceTools,{favorites:[],toggleFavorite(){},setModal:value=>modal=value,navigate(){}}));});
  await click(renderer.root.findByProps({'aria-label':'查看章节审稿助手使用指南'}));
  await click(renderer.root.findByProps({'aria-label':'使用章节审稿助手示例'}));
  assert.equal(modal.tool.id,'review');assert.equal(modal.prompt,toolGuides.review.prompt);
  await act(async()=>renderer.unmount());
  await act(async()=>{renderer=TestRenderer.create(React.createElement(ReferenceHome,{works:[],favorites:[],toggleFavorite(){},setModal:value=>modal=value,navigate(){},notify(){}}));});
  assert.equal(renderer.root.findAllByProps({'aria-label':'创建第一部作品'}).length,1);
  await click(renderer.root.findByProps({'aria-label':'创建第一部作品'}));assert.equal(modal.type,'create');
  assert.ok(!text(renderer.root).includes('NaN'));
  await act(async()=>renderer.unmount());
  const css=readFileSync(new URL('../src/home.css',import.meta.url),'utf8');
  assert.match(css,/\.home-tools-grid\s*\{[^}]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css,/@container home-workspace \(max-width:880px\)/);
  assert.ok(!css.includes('home-content-grid'));
  console.log('PASS market guide handoff, empty workspace recovery, four-column desktop grid and smaller-screen adaptation');
} finally {
  if(renderer)await act(async()=>renderer.unmount());
  await server.close();
}
