import {newId} from './works.js';

export const CONVERSATION_LIMITS=Object.freeze({sessions:20,turns:30,userChars:4000,assistantChars:16000,historyTurns:8,historyChars:16000,requestChars:50000,sessionChars:750000,collectionChars:12000000,references:100});
const statuses=new Set(['sending','completed','failed','cancelled','interrupted']);
const terminalStatuses=new Set(['failed','cancelled','interrupted']);
const requestKeys=new Set(['task','requestId','prompt','context','mode','target']);
const sessionKeys=new Set(['id','title','workId','createdAt','updatedAt','draft','referenceIds','turns']);
const turnKeys=new Set(['id','requestId','userText','assistantText','status','source','error','createdAt','updatedAt','request','usage']);
const tokenKeys=new Set(['inputTokens','outputTokens','totalTokens','promptTokens','completionTokens']);
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
const str=(value,max)=>typeof value==='string'&&value.length<=max;
const identifier=value=>str(value,120)&&/^[a-zA-Z0-9_:-]{1,120}$/.test(value);
const requestIdentifier=value=>identifier(value)&&value.length>=8;
const validWorkId=value=>str(value,500);
const timestamp=value=>str(value,64)&&Number.isFinite(Date.parse(value));
const now=()=>new Date().toISOString();
const clone=value=>JSON.parse(JSON.stringify(value));
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const allowedKeys=(value,keys)=>Object.keys(value).every(key=>keys.has(key));

function assertSafeJSON(value,{limit=CONVERSATION_LIMITS.requestChars}={}) {
 const ancestors=new Set();let nodes=0;
 const visit=(item,depth)=>{
  assert(++nodes<=10000&&depth<=24,'对话请求资料过于复杂，请减少引用。');
  if(item===null||typeof item==='string'||typeof item==='boolean')return;
  if(typeof item==='number'){assert(Number.isFinite(item),'对话请求包含无效数字。');return;}
  assert(Array.isArray(item)?Object.getPrototypeOf(item)===Array.prototype:plain(item),'对话请求只能包含普通 JSON 资料。');
  assert(!ancestors.has(item),'对话请求包含循环资料。');ancestors.add(item);
  assert(Object.getOwnPropertySymbols(item).length===0,'对话请求包含不支持的字段。');
  if(Array.isArray(item))assert(Object.keys(item).length===item.length&&Object.keys(item).every(key=>/^(0|[1-9]\d*)$/.test(key)&&Number(key)<item.length),'对话请求包含不支持的数组字段。');
  for(const [key,property]of Object.entries(Object.getOwnPropertyDescriptors(item))){
   assert(key.length<=200&&!['__proto__','prototype','constructor'].includes(key)&&'value'in property,'对话请求包含不支持的字段。');visit(property.value,depth+1);
  }
  ancestors.delete(item);
 };
 visit(value,0);assert(JSON.stringify(value).length<=limit,'对话请求资料过多，请减少引用或历史。');return value;
}

export function validateConversationHistory(history) {
 assert(Array.isArray(history)&&history.length<=16&&history.length%2===0,'对话历史需包含最多 8 轮完整讨论。');
 let chars=0;
 history.forEach((message,index)=>{
  assert(plain(message)&&allowedKeys(message,new Set(['role','content']))&&message.role===(index%2===0?'user':'assistant')&&str(message.content,16000)&&message.content.trim(),'对话历史的角色或内容不正确。');chars+=message.content.length;
 });
 assert(chars<=CONVERSATION_LIMITS.historyChars,'对话历史超过本次输入预算。');return history;
}

export function validateConversationRequest(request,{userText,requestId,workId=''}) {
 assert(plain(request)&&allowedKeys(request,requestKeys),'对话请求格式不正确。');
 assertSafeJSON(request);
 assert(str(userText,CONVERSATION_LIMITS.userChars)&&userText.trim()&&validWorkId(workId)&&request.task==='chat'&&request.requestId===requestId&&requestIdentifier(requestId)&&request.prompt===userText,'对话请求与本轮输入不一致。');
 assert(['standard','refine'].includes(request.mode)&&Number.isInteger(request.target)&&request.target>=200&&request.target<=4000,'对话生成模式或目标篇幅不正确。');
 assert(plain(request.context),'对话上下文格式不正确。');
 const referencedWork=request.context.workId||'';
 assert(validWorkId(referencedWork)&&referencedWork===workId,'对话请求关联了其他作品，请重新开始该作品的讨论。');
 if(workId)assert(request.context.workId===workId,'关联作品的对话请求缺少作品标识。');
 if(request.context.chapterId!==undefined)assert(str(request.context.chapterId,500)&&Boolean(workId),'独立讨论不能引用其他作品的章节。');
 validateConversationHistory(request.context.history||[]);
 return request;
}

function validateUsage(usage) {
 if(usage===undefined||usage===null)return;
 assert(plain(usage)&&Object.keys(usage).length<=5&&Object.entries(usage).every(([key,value])=>tokenKeys.has(key)&&Number.isSafeInteger(value)&&value>=0&&value<=1000000000000),'对话用量记录格式不正确。');
}

