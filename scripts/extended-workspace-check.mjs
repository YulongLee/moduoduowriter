import assert from 'node:assert/strict';
import {collectBackup,restoreBackup,mergeBackup,validateBackup,validateWork,backupKeys} from '../src/backup.js';
import {createWorkspaceClient,collectionKeys,workspaceBackup} from '../src/workspace.js';
import {scopedStorage,storageKeyForSpace,readStoredArray,writeStoredValue} from '../src/storage.js';
import {saveMemoryEntry,applyMemoryExtraction} from '../src/storyMemory.js';
import {createChapterQueue,completeQueueJob,prepareQueueJob} from '../src/chapterQueue.js';
import {captureSubmissionVersion,withSubmissionVersion} from '../src/submissions.js';
import {captureRevision} from '../src/Revision.js';
import {createWritingEvaluation} from '../src/writingEvaluation.js';

const storage=()=>{const map=new Map();return {map,getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)};};
const initial={id:'story',title:'测试作品',genre:'悬疑',kind:'长篇小说',description:'旧信的来历',outline:'追查钟楼',characters:'修复师',chapters:[{id:'c1',title:'雨夜',text:'沈听澜推开书店的门。',plan:'门缝里出现旧信'}]};
let work=saveMemoryEntry(initial,{type:'character',title:'沈听澜',content:'旧物修复师',summary:'修复师',relatedIds:[],locked:true,evidence:'沈听澜推开书店的门。',sourceChapterId:'c1'});
work=applyMemoryExtraction(work,'c1',{summary:'修复师在雨夜返回书店。',entries:[]},[],{sourceText:initial.chapters[0].text});
work={...work,chapterQueue:createChapterQueue(work,{chapterIds:['c1'],referenceIds:[`memory:${work.memory.entries[0].id}`]})};
work={...work,chapterQueue:completeQueueJob(prepareQueueJob(work,work.chapterQueue,work.chapterQueue.jobs[0].id),work.chapterQueue.jobs[0].id,{text:'信封上写着明天的日期。',source:'demo'})};
const snapshot=captureSubmissionVersion(work,{}, {id:'snapshot-1',versionLabel:'首次投递'});
const submission=withSubmissionVersion({id:'submission-1',title:work.title,platform:'人工投递',status:'草稿'},snapshot);
const planning={title:'雨夜来信',outline:'追查寄信人',characters:'修复师',text:'雨从傍晚开始。'};
const quick={id:'planning:sample',type:'quick-start',initial:{idea:'旧信来自明天',genre:'悬疑',audience:'全频',perspective:'第三人称',kind:'长篇小说',mode:'灵感共创'},planning,scope:'outline',candidate:{values:{outline:'新的总纲'},baseline:{...planning},source:'demo'},chosen:['outline'],requirement:'保留亲情线索',hasGenerated:true,updatedAt:new Date().toISOString()};
const revision={id:'editor:story:c1:text',type:'revision-thread',prompt:'保留文风',versions:[{id:1,text:'雨从傍晚开始。',requirement:'润色',source:'demo',anchor:captureRevision({workId:'story',chapterId:'c1',text:work.chapters[0].text}),createdAt:new Date().toISOString()}],currentId:1,continuing:true,referenceIds:[`memory:${work.memory.entries[0].id}`],updatedAt:new Date().toISOString()};
const evaluation=createWritingEvaluation('opening');evaluation.candidates[0].text='灯塔亮起的那一刻，林渡停下了手中的锉刀。';evaluation.candidates[1].text='照片从门缝里滑进来，边缘还沾着海水。';
const backup=validateBackup({format:'mdd-workspace',version:1,works:[work],submissions:[submission],planningDrafts:[quick,revision],evaluations:[evaluation]});
const local=storage();restoreBackup(local,backup);
const restored=collectBackup(local);
assert.deepEqual(restored.works,backup.works);assert.deepEqual(restored.submissions,backup.submissions);assert.deepEqual(restored.planningDrafts,backup.planningDrafts);
assert.deepEqual(restored.evaluations,backup.evaluations);assert.equal(backupKeys.evaluations,collectionKeys.evaluations);
const capacity=validateBackup({format:'mdd-workspace',version:1,works:[],evaluations:Array.from({length:100},(_,index)=>({...structuredClone(evaluation),id:`saved-evaluation-${index}`}))});
const extra=validateBackup({format:'mdd-workspace',version:1,works:[],favorites:['outline'],evaluations:[evaluation]});
assert.throws(()=>mergeBackup(capacity,extra),/100/,'Combined limits must be checked before any collection is changed');
const capacityStorage=storage();restoreBackup(capacityStorage,capacity);const beforeFailedImport=[...capacityStorage.map];
assert.throws(()=>restoreBackup(capacityStorage,extra),/100/);assert.deepEqual([...capacityStorage.map],beforeFailedImport,'A rejected combined backup must leave every cached collection unchanged');
assert.equal(restored.works[0].memory.entries[0].locked,true);assert.equal(restored.works[0].chapters[0].summary,'修复师在雨夜返回书店。');assert.equal(restored.works[0].chapterQueue.jobs[0].status,'awaiting_confirmation');
assert.deepEqual(validateBackup({format:'mdd-workspace',version:1,works:[initial]}).planningDrafts,[]);
assert.equal(backupKeys.planningDrafts,collectionKeys.planningDrafts);
for(const [label,mutate] of [
 ['memory',value=>{value.works[0].memory.entries[0].type='unknown';}],
 ['locked fact',value=>{value.works[0].memory.entries[0].locked='yes';}],
 ['chapter summary',value=>{value.works[0].chapters[0].summary={text:'bad'};}],
 ['queue state',value=>{value.works[0].chapterQueue.jobs[0].status='published';}],
 ['queue duplicate',value=>{value.works[0].chapterQueue.jobs.push(value.works[0].chapterQueue.jobs[0]);}],
 ['planning shape',value=>{value.planningDrafts[0].planning.outline=123;}],
 ['oversized requirement',value=>{value.planningDrafts[0].requirement='x'.repeat(100001);}],
 ['revision anchor',value=>{value.planningDrafts[1].versions[0].anchor.end=999999;}],
 ['revision active candidate',value=>{value.planningDrafts[1].currentId=99;}],
 ['submission word count',value=>{value.submissions[0].snapshot.wordCount++;}],
 ['submission active version',value=>{value.submissions[0].activeVersionId='missing';}],
 ['evaluation method',value=>{value.evaluations[0].method='automatic';}],
 ['evaluation date',value=>{value.evaluations[0].createdAt='not-a-date';}],
 ['evaluation score',value=>{value.evaluations[0].candidates[0].scores.style=10;}]
]) {const malformed=structuredClone(backup);mutate(malformed);assert.throws(()=>validateBackup(malformed),undefined,`Must reject malformed ${label}`);}
assert.throws(()=>validateWork({...initial,memory:{version:1,entries:new Array(10001).fill({})}}));
console.log('PASS memory, summaries, queue candidates, planning and revision drafts, immutable submission versions round-trip; malformed records and oversized drafts rejected');

