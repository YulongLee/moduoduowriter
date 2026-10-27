import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import TestRenderer,{act} from 'react-test-renderer';
import {createServer} from 'vite';
import {createChapterQueue,prepareQueueJob,completeQueueJob} from '../src/chapterQueue.js';

// Controlled data, memory rendering and a request trap; no browser or paid generation.
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
const text=node=>typeof node==='string'?node:(node?.children||[]).map(text).join('');
const click=async node=>{assert.ok(node,'Expected a reachable control');await act(async()=>node.props.onClick());};
const button=(root,label)=>root.findAllByType('button').find(node=>text(node).trim()===label);
const originalFetch=globalThis.fetch,originalDocument=globalThis.document,originalStorage=globalThis.localStorage;
const networkRequests=[],storageReads=[],storageWrites=[],listeners=new Map(),menuNodes=new Map();
globalThis.localStorage={getItem(key){storageReads.push(key);return null;},setItem(key){storageWrites.push(key);}};
globalThis.fetch=async(url)=>{networkRequests.push(url);throw new Error('Homepage actions must not request a service');};
globalThis.document={activeElement:null,addEventListener(type,listener){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(listener);},removeEventListener(type,listener){listeners.get(type)?.delete(listener);}};
const emit=(type,event={})=>{for(const listener of [...(listeners.get(type)||[])])listener(event);};
const change=async(node,value)=>act(async()=>node.props.onChange({target:{value,checked:typeof value==='boolean'?value:undefined}}));
const hidden=node=>{for(let item=node;item;item=item.parent)if(item.props?.hidden)return true;return false;};
const nodeMock=element=>{
 const node={label:element.props['aria-label'],focus(){document.activeElement=node;},contains:target=>target===node,querySelectorAll:()=>[],querySelector:()=>null,scrollIntoView(){}};
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
 const {initialWorks,tools}=await server.ssrLoadModule('/src/data.js');
 const {getHomeWorkState}=await server.ssrLoadModule('/src/homeModel.js');
 const {AccountContext}=await server.ssrLoadModule('/src/Account.jsx');
 let modal,route,imports=0;const notices=[],pendingActions=[],favoriteActions=[];
 const secretWork={...initialWorks[0],id:'private-home-secret',title:'绝不能出现在公开首页的私有作品',description:'私密作品介绍独有标记',outline:'私密大纲独有标记',characters:'私密人物资料独有标记',chapters:[{id:'secret-chapter',title:'私密章节标题',text:'私密正文只属于作者，不能在首页读取或展示。'}]};
 const secretWorks=new Proxy([secretWork],{get(target,key){if(key===Symbol.iterator||['filter','map','reduce','forEach','length'].includes(key))throw new Error('Public homepage attempted to inspect supplied private works');return Reflect.get(target,key);}});
 const homeTree=({authenticated=false,works=secretWorks,favorites=['ideas']}={})=>React.createElement(AccountContext.Provider,{value:{ready:true,configured:true,user:authenticated?{id:'private-user',username:'不应出现在通用首页的账号名'}:null,spaceId:authenticated?'private-space':'local'}},React.createElement(ReferenceHome,{authenticated,works,favorites,toggleFavorite:id=>favoriteActions.push(id),onRequireAccount:action=>pendingActions.push(action),setModal:value=>modal=value,navigate:value=>route=value,notify:value=>notices.push(value),onImport:()=>imports++}));
 const mountHome=async props=>act(async()=>{renderer=TestRenderer.create(homeTree(props),{createNodeMock:nodeMock});});
 const byLabel=label=>renderer.root.findByProps({'aria-label':label});
 const rows=()=>renderer.root.findAll(node=>node.type==='article'&&node.props.className?.includes('home-tool-card'));
 const more=tool=>byLabel(`${tool.title}更多操作`);
 const submit=async()=>act(async()=>renderer.root.findByProps({className:'home-composer-form'}).props.onSubmit({preventDefault(){}}));
 const continueAfterAccount=async action=>{assert.equal(typeof action,'function','Private actions must be passed as deferred callbacks');await act(async()=>action());};
 const gated=async action=>{modal=undefined;const before=pendingActions.length;await action();assert.equal(pendingActions.length,before+1,'A private action must first request account access');assert.equal(modal,undefined,'A private dialog cannot open before the account callback executes');const deferred=pendingActions.pop();await continueAfterAccount(deferred);};
 const normalizedTree=()=>JSON.stringify(renderer.toJSON(),(key,value)=>['id','htmlFor','form','aria-controls','aria-labelledby'].includes(key)?undefined:value);
 const privateLabels=['我的作品','继续创作','创作数据','当前作品','对话关联作品','对话记录'];
 await mountHome();
 assert.equal(text(renderer.root.findByType('h1')),'今天，想写一个什么故事？');assert.ok(byLabel('首页创作入口'));
 for(const label of privateLabels)assert.equal(renderer.root.findAllByProps({'aria-label':label}).length,0,`Public home cannot include ${label}`);
 for(const marker of ['绝不能出现在公开首页','私密作品介绍','私密大纲','私密人物','私密章节','私密正文','不应出现在通用首页的账号名'])assert.ok(!text(renderer.root).includes(marker));
 const anonymousSnapshot=normalizedTree();await act(async()=>renderer.update(homeTree({authenticated:true,works:[],favorites:[]})));
 assert.equal(normalizedTree(),anonymousSnapshot,'The universal homepage must render the same body for signed-in and signed-out visitors, regardless of private works or favorites');
 assert.equal(networkRequests.length,0);assert.equal(storageReads.length,0,'Public home cannot read workspace collections or local conversation history');assert.equal(storageWrites.length,0);
 console.log('PASS universal public homepage, identical account-state content and no private manuscript/favorite/storage exposure');

 // The public input may prepare a prompt; only explicit account-gated actions can enter private creation.
 const chatInput=byLabel('故事灵感输入'),chatForm=(()=>{let node=chatInput.parent;while(node&&node.type!=='form')node=node.parent;return node;})();assert.ok(chatForm);
 const firstPending=pendingActions.length;
 for(const label of ['聊聊故事灵感','设计一个角色','讨论下一章']){await click(button(renderer.root,label));assert.ok(byLabel('故事灵感输入').props.value.trim());assert.equal(pendingActions.length,firstPending);}
 const inputKey=async extra=>act(async()=>byLabel('故事灵感输入').props.onKeyDown?.({key:'Enter',shiftKey:false,isComposing:false,nativeEvent:{isComposing:false},preventDefault(){},...extra}));
 await inputKey({shiftKey:true});await inputKey({isComposing:true});await inputKey({nativeEvent:{isComposing:true}});assert.equal(pendingActions.length,firstPending);
 await change(byLabel('故事灵感输入'),'  一位修复师收到来自未来的信  ');
 await gated(()=>act(async()=>chatForm.props.onSubmit({preventDefault(){}})));assert.equal(modal.type,'home-conversation');assert.equal(modal.initialPrompt,'一位修复师收到来自未来的信');assert.equal(modal.workId,undefined);
 assert.equal(networkRequests.length,0,'A public chat prompt must never automatically call a model');
 console.log('PASS public example chips only fill the draft, input methods do not submit and discussion enters an account-gated private dialog');

 const iconClasses={ideas:'lucide-lightbulb',outline:'lucide-list-tree',character:'lucide-users-round',polish:'lucide-wand-sparkles',continue:'lucide-feather',dialogue:'lucide-messages-square',review:'lucide-scan-text',title:'lucide-type'};
 assert.equal(rows().length,8);assert.ok(text(renderer.root).includes('构思与规划'));assert.ok(text(renderer.root).includes('正文与修改'));
 for(const tool of tools){
  const main=byLabel(`使用${tool.title}`),icon=main.findByProps({className:'home-tool-icon'}).findByType('svg');assert.ok(icon.props.className.includes(iconClasses[tool.id]),`${tool.title}: preserve the existing SVG glyph`);
  await gated(()=>click(main));assert.equal(modal.type,'tool');assert.deepEqual(modal.tool,tool);assert.equal(modal.workId,undefined);assert.equal(modal.chapterId,undefined);
  const beforeGuide=pendingActions.length;await click(more(tool));assert.equal(more(tool).props['aria-expanded'],true);await click(byLabel(`查看${tool.title}使用指南`));assert.equal(pendingActions.length,beforeGuide,'Authored usage guides are readable without login');
  assert.equal(document.activeElement.label,`${tool.title}更多操作`);const guide=byLabel(`${tool.title}使用指南`);assert.ok(text(guide).includes(toolGuides[tool.id].scene));
  await gated(()=>click(guide.findByProps({'aria-label':`使用${tool.title}示例`})));assert.deepEqual(modal.tool,tool);assert.equal(modal.prompt,toolGuides[tool.id].prompt);assert.equal(modal.workId,undefined);assert.equal(modal.chapterId,undefined);
 }
 await click(byLabel('收起工具使用指南'));
 const entries=byLabel('创作快捷入口');assert.equal(entries.findAllByType('button').length,6);
 for(const [label,id]of [['故事大纲','outline'],['人物设定','character'],['寻找灵感','ideas'],['剧情续写','continue'],['文字润色','polish']]){await gated(()=>click(entries.findAllByType('button').find(node=>text(node).includes(label))));assert.equal(modal.tool.id,id);assert.equal(modal.workId,undefined);}
 const firstTool=tools.find(tool=>tool.id==='ideas');await act(async()=>more(firstTool).props.onKeyDown({key:'ArrowUp',preventDefault(){}}));
 const menu=byLabel(`${firstTool.title}操作`),menuKey=async key=>act(async()=>menu.props.onKeyDown({key,preventDefault(){}}));
 assert.equal(document.activeElement,menuNodes.get(`${firstTool.title}操作`).items[1]);await menuKey('ArrowDown');assert.equal(document.activeElement.name,'guide');await menuKey('End');assert.equal(document.activeElement.name,'favorite');await menuKey('Home');assert.equal(document.activeElement.name,'guide');
 await act(async()=>emit('keydown',{key:'Escape',preventDefault(){},stopPropagation(){}}));assert.equal(more(firstTool).props['aria-expanded'],false);assert.equal(document.activeElement.label,`${firstTool.title}更多操作`);
 await click(more(firstTool));await act(async()=>emit('pointerdown',{target:{}}));assert.equal(more(firstTool).props['aria-expanded'],false);
 await click(more(firstTool));route=undefined;await gated(()=>click(byLabel('收藏故事灵感发生器')));assert.equal(route,'tools');assert.equal(favoriteActions.length,0,'The public page cannot mutate or display private favorites');
 assert.equal(networkRequests.length,0);assert.equal(storageReads.length,0);assert.equal(storageWrites.length,0);
 console.log('PASS eight retained tools/icons, six shortcuts, public authored guides and explicit account gating for tool use and favorites');

 assert.equal(renderer.root.findAllByProps({'aria-label':'一句话故事灵感'}).length,0,'Public home must not mount the private generation form');
 const beforeExample=pendingActions.length;await click(button(renderer.root,'查看生成示例'));assert.ok(text(byLabel('预写创作示例')).includes('预先编写的示例'));assert.equal(pendingActions.length,beforeExample);
 await click(button(renderer.root,'填入示例灵感'));assert.ok(byLabel('故事灵感输入').props.value.includes('旧物记忆'));assert.equal(pendingActions.length,beforeExample,'Public preview use only fills the draft');
 const publicDraft=byLabel('故事灵感输入').props.value;await gated(()=>click(entries.findAllByType('button').find(node=>text(node).includes('生成小说'))));assert.equal(modal.type,'quick-start');assert.equal(modal.idea,publicDraft);assert.equal(modal.autoGenerate,true);assert.equal(modal.workId,undefined);
 await change(byLabel('故事灵感输入'),'');await gated(()=>click(entries.findAllByType('button').find(node=>text(node).includes('生成小说'))));assert.equal(modal.type,'quick-start');assert.equal(modal.autoGenerate,false,'A blank quick entry opens private planning without starting generation');
 await gated(()=>click(button(renderer.root,'添加参考资料')));assert.equal(modal.type,'home-conversation');assert.equal(modal.initialPrompt,'');
 for(const [label,expected]of [['小说写作','novels'],['剧本创作','scripts'],['小说拆书','dismantle'],['投稿中心','submit']]){route=undefined;await gated(()=>click(button(renderer.root,label)));assert.equal(route,expected);}
 route=undefined;await gated(()=>click(button(renderer.root,'进入工具库')));assert.equal(route,'tools');await gated(()=>click(byLabel('会员创作方案').findByType('button')));assert.equal(route,'membership');
 assert.equal(imports,0,'Supplying a private import callback must not cause the public page to inspect or import documents');
 assert.equal(networkRequests.length,0);assert.equal(storageReads.length,0);assert.equal(storageWrites.length,0);await act(async()=>renderer.unmount());renderer=null;
 assert.ok([...listeners.values()].every(values=>values.size===0));
 console.log('PASS authored previews only fill public drafts, while generation, references and private destinations wait for account access');

 // The existing work-state business model remains covered even though universal home no longer displays private projects.
 const emptyWork={id:'empty-project',title:'尚未动笔的故事',kind:'长篇小说',genre:'悬疑',outline:'',characters:'',chapters:[{id:'empty-1',title:'第一章',text:''}]};
 assert.equal(getHomeWorkState(emptyWork).actionLabel,'开始第一章');assert.equal(getHomeWorkState(emptyWork).words,0);assert.equal(getHomeWorkState(emptyWork).nextAction.toolId,'outline');
 assert.equal(getHomeWorkState({...emptyWork,outline:'已经确认的主线'}).nextAction.toolId,'character');
 assert.equal(getHomeWorkState({...emptyWork,outline:'已经确认的主线',characters:'人物的目标与边界'}).nextAction.type,'chapter-plan');
 const memoryCharacter={...emptyWork,outline:'已经确认的主线',memory:{version:1,entries:[{id:'character-fact',type:'character',title:'修复师',content:'主角寻找寄信人。'}]}};assert.equal(getHomeWorkState(memoryCharacter).nextAction.type,'chapter-plan');
 const scriptWork={...emptyWork,kind:'剧本',outline:'冲突与场景',characters:'角色的目标'};assert.equal(getHomeWorkState(scriptWork).actionLabel,'开始第一场');assert.equal(getHomeWorkState(scriptWork).unit,'场');assert.equal(getHomeWorkState(scriptWork).nextAction.toolId,'outline');
 const partlyWritten={...initialWorks[0],lastEditedChapterId:'blank',chapters:[{id:'written',title:'已有正文',text:'人物推开了旧书店的门。'},{id:'blank',title:'待写章节',text:''}]};assert.equal(getHomeWorkState(partlyWritten).nextAction.chapterId,'written');
 const queuedWork={...initialWorks[0],id:'queue-story',chapters:[{...initialWorks[0].chapters[0],plan:'从收到信开始调查'}]};const queued=createChapterQueue(queuedWork,{chapterIds:[queuedWork.chapters[0].id]});const prepared=prepareQueueJob(queuedWork,queued,queued.jobs[0].id);queuedWork.chapterQueue=completeQueueJob(prepared,queued.jobs[0].id,{text:'尚未确认的章节候选。',source:'ai'});
 assert.equal(getHomeWorkState(queuedWork).nextAction.type,'chapter-queue');assert.equal(getHomeWorkState({...queuedWork,chapterQueue:{...queuedWork.chapterQueue,status:'completed',jobs:queuedWork.chapterQueue.jobs.map(job=>({...job,status:'succeeded'}))}}).nextAction.toolId,'review');assert.equal(getHomeWorkState(null),null);
 console.log('PASS retained zero-word, script scene, character-memory, actual-prose review and pending queue recommendations as private work-state model behavior');

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
  const heroWidth=css.match(/\.home-window-inner\s*\{[^}]*max-width:(\d+)px/),contentWidth=css.match(/\.home-window-content\s*\{[^}]*max-width:(\d+)px/);
  assert.ok(heroWidth&&contentWidth&&Number(heroWidth[1])>=1200&&Number(heroWidth[1])<=1600,'The new Hero must retain a readable wide-screen content limit');assert.equal(heroWidth[1],contentWidth[1],'Hero and bookshelf/tool content must share an aligned width');
  assert.match(css,/\[hidden\][^{]*\{[^}]*display:none\s*!important/,'Folded form controls must be visually and keyboard hidden');
  assert.match(css,/@container home-workspace \(max-width:740px\)/);assert.match(css,/@container home-workspace \(max-width:480px\)/);
  assert.match(css,/\.home-window-hero::before\s*\{[^}]*background:url\('\/art\//,'The approved Hero scene must use the bundled background asset');
  assert.equal(networkRequests.length,0);
  console.log('PASS existing market guide handoff, controlled page width, hidden controls and mobile layout rules');
}finally{
 if(renderer)await act(async()=>renderer.unmount());await server.close();globalThis.fetch=originalFetch;
 if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;if(originalStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=originalStorage;
}
