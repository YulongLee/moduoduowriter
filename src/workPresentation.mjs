import {workWords} from './data.js';

const statuses=['draft','writing','serializing','completed'];
const statusLabels={draft:'草稿',writing:'创作中',serializing:'连载中',completed:'已完结'};
const kinds=['长篇小说','短篇故事','剧本'];
const nameOrder=new Intl.Collator('zh-CN',{numeric:true,sensitivity:'base'});
const editDateFormat=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const kindOf=work=>typeof work?.kind==='string'&&work.kind.trim()?work.kind:'长篇小说';
const text=value=>typeof value==='string'?value:'';
const actualWords=work=>workWords({chapters:(Array.isArray(work?.chapters)?work.chapters:[]).map(chapter=>({text:text(chapter?.text)}))});

function isoMilliseconds(value){
 if(typeof value!=='string')return null;
 const match=/^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value);
 if(!match)return null;
 const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
 const lastDay=new Date(0);lastDay.setUTCFullYear(year,month,0);
 if(month<1||month>12||day<1||day>lastDay.getUTCDate())return null;
 const result=Date.parse(value);return Number.isFinite(result)?result:null;
}

/** Explicit author-set states take precedence; legacy percentages are ignored. */
export function workStatus(work){
 return statuses.includes(work?.status)?work.status:actualWords(work)>0?'writing':'draft';
}

export function workStatusLabel(work){return statusLabels[workStatus(work)];}

/** Percent remains numeric and unrounded so the UI can choose its display precision. */
export function workTargetProgress(work){
 const target=work?.targetWords;
 if(!Number.isInteger(target)||target<=0||target>100000000)return null;
 const words=actualWords(work);return {words,target,percent:Math.min(100,words/target*100)};
}

/** Only complete ISO timestamps count; human labels and date-only strings do not. */
export function workEditTime(work){
 return isoMilliseconds(work?.updatedAt)??isoMilliseconds(work?.createdAt);
}

export function workEditLabel(work){
 const timestamp=workEditTime(work);if(timestamp===null)return '编辑时间未记录';
 const parts=Object.fromEntries(editDateFormat.formatToParts(new Date(timestamp)).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
 return `${parts.year}/${parts.month}/${parts.day} ${parts.hour}:${parts.minute}`;
}

function matchingWorks(works,query){
 const needle=text(query).trim().toLocaleLowerCase('zh-CN');
 return (Array.isArray(works)?works:[]).filter(work=>work&&typeof work==='object'&&!Array.isArray(work)&&!work.deletedAt&&(!needle||[work.title,work.genre,work.description,kindOf(work)].some(value=>text(value).toLocaleLowerCase('zh-CN').includes(needle))));
}

/** Filter and sort copies; equal/undated records retain their incoming order. */
export function selectLibraryWorks(works,{kind='all',status='all',query='',sort='recent'}={}){
 const selected=matchingWorks(works,query).filter(work=>(kind==='all'||kindOf(work)===kind)&&(status==='all'||workStatus(work)===status));
 return selected.map((work,index)=>({work,index})).sort((left,right)=>{
  let order;
  if(sort==='words')order=actualWords(right.work)-actualWords(left.work);
  else if(sort==='name')order=nameOrder.compare(text(left.work.title),text(right.work.title));
  else{
   const a=workEditTime(left.work),b=workEditTime(right.work);
   order=a===null?(b===null?0:1):b===null?-1:b-a;
  }
  return order||left.index-right.index;
 }).map(entry=>entry.work);
}

/** Type totals ignore the selected type; state totals use the selected type. */
export function libraryCounts(works,{kind='all',query=''}={}){
 const matching=matchingWorks(works,query);
 const result={total:matching.length,kinds:Object.fromEntries(kinds.map(value=>[value,0])),statuses:Object.fromEntries(statuses.map(value=>[value,0]))};
 for(const work of matching){
  const workKind=kindOf(work);if(kinds.includes(workKind))result.kinds[workKind]++;
  if(kind==='all'||workKind===kind)result.statuses[workStatus(work)]++;
 }
 return result;
}
