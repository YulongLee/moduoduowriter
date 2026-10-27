import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React,{useState} from 'react';
import TestRenderer,{act} from 'react-test-renderer';
import {createServer} from 'vite';
import {createChapterQueue,prepareQueueJob,completeQueueJob} from '../src/chapterQueue.js';

// Controlled data, memory rendering and a request trap; no browser or paid generation.
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
const text=node=>typeof node==='string'?node:(node?.children||[]).map(text).join('');
const click=async node=>{assert.ok(node,'Expected a reachable control');await act(async()=>node.props.onClick());};
const button=(root,label)=>root.findAllByType('button').find(node=>text(node).trim()===label);
const originalFetch=globalThis.fetch,originalDocument=globalThis.document;
const networkRequests=[],listeners=new Map(),menuNodes=new Map();
globalThis.fetch=async(url)=>{networkRequests.push(url);throw new Error('Homepage actions must not request a service');};
globalThis.document={activeElement:null,addEventListener(type,listener){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(listener);},removeEventListener(type,listener){listeners.get(type)?.delete(listener);}};
const emit=(type,event={})=>{for(const listener of [...(listeners.get(type)||[])])listener(event);};
const change=async(node,value)=>act(async()=>node.props.onChange({target:{value,checked:typeof value==='boolean'?value:undefined}}));
const hidden=node=>{for(let item=node;item;item=item.parent)if(item.props?.hidden)return true;return false;};
const nodeMock=element=>{
 const node={label:element.props['aria-label'],focus(){document.activeElement=node;},contains:target=>target===node,querySelectorAll:()=>[],querySelector:()=>null};
 if(element.props.role==='menu'){
  const items=['guide','favorite'].map(name=>({name,focus(){document.activeElement=this;}}));
  node.querySelectorAll=()=>items;node.items=items;menuNodes.set(element.props['aria-label'],node);
 }
 return node;
};
let renderer;
try{
 const {ReferenceHome,Generator}=await server.ssrLoadModule('/src/HomeDesk.jsx');
 const {ReferenceTools}=await server.ssrLoadModule('/src/Dashboard.jsx');
 const {ToolGuide}=await server.ssrLoadModule('/src/ToolGuide.jsx');
 const {toolGuides}=await server.ssrLoadModule('/src/toolGuides.js');
 const {initialWorks,tools,workWords}=await server.ssrLoadModule('/src/data.js');
 let modal,route,imports=0;const notices=[];
 const sampleWorks=[{...initialWorks[0],lastEditedChapterId:initialWorks[0].chapters[1].id},...initialWorks.slice(1)];
 const emptyWork={id:'empty-project',title:'尚未动笔的故事',kind:'长篇小说',genre:'悬疑',outline:'',characters:'',chapters:[{id:'empty-1',title:'第一章',text:''}]};
 function Home({works=sampleWorks}={}){
  const [favorites,setFavorites]=useState([]);
  return React.createElement(ReferenceHome,{works,favorites,toggleFavorite:id=>setFavorites(values=>values.includes(id)?values.filter(value=>value!==id):[...values,id]),setModal:value=>modal=value,navigate:value=>route=value,notify:value=>notices.push(value),onImport:()=>imports++});
 }
 const mountHome=async works=>act(async()=>{renderer=TestRenderer.create(React.createElement(Home,{works}),{createNodeMock:nodeMock});});
 const updateHome=async works=>act(async()=>renderer.update(React.createElement(Home,{works})));
 const byLabel=label=>renderer.root.findByProps({'aria-label':label});
 const rows=()=>renderer.root.findAll(node=>node.type==='article'&&node.props.className?.includes('home-tool-card'));
 const more=tool=>byLabel(`${tool.title}更多操作`);
 const submit=async()=>act(async()=>renderer.root.findByType('form').props.onSubmit({preventDefault(){}}));
 await mountHome();
 assert.equal(text(renderer.root.findByType('h1')),'创作工作台');
 assert.ok(text(renderer.root).includes('一句话生成爆款小说'),'The existing core creation label must remain visible');
 assert.equal(byLabel('当前作品').type,'select');assert.equal(byLabel('当前作品').props.value,sampleWorks[0].id);
 assert.equal(renderer.root.findAllByProps({'aria-label':'继续创作'}).length,1);
 assert.equal(byLabel('继续创作').findAll(node=>node.type==='div'&&node.props.className?.startsWith('book-cover ')).length,1,'Only the active project should be expanded');
 assert.ok(text(byLabel('继续创作')).includes(sampleWorks[0].chapters[1].title));
 assert.ok(text(byLabel('作品准备状态')).includes('大纲')&&text(byLabel('作品准备状态')).includes('人物'));
 assert.ok(!text(byLabel('作品准备状态')).includes('%'),'Preparation must not invent a completion percentage');
 await click(byLabel(`继续最近作品：${sampleWorks[0].title}`));assert.equal(route,`editor/${sampleWorks[0].id}`);
 await click(byLabel('当前作品下一步'));assert.equal(modal.type,'tool');assert.equal(modal.tool.id,'review');assert.equal(modal.workId,sampleWorks[0].id);assert.equal(modal.chapterId,sampleWorks[0].chapters[1].id);
 assert.equal(hidden(byLabel('一句话故事灵感')),true,'Returning writers should see their project before an expanded new-story form');
 await click(button(renderer.root,'开始新故事'));assert.equal(hidden(byLabel('一句话故事灵感')),false);assert.equal(document.activeElement.label,'一句话故事灵感');
 await change(byLabel('一句话故事灵感'),'尚未提交的私人构思');await change(byLabel('故事题材'),'治愈');
 await click(byLabel('创作偏好'));await change(byLabel('目标读者'),'女频');
 await click(byLabel('展开故事创作'));assert.equal(hidden(byLabel('一句话故事灵感')),true);
 await click(button(renderer.root,'开始新故事'));assert.equal(byLabel('一句话故事灵感').props.value,'尚未提交的私人构思');assert.equal(byLabel('故事题材').props.value,'治愈');assert.equal(byLabel('目标读者').props.value,'女频');
 assert.equal(networkRequests.length,0,'Opening and folding creation must not generate content');
 console.log('PASS project-first returning homepage, truthful chapter preparation and recommended review, and preserved unsent creation/preferences on folding');

 // The same existing tools use the currently selected project only when the author opts in.
 const iconClasses={ideas:'lucide-lightbulb',outline:'lucide-list-tree',character:'lucide-users-round',polish:'lucide-wand-sparkles',continue:'lucide-feather',dialogue:'lucide-messages-square',review:'lucide-scan-text',title:'lucide-type'};
 assert.equal(rows().length,8);assert.ok(text(renderer.root).includes('构思与规划'));assert.ok(text(renderer.root).includes('正文与修改'));
 assert.equal(byLabel('关联当前作品').props.checked,true);
 for(const tool of tools){
  const main=byLabel(`使用${tool.title}`),icon=main.findByProps({className:'home-tool-icon'}).findByType('svg');
  assert.ok(icon.props.className.includes(iconClasses[tool.id]),`${tool.title}: preserve the existing SVG glyph`);
  await click(main);assert.equal(modal.type,'tool');assert.deepEqual(modal.tool,tool);assert.equal(modal.workId,sampleWorks[0].id);assert.equal(modal.chapterId,sampleWorks[0].chapters[1].id);
  assert.equal(renderer.root.findAllByProps({'aria-label':`查看${tool.title}使用指南`}).length,0);
  await click(more(tool));assert.equal(more(tool).props['aria-expanded'],true);
  await click(byLabel(`查看${tool.title}使用指南`));assert.equal(document.activeElement.label,`${tool.title}更多操作`);
  const guide=byLabel(`${tool.title}使用指南`);assert.ok(text(guide).includes(toolGuides[tool.id].scene));
  await click(guide.findByProps({'aria-label':`使用${tool.title}示例`}));assert.deepEqual(modal.tool,tool);assert.equal(modal.prompt,toolGuides[tool.id].prompt);assert.equal(modal.workId,sampleWorks[0].id);assert.equal(modal.chapterId,sampleWorks[0].chapters[1].id);
 }
 await click(byLabel('收起工具使用指南'));
 await change(byLabel('关联当前作品'),false);await click(byLabel('使用故事灵感发生器'));assert.equal(modal.workId,undefined);assert.equal(modal.chapterId,undefined);
 await change(byLabel('关联当前作品'),true);await change(byLabel('当前作品'),sampleWorks[1].id);
 await click(byLabel('使用故事灵感发生器'));assert.equal(modal.workId,sampleWorks[1].id);assert.equal(modal.chapterId,sampleWorks[1].chapters[0].id);
 await click(byLabel(`继续最近作品：${sampleWorks[1].title}`));assert.equal(route,`editor/${sampleWorks[1].id}`);
 const entries=byLabel('创作快捷入口');
 for(const [label,expected] of [['小说写作','novels'],['剧本创作','scripts'],['小说拆书','dismantle'],['投稿中心','submit']]){await click(entries.findAllByType('button').find(item=>text(item).includes(label)));assert.equal(route,expected);}
 await click(button(renderer.root,'进入工具库'));assert.equal(route,'tools');
 const firstTool=tools.find(tool=>tool.id==='ideas');
 await act(async()=>more(firstTool).props.onKeyDown({key:'ArrowUp',preventDefault(){}}));
 const menu=byLabel(`${firstTool.title}操作`),menuKey=async key=>act(async()=>menu.props.onKeyDown({key,preventDefault(){}}));
 assert.equal(document.activeElement,menuNodes.get(`${firstTool.title}操作`).items[1]);
 await menuKey('ArrowDown');assert.equal(document.activeElement.name,'guide');await menuKey('End');assert.equal(document.activeElement.name,'favorite');await menuKey('Home');assert.equal(document.activeElement.name,'guide');
 await act(async()=>emit('keydown',{key:'Escape',preventDefault(){},stopPropagation(){}}));assert.equal(more(firstTool).props['aria-expanded'],false);assert.equal(document.activeElement.label,`${firstTool.title}更多操作`);
 await click(more(firstTool));await act(async()=>emit('pointerdown',{target:{}}));assert.equal(more(firstTool).props['aria-expanded'],false);
 await click(more(firstTool));await click(byLabel('收藏故事灵感发生器'));assert.equal(document.activeElement.label,'故事灵感发生器更多操作');
 await change(byLabel('工具筛选'),'favorites');assert.equal(rows().length,1);await click(more(firstTool));await click(byLabel('取消收藏故事灵感发生器'));assert.equal(rows().length,0);assert.equal(document.activeElement.label,'工具筛选');
 await click(button(renderer.root,'看看全部工具'));assert.equal(rows().length,8);
 for(const label of ['创作设置','备份恢复']){await click(button(renderer.root,label));assert.equal(modal.type,'settings');}
 await click(byLabel('使用帮助'));assert.equal(modal.type,'help');await click(button(renderer.root,'查看创作方案'));assert.equal(route,'membership');await click(button(renderer.root,'查看工作流'));assert.equal(route,'workflows');
 console.log('PASS retained tool labels/glyphs, optional author-controlled work context, original routes, guides, favorites and keyboard/menu focus');

 // Selected projects can disappear after restore/deletion; no old project may remain attached.
 await updateHome([emptyWork]);assert.equal(byLabel('当前作品').props.value,emptyWork.id);assert.ok(text(byLabel(`继续最近作品：${emptyWork.title}`)).includes('开始第一章'));
 await click(byLabel('当前作品下一步'));assert.equal(modal.tool.id,'outline');assert.equal(modal.workId,emptyWork.id);
 await click(byLabel('使用故事灵感发生器'));assert.equal(modal.workId,emptyWork.id);assert.equal(modal.chapterId,emptyWork.chapters[0].id);
 await updateHome([{...emptyWork,outline:'已经确认的主线'}]);await click(byLabel('当前作品下一步'));assert.equal(modal.tool.id,'character');
 await updateHome([{...emptyWork,outline:'已经确认的主线',characters:'人物的目标与边界'}]);await click(byLabel('当前作品下一步'));assert.equal(modal.type,'chapter-plan');assert.equal(modal.workId,emptyWork.id);
 const memoryCharacter={...emptyWork,outline:'已经确认的主线',memory:{version:1,entries:[{id:'character-fact',type:'character',title:'修复师',content:'主角寻找寄信人。'}]}};
 await updateHome([memoryCharacter]);await click(byLabel('当前作品下一步'));assert.equal(modal.type,'chapter-plan','A character already recorded in structured memory must not be reported missing');
 const scriptWork={...emptyWork,id:'script-project',title:'尚未开场的剧本',kind:'剧本',outline:'第一场的冲突与行动',characters:'人物的目标和关系',chapters:[{id:'scene-1',title:'第一场 · 修复铺',text:''}]};
 await updateHome([scriptWork]);assert.ok(text(byLabel(`继续最近作品：${scriptWork.title}`)).includes('开始第一场'));
 assert.ok(text(byLabel('继续创作')).includes('1 场'));assert.ok(text(byLabel('作品准备状态')).includes('分场正文'));
 await click(byLabel('当前作品下一步'));assert.equal(modal.type,'tool');assert.equal(modal.tool.id,'outline');assert.equal(modal.workId,scriptWork.id);assert.ok(text(byLabel('当前作品下一步')).includes('梳理场次安排'),'An unwritten script must use scene planning rather than novel chapter planning');
 const partlyWritten={...initialWorks[0],lastEditedChapterId:'blank',chapters:[{id:'written',title:'已有正文',text:'人物推开了旧书店的门。'},{id:'blank',title:'待写章节',text:''}]};
 await updateHome([partlyWritten]);await click(byLabel('当前作品下一步'));assert.equal(modal.tool.id,'review');assert.equal(modal.chapterId,'written','Review recommendations must target actual prose rather than the remembered blank chapter');
 const queuedWork={...initialWorks[0],id:'queue-story',chapters:[{...initialWorks[0].chapters[0],plan:'从收到信开始调查'}]};
 const queued=createChapterQueue(queuedWork,{chapterIds:[queuedWork.chapters[0].id]});
 const prepared=prepareQueueJob(queuedWork,queued,queued.jobs[0].id);
 queuedWork.chapterQueue=completeQueueJob(prepared,queued.jobs[0].id,{text:'尚未确认的章节候选。',source:'ai'});
 await updateHome([queuedWork]);await click(byLabel('当前作品下一步'));assert.equal(modal.type,'chapter-queue');assert.equal(modal.workId,queuedWork.id);
 await updateHome([{...queuedWork,chapterQueue:{...queuedWork.chapterQueue,status:'completed',jobs:queuedWork.chapterQueue.jobs.map(job=>({...job,status:'succeeded'}))}}]);await click(byLabel('当前作品下一步'));assert.equal(modal.type,'tool');assert.equal(modal.tool.id,'review','A finished queue must not keep appearing as an unfinished task');
 await updateHome([]);assert.equal(renderer.root.findAllByProps({'aria-label':'继续创作'}).length,0);assert.equal(hidden(byLabel('一句话故事灵感')),false,'An empty workspace must have a usable creation surface');
 await click(byLabel('使用故事灵感发生器'));assert.equal(modal.workId,undefined);assert.equal(modal.chapterId,undefined);assert.ok(!text(renderer.root).includes('NaN'));
 await click(button(renderer.root,'导入文稿'));assert.ok(imports>0);
 assert.equal(networkRequests.length,0,'Recommendations, context changes and queue restoration only open UI');
 await act(async()=>renderer.unmount());renderer=null;
 assert.ok([...listeners.values()].every(values=>values.size===0));
 console.log('PASS zero-word start, missing-outline/character/planning recommendations, author-confirmed queue recovery and removed/empty-project context safety');

 // Standalone Generator keeps the original planning contract; visual folding must not change generation semantics.
 await act(async()=>{renderer=TestRenderer.create(React.createElement(Generator,{setModal:value=>modal=value,notify:value=>notices.push(value),onImport:()=>imports++}),{createNodeMock:nodeMock});});
 assert.equal(hidden(byLabel('一句话故事灵感')),false);assert.equal(byLabel('一句话故事灵感').props.maxLength,500);
 assert.equal(byLabel('故事题材').props.value,'玄幻');assert.equal(byLabel('作品篇幅').props.value,'长篇小说');assert.equal(byLabel('创作偏好').props['aria-expanded'],false);
 modal=undefined;await submit();assert.equal(modal,undefined);assert.ok(notices.at(-1).includes('灵感'));
 await change(byLabel('故事题材'),'治愈');await change(byLabel('作品篇幅'),'短篇故事');await click(byLabel('创作偏好'));
 await change(byLabel('目标读者'),'女频');await change(byLabel('叙述视角'),'第一人称');await change(byLabel('创作模式'),'长篇规划');
 await act(async()=>renderer.root.findByProps({className:'home-preference-panel'}).props.onKeyDown({key:'Escape',preventDefault(){},stopPropagation(){}}));
 await change(byLabel('一句话故事灵感'),'  一封来自未来的旧信  ');await submit();
 assert.deepEqual(modal,{type:'quick-start',autoGenerate:true,idea:'一封来自未来的旧信',genre:'治愈',audience:'女频',perspective:'第一人称',kind:'短篇故事',mode:'长篇规划'});
 const previousModal=modal;assert.equal(byLabel('查看生成示例').props['aria-expanded'],false);await click(byLabel('查看生成示例'));
 const preview=byLabel('生成效果示例');assert.ok(text(preview).includes('预写示例'));await click(preview.findAllByType('button').find(item=>text(item).includes('用这个灵感')));assert.equal(modal,previousModal);assert.equal(byLabel('故事题材').props.value,'悬疑');
 const inspiration=()=>text(renderer.root.findByProps({className:'home-prompt-example'}));
 for(const [needle,genre] of [['星舰','科幻'],['末日','末世']]){for(let attempts=0;attempts<8&&!inspiration().includes(needle);attempts++)await click(byLabel('换一批灵感'));assert.ok(inspiration().includes(needle));await click(renderer.root.findByProps({className:'home-prompt-example'}));assert.equal(byLabel('故事题材').props.value,genre);}
 await act(async()=>renderer.unmount());renderer=null;
 console.log('PASS unchanged planning defaults and payload, preserved preferences, authored sample preview and accurate inspiration categories without requests');
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
  await act(async()=>renderer.unmount());renderer=null;
  const css=readFileSync(new URL('../src/home.css',import.meta.url),'utf8');
  assert.match(css,/max-width:1440px/,'The workbench must retain a useful wide-screen limit');
  assert.match(css,/\[hidden\][^{]*\{[^}]*display:none\s*!important/,'Folded form controls must be visually and keyboard hidden');
  assert.match(css,/@container home-workspace \(max-width:900px\)/);
  assert.match(css,/@container home-workspace \(max-width:640px\)/);
  assert.equal(networkRequests.length,0);
  console.log('PASS existing market guide handoff, controlled page width, hidden controls and mobile layout rules');
}finally{
 if(renderer)await act(async()=>renderer.unmount());await server.close();globalThis.fetch=originalFetch;
 if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;
}
