import assert from 'node:assert/strict';
import {workStatus,workStatusLabel,workTargetProgress,workEditTime,workEditLabel,selectLibraryWorks,libraryCounts} from '../src/workPresentation.mjs';
import {workWords} from '../src/data.js';
import {validateWork,validateBackup,collectBackup,restoreBackup} from '../src/backup.js';

// Pure fixtures only: no real account, current clock, browser storage or services.
const work=(id,properties={})=>({id,title:id,kind:'长篇小说',genre:'悬疑',description:'',chapters:[{id:id+'-chapter',title:'第一章',text:''}],...properties});
const written=work('written',{chapters:[{id:'written-chapter',title:'正文',text:'春 风\n雨'}],progress:0});
assert.equal(workStatus(written),'writing');
assert.equal(workStatus(work('legacy-empty',{progress:100,updated:'今天 10:42',outline:'大纲已完成',characters:'人物已准备'})),'draft');
assert.equal(workStatus(work('spaces',{chapters:[{id:'spaces',title:'空白',text:' \n\t'}]})),'draft');
assert.equal(workStatus({...written,status:'legacy-label'}),'writing');
assert.equal(workStatus(null),'draft');
for(const [status,label] of [['draft','草稿'],['writing','创作中'],['serializing','连载中'],['completed','已完结']]){
 const value=work('explicit-'+status,{status});assert.equal(workStatus(value),status);assert.equal(workStatusLabel(value),label);
 assert.equal(workStatus({...written,status}),status,'A valid explicit state must override body inference');
}
assert.deepEqual(workTargetProgress({...written,targetWords:6}),{words:workWords(written),target:6,percent:50});
assert.deepEqual(workTargetProgress({...written,targetWords:2,progress:1}),{words:3,target:2,percent:100});
assert.equal(workTargetProgress({...written,targetWords:7}).percent,3/7*100);
assert.equal(workTargetProgress(work('empty-target',{targetWords:100000000})).percent,0);
for(const targetWords of [undefined,null,0,-1,1.5,100000001,NaN,Infinity,'100',{},true])assert.equal(workTargetProgress({...written,targetWords,progress:99}),null);
console.log('PASS explicit/legacy work states and real-word target progress without legacy percentage or human-date inference');

const timestamp='2026-11-04T08:15:00.000Z';
assert.equal(workEditTime({updatedAt:timestamp}),Date.parse(timestamp));
assert.equal(workEditTime({updatedAt:'2026-11-04T16:15:00+08:00'}),Date.parse(timestamp));
assert.equal(workEditTime({updatedAt:'今天 10:42',createdAt:timestamp}),Date.parse(timestamp));
assert.equal(workEditTime({updatedAt:timestamp,createdAt:'2026-11-05T00:00:00Z'}),Date.parse(timestamp),'The valid updatedAt field takes precedence');
assert.equal(workEditTime({updatedAt:'1970-01-01T00:00:00Z'}),0,'The epoch timestamp must not be treated as missing');
assert.equal(workEditLabel({updatedAt:timestamp}),'2026/11/04 16:15');
assert.equal(workEditLabel({createdAt:'2026-11-04T18:45:00Z'}),'2026/11/05 02:45');
assert.equal(workEditLabel({createdAt:'2026-11-04T16:00:00Z'}),'2026/11/05 00:00');
for(const invalid of ['今天','2026-11-04','2026-02-30T08:15:00Z','2026-13-01T00:00:00Z','2026-11-04T24:00:00Z','2026-11-04T08:15:61Z','2026-11-04T08:15:00',null,123]){
 assert.equal(workEditTime({updatedAt:invalid}),null);assert.equal(workEditLabel({updatedAt:invalid}),'编辑时间未记录');
}
console.log('PASS strict ISO fallback and deterministic Beijing edit-time labels, including midnight and unrecorded legacy dates');