const cache=storage();cache.setItem(collectionKeys.works,JSON.stringify([{...initial,title:'legacy private manuscript'}]));cache.setItem(collectionKeys.planningDrafts,JSON.stringify([quick]));
assert.equal(storageKeyForSpace(collectionKeys.works,'local'),collectionKeys.works);
const aliceCache=scopedStorage(cache,'alice'),bobCache=scopedStorage(cache,'bob');aliceCache.setItem(collectionKeys.works,JSON.stringify([{...initial,title:'Alice cached manuscript'}]));
assert.equal(bobCache.getItem(collectionKeys.works),null);assert.deepEqual(readStoredArray(bobCache,collectionKeys.works,[]),[]);assert.equal(writeStoredValue(bobCache,collectionKeys.favorites,['outline']),true);
assert.equal(cache.getItem('mdd-space:bob:mdd-favorites-v1'),'["outline"]');assert.ok(cache.getItem(collectionKeys.works).includes('legacy private'));
const fresh=()=>Object.fromEntries(Object.keys(collectionKeys).map(name=>[name,{data:[],revision:1}]));
const remote={alice:fresh(),bob:fresh()},requests=[];let cookieSpace='alice';
remote.alice.works.data=[{...initial,title:'Alice server manuscript'}];
const request=async(path,body,options={})=>{
 requests.push({path,body:structuredClone(body),spaceId:options.spaceId,method:options.method});
 if(options.spaceId!==cookieSpace)throw Object.assign(new Error('账号空间已切换'),{status:412,code:'space-mismatch'});
 const collections=remote[cookieSpace];
 if(path==='/api/data')return {spaceId:cookieSpace,collections:structuredClone(collections)};
 const name=path.split('/').at(-1),entry=collections[name];if(body.revision!==entry.revision)throw Object.assign(new Error('Conflict'),{status:409});entry.data=structuredClone(body.data);entry.revision++;return {spaceId:cookieSpace,revision:entry.revision};
};
const alice=createWorkspaceClient({storage:cache,request,spaceId:'alice'}),bob=createWorkspaceClient({storage:cache,request,spaceId:'bob'});
try{
 assert.ok(alice.entries.works.data[0].title.includes('Alice cached'));assert.equal(alice.entries.planningDrafts.data.length,0,'A user space must not read legacy planning drafts');
 await alice.initialize();assert.equal(alice.entries.works.data[0].title,'Alice server manuscript');
 alice.set('planningDrafts',[quick,revision]);await alice.flush();assert.equal(remote.alice.planningDrafts.data.length,2);assert.equal(workspaceBackup(alice).planningDrafts.length,2);
 cookieSpace='bob';await bob.initialize();assert.deepEqual(bob.entries.works.data,[]);assert.deepEqual(bob.entries.planningDrafts.data,[]);assert.ok(cache.getItem(collectionKeys.works).includes('legacy private'));
 alice.set('works',[{...initial,title:'Alice offline edit after another tab logged in as Bob'}]);await alice.flush();
 assert.equal(alice.state.status,'space-mismatch');assert.equal(remote.bob.works.data.length,0,'An old tab must never write its manuscript to the newly logged-in user');
 assert.ok(alice.state.error.includes('重新登录'));assert.ok(aliceCache.getItem(collectionKeys.works).includes('Alice offline edit'));
 const count=requests.length;alice.set('favorites',['character']);await alice.flush();await alice.initialize();await alice.refresh();assert.equal(requests.length,count,'A mismatched client must stop retries, refresh and subsequent flushes');
 assert.ok(requests.every(value=>value.spaceId==='alice'||value.spaceId==='bob'));
}finally{alice.stop();bob.stop();}
const leaked={spaceId:'bob',collections:{...fresh(),works:{data:[{...initial,title:'Bob private content'}],revision:10}}};
const mismatched=createWorkspaceClient({storage:cache,spaceId:'alice',request:async()=>leaked});
try{await mismatched.initialize();assert.equal(mismatched.state.status,'space-mismatch');assert.ok(!JSON.stringify(mismatched.entries).includes('Bob private content'));assert.ok(!aliceCache.getItem(collectionKeys.works).includes('Bob private content'));}finally{mismatched.stop();}
let legacyRequests=0;
const legacy=createWorkspaceClient({storage:storage(),request:async(path,body)=>{legacyRequests++;return path==='/api/data'?{collections:fresh()}:{revision:1};}});
try{await legacy.initialize();assert.equal(legacy.state.status,'saved');assert.ok(legacyRequests>=1);}finally{legacy.stop();}
console.log('PASS namespaced cache and pending markers, original local migration, planning-draft sync, explicit space headers, switched-session write prevention and old mock compatibility');
