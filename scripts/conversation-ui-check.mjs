import assert from 'node:assert/strict';
import React from 'react';
import TestRenderer,{act} from 'react-test-renderer';
import {createServer} from 'vite';

// Controlled in-memory UI scenarios. No real writing service, paid model, or user manuscript is accessed.
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const original={fetch:globalThis.fetch,window:globalThis.window,document:globalThis.document,location:globalThis.location,localStorage:globalThis.localStorage,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame};
const originalNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
const originalCreateObjectURL=URL.createObjectURL,originalRevokeObjectURL=URL.revokeObjectURL;
const originalSetTimeout=globalThis.setTimeout;
const values=new Map(),calls=[],generated=[],downloads=[],listeners=new Map();
let copied='',behavior='success',reply='受控回复：让主角先尝试一个有代价的行动，再揭开新线索。',taskReply=null,held=null,holdTasks=false,taskHeld=null,blockedSave=false,saveAttempts=0,failSaveAt=Infinity;
globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>{if(key==='mdd-conversations-v1'&&(++saveAttempts===failSaveAt||blockedSave))throw new DOMException('Controlled storage refusal','QuotaExceededError');values.set(key,value);},removeItem:key=>values.delete(key)};
globalThis.window={innerWidth:1440,addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},removeEventListener(type,fn){listeners.get(type)?.delete(fn);},scrollTo(){}};
globalThis.document={activeElement:null,getElementById(){return null;},querySelector(){return null;},addEventListener(){},removeEventListener(){},createElement(){return {click(){},remove(){},style:{}};},body:{appendChild(){},removeChild(){},style:{}}};
globalThis.location={hash:'#home'};
globalThis.requestAnimationFrame=fn=>setTimeout(fn,0);globalThis.cancelAnimationFrame=clearTimeout;
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{async writeText(text){copied=text;}}}});
URL.createObjectURL=blob=>{downloads.push(blob);return 'blob:conversation-test';};URL.revokeObjectURL=()=>{};
globalThis.fetch=async(url,options={})=>{
 const body=options.body?JSON.parse(options.body):undefined;calls.push({url,body,method:options.method||'GET'});
 if(url==='/api/service/status')return Response.json({configured:true,defaultMode:'ai'});
 if(String(url).startsWith('/api/tasks/')){
  const respond=()=>taskReply?Response.json(taskReply):Response.json({error:'任务不存在'},{status:404});
  // Deliberately allow a late response after abort to exercise the view/session guard as well as AbortController.
  if(holdTasks)return new Promise(resolve=>{taskHeld={signal:options.signal,resolve:()=>resolve(respond())};});
  return respond();
 }
 if(url!=='/api/generate')throw Error(`Unexpected controlled endpoint: ${url}`);
 generated.push(structuredClone(body));
 if(behavior==='network-error')throw Error('Controlled transport failure');
 if(behavior==='http-error')return Response.json({error:'受控生成失败'},{status:502});
 if(behavior==='held')return new Promise((resolve,reject)=>{
  held={resolve:()=>resolve(Response.json({text:reply,source:'ai',usage:{totalTokens:24},requestId:body.requestId})),reject};
  options.signal?.addEventListener('abort',()=>reject(new DOMException('Controlled cancel','AbortError')),{once:true});
 });
 return Response.json({text:reply,source:'ai',usage:{totalTokens:24},requestId:body.requestId});
};
const workA={id:'chat-work-a',title:'雾港来信',kind:'长篇小说',genre:'悬疑',outline:'A作品独有大纲：寻找灯塔里的照片。',characters:'林渡是不会游泳的修船师。',lastEditedChapterId:'a1',chapters:[{id:'a1',title:'雨夜来信',text:'A作品独有正文。林渡在书店收到了一封信。'}]};
const workB={id:'chat-work-b',title:'海边重逢',kind:'短篇故事',genre:'言情',outline:'B作品独有大纲：旧屋修复与重逢。',characters:'许知夏是一名插画师。',chapters:[{id:'b1',title:'春天的电话',text:'B作品独有正文。许知夏接到了十年前的电话。'}]};
const beforeWorks=JSON.stringify([workA,workB]);
const text=node=>typeof node==='string'?node:(node?.children||[]).map(text).join('');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const nodeMock=element=>({label:element.props['aria-label'],focus(){document.activeElement=this;},scrollIntoView(){},scrollTo(){},scrollHeight:100,scrollTop:0,querySelector(){return null;}});
const server=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});
let renderer,modal,billingOverride=null;
const notices=[];
try{
 const {HomeConversation}=await server.ssrLoadModule('/src/HomeConversation.jsx');
 const {GenerationProvider}=await server.ssrLoadModule('/src/Generation.jsx');
 const {BillingContext,TaskMeter}=await server.ssrLoadModule('/src/Billing.jsx');
 const {quoteTask,newBillingAccount,reserveTask,finishTask,balanceOf}=await server.ssrLoadModule('/src/billing.js');
 const model=await server.ssrLoadModule('/src/conversation.js');
 const byLabel=label=>renderer.root.findByProps({'aria-label':label});
 const button=(label)=>renderer.root.findAllByType('button').find(node=>text(node).trim()===label);
 const prefixButton=prefix=>renderer.root.findAllByType('button').find(node=>node.props['aria-label']?.startsWith(prefix));
 const input=()=>byLabel('创作对话输入');
 const change=async(node,value)=>act(async()=>node.props.onChange({target:{value,checked:value}}));
 const owningForm=node=>{if(node.props.form)return renderer.root.findByProps({id:node.props.form});let form=node.parent;while(form&&form.type!=='form')form=form.parent;return form;};
 const click=async node=>{assert.ok(node,'Expected a reachable conversation control');await act(async()=>{if(node.props.onClick)await node.props.onClick();else if(node.props.type==='submit'){const form=owningForm(node);assert.equal(form?.type,'form');await form.props.onSubmit({preventDefault(){}});}else throw Error('Control has no action');});};
 const key=async(key,extra={})=>{let prevented=false;await act(async()=>{await input().props.onKeyDown({key,shiftKey:false,isComposing:false,nativeEvent:{isComposing:false},preventDefault(){prevented=true;},...extra});});return prevented;};
 const recordList=()=>JSON.parse(values.get('mdd-conversations-v1')||'[]');
 const currentTurn=()=>recordList().find(record=>record.id===byLabel('对话记录').props.value)?.turns.at(-1);
 const tree=(props={})=>{
  const conversation=React.createElement(HomeConversation,{works:[workA,workB],work:workA,setModal:value=>modal=value,notify:value=>notices.push(value),...props});
  return React.createElement(GenerationProvider,null,billingOverride?React.createElement(BillingContext.Provider,{value:billingOverride},conversation):conversation);
 };
 const unmount=async()=>{if(renderer){await act(async()=>renderer.unmount());renderer=null;}};
 const mount=async({records=[],mode='ai',preserve=false,props={},billing=null}={})=>{
  await unmount();if(!preserve){values.clear();values.set('mdd-ai-mode',mode);values.set('mdd-conversations-v1',JSON.stringify(records));}
  billingOverride=billing;
  await act(async()=>{renderer=TestRenderer.create(tree(props),{createNodeMock:nodeMock});await sleep(0);});
 };
 const send=async value=>{await change(input(),value);await click(byLabel('发送创作消息'));};
 const waitFor=async predicate=>{for(let i=0;i<100;i++){if(predicate())return;await act(async()=>sleep(5));}assert.ok(predicate(),'Expected conversation state did not settle');};
 const launch=async value=>{await change(input(),value);await act(async()=>{const node=byLabel('发送创作消息');if(node.props.onClick)void node.props.onClick();else{const form=owningForm(node);assert.equal(form?.type,'form');void form.props.onSubmit({preventDefault(){}});}await sleep(0);});};
 const completed=()=>currentTurn()?.status==='completed';
 const makeRequest=(question,workId='',requestId=crypto.randomUUID())=>({task:'chat',requestId,prompt:question,context:{history:[],...(workId?{workId}:{})},mode:'standard',target:1000});
 const canonicalQuote=request=>quoteTask({taskId:'chat',model:request.mode,inputChars:JSON.stringify({prompt:request.prompt||'',context:request.context||{},previous:{}}).length,outputChars:Math.max(300,Math.min(4000,Number(request.target)||1000))});
 const fakeBilling=({delayReservation=false}={})=>{
  let account={...newBillingAccount(),enabled:true};
  const control={quotes:[],settlements:[],release:null};
  control.value={ready:true,server:false,get account(){return account;},get balance(){return balanceOf(account);},go(){},async runTask(quote,producer){
   control.quotes.push(structuredClone(quote));const reservation=reserveTask(account,quote);account=reservation.account;
   if(delayReservation)await new Promise(resolve=>{control.release=resolve;});
   try{await producer();account=finishTask(account,reservation.ticket,true);control.settlements.push(true);return {ok:true};}
   catch(error){account=finishTask(account,reservation.ticket,false);control.settlements.push(false);return {ok:false,message:error.message,code:'failed'};}
  }};
  return control;
 };

 await mount();
 assert.equal(generated.length,0,'Opening the homepage must not initiate generation');
 assert.equal(input().props.maxLength,4000);
 for(const label of ['填入构思示例','填入推进示例','填入人物示例']){
  await click(byLabel(label));assert.ok(input().props.value.trim());assert.equal(generated.length,0,'Example controls only fill the draft');
 }
 await change(input(),'先测试输入法');
 await key('Enter',{shiftKey:true});await key('Enter',{isComposing:true});await key('Enter',{nativeEvent:{isComposing:true}});
 assert.equal(generated.length,0,'Shift+Enter and IME composition must never send');
 await change(input(),'  请帮我构思灯塔悬疑故事  ');reply='第一轮受控回复：先明确主角寻找父亲的动机。';
 await key('Enter');await waitFor(completed);
 assert.equal(generated.length,1);assert.equal(generated[0].task,'chat');assert.equal(generated[0].prompt,'请帮我构思灯塔悬疑故事');
 assert.equal(generated[0].context.workId,workA.id);assert.deepEqual(generated[0].context.history,[]);
 assert.ok(JSON.stringify(generated[0].context).includes('A作品独有'));assert.ok(!JSON.stringify(generated[0].context).includes('B作品独有'));
 assert.equal(currentTurn().source,'ai');assert.equal(currentTurn().request,undefined,'Completed replies must not retain a duplicated frozen request');
 const firstQuestion=generated[0].prompt,firstReply=reply;
 reply='第二轮受控回复：把动机转化为一次有代价的选择。';await send('接着把这个动机变成具体行动');await waitFor(completed);
 assert.deepEqual(generated.at(-1).context.history,[{role:'user',content:firstQuestion},{role:'assistant',content:firstReply}]);
 assert.ok(text(renderer.root).includes(firstReply)&&text(renderer.root).includes(reply));
 const lastTurnId=currentTurn().id;
 await click(byLabel(`复制创作回复 ${lastTurnId}`));assert.equal(copied,reply);
 modal=undefined;await click(byLabel(`用于故事规划 ${lastTurnId}`));assert.equal(modal.type,'quick-start');assert.equal(modal.autoGenerate,false);assert.ok(modal.idea.includes(reply));
 await click(byLabel(`交给写作工具 ${lastTurnId}`));assert.equal(modal.type,'tool');assert.equal(modal.workId,workA.id);assert.ok(modal.prompt.includes(reply));
 assert.equal(JSON.stringify([workA,workB]),beforeWorks,'Conversation handoffs must not silently alter manuscripts');
 await click(byLabel('导出当前对话'));assert.ok(downloads.length);assert.ok((await downloads.at(-1).text()).includes(firstReply));
 const savedId=byLabel('对话记录').props.value;
 await change(input(),'尚未发送的第三轮草稿');
 await unmount();await mount({preserve:true});assert.equal(byLabel('对话记录').props.value,savedId);assert.ok(text(renderer.root).includes(firstReply));
 assert.equal(input().props.value,'尚未发送的第三轮草稿','Leaving the page flushes the unsent draft without generating it');
 assert.equal(generated.length,2,'Reopening saved conversations must not regenerate');
 console.log('PASS examples, input methods, multi-turn context, persistence, explicit planning/tool handoff and text export');

 // Removing every selected reference must remove the actual manuscript snippets sent to the service.
 const removals=()=>renderer.root.findAllByType('button').filter(node=>node.props['aria-label']?.startsWith('移除引用 '));
 while(removals().length)await click(removals()[0]);
 reply='没有引用正文时的受控讨论。';await send('只谈一般构思，不引用文稿');await waitFor(completed);
 assert.deepEqual(generated.at(-1).context.references,[]);
 await change(byLabel('对话关联作品'),workB.id);reply='只基于B作品的回复。';await send('讨论B作品的重逢');await waitFor(completed);
 const bPayload=generated.at(-1);assert.equal(bPayload.context.workId,workB.id);assert.deepEqual(bPayload.context.history,[]);
 assert.ok(!JSON.stringify(bPayload.context).includes(firstReply));assert.ok(!JSON.stringify(bPayload.context).includes('A作品独有'));
 await change(byLabel('对话关联作品'),'');reply='独立讨论回复。';await send('独立构思一座没有姓名的城市');await waitFor(completed);
 assert.ok(!generated.at(-1).context.workId);assert.deepEqual(generated.at(-1).context.history,[]);assert.ok(!JSON.stringify(generated.at(-1).context).includes('B作品独有'));
 console.log('PASS removable references, work-bound conversations and independent discussions cannot mix manuscripts or histories');

 behavior='held';await launch('等待时不要重复发送');await waitFor(()=>Boolean(held));
 const busyCount=generated.length,sendWhileBusy=renderer.root.findAllByProps({'aria-label':'发送创作消息'});
 assert.ok(sendWhileBusy.length===0||sendWhileBusy.every(node=>node.props.disabled),'Sending is unavailable during an active request');assert.equal(byLabel('对话关联作品').props.disabled,true);assert.equal(byLabel('对话记录').props.disabled,true);
 await key('Enter');assert.equal(generated.length,busyCount);
 await click(byLabel('取消本次对话'));await waitFor(()=>['cancelled','interrupted'].includes(currentTurn()?.status));
 assert.ok(!completed());behavior='success';held=null;
 console.log('PASS busy guards and explicit cancellation preserve the unfinished turn');

 await mount();behavior='held';await launch('A作品的处理中问题');await waitFor(()=>Boolean(held));
 const delayed=held;await act(async()=>{renderer.update(tree({work:workB}));await sleep(0);});
 await waitFor(()=>recordList().find(record=>record.workId===workA.id)?.turns.at(-1).status!=='sending');
 assert.equal(byLabel('对话关联作品').props.value,workB.id);
 delayed.resolve();await act(async()=>sleep(0));behavior='success';held=null;
 reply='切换作品后的B回复。';await send('只讨论切换后的作品');await waitFor(completed);
 assert.equal(generated.at(-1).context.workId,workB.id);assert.deepEqual(generated.at(-1).context.history,[]);
 assert.ok(!recordList().find(record=>record.workId===workA.id)?.turns.some(turn=>turn.assistantText===reply));
 console.log('PASS an external project switch cancels the previous request and never writes its result into another work');

 // A refresh preserves the original request identity and never automatically resends it.
 const recoveryQuestion='恢复已经提交的创作问题',recoveryRequest=makeRequest(recoveryQuestion,workA.id);
 let interrupted=model.createConversation({workId:workA.id});interrupted=model.beginConversationTurn(interrupted,{userText:recoveryQuestion,request:recoveryRequest});
 const recoveryId=interrupted.turns[0].id,beforeRecovery=generated.length;
 taskReply={id:recoveryRequest.requestId,status:'succeeded',task:'chat',request:recoveryRequest,result:{text:'服务端已完成的受控回复。',source:'ai',usage:{totalTokens:20}}};
 await mount({records:[interrupted]});await waitFor(()=>recordList()[0]?.turns[0].status==='interrupted');
 assert.equal(generated.length,beforeRecovery);
 await click(byLabel(`恢复创作回复 ${recoveryId}`));await waitFor(completed);
 assert.equal(generated.length,beforeRecovery,'Recovering an acknowledged result must not create a second generation');
 assert.equal(currentTurn().requestId,recoveryRequest.requestId);assert.equal(currentTurn().assistantText,'服务端已完成的受控回复。');
 console.log('PASS reload interrupts sending and completed-result recovery is idempotent');

 for(const foreignRequest of [undefined,{...recoveryRequest,prompt:'同ID的其他问题'},{...recoveryRequest,context:{history:[],workId:workB.id}}]){
  await mount({records:[interrupted]});const beforeRejectedResult=generated.length;
  taskReply={id:recoveryRequest.requestId,status:'succeeded',task:'chat',...(foreignRequest?{request:foreignRequest}:{}),result:{text:'不能采用的其他任务回复。',source:'ai'}};
  await click(byLabel(`恢复创作回复 ${recoveryId}`));
  assert.equal(generated.length,beforeRejectedResult);assert.equal(currentTurn().status,'interrupted');assert.equal(currentTurn().assistantText,'');
  assert.ok(!text(renderer.root).includes('不能采用的其他任务回复。'),'Recovered replies require the exact frozen request, even when a task ID is the same');
 }
 console.log('PASS missing or mismatched recovered request snapshots cannot adopt another question or work\'s result');

 const resumableQuestion='查不到旧任务时保留原问题和引用',resumableRequest=makeRequest(resumableQuestion,workA.id);
 resumableRequest.context.references=[{id:'work:outline',type:'outline',title:'提交时的大纲',content:'这份资料属于首次提交时的冻结快照。'}];
 let resumable=model.createConversation({workId:workA.id,referenceIds:['work:outline']});resumable=model.beginConversationTurn(resumable,{userText:resumableQuestion,request:resumableRequest});
 const resumableTurnId=resumable.turns[0].id,beforeResume=generated.length;taskReply=null;
 await mount({records:[resumable]});await click(byLabel(`恢复创作回复 ${resumableTurnId}`));
 assert.equal(generated.length,beforeResume,'Checking a missing task must not implicitly regenerate');
 assert.ok(byLabel(`继续本轮讨论 ${resumableTurnId}`));
 while(removals().length)await click(removals()[0]);
 if(prefixButton('恢复创作回复 '))await click(byLabel(`恢复创作回复 ${resumableTurnId}`));
 assert.equal(generated.length,beforeResume,'Changing references and rechecking still cannot implicitly regenerate');
 reply='主动继续原任务的受控回复。';await click(byLabel(`继续本轮讨论 ${resumableTurnId}`));await waitFor(completed);
 assert.equal(generated.length,beforeResume+1);assert.deepEqual(generated.at(-1),resumableRequest,'Explicit continuation reuses the original ID and frozen payload, regardless of current references');
 assert.equal(currentTurn().id,resumableTurnId);
 console.log('PASS unknown tasks are checked first and explicit continuation retains the original request ID and immutable input');

 await mount({records:[resumable]});taskReply=null;await click(byLabel(`恢复创作回复 ${resumableTurnId}`));
 const beforeStaleRecovery=generated.length;holdTasks=true;
 await act(async()=>{void byLabel(`继续本轮讨论 ${resumableTurnId}`).props.onClick();await sleep(0);});await waitFor(()=>Boolean(taskHeld));
 const lateTask=taskHeld;await act(async()=>{renderer.update(tree({work:workB}));await sleep(0);});
 assert.equal(lateTask.signal.aborted,true,'Switching project aborts the in-flight recovery query');
 holdTasks=false;lateTask.resolve();await act(async()=>sleep(0));taskHeld=null;
 assert.equal(generated.length,beforeStaleRecovery,'A late recovery query must not regenerate the previous work after a project switch');
 assert.equal(byLabel('对话关联作品').props.value,workB.id);assert.equal(byLabel('对话关联作品').props.disabled,false);
 assert.equal(recordList().find(record=>record.id===resumable.id).turns[0].status,'interrupted');
 console.log('PASS recovery-query cancellation and late-result guards prevent cross-work automatic continuation');

 // An uncertain transport error first queries the original task; only a confirmed failure allows a new request.
 behavior='network-error';await click(byLabel('新建对话'));await send('网络中断但服务结果未知');await waitFor(()=>Boolean(prefixButton('恢复创作回复 ')));
 const unknown=currentTurn(),unknownCount=generated.length;
 taskReply={id:unknown.requestId,status:'running',task:'chat',request:unknown.request,result:null};await click(byLabel(`恢复创作回复 ${unknown.id}`));
 assert.equal(generated.length,unknownCount,'A running original request must not be silently duplicated');
 taskReply={id:unknown.requestId,status:'failed',task:'chat',request:unknown.request,error:'受控上游已明确失败',result:null};await click(byLabel(`恢复创作回复 ${unknown.id}`));await waitFor(()=>Boolean(prefixButton('重试创作消息 ')));
 behavior='success';reply='明确失败后主动重试的回复。';await click(byLabel(`重试创作消息 ${unknown.id}`));await waitFor(completed);
 assert.equal(generated.length,unknownCount+1);assert.notEqual(generated.at(-1).requestId,unknown.requestId);assert.equal(currentTurn().id,unknown.id);
 console.log('PASS uncertain failure checks the old task, running results are not duplicated and confirmed failure retries with an explicit new request');

 const firstSessionId=byLabel('对话记录').props.value;
 await click(byLabel('删除当前对话'));assert.ok(recordList().some(record=>record.id===firstSessionId));
 await click(byLabel('取消删除'));assert.ok(recordList().some(record=>record.id===firstSessionId));
 await click(byLabel('删除当前对话'));await click(byLabel('确认删除对话'));assert.ok(!recordList().some(record=>record.id===firstSessionId));
 console.log('PASS deleting a saved conversation requires explicit confirmation');

 let longSession=model.createConversation({workId:workA.id});
 for(let i=0;i<10;i++){
  const question=`历史问题${i}：`+'问'.repeat(2500),request=makeRequest(question,workA.id);
  longSession=model.beginConversationTurn(longSession,{userText:question,request});
  longSession=model.completeConversationTurn(longSession,longSession.turns.at(-1).id,{text:`历史回复${i}：`+'答'.repeat(3500),source:'ai',usage:null});
 }
 await mount({records:[longSession]});reply='<script>仅作为回复文字显示</script>';await send('继续讨论最近一个问题');await waitFor(completed);
 const history=generated.at(-1).context.history;
 assert.ok(history.length<=16);assert.ok(history.reduce((sum,item)=>sum+item.content.length,0)<=16000);assert.ok(history.at(-1).content.startsWith('历史回复9：'));
 assert.ok(!history.some(item=>item.content.startsWith('历史问题0：')));assert.ok(text(renderer.root).includes('未发送'));
 assert.equal(renderer.root.findAllByType('script').length,0,'Assistant text must never execute as HTML');assert.ok(text(renderer.root).includes('<script>仅作为回复文字显示</script>'));
 console.log('PASS bounded recent history, visible omission notice and safe text-only rendering');

 await mount();const beforeBlocked=generated.length;blockedSave=true;await send('缓存拒写时不能开始模型任务');
 assert.equal(generated.length,beforeBlocked,'A conversation that cannot save its recoverable request must not initiate generation');
 assert.equal(recordList().flatMap(record=>record.turns).length,0);assert.match(text(renderer.root),/尚未缓存|暂未完整缓存|未能缓存/);
 await click(byLabel('新建对话'));await change(byLabel('对话关联作品'),workB.id);
 assert.equal(input().props.value,'缓存拒写时不能开始模型任务');assert.equal(byLabel('对话关联作品').props.value,workA.id,'An unsaved draft cannot be silently discarded by a conversation/work change');
 const beforeEmergencyExport=downloads.length;await click(byLabel('导出当前对话'));
 assert.equal(downloads.length,beforeEmergencyExport+1);assert.ok((await downloads.at(-1).text()).includes('缓存拒写时不能开始模型任务'),'Emergency export must use the retained in-memory draft even while storage refuses writes');blockedSave=false;
 console.log('PASS a failed local save blocks generation and displays a recovery message');

 let existing=model.createConversation({workId:workA.id}),existingRequest=makeRequest('已有会话中的旧问题',workA.id);
 existing=model.beginConversationTurn(existing,{userText:existingRequest.prompt,request:existingRequest});existing=model.completeConversationTurn(existing,existing.turns[0].id,{text:'已保存的原回复。',source:'ai'});
 await mount({records:[existing]});const beforePendingSave=generated.length;saveAttempts=0;failSaveAt=2;
 await send('只在写入本轮请求时拒写的待发送问题');failSaveAt=Infinity;
 assert.equal(generated.length,beforePendingSave,'Refusing the pending request snapshot must not call generation');
 assert.ok(!text(renderer.root).includes('正在整理回复'),'A rejected pending-request save cannot leave an unsent turn stuck as sending');
 assert.equal(input().props.value,'只在写入本轮请求时拒写的待发送问题');
 assert.ok(prefixButton('恢复创作回复 '),'The unfinished, unsent turn must remain recoverable');
 console.log('PASS a rejected pending-request save preserves the existing conversation and draft without a permanent sending state');

 for(const status of ['cancelled','failed']){
  const recoveryDraft='恢复失败时仍保留的后续草稿';await mount({records:[{...resumable,draft:recoveryDraft}]});
  taskReply={id:resumableRequest.requestId,status,task:'chat',request:resumableRequest,error:status==='failed'?'受控明确失败':'受控已取消',result:null};
  await click(byLabel(`恢复创作回复 ${resumableTurnId}`));
  const actionLabel=`${status==='failed'?'重试创作消息':'继续本轮讨论'} ${resumableTurnId}`,beforeRejectedRetry=generated.length;
  blockedSave=true;await click(byLabel(actionLabel));blockedSave=false;
  assert.equal(generated.length,beforeRejectedRetry,'Rejected recovery snapshots must not call generation');
  assert.ok(!text(renderer.root).includes('正在整理回复'),'Rejected recovery snapshots cannot leave an unsent turn stuck as sending');
  assert.equal(input().props.value,recoveryDraft);assert.equal(byLabel('对话关联作品').props.disabled,false);
  assert.ok(renderer.root.findAllByType('button').some(node=>/^(恢复创作回复|重试创作消息|继续本轮讨论) /.test(node.props['aria-label']||'')),'An author must still have a recovery action after saving is restored');
 }
 console.log('PASS rejected continuation/retry snapshots retain the draft and a recoverable turn without calling generation');

 for(const status of ['cancelled','failed']){
  const frozen=makeRequest(`按冻结报价${status==='failed'?'重试':'继续'}讨论`,workA.id);frozen.mode=status==='failed'?'standard':'refine';frozen.target=status==='failed'?200:2000;
  frozen.context.references=[{id:'work:outline',type:'outline',title:'原始资料',content:'报价和任务必须使用这份冻结资料。'.repeat(80)}];
  let priced=model.createConversation({workId:workA.id,referenceIds:['work:outline']});priced=model.beginConversationTurn(priced,{userText:frozen.prompt,request:frozen});priced=model.failConversationTurn(priced,priced.turns[0].id,{status:'interrupted',error:'受控中断'});
  const pricedTurnId=priced.turns[0].id,bill=fakeBilling();await mount({records:[priced],billing:bill.value});
  await change(byLabel('创作计费模式'),frozen.mode==='standard'?'refine':'standard');await change(byLabel('计费目标篇幅'),'500');
  while(removals().length)await click(removals()[0]);await change(input(),'当前新问题和新输入规模不得影响恢复报价。'.repeat(40));
  taskReply={id:frozen.requestId,status,task:'chat',request:frozen,error:status==='failed'?'受控明确失败':'受控已取消',result:null};
  await click(byLabel(`恢复创作回复 ${pricedTurnId}`));assert.equal(bill.quotes.length,0,'Checking a recovery task cannot reserve credits');
  const displayed=renderer.root.findByType(TaskMeter).props.meter;assert.deepEqual(displayed.quote,canonicalQuote(frozen));assert.equal(displayed.model,frozen.mode);assert.equal(displayed.outputChars,frozen.target);
  const beforePricedGeneration=generated.length;reply='按原始需求完成的受控回复。';await click(byLabel(`${status==='failed'?'重试创作消息':'继续本轮讨论'} ${pricedTurnId}`));await waitFor(completed);
  assert.equal(generated.length,beforePricedGeneration+1);assert.equal(bill.quotes.length,1);assert.deepEqual(bill.quotes[0],canonicalQuote(frozen),'Billing must use the server-equivalent quote of the frozen request');
  if(status==='failed'){assert.notEqual(generated.at(-1).requestId,frozen.requestId);assert.deepEqual({...generated.at(-1),requestId:frozen.requestId},frozen);}
  else assert.deepEqual(generated.at(-1),frozen);
  assert.deepEqual(bill.settlements,[true]);
 }
 console.log('PASS continuation and confirmed-failure retry retain canonical frozen-request pricing despite changed mode, size, references and unsent input');

 const delayedBilling=fakeBilling({delayReservation:true});await mount({mode:'demo',billing:delayedBilling.value,props:{work:null,works:[]}});
 const balanceBeforeReservation=delayedBilling.value.balance,beforeCancelledDemo=generated.length;let demoGenerationTimers=0;
 globalThis.setTimeout=(fn,ms,...args)=>{if(ms===100)demoGenerationTimers++;return originalSetTimeout(fn,ms,...args);};
 await launch('演示账本正在预留时停止生成');await waitFor(()=>Boolean(delayedBilling.release));
 assert.ok(delayedBilling.value.balance<balanceBeforeReservation,'The controlled ledger actually reserved credits before cancellation');
 await click(byLabel('取消本次对话'));delayedBilling.release();await waitFor(()=>delayedBilling.settlements.length===1);
 globalThis.setTimeout=originalSetTimeout;
 assert.equal(demoGenerationTimers,0,'Cancelling before reservation finishes cannot start the demo generator');assert.equal(generated.length,beforeCancelledDemo);
 assert.deepEqual(delayedBilling.settlements,[false]);assert.equal(delayedBilling.value.balance,balanceBeforeReservation);assert.equal(delayedBilling.value.account.ledger.find(row=>row.kind==='task').status,'refunded');
 assert.ok(['cancelled','interrupted'].includes(currentTurn().status));assert.equal(currentTurn().assistantText,'');
 console.log('PASS cancellation during delayed demo reservation never starts generation and refunds the reserved ledger amount');

 const aiCount=generated.length;await mount({mode:'demo',props:{work:null,works:[]}});await send('这个问题没有调用真实模型');await waitFor(completed);
 assert.equal(generated.length,aiCount);assert.equal(currentTurn().source,'demo');assert.match(text(renderer.root),/预写|预置|预先编写/);
 console.log('PASS demo replies are clearly authored samples and never make a paid generation request');

 const beforeHero=generated.length;await mount({props:{appearance:'hero'}});modal=undefined;
 const hero=byLabel('创作对话'),historySummary=byLabel('对话记录与关联作品');
 assert.ok(hero.props.className.split(' ').includes('home-chat-hero'));
 assert.equal(historySummary.type,'summary');assert.notEqual(historySummary.parent.props.open,true,'History and work management stay folded until requested');
 assert.equal(input().props.maxLength,4000);assert.equal(byLabel('对话关联作品').props.value,workA.id);assert.equal(text(byLabel('发送创作消息')),'开始创作');
 assert.equal(owningForm(byLabel('发送创作消息')),owningForm(input()),'The visible Hero action submits the actual chat input form');
 assert.equal(owningForm(renderer.root.findByType(TaskMeter)),null);assert.equal(owningForm(byLabel('生成引用资料')),null,'Reference/settings controls must not accidentally submit the story');
 for(const label of ['填入构思示例','填入推进示例','填入人物示例']){await click(byLabel(label));assert.ok(input().props.value.trim());assert.equal(generated.length,beforeHero);}
 await key('Enter',{shiftKey:true});await key('Enter',{nativeEvent:{isComposing:true}});assert.equal(generated.length,beforeHero);
 reply='Hero第一轮回复，先明确灯塔的秘密。';await send('在首页输入卡里讨论灯塔的秘密');await waitFor(completed);
 assert.equal(generated.length,beforeHero+1);assert.equal(generated.at(-1).task,'chat');assert.equal(generated.at(-1).context.workId,workA.id);assert.equal(modal,undefined,'The Hero submit starts a discussion and never silently creates a manuscript');
 assert.equal(text(byLabel('发送创作消息')),'继续讨论');
 const heroFirstReply=reply;reply='Hero第二轮回复，延续已完成的讨论。';await send('继续这个故事');await waitFor(completed);
 assert.deepEqual(generated.at(-1).context.history,[{role:'user',content:'在首页输入卡里讨论灯塔的秘密'},{role:'assistant',content:heroFirstReply}]);
 await click(byLabel(`用于故事规划 ${currentTurn().id}`));assert.equal(modal.type,'quick-start');assert.equal(modal.autoGenerate,false);
 assert.equal(JSON.stringify([workA,workB]),beforeWorks);
 console.log('PASS Hero input card, folded session manager, safe detached controls, fill-only inspiration chips and explicit multi-turn creation handoff');

 assert.equal(JSON.stringify([workA,workB]),beforeWorks);
 console.log('PASS conversation mount has no automatic generation and preserves source works');
}finally{
 blockedSave=false;holdTasks=false;failSaveAt=Infinity;
 globalThis.setTimeout=originalSetTimeout;
 if(renderer)await act(async()=>renderer.unmount());await server.close();
 for(const [key,value]of Object.entries(original)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
 if(originalNavigator)Object.defineProperty(globalThis,'navigator',originalNavigator);else delete globalThis.navigator;
 URL.createObjectURL=originalCreateObjectURL;URL.revokeObjectURL=originalRevokeObjectURL;
}
