import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
import {groupConversations,renameConversation} from '../src/conversationPresentation.mjs';
import {validateConversation} from '../src/conversation.js';

// Only authored in-memory fixtures are used. No current clock, private account,
// browser session, API or external content is needed for these checks.
const now='2026-11-04T16:30:00.000Z';
const makeSession=(id,updatedAt,extra={})=>({id,title:'讨论 '+id,workId:'',createdAt:updatedAt,updatedAt,draft:'',referenceIds:[],turns:[],...extra});
const completed=(userText,assistantText)=>({id:'turn-completed',requestId:'request-completed',userText,assistantText,status:'completed',source:'ai',error:'',usage:null,createdAt:'2026-11-04T12:00:00Z',updatedAt:'2026-11-04T12:01:00Z'});
const records=[
 makeSession('unknown-first',undefined,{draft:'没有日期的真实草稿'}),
 makeSession('older','2026-11-02T18:00:00Z'),
 makeSession('today-first','2026-11-04T16:10:00Z',{turns:[completed('用户问题','  大纲\n\t 与人物   的实际回复  ')]}),
 makeSession('yesterday','2026-11-04T15:45:00Z',{workId:'work-one',workLabel:'  雾港\n来信  '}),
 makeSession('unknown-second','2026-02-30T00:00:00Z',{createdAt:'今天 10:42'}),
 makeSession('today-latest','2026-11-05T00:20:00+08:00'),
 makeSession('created-fallback','刚刚',{createdAt:'2026-11-04T00:15:00Z'}),
];
const freeze=value=>{Object.freeze(value);for(const child of Object.values(value))if(child&&typeof child==='object'&&!Object.isFrozen(child))freeze(child);return value;};
freeze(records);const before=JSON.stringify(records),originalNow=Date.now;
let grouped;
try{
 Date.now=()=>{throw Error('Presentation helpers must not read the ambient clock');};
 grouped=groupConversations(records,{now,activeId:'today-first'});
}finally{Date.now=originalNow;}
assert.deepEqual(grouped.map(group=>group.label),['今天','昨天','更早','时间未记录']);
assert.deepEqual(grouped.map(group=>group.items.map(item=>item.id)),[['today-latest','today-first'],['yesterday','created-fallback'],['older'],['unknown-first','unknown-second']]);
assert.equal(grouped[0].items[1].preview,'大纲 与人物 的实际回复');assert.equal(grouped[1].items[0].workLabel,'雾港 来信');
assert.equal(Object.hasOwn(grouped[0].items[0],'workLabel'),false,'Work names must never be invented from a work identifier');
assert.equal(JSON.stringify(records),before);assert.notEqual(grouped[0].items[1],records[2]);
assert.throws(()=>groupConversations(records),/ISO/);assert.throws(()=>groupConversations(records,{now:'今天'}),/ISO/);
const future=makeSession('future','2026-11-06T08:00:00Z');
assert.deepEqual(groupConversations([records[0],future,records[4]],{now})[0].items.map(item=>item.id),['unknown-first','future','unknown-second'],'Unknown/future dates must retain stable order instead of fabricating earlier activity');
assert.equal(groupConversations([future],{now})[0].label,'时间未记录');
const emptyScratch=makeSession('scratch','2026-11-05T00:25:00+08:00');
assert.deepEqual(groupConversations([],{now,scratch:emptyScratch}),[]);
const scratch={...emptyScratch,draft:'尚未保存的真实输入'};
assert.equal(groupConversations([],{now,scratch})[0].items[0].id,'scratch');
assert.deepEqual(groupConversations([],{now,activeId:'another-session',scratch}),[]);
assert.equal(groupConversations([scratch],{now,activeId:scratch.id,scratch})[0].items.length,1,'An already persisted scratch id cannot be duplicated');
assert.equal(Object.hasOwn(scratch,'preview'),false);
const failedPreview=makeSession('failed',now,{draft:'后续草稿',turns:[completed('旧问题','旧回复'),{userText:'真正最新的问题',assistantText:'不可冒充的失败结果',status:'failed'}]});
assert.equal(groupConversations([failedPreview],{now})[0].items[0].preview,'真正最新的问题');
const longPreview=makeSession('emoji',now,{draft:'😀'.repeat(90)});assert.equal(Array.from(groupConversations([longPreview],{now})[0].items[0].preview).length,80);
const literalPreview=makeSession('raw',now,{draft:'<script>raw</script> [link](javascript:alert(1))'});assert.equal(groupConversations([literalPreview],{now})[0].items[0].preview,literalPreview.draft);
console.log('PASS explicit-clock Beijing grouping, UTC midnight, stable missing dates, real scratch inclusion and literal bounded previews without mutations or fake history');

