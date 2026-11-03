import {validateConversation} from './conversation.js';

const groupLabels=['今天','昨天','更早','时间未记录'];
const calendar=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'});
const text=value=>typeof value==='string'?value:'';

function isoTime(value){
 if(typeof value!=='string')return null;
 const parts=/^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value);
 if(!parts)return null;
 const year=Number(parts[1]),month=Number(parts[2]),day=Number(parts[3]),lastDay=new Date(0);lastDay.setUTCFullYear(year,month,0);
 if(month<1||month>12||day<1||day>lastDay.getUTCDate())return null;
 const result=Date.parse(value);return Number.isFinite(result)?result:null;
}

function dateKey(timestamp){
 const parts=Object.fromEntries(calendar.formatToParts(new Date(timestamp)).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
 return `${parts.year}-${parts.month}-${parts.day}`;
}

function lastMessage(session){
 const turns=Array.isArray(session?.turns)?session.turns:[];
 for(let index=turns.length-1;index>=0;index--){
  const turn=turns[index];
  if(turn?.status==='completed'&&text(turn.assistantText).trim())return turn.assistantText;
  if(text(turn?.userText).trim())return turn.userText;
 }
 return text(session?.draft);
}

const previewFor=session=>Array.from(lastMessage(session).replace(/\s+/gu,' ').trim()).slice(0,80).join('');

/** Display copies only: derived preview/workLabel fields must not be persisted. */
export function groupConversations(records,{now,activeId='',scratch}={}){
 const timestamp=isoTime(now);if(timestamp===null)throw new Error('对话分组需要明确的有效ISO时间');
 const today=dateKey(timestamp),previousDay=new Date(`${today}T00:00:00Z`);previousDay.setUTCDate(previousDay.getUTCDate()-1);
 const yesterday=previousDay.toISOString().slice(0,10);
 const candidates=(Array.isArray(records)?records:[]).filter(session=>session&&typeof session==='object'&&!Array.isArray(session)&&typeof session.id==='string'&&session.id);
 if(scratch&&typeof scratch.id==='string'&&scratch.id&&!candidates.some(session=>session.id===scratch.id)&&(!activeId||activeId===scratch.id)&&previewFor(scratch))candidates.push(scratch);
 const groups=new Map(groupLabels.map(label=>[label,[]]));
 const sorted=candidates.map((session,index)=>{const at=isoTime(session.updatedAt)??isoTime(session.createdAt);return {session,index,at,sortAt:at!==null&&dateKey(at)<=today?at:null};}).sort((left,right)=>left.sortAt===null?(right.sortAt===null?left.index-right.index:1):right.sortAt===null?-1:right.sortAt-left.sortAt||left.index-right.index);
 for(const {session,at} of sorted){
  const date=at===null?null:dateKey(at);
  // A future calendar date is not historical activity and is never labeled "更早".
  const label=date===today?'今天':date===yesterday?'昨天':date&&date<today?'更早':'时间未记录';
  const item={...session,preview:previewFor(session)};
  if(typeof session.workLabel==='string')item.workLabel=session.workLabel.replace(/\s+/gu,' ').trim();
  groups.get(label).push(item);
 }
 return groupLabels.filter(label=>groups.get(label).length).map(label=>({label,items:groups.get(label)}));
}

/** Rename metadata only; preserve the original turns, frozen requests and scope. */
export function renameConversation(session,title,{at}={}){
 validateConversation(session);
 if(typeof title!=='string'||!title.trim()||title.trim().length>80)throw new Error('对话名称需为1–80个字符');
 if(isoTime(at)===null)throw new Error('重命名需要明确的有效ISO时间');
 return validateConversation({...session,title:title.trim(),updatedAt:at});
}
