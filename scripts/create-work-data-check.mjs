import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {workTypes,workGenres,workStyles,creationTemplates,createWorkDraft,validateCreateWorkDraft,creationPayload,applyCreationTemplate} from '../src/createWork.mjs';
import {validateBackup,validateWork} from '../src/backup.js';
import {createStore} from '../server/store.mjs';
import {createApi} from '../server/api.mjs';

// All helper fixtures, accounts, sessions and API stores are isolated. No real
// workspace or model, email, SMS or cloud service is read or contacted.
assert.deepEqual(workTypes.map(type=>type.value),['长篇小说','短篇故事','剧本']);
assert.ok(workTypes.every(type=>type.label&&type.description));
assert.deepEqual(workGenres,['玄幻','都市','科幻','历史','仙侠','悬疑','言情','游戏','现实','奇幻','武侠','青春','治愈','其他']);
assert.deepEqual(workStyles,['热血','轻松','爽文','正剧','脑洞','群像','成长','治愈','悬疑','浪漫','黑暗','其他']);
assert.deepEqual(creationTemplates.map(template=>template.id),['xianxia','urban','future','history']);
assert.deepEqual(creationTemplates.map(template=>template.name),['玄幻修仙模板','都市异能模板','科幻未来模板','历史权谋模板']);
assert.deepEqual(createWorkDraft(),{title:'',description:'',kind:'长篇小说',genre:'玄幻',styles:[],templateId:'',outline:'',characters:'',notes:''});
assert.deepEqual(Object.keys(validateCreateWorkDraft(createWorkDraft())),['title']);
const validDraft=createWorkDraft({title:'  我的新故事  ',idea:'从一封迟到的信开始。',genre:'都市奇想',styles:['脑洞']});
assert.equal(validDraft.title,'我的新故事');assert.equal(validDraft.description,'从一封迟到的信开始。');assert.equal(validDraft.genre,'都市奇想');assert.deepEqual(validateCreateWorkDraft(validDraft),{});
assert.equal(creationPayload(validDraft).genre,'都市奇想','A legacy custom genre remains selectable instead of being silently replaced');
const longIdea='旧书店里的一封信，改变了两个人的选择。'.repeat(45);
const initial={title:'旧信',idea:longIdea,outline:'保留总纲',characters:'保留人物',notes:'保留自己的笔记',styles:['成长']};
const beforeInitial=JSON.stringify(initial),adapted=createWorkDraft(initial);
assert.equal(adapted.description,longIdea.slice(0,500));assert.ok(adapted.notes.includes(longIdea));assert.ok(adapted.notes.startsWith(initial.notes));assert.equal(adapted.outline,initial.outline);assert.equal(adapted.characters,initial.characters);assert.equal(JSON.stringify(initial),beforeInitial);
assert.equal(createWorkDraft(adapted).notes,adapted.notes,'Normalizing again must not duplicate preserved material');
assert.ok(applyCreationTemplate(initial,'urban').notes.includes(longIdea),'Applying a template also preserves legacy intent before explicit normalization');
const twoSources=createWorkDraft({title:'不同来源',description:'已有简介',idea:longIdea});assert.equal(twoSources.description,'已有简介');assert.ok(twoSources.notes.includes(longIdea));
const oversized=createWorkDraft({title:'过长资料',idea:'文'.repeat(100001)});assert.ok(oversized.notes.includes('文'.repeat(100001)));assert.ok(validateCreateWorkDraft(oversized).description,'Oversized legacy material is preserved for correction, not silently truncated');
console.log('PASS exact work types/styles/template options, default draft and lossless legacy idea/custom-genre adaptation');