const pendingQuestion='继续讨论人物动机';
const pending={id:'turn-pending',requestId:'request-pending',userText:pendingQuestion,assistantText:'',status:'interrupted',source:'',error:'上次讨论已中断',createdAt:'2026-11-04T12:02:00Z',updatedAt:'2026-11-04T12:03:00Z',usage:null,request:{task:'chat',requestId:'request-pending',prompt:pendingQuestion,context:{workId:'work-one',history:[{role:'user',content:'旧问题'},{role:'assistant',content:'旧回复'}],references:[{id:'work:outline',title:'已确认大纲',content:'保持原始引用资料'}]},mode:'standard',target:1000}};
const source=validateConversation(makeSession('rename-source','2026-11-04T12:03:00Z',{workId:'work-one',draft:'尚未发送的问题',referenceIds:['work:outline'],turns:[completed('旧问题','旧回复'),pending]}));
freeze(source);const sourceBefore=JSON.stringify(source);
const renamed=renameConversation(source,'  我确认的新名称  ',{at:now});
assert.notEqual(renamed,source);assert.equal(renamed.title,'我确认的新名称');assert.equal(renamed.updatedAt,now);assert.equal(renamed.createdAt,source.createdAt);assert.equal(renamed.id,source.id);assert.equal(renamed.workId,source.workId);
assert.equal(renamed.turns,source.turns);assert.equal(renamed.turns[1].request,source.turns[1].request);assert.deepEqual(renamed.referenceIds,source.referenceIds);assert.equal(renamed.draft,source.draft);assert.equal(JSON.stringify(source),sourceBefore);validateConversation(renamed);
assert.equal(renameConversation(source,'名'.repeat(80),{at:now}).title.length,80);assert.equal(renameConversation(source,'名',{at:now}).title.length,1);
for(const title of ['', '   ',null,123,'名'.repeat(81)])assert.throws(()=>renameConversation(source,title,{at:now}),/1–80/);
for(const at of [undefined,'今天','2026-11-04','2026-02-30T00:00:00Z','2026-11-04T24:00:00Z'])assert.throws(()=>renameConversation(source,'有效名称',{at}),/ISO/);
assert.throws(()=>renameConversation({...source,preview:'仅展示字段'},'有效名称',{at:now}),/记录格式/);
console.log('PASS schema-checked 1–80 character rename with explicit ISO time and unchanged scope, drafts, turns and frozen requests');

const fetchBefore=globalThis.fetch;let requests=0,vite;
try{
 globalThis.fetch=()=>{requests++;throw Error('Conversation presentation must not request a network resource');};
 vite=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});
 const {default:ConversationRichText}=await vite.ssrLoadModule('/src/ConversationRichText.jsx');
 const render=text=>renderToStaticMarkup(React.createElement(ConversationRichText,{text}));
 const fixture='# 主标题\n\n## 二级\n\n### 三级\n\n#### 四级\n\n段落中的 **重要内容** 和 `const n = 1`。\n第二行仍完整。\n\n- 第一项\n- 第二项\n\n3. 第三项\n4. 第四项\n\n> 引用里的 **原文**\n\n---\n\n| 角色 | 任务 |\n| --- | --- |\n| 主角 | `a|b` |\n| 配角 | **保留关系** |\n\n```html\n<script>alert("code")</script>\n<img src="https://invalid.example/code" onerror="attack()">\n```';
 const html=render(fixture),dom=new JSDOM(html),document=dom.window.document;
 assert.ok(document.querySelector('.conversation-rich-text'));
 for(const selector of ['h1','h2','h3','h4','p','ul','ol','blockquote','pre > code','hr','table','th','td','strong','code.conversation-rich-inline-code'])assert.ok(document.querySelector(selector),selector);
 assert.equal(document.querySelector('ol').getAttribute('start'),'3');assert.ok(document.querySelector('table').textContent.includes('a|b'));assert.ok(document.body.textContent.includes('第二行仍完整。'));
 assert.equal(document.querySelector('pre > code').textContent,'<script>alert("code")</script>\n<img src="https://invalid.example/code" onerror="attack()">');
 dom.window.close();
 const attacks='<script>alert("raw")</script>\n<img src="https://invalid.example/pixel" onerror="alert(1)">\n<svg onload="attack()"><a href="javascript:alert(1)">危险原文</a></svg>\n<iframe src="https://invalid.example/frame"></iframe>\n[危险链接](javascript:alert(1)) ![外部图片](https://invalid.example/image) <https://invalid.example/autolink>\n**[加粗链接](data:text/html,attack)**\n`<button onclick="attack()">按钮原文</button>`';
 const attackHTML=render(attacks),attackDOM=new JSDOM(attackHTML),attackDocument=attackDOM.window.document;
 assert.equal(attackDocument.querySelectorAll('script,img,svg,a,iframe,form,input,button,object,embed,link,style,video,audio,source').length,0,'Only inert text and allowlisted Markdown elements may render');
 for(const element of attackDocument.querySelectorAll('*'))for(const attribute of element.attributes)assert.ok(!/^on/i.test(attribute.name)&&!['src','href','srcdoc','style'].includes(attribute.name),'No active or URL-bearing attributes');
 for(const original of ['<script>alert("raw")</script>','<img src="https://invalid.example/pixel" onerror="alert(1)">','危险原文','[危险链接](javascript:alert(1))','![外部图片](https://invalid.example/image)','<https://invalid.example/autolink>','<button onclick="attack()">按钮原文</button>'])assert.ok(attackDocument.body.textContent.includes(original),original);
 attackDOM.window.close();
 const unclosed=new JSDOM(render('```\n<section onclick="x()">原始代码\n未关闭代码块'));
 assert.equal(unclosed.window.document.querySelector('pre > code').textContent,'<section onclick="x()">原始代码\n未关闭代码块');assert.equal(unclosed.window.document.querySelectorAll('section').length,0);unclosed.window.close();
 const max=new JSDOM(render('文'.repeat(16000)));assert.equal(max.window.document.body.textContent.length,16000);max.window.close();
 assert.throws(()=>render('文'.repeat(16001)),RangeError);
 assert.ok(!render({toString(){throw Error('Do not coerce objects into markup');}}).includes('object'));
 assert.equal(requests,0);
 console.log('PASS real React Markdown structure, tables/code/quotes and full readable text with escaped HTML, inert unsafe links/images, bounded size and zero network requests');
}finally{if(vite)await vite.close();globalThis.fetch=fetchBefore;}
