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
const originalFetch=globalThis.fetch,originalDocument=globalThis.document;
const networkRequests=[],listeners=new Map();
globalThis.fetch=async(url)=>{networkRequests.push(url);throw new Error('Homepage interactions must not request a service');};
globalThis.document={activeElement:null,addEventListener(type,listener){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(listener);},removeEventListener(type,listener){listeners.get(type)?.delete(listener);}};
const emit=(type,event={})=>{for(const listener of [...(listeners.get(type)||[])])listener(event);};
const change=async(node,value)=>act(async()=>node.props.onChange({target:{value}}));
const menuNodes=new Map();
const nodeMock=element=>{const node={label:element.props['aria-label'],focus(){document.activeElement=node;},contains:target=>target===node,querySelectorAll:()=>[],querySelector:()=>null};if(element.props.role==='menu'){const items=['guide','favorite'].map(name=>{const item={name,focus(){document.activeElement=item;}};return item;});node.querySelectorAll=()=>items;node.items=items;menuNodes.set(element.props['aria-label'],node);}return node;};
let renderer;
try {
  const {ReferenceHome} = await server.ssrLoadModule('/src/HomeDesk.jsx');
  const {ReferenceTools} = await server.ssrLoadModule('/src/Dashboard.jsx');
  const {ToolGuide} = await server.ssrLoadModule('/src/ToolGuide.jsx');
  const {toolGuides} = await server.ssrLoadModule('/src/toolGuides.js');
  const {initialWorks,tools,workWords} = await server.ssrLoadModule('/src/data.js');
  let modal,route,imports=0;const notices=[];
  const sampleWorks=[{...initialWorks[0],lastEditedChapterId:initialWorks[0].chapters[1].id},...initialWorks.slice(1),{...initialWorks[0],id:'fourth',title:'第四部作品'}];
  function Home({works=sampleWorks}={}) {
    const [favorites,setFavorites] = useState([]);
    return React.createElement(ReferenceHome,{works,favorites,toggleFavorite:id=>setFavorites(values=>values.includes(id)?values.filter(value=>value!==id):[...values,id]),setModal:value=>modal=value,navigate:value=>route=value,notify:value=>notices.push(value),onImport:()=>imports++});
  }
  const mountHome=async works=>act(async()=>{renderer=TestRenderer.create(React.createElement(Home,{works}),{createNodeMock:nodeMock});});
  const byLabel=label=>renderer.root.findByProps({'aria-label':label});
  const submit=async()=>act(async()=>renderer.root.findByType('form').props.onSubmit({preventDefault(){}}));
  const rows=()=>renderer.root.findAll(node=>node.type==='article' && node.props.className?.includes('home-tool-card'));
  const more=tool=>byLabel(`${tool.title}更多操作`);
  await mountHome();
  const sections = renderer.toJSON().children.filter(node=>node && typeof node === 'object');
  assert.deepEqual(sections.map(node=>node.props.className),['home-composer','home-books-section','home-entry-grid','home-tools-section','home-support']);
  assert.equal(text(renderer.root.findByType('h1')),'一句话生成爆款小说');
  assert.ok(!text(renderer.root).includes('AI工具'));
  assert.equal(renderer.root.findAllByProps({className:'home-books-section'}).length,1);
  assert.equal(renderer.root.findAll(node=>node.type==='article' && node.props.className?.includes('home-book-card')).length,3);
  assert.ok(!text(renderer.root).includes('第四部作品'));
  assert.ok(text(renderer.root).includes(`上次编辑：${initialWorks[0].chapters[1].title}`),'Only a real saved chapter reference may be presented as last edited');
  await click(byLabel(`继续最近作品：${initialWorks[0].title}`));assert.equal(route,`editor/${initialWorks[0].id}`);
  const entries=byLabel('创作快捷入口');
  for(const [label,expected] of [['小说写作','novels'],['剧本创作','scripts'],['小说拆书','dismantle'],['投稿中心','submit']]) {
    await click(entries.findAllByType('button').find(item=>text(item).startsWith(label)));assert.equal(route,expected);
  }
  assert.equal(byLabel('故事题材').type,'select');assert.equal(byLabel('作品篇幅').type,'select');
  assert.equal(byLabel('故事题材').props.value,'玄幻');assert.equal(byLabel('作品篇幅').props.value,'长篇小说');
  assert.equal(byLabel('创作偏好').props['aria-expanded'],false);
  assert.equal(renderer.root.findAllByProps({'aria-label':'目标读者'}).length,0);
  assert.equal(renderer.root.findAllByProps({'aria-label':'叙述视角'}).length,0);
  assert.equal(byLabel('一句话故事灵感').props.maxLength,500);
  modal=undefined;await submit();assert.equal(modal,undefined);assert.ok(notices.at(-1).includes('灵感'));
  await change(byLabel('故事题材'),'治愈');await change(byLabel('作品篇幅'),'短篇故事');
  await click(byLabel('创作偏好'));assert.equal(byLabel('创作偏好').props['aria-expanded'],true);
  await change(byLabel('目标读者'),'女频');await change(byLabel('叙述视角'),'第一人称');await change(byLabel('创作模式'),'长篇规划');
  await act(async()=>renderer.root.findByProps({className:'home-preference-panel'}).props.onKeyDown({key:'Escape',preventDefault(){},stopPropagation(){}}));assert.equal(byLabel('创作偏好').props['aria-expanded'],false);
  await change(byLabel('一句话故事灵感'),'  一封来自未来的旧信  ');await submit();
  assert.deepEqual(modal,{type:'quick-start',autoGenerate:true,idea:'一封来自未来的旧信',genre:'治愈',audience:'女频',perspective:'第一人称',kind:'短篇故事',mode:'长篇规划'});
  const previousModal=modal;
  assert.equal(byLabel('查看生成示例').props['aria-expanded'],false);assert.equal(renderer.root.findAllByProps({'aria-label':'生成效果示例'}).length,0);
  await click(byLabel('查看生成示例'));const preview=byLabel('生成效果示例');assert.ok(text(preview).includes('预写示例'));assert.ok(text(preview).includes('大纲')&&text(preview).includes('人物')&&text(preview).includes('开篇'));
  await click(preview.findAllByType('button').find(item=>text(item).includes('用这个灵感')));assert.equal(modal,previousModal,'Using an example must only fill input, never open a generated result');
  assert.equal(byLabel('故事题材').props.value,'悬疑');assert.ok(byLabel('一句话故事灵感').props.value.trim());assert.equal(networkRequests.length,0);
  if(byLabel('查看生成示例').props['aria-expanded'])await click(byLabel('查看生成示例'));
  const inspiration=()=>text(renderer.root.findByProps({className:'home-prompt-example'}));
  const before=inspiration();await click(byLabel('换一批灵感'));assert.notEqual(inspiration(),before);
  await click(renderer.root.findByProps({className:'home-prompt-example'}));assert.ok(byLabel('一句话故事灵感').props.value.trim());
  const chooseInspiration=async(needle,expectedGenre)=>{for(let attempts=0;attempts<8&&!inspiration().includes(needle);attempts++)await click(byLabel('换一批灵感'));assert.ok(inspiration().includes(needle));await click(renderer.root.findByProps({className:'home-prompt-example'}));assert.equal(byLabel('故事题材').props.value,expectedGenre);};
  await chooseInspiration('星舰','科幻');await chooseInspiration('末日','末世');
  await click(button(renderer.root,'导入文稿'));assert.equal(imports,1);
  assert.equal(rows().length,8);assert.equal(renderer.root.findAll(node=>node.type==='div' && node.props.className?.includes('tool-artwork')).length,0);
  const iconClasses={ideas:'lucide-lightbulb',outline:'lucide-list-tree',character:'lucide-users-round',polish:'lucide-wand-sparkles',continue:'lucide-feather',dialogue:'lucide-messages-square',review:'lucide-scan-text',title:'lucide-type'};
  for(const tool of tools) {
    const main=byLabel(`使用${tool.title}`),icon=main.findByProps({className:'home-tool-icon'}).findByType('svg');
    assert.ok(icon.props.className.includes(iconClasses[tool.id]),`${tool.title}: the existing functional SVG glyph must be retained`);
    await click(main);assert.equal(modal.type,'tool');assert.deepEqual(modal.tool,tool);
    assert.equal(renderer.root.findAllByProps({'aria-label':`查看${tool.title}使用指南`}).length,0,'Secondary actions must be hidden until requested');
    await click(more(tool));assert.equal(more(tool).props['aria-expanded'],true);
    const menu=byLabel(`${tool.title}操作`);assert.equal(menu.props.role,'menu');
    assert.equal(byLabel(`查看${tool.title}使用指南`).props.role,'menuitem');
    await click(byLabel(`查看${tool.title}使用指南`));assert.equal(more(tool).props['aria-expanded'],false);
    assert.equal(document.activeElement.label,`${tool.title}更多操作`,'Opening a guide should return focus to its persistent trigger');
    const guide=byLabel(`${tool.title}使用指南`);assert.ok(text(guide).includes(toolGuides[tool.id].scene));
    await click(guide.findByProps({'aria-label':`使用${tool.title}示例`}));assert.deepEqual(modal.tool,tool);assert.equal(modal.prompt,toolGuides[tool.id].prompt);assert.equal(modal.type,'tool');
  }
  await click(byLabel('收起工具使用指南'));
  const firstTool=tools.find(tool=>tool.id==='ideas');
  await act(async()=>more(firstTool).props.onKeyDown({key:'ArrowUp',preventDefault(){}}));const menu=byLabel(`${firstTool.title}操作`);
  assert.equal(document.activeElement,menuNodes.get(`${firstTool.title}操作`).items[1],'ArrowUp should open at the last menu item');
  const menuKey=async key=>act(async()=>menu.props.onKeyDown({key,preventDefault(){}}));
  await menuKey('ArrowDown');assert.equal(document.activeElement.name,'guide');
  await menuKey('End');assert.equal(document.activeElement.name,'favorite');
  await menuKey('Home');assert.equal(document.activeElement.name,'guide');
  await act(async()=>emit('keydown',{key:'Escape',preventDefault(){},stopPropagation(){}}));
  assert.equal(more(firstTool).props['aria-expanded'],false,'Escape must dismiss the actions menu');assert.equal(document.activeElement.label,`${firstTool.title}更多操作`,'Escape should return focus to the menu trigger');
  await click(more(firstTool));await act(async()=>{emit('pointerdown',{target:{}});emit('mousedown',{target:{}});});assert.equal(more(firstTool).props['aria-expanded'],false,'Clicking outside must close secondary actions');
  await click(more(firstTool));await click(byLabel('收藏故事灵感发生器'));
  assert.equal(document.activeElement.label,'故事灵感发生器更多操作','Favoriting should return focus to its persistent trigger');
  await change(byLabel('工具筛选'),'favorites');assert.equal(rows().length,1);
  await click(more(firstTool));await click(byLabel('取消收藏故事灵感发生器'));assert.equal(rows().length,0);assert.ok(text(renderer.root).includes('还没有收藏工具'));
  assert.equal(document.activeElement.label,'工具筛选','Removing a filtered favorite should focus the surviving filter, not a removed tool');
  await click(button(renderer.root,'看看全部工具'));assert.equal(rows().length,8);
  for(const label of ['创作设置','备份恢复']) {await click(button(renderer.root,label));assert.equal(modal.type,'settings');}
  await click(byLabel('使用帮助'));assert.equal(modal.type,'help');
  await click(button(renderer.root,'查看创作方案'));assert.equal(route,'membership');
  await click(button(renderer.root,'查看工作流'));assert.equal(route,'workflows');
  assert.equal(networkRequests.length,0,'Navigation, examples, menus and favorites must not invoke a model or service');
  await act(async()=>renderer.unmount());
  assert.ok([...listeners.values()].every(values=>values.size===0),'Menu listeners must be removed on close and unmount');
  for(const badReference of [undefined,'deleted-chapter']){
    await mountHome([{...initialWorks[0],lastEditedChapterId:badReference}]);
    assert.ok(!text(renderer.root).includes('上次编辑：'),'Missing and deleted chapter references must not be invented');
    assert.ok(text(renderer.root).includes(`${workWords(initialWorks[0]).toLocaleString()} 字 · ${initialWorks[0].chapters.length} 章`));
    await act(async()=>renderer.unmount());
  }
  console.log('PASS approved homepage hierarchy, truthful recent chapters, unchanged icons/routes, collapsed preferences and exact planning handoff; examples remain non-generating');
  console.log('PASS secondary-action menus, Escape/outside dismissal, authored guides, favorites and existing settings/backup/help/workflow services');

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
  assert.match(css,/\.home-v2\s*\{[^}]*max-width:1320px/);
  assert.match(css,/\.home-tools-grid\s*\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/@container home-workspace \(max-width:880px\)/);
  assert.ok(!css.includes('home-content-grid'));
  assert.match(css,/@container home-workspace \(max-width:580px\)/);
  assert.equal(networkRequests.length,0);
  console.log('PASS market guide handoff, empty workspace recovery, controlled content width and responsive two-column tool list');
} finally {
  if(renderer)await act(async()=>renderer.unmount());
  await server.close();globalThis.fetch=originalFetch;if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;
}