for(const [field,values] of [
 ['title',['','   ',123,'名'.repeat(51)]],
 ['description',[null,123,'字'.repeat(501)]],
 ['kind',['视频','',null,123]],
 ['genre',['',null,123,'类'.repeat(51)]],
 ['styles',['热血',null,['未知'],['热血','热血'],['热血','轻松','脑洞','成长']]],
 ['templateId',['unknown',null,123]],
])for(const value of values){const draft={...validDraft,[field]:value};assert.ok(validateCreateWorkDraft(draft)[field],field);assert.throws(()=>creationPayload(draft),error=>Boolean(error.errors?.[field]));}
for(const field of ['outline','characters','notes'])for(const value of [null,123,'字'.repeat(100001)])assert.ok(validateCreateWorkDraft({...validDraft,[field]:value}).description);
assert.deepEqual(validateCreateWorkDraft({...validDraft,title:'名'.repeat(50),description:'字'.repeat(500),styles:['热血','轻松','成长'],notes:'字'.repeat(100000)}),{});
const plainPayload=creationPayload({...validDraft,templateId:'',text:'不能预填的正文',apiKey:'not-to-be-forwarded',workId:'unrelated-id'});
assert.equal(plainPayload.text,'');assert.equal(Object.hasOwn(plainPayload,'templateId'),false);assert.equal(Object.hasOwn(plainPayload,'apiKey'),false);assert.equal(Object.hasOwn(plainPayload,'workId'),false);assert.notEqual(plainPayload.styles,validDraft.styles);
console.log('PASS creation limits, invalid field types/styles/templates and strict metadata-only payload without hidden/provider fields or prose');

const planned=[];
for(const template of creationTemplates){
 assert.equal(template.tags.length,3);assert.ok(template.tags.every(tag=>typeof tag==='string'&&tag));assert.ok(template.summary.length>0&&template.summary.length<=40);assert.ok(template.image.startsWith('/art/'));
 assert.ok(template.outline&&template.characters&&template.notes);assert.equal(Object.hasOwn(template,'text'),false);assert.equal(Object.hasOwn(template,'chapters'),false);
 const draft=applyCreationTemplate(createWorkDraft(),template.id);assert.equal(draft.title,template.title);assert.notEqual(draft.title,template.name);assert.equal(draft.description,template.description);assert.equal(draft.templateId,template.id);assert.equal(draft.genre,template.genre);assert.deepEqual(draft.styles,template.styles);
 assert.deepEqual(applyCreationTemplate(draft,template.id),draft,'Applying the same template must be idempotent');
 assert.deepEqual(validateCreateWorkDraft(draft),{});const result=creationPayload(draft);assert.equal(result.text,'');planned.push(result);
 const prior=createWorkDraft({title:'自己的书名',description:'自己的简介',kind:'短篇故事',genre:'现实',styles:['轻松'],outline:'已确认总纲',characters:'已确认人物',notes:'已有笔记'}),before=JSON.stringify(prior);
 Object.freeze(prior.styles);Object.freeze(prior);
 const next=applyCreationTemplate(prior,template.id);
 for(const field of ['title','description','outline','characters','notes'])assert.equal(next[field],prior[field]);
 assert.equal(next.kind,prior.kind);assert.equal(next.genre,template.genre);assert.deepEqual(next.styles,template.styles);assert.notEqual(next.styles,template.styles);assert.equal(JSON.stringify(prior),before);
}
assert.match(creationTemplates.find(template=>template.id==='urban').outline,/每天最多使用三次/);assert.match(creationTemplates.find(template=>template.id==='urban').outline,/记忆/);
assert.throws(()=>applyCreationTemplate(validDraft,'unavailable'));
let switching=createWorkDraft();
for(const template of [creationTemplates[0],creationTemplates[2],creationTemplates[3],creationTemplates[1],creationTemplates[0]]){
 switching=applyCreationTemplate(switching,template.id);
 for(const field of ['title','description','outline','characters','notes'])assert.equal(switching[field],template[field],'Unedited template content must follow every new selection: '+field);
 assert.equal(switching.genre,template.genre);assert.deepEqual(switching.styles,template.styles);assert.deepEqual(applyCreationTemplate(switching,template.id),switching);
}
const customized={...switching,title:'我改过的书名',outline:'我确认的新世界规则',notes:'我手写的创作记录'};
const customizedBefore=JSON.stringify(customized),future=creationTemplates.find(template=>template.id==='future');
const switched=applyCreationTemplate(customized,future.id);
for(const field of ['title','outline','notes'])assert.equal(switched[field],customized[field],'Author edits must survive template switching');
for(const field of ['description','characters'])assert.equal(switched[field],future[field],'Only untouched previous template content is replaced');
assert.equal(JSON.stringify(customized),customizedBefore);assert.deepEqual(applyCreationTemplate(switched,future.id),switched);
const legacyWithTemplate={...applyCreationTemplate(createWorkDraft({title:'旧想法',idea:longIdea,notes:'作者的旧笔记'}),'xianxia')};
const legacySwitched=applyCreationTemplate(legacyWithTemplate,'future');assert.ok(legacySwitched.notes.includes(longIdea));assert.ok(legacySwitched.notes.includes('作者的旧笔记'));assert.equal(legacySwitched.description,legacyWithTemplate.description);
console.log('PASS four original editable frameworks, truthful display names, idempotent application and preservation of author decisions without generating chapters');
console.log('PASS repeated template switches replace unedited auto-filled fields while preserving author edits and complete legacy ideas');