export function validateConversation(session) {
 assert(plain(session)&&allowedKeys(session,sessionKeys)&&identifier(session.id),'对话记录格式不正确。');
 assert(str(session.title,120)&&session.title.trim()&&validWorkId(session.workId)&&timestamp(session.createdAt)&&timestamp(session.updatedAt),'对话名称、作品或时间格式不正确。');
 assert(str(session.draft,CONVERSATION_LIMITS.userChars),'对话草稿最多 4,000 字符。');
 assert(Array.isArray(session.referenceIds)&&session.referenceIds.length<=CONVERSATION_LIMITS.references&&new Set(session.referenceIds).size===session.referenceIds.length&&session.referenceIds.every(value=>str(value,1000)&&value.length>0),'对话引用格式不正确。');
 assert(session.workId||session.referenceIds.length===0,'独立讨论不能保存作品引用。');
 assert(Array.isArray(session.turns)&&session.turns.length<=CONVERSATION_LIMITS.turns,'每份对话最多保留 30 轮，请导出后开始新对话。');
 const turnIds=new Set(),requestIds=new Set();let sending=0,frozen=0;
 session.turns.forEach((turn,index)=>{
  assert(plain(turn)&&allowedKeys(turn,turnKeys)&&identifier(turn.id)&&requestIdentifier(turn.requestId)&&!turnIds.has(turn.id)&&!requestIds.has(turn.requestId),'对话轮次或请求编号重复／不正确。');
  turnIds.add(turn.id);requestIds.add(turn.requestId);
  assert(str(turn.userText,CONVERSATION_LIMITS.userChars)&&turn.userText.trim()&&str(turn.assistantText,CONVERSATION_LIMITS.assistantChars)&&statuses.has(turn.status)&&['','ai','demo'].includes(turn.source)&&str(turn.error,2000)&&timestamp(turn.createdAt)&&timestamp(turn.updatedAt),'对话内容或状态格式不正确。');
  validateUsage(turn.usage);
  if(turn.status==='completed')assert(turn.assistantText.trim()&&['ai','demo'].includes(turn.source)&&turn.error===''&&turn.request===undefined,'已完成的对话内容或来源不完整。');
  else {
   assert(turn.assistantText===''&&turn.source===''&&(turn.usage===undefined||turn.usage===null),'未完成的对话不能冒充生成结果。');
   if(turn.status==='sending'){sending++;assert(turn.request&&turn.error==='','正在生成的对话缺少可恢复请求。');}
   else assert(turn.error.trim(),'未完成的对话需保留原因。');
  }
  if(turn.request!==undefined){
   frozen++;assert(index===session.turns.length-1&&turn.status!=='completed','只能保留最近一轮未完成请求供恢复。');
   validateConversationRequest(turn.request,{userText:turn.userText,requestId:turn.requestId,workId:session.workId});
  }
 });
 assert(sending<=1&&frozen<=1,'一份对话只能有一个未完成的生成请求。');
 assert(JSON.stringify(session).length<=CONVERSATION_LIMITS.sessionChars,'这份对话过长，请导出后开始新对话。');
 return session;
}

export function validateConversations(records) {
 assert(Array.isArray(records)&&records.length<=CONVERSATION_LIMITS.sessions,'最多保存 20 份对话，请先导出并删除旧对话。');
 assert(new Set(records.map(record=>record?.id)).size===records.length,'对话编号重复，请重新选择备份。');
 records.forEach(validateConversation);
 assert(JSON.stringify(records).length<=CONVERSATION_LIMITS.collectionChars,'对话记录容量已满，请先导出并删除旧对话。');
 return records;
}

export function createConversation({workId='',draft='',referenceIds=[]}={}) {
 const createdAt=now();
 return validateConversation({id:newId(),title:'新的创作对话',workId,createdAt,updatedAt:createdAt,draft,referenceIds:[...referenceIds],turns:[]});
}

export function saveConversation(records,session) {
 validateConversation(session);
 const next=[session,...records.filter(record=>record.id!==session.id)];
 validateConversations(next);return next;
}

// Missing records are deliberately not recreated: an async result cannot resurrect a deleted conversation.
export function updateConversation(records,id,updater) {
 const current=records.find(record=>record.id===id);if(!current)return records;
 const next=updater(clone(current));assert(next?.id===id,'不能修改对话编号。');
 validateConversation(next);return saveConversation(records,next);
}

const touch=(session,patch)=>validateConversation({...session,...patch,updatedAt:now()});
export function beginConversationTurn(session,{userText,request,requestId=request?.requestId}={}) {
 validateConversation(session);
 assert(!session.turns.some(turn=>turn.status==='sending'),'上一条对话仍在生成，请先等待或取消。');
 assert(session.turns.length<CONVERSATION_LIMITS.turns,'每份对话最多保留 30 轮，请导出后开始新对话。');
 const question=typeof userText==='string'?userText.trim():'';
 assert(question&&question.length<=CONVERSATION_LIMITS.userChars,'请填写最多 4,000 字符的创作问题。');
 validateConversationRequest(request,{userText:question,requestId,workId:session.workId});
 const createdAt=now(),turn={id:newId(),requestId,userText:question,assistantText:'',status:'sending',source:'',error:'',createdAt,updatedAt:createdAt,request:clone(request),usage:null};
 const turns=session.turns.map(previous=>{if(previous.request===undefined)return previous;const {request:discarded,...kept}=previous;return kept;});
 return touch(session,{title:session.turns.length?session.title:Array.from(question.replace(/\s+/g,' ')).slice(0,28).join(''),draft:'',turns:[...turns,turn]});
}