const sample=[
 work('a',{title:'Zulu',updated:'今天 23:59',progress:90}),
 work('b',{title:'Alpha',description:'A FUTURE letter',updatedAt:'2026-11-03T12:00:00Z',chapters:[{id:'b-c',title:'b',text:'一二三四五'}]}),
 work('c',{title:'Gamma',kind:'短篇故事',genre:'科幻',status:'serializing',createdAt:'2026-10-01T00:00:00Z',chapters:[{id:'c-c',title:'c',text:'一二'}]}),
 work('d',{title:'Beta',kind:'剧本',status:'completed',updatedAt:timestamp,chapters:[{id:'d-c',title:'d',text:'一二三'}]}),
 work('e',{title:'Yankee',updatedAt:'昨天 21:16',chapters:[{id:'e-c',title:'e',text:'一'}]}),
 work('deleted',{title:'Deleted',deletedAt:'2026-11-04T10:00:00Z',updatedAt:'2026-11-05T00:00:00Z',status:'completed'}),
];
const deepFreeze=value=>{Object.freeze(value);for(const child of Object.values(value))if(child&&typeof child==='object'&&!Object.isFrozen(child))deepFreeze(child);return value;};
deepFreeze(sample);const before=JSON.stringify(sample),ids=values=>values.map(value=>value.id);
assert.deepEqual(ids(selectLibraryWorks(sample)),['d','b','c','a','e']);
assert.deepEqual(ids(selectLibraryWorks(sample,{sort:'words'})),['b','d','c','e','a']);
assert.deepEqual(ids(selectLibraryWorks(sample,{sort:'name'})),['b','d','c','e','a']);
assert.deepEqual(ids(selectLibraryWorks(sample,{kind:'长篇小说',status:'writing'})),['b','e']);
assert.deepEqual(ids(selectLibraryWorks(sample,{kind:'剧本',status:'completed'})),['d']);
assert.deepEqual(ids(selectLibraryWorks(sample,{query:'  ALPHA '})),['b']);
assert.deepEqual(ids(selectLibraryWorks(sample,{query:'future'})),['b']);
assert.deepEqual(ids(selectLibraryWorks(sample,{query:'科幻'})),['c']);
assert.deepEqual(ids(selectLibraryWorks(sample,{query:'剧本'})),['d']);
assert.notEqual(selectLibraryWorks(sample),sample);assert.equal(JSON.stringify(sample),before);
const counts=libraryCounts(sample);
assert.deepEqual(counts,{total:5,kinds:{'长篇小说':3,'短篇故事':1,'剧本':1},statuses:{draft:1,writing:2,serializing:1,completed:1}});
assert.deepEqual(libraryCounts(sample,{kind:'长篇小说'}),{...counts,statuses:{draft:1,writing:2,serializing:0,completed:0}});
assert.deepEqual(libraryCounts(sample,{kind:'剧本',query:'future'}),{total:1,kinds:{'长篇小说':1,'短篇故事':0,'剧本':0},statuses:{draft:0,writing:0,serializing:0,completed:0}});
assert.deepEqual(libraryCounts([]),{total:0,kinds:{'长篇小说':0,'短篇故事':0,'剧本':0},statuses:{draft:0,writing:0,serializing:0,completed:0}});
assert.deepEqual(ids(selectLibraryWorks([sample[0],null,[],sample[4]],{sort:'recent'})),['a','e']);
assert.equal(libraryCounts([{...sample[0],kind:undefined}]).kinds['长篇小说'],1);
console.log('PASS nondeleted library search/type/state filters, real date/word/name sorting, stable undated records and independent scoped counts without mutation');

const legacy=work('legacy',{progress:100,updated:'今天 10:42'});
assert.equal(validateWork(legacy).status,undefined);assert.equal(validateWork(legacy).targetWords,undefined);
const oldBackup=validateBackup({format:'mdd-workspace',version:1,works:[legacy]});assert.equal(oldBackup.works[0].status,undefined);
for(const status of ['draft','writing','serializing','completed'])for(const targetWords of [1,100000000])assert.equal(validateWork({...legacy,status,targetWords}).targetWords,targetWords);
for(const status of ['',null,0,'done','已完结',{},[]])assert.throws(()=>validateWork({...legacy,status}),/状态/);
for(const targetWords of [null,0,-1,1.5,100000001,NaN,Infinity,'100',{},true])assert.throws(()=>validateWork({...legacy,targetWords}),/目标字数/);
const storageValues=new Map(),storage={getItem:key=>storageValues.get(key)??null,setItem:(key,value)=>storageValues.set(key,value),removeItem:key=>storageValues.delete(key)};
restoreBackup(storage,{format:'mdd-workspace',version:1,works:[{...legacy,status:'serializing',targetWords:80000}]});
const restored=collectBackup(storage);assert.equal(restored.works[0].status,'serializing');assert.equal(restored.works[0].targetWords,80000);
const beforeRestore=[...storageValues];assert.throws(()=>restoreBackup(storage,{format:'mdd-workspace',version:1,works:[{...legacy,targetWords:0}]}));assert.deepEqual([...storageValues],beforeRestore);
console.log('PASS old-backup compatibility, explicit state/goal round-trip and damaged new fields rejected before restore writes');