const asWork=(payload,index)=>{const {text,...metadata}=payload;return {id:`template-work-${index}`,...metadata,chapters:[{id:`template-chapter-${index}`,title:'第一章',text}]};};
const createdWorks=planned.map(asWork);
const legacyWork={id:'legacy-create',title:'老作品',description:'旧简介'.repeat(200),chapters:[{id:'legacy-chapter',title:'旧章',text:''}]};
const old=validateBackup({format:'mdd-workspace',version:1,works:[legacyWork]});assert.equal(Object.hasOwn(old.works[0],'styles'),false);assert.equal(Object.hasOwn(old.works[0],'templateId'),false);
const backup=validateBackup({format:'mdd-workspace',version:1,works:createdWorks});
assert.deepEqual(backup.works.map(work=>work.styles),planned.map(payload=>payload.styles));assert.deepEqual(backup.works.map(work=>work.templateId),creationTemplates.map(template=>template.id));
for(const styles of [null,'热血',['未知'],['热血','热血'],['热血','轻松','脑洞','成长']])assert.throws(()=>validateWork({...createdWorks[0],styles}),/风格/);
for(const templateId of [null,'','unknown',123])assert.throws(()=>validateWork({...createdWorks[0],templateId}),/模板/);
console.log('PASS new style/template backup fields and old records with long descriptions, with damaged optional fields rejected');

const directory=await mkdtemp(join(tmpdir(),'mdd-create-work-data-'));
let store,handler,server;let providerCalls=0;
try{
 store=createStore(directory);const owner=await store.register('fixture_create_owner','fixture-create-password-123');store.close();store=null;
 handler=createApi({directory,requireAccount:true,fetchImpl:()=>{providerCalls++;throw Error('Creation checks must never call providers');}});server=createServer(handler);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 const request=async(path,{method='GET',body}={})=>{
  const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json','X-Mdd-Client':'workspace-v1','X-Mdd-Space':owner.user.id,Cookie:`mdd_session=${owner.token}`},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,data:await response.json()};
 };
 assert.equal((await request('/api/data/works',{method:'PUT',body:{revision:0,data:[legacyWork]}})).status,200);
 let current=(await request('/api/data')).data.collections.works;assert.equal(Object.hasOwn(current.data[0],'styles'),false);assert.equal(Object.hasOwn(current.data[0],'templateId'),false);
 assert.equal((await request('/api/data/works',{method:'PUT',body:{revision:current.revision,data:[legacyWork,...createdWorks]}})).status,200);
 current=(await request('/api/data')).data.collections.works;
 assert.deepEqual(current.data.slice(1),createdWorks);assert.ok(current.data.slice(1).every(work=>work.chapters[0].text===''));
 for(const change of [{styles:'热血'},{styles:['未知']},{styles:['热血','热血']},{styles:['热血','轻松','脑洞','成长']},{templateId:'unknown'},{templateId:null}]){
  const invalid=[legacyWork,{...createdWorks[0],...change}];const response=await request('/api/data/works',{method:'PUT',body:{revision:current.revision,data:invalid}});assert.equal(response.status,400);
  assert.deepEqual((await request('/api/data')).data.collections.works,current,'Invalid new creation fields must not change records or revision');
 }
 assert.equal(providerCalls,0);console.log('PASS real temporary API style/template round-trip, legacy compatibility and rejection without record changes or provider calls');
}finally{
 store?.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}handler?.close();await rm(directory,{recursive:true,force:true});
}