export function completeConversationTurn(session,turnId,result) {
 validateConversation(session);
 const current=session.turns.find(turn=>turn.id===turnId);if(!current||current.status!=='sending')return session;
 assert(str(result?.text,CONVERSATION_LIMITS.assistantChars)&&result.text.trim(),'回复为空或超过会话保存上限，请复制结果后重新讨论。');
 assert(['ai','demo'].includes(result.source),'生成回复缺少明确来源。');validateUsage(result.usage);
 return touch(session,{turns:session.turns.map(turn=>{if(turn.id!==turnId)return turn;const {request:finished,...saved}=turn;return {...saved,assistantText:result.text,status:'completed',source:result.source,error:'',usage:result.usage?clone(result.usage):null,updatedAt:now()};})});
}

export function failConversationTurn(session,turnId,{status='failed',error='本轮尚未完成，请检查后再试。'}={}) {
 validateConversation(session);assert(terminalStatuses.has(status),'对话失败状态不正确。');
 const current=session.turns.find(turn=>turn.id===turnId);if(!current||current.status!=='sending')return session;
 return touch(session,{turns:session.turns.map(turn=>turn.id===turnId?{...turn,status,error:String(error||'本轮尚未完成。').slice(0,2000),updatedAt:now()}:turn)});
}

export function restartConversationTurn(session,turnId,{request,requestId}={}) {
 validateConversation(session);
 const current=session.turns.at(-1);
 assert(current?.id===turnId&&terminalStatuses.has(current.status)&&current.request,'只有最近一轮未完成请求可以恢复，请开始新的讨论。');
 const frozen=request||current.request,nextId=requestId||frozen.requestId;
 validateConversationRequest(frozen,{userText:current.userText,requestId:nextId,workId:session.workId});
 return touch(session,{turns:session.turns.map(turn=>turn.id===turnId?{...turn,requestId:nextId,request:clone(frozen),status:'sending',source:'',assistantText:'',error:'',usage:null,updatedAt:now()}:turn)});
}

export function recoverConversations(records) {
 validateConversations(records);let changed=false;
 const next=records.map(session=>{
  if(!session.turns.some(turn=>turn.status==='sending'))return session;
  changed=true;return touch(session,{turns:session.turns.map(turn=>turn.status==='sending'?{...turn,status:'interrupted',error:'上次讨论已中断；请先恢复结果或核对请求状态，不会自动重新生成。',updatedAt:now()}:turn)});
 });
 return changed?next:records;
}

export function buildConversationHistory(session,{maxTurns=CONVERSATION_LIMITS.historyTurns,budget=CONVERSATION_LIMITS.historyChars}={}) {
 validateConversation(session);
 assert(Number.isInteger(maxTurns)&&maxTurns>=1&&maxTurns<=8&&Number.isInteger(budget)&&budget>=200&&budget<=16000,'对话历史预算不正确。');
 const completed=session.turns.filter(turn=>turn.status==='completed');let inputChars=0;const chosen=[];
 for(let index=completed.length-1;index>=0&&chosen.length<maxTurns;index--){
  const turn=completed[index],size=turn.userText.length+turn.assistantText.length;if(inputChars+size>budget)break;chosen.unshift(turn);inputChars+=size;
 }
 const history=chosen.flatMap(turn=>[{role:'user',content:turn.userText},{role:'assistant',content:turn.assistantText}]);
 const omittedTurns=completed.length-chosen.length,truncated=omittedTurns>0;
 const notice=truncated?`本次引用最近 ${chosen.length} 轮已完成讨论；${omittedTurns} 轮较早或过长内容未发送。`:chosen.length?`本次引用 ${chosen.length} 轮已完成讨论。`:'本次没有已完成的历史讨论。';
 return {history,notice,truncated,inputChars,usedTurns:chosen.length,omittedTurns};
}

export function conversationText(session) {
 validateConversation(session);
 const lines=['墨多多写作 · 创作对话',session.title,`关联：${session.workId||'独立讨论'}`,`创建：${new Date(session.createdAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})}`,''];
 for(const turn of session.turns){lines.push('你：',turn.userText,'');if(turn.status==='completed')lines.push(`墨多多（${turn.source==='demo'?'预置示例':'智能创作'}）：`,turn.assistantText,'');else lines.push(`本轮未完成：${turn.error||turn.status}`,'');}
 if(session.draft.trim())lines.push('尚未发送的草稿：',session.draft,'');
 return lines.join('\n');
}
