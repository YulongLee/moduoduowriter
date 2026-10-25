import assert from 'node:assert/strict';
import React,{useEffect,useState} from 'react';
import TestRenderer,{act} from 'react-test-renderer';
import {createServer} from 'vite';
import {applyDemoPurchase,balanceOf,finishTask,newBillingAccount,quoteTask,reserveTask} from '../src/billing.js';

globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.location={hash:'#home'};
const storage=new Map();let localWrites=0;
globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem(key,value){localWrites++;storage.set(key,value);}};
const originalFetch=globalThis.fetch,originalNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
let copied='';Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{async writeText(value){copied=value;}}}});
let auth={configured:false,user:null,spaceId:'local',canRegister:true},codeNumber=0,statusCalls=0;
let ledger=newBillingAccount(),billingFailure=false,settleFailure=false,purchaseFailure=false;
const calls=[];
const respond=(data,status=200)=>({ok:status<400,status,async json(){return structuredClone(data);}});
const snapshot=()=>({account:ledger,mode:'server-demo',paymentConfigured:false});
globalThis.fetch=async(url,options={})=>{
 const body=options.body?JSON.parse(options.body):undefined;calls.push({url,body,method:options.method,headers:options.headers});
 if(url==='/api/auth/status'){statusCalls++;return respond(auth);}
 if(url==='/api/auth/register'){const role=auth.configured?'author':'admin';auth={configured:true,user:{id:`user-${body.username}`,username:body.username,role,createdAt:1},spaceId:`user-${body.username}`,canRegister:true};return respond({user:auth.user,recoveryCode:`recovery-${++codeNumber}`});}
 if(url==='/api/auth/login'){auth={...auth,user:{id:'user-writer',username:body.username,role:'author',createdAt:1},spaceId:'user-writer'};return respond({user:auth.user});}
 if(url==='/api/auth/logout'){auth={...auth,user:null,spaceId:'local'};return respond({ok:true});}
 if(url==='/api/auth/recover'){auth={...auth,user:{id:'user-writer',username:body.username,role:'author',createdAt:1},spaceId:'user-writer'};return respond({user:auth.user,recoveryCode:`recovery-${++codeNumber}`});}
 if(url==='/api/auth/recovery')return respond({recoveryCode:`recovery-${++codeNumber}`});
 if(url.startsWith('/api/billing')){
  if(billingFailure)return respond({error:'账本服务暂不可用'},503);
  if(url==='/api/billing')return respond(snapshot());
  if(url==='/api/billing/purchase'){if(purchaseFailure)return respond({error:'订单尚未确认'},503);ledger=applyDemoPurchase(ledger,body.offer,body.requestId);return respond(snapshot());}
  if(url==='/api/billing/settings'){ledger={...ledger,enabled:body.enabled};return respond(snapshot());}
  if(url==='/api/billing/reset'){if(ledger.ledger.some(row=>row.status==='pending'))return respond({error:'任务处理中'},409);ledger=newBillingAccount();return respond(snapshot());}
  if(url==='/api/billing/reservations'){try{const quote=quoteTask(body.request),reservation=reserveTask(ledger,quote);ledger=reservation.account;return respond({...snapshot(),ticket:reservation.ticket,quote});}catch(error){return respond({error:error.message},402);}}
  if(url.startsWith('/api/billing/reservations/')){if(settleFailure)return respond({error:'结算暂不可用'},503);ledger=finishTask(ledger,decodeURIComponent(url.split('/').at(-1)),body.success);return respond(snapshot());}
 }
 if(url==='/api/service/status')return respond({configured:true,defaultMode:'ai'});
 throw new Error(`Unexpected mock URL: ${url}`);
};
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
const text=node=>typeof node==='string'?node:(node?.children||[]).map(text).join('');
const button=(root,label)=>root.findAllByType('button').find(node=>text(node).trim()===label);
const click=async node=>{assert.ok(node,'Expected reachable button');await act(async()=>node.props.onClick());};
const change=async(node,value)=>act(async()=>node.props.onChange({target:{value,checked:value}}));
const submit=async root=>act(async()=>root.findByType('form').props.onSubmit({preventDefault(){}}));
let renderer;
try{
 const {AccountProvider,AccountAccess,AccountContext,useAccount}=await server.ssrLoadModule('/src/Account.jsx');
 const {BillingProvider,MembershipPage,useBilling}=await server.ssrLoadModule('/src/Billing.jsx');
 const {GenerationProvider}=await server.ssrLoadModule('/src/Generation.jsx');
 const {getRequestSpace}=await server.ssrLoadModule('/src/sessionScope.js');
 let session,mounts=0;
 function Space(){session=useAccount();useEffect(()=>{mounts++;},[]);const [marker,setMarker]=useState('private draft');return React.createElement('div',null,React.createElement('input',{'aria-label':'space marker',value:marker,onChange:e=>setMarker(e.target.value)}),React.createElement(AccountAccess));}
 await act(async()=>{renderer=TestRenderer.create(React.createElement(AccountProvider,null,React.createElement(Space)));});
 assert.equal(mounts,1);assert.equal(session.spaceId,'local');assert.equal(getRequestSpace(),'local');
 await change(renderer.root.findByProps({'aria-label':'space marker'}),'local unsaved marker');
 await click(button(renderer.root,'设置账号'));
 await change(renderer.root.findByProps({'aria-label':'创作账号'}),'admin');await change(renderer.root.findByProps({'aria-label':'创作密码'}),'test-password-123');
 const beforeRegister=statusCalls;
 await submit(renderer.root);
 assert.equal(statusCalls,beforeRegister,'Registration must keep the one-time recovery code visible before refreshing the gate');
 assert.equal(text(renderer.root.findByProps({'aria-label':'账号恢复码'})),'recovery-1');
 const continueButton=()=>button(renderer.root,'已保存，继续');assert.equal(continueButton().props.disabled,true);
 await click(continueButton());assert.equal(statusCalls,beforeRegister,'Calling a disabled action cannot dismiss an unsaved recovery code');
 await click(button(renderer.root,'复制恢复码'));assert.equal(copied,'recovery-1');
 await change(renderer.root.findByProps({'aria-label':'已安全保存恢复码'}),true);await click(continueButton());
 assert.equal(mounts,2);assert.equal(session.user.role,'admin');assert.equal(session.spaceId,'user-admin');
 assert.equal(renderer.root.findByProps({'aria-label':'space marker'}).props.value,'private draft','Changing from local to a user space must remount child state');
 await click(button(renderer.root,'退出登录'));assert.equal(getRequestSpace(),null);
 await click(button(renderer.root,'注册新账号'));
 await change(renderer.root.findByProps({'aria-label':'创作账号'}),'writer');await change(renderer.root.findByProps({'aria-label':'创作密码'}),'another-password');
 await submit(renderer.root);assert.ok(text(renderer.root).includes('保存你的账号恢复码'));
 await change(renderer.root.findByProps({'aria-label':'已安全保存恢复码'}),true);await click(continueButton());
 assert.equal(session.user.role,'author');assert.equal(mounts,3);assert.ok(text(renderer.root).includes('作者 · 独立创作空间'));
 await click(button(renderer.root,'管理恢复码'));await change(renderer.root.findByProps({'aria-label':'管理恢复码当前密码'}),'another-password');
 const beforeRotate=statusCalls;await submit(renderer.root);assert.equal(statusCalls,beforeRotate);assert.equal(text(renderer.root.findByProps({'aria-label':'账号恢复码'})),'recovery-3');
 assert.deepEqual(calls.findLast(call=>call.url==='/api/auth/recovery').body,{password:'another-password'});
 await change(renderer.root.findByProps({'aria-label':'已安全保存恢复码'}),true);await click(continueButton());
 await click(button(renderer.root,'退出登录'));await click(button(renderer.root,'忘记密码？使用恢复码'));
 await change(renderer.root.findByProps({'aria-label':'创作账号'}),'writer');await change(renderer.root.findByProps({'aria-label':'创作密码'}),'replacement-password');await change(renderer.root.findByProps({'aria-label':'账号恢复码输入'}),' recovery-3 ');
 const beforeRecover=statusCalls;await submit(renderer.root);assert.equal(statusCalls,beforeRecover);
 assert.deepEqual(calls.findLast(call=>call.url==='/api/auth/recover').body,{username:'writer',password:'replacement-password',recoveryCode:'recovery-3'});
 assert.ok(text(renderer.root).includes('recovery-4'));await change(renderer.root.findByProps({'aria-label':'已安全保存恢复码'}),true);await click(continueButton());
 assert.equal(session.user.username,'writer');assert.ok(![...storage.values()].some(value=>/password|recovery-/.test(value)));
 await act(async()=>renderer.unmount());renderer=null;
 console.log('PASS first-admin registration, later-author registration, isolated remounts, recovery-code acknowledgement, copy, rotation and password reset');

 let api;
 function Observer(){api=useBilling();return null;}
 const accountValue={configured:true,ready:true,user:{id:'writer',username:'writer',role:'author'},spaceId:'writer',canRegister:true};
 const mountBilling=({ai=false,page=false}={})=>{
   const content=React.createElement(BillingProvider,null,React.createElement(Observer),page?React.createElement(MembershipPage,{navigate(){}}):null);
   return React.createElement(AccountContext.Provider,{value:accountValue},ai?React.createElement(GenerationProvider,null,content):content);
 };
 storage.set('mdd-billing-demo-v1',JSON.stringify({...newBillingAccount(),buckets:[{id:'tampered',kind:'gift',remaining:90000000,expiresAt:null}]}));
 const writesBefore=localWrites;
 await act(async()=>{renderer=TestRenderer.create(mountBilling({page:true}));});
 assert.equal(api.server,true);assert.equal(api.balance,300);assert.equal(localWrites,writesBefore,'The server account must never import or overwrite browser credit values');
 let result,runs=0;
 await act(async()=>{result=await api.runTask(quoteTask({}),async()=>{runs++;});});assert.equal(result.ok,true);assert.equal(api.balance,300);
 await act(async()=>{await api.setEnabled(true);});
 const quote=quoteTask({inputChars:1000});
 await act(async()=>{result=await api.runTask(quote,async()=>{runs++;});});assert.equal(result.ok,true);assert.equal(api.balance,288);assert.equal(ledger.ledger[0].status,'completed');
 await act(async()=>{result=await api.runTask(quote,async()=>{throw new Error('Controlled failure');});});assert.equal(result.ok,false);assert.equal(api.balance,288);assert.equal(ledger.ledger[0].status,'refunded');
 await act(async()=>{result=await api.runTask(quoteTask({inputChars:1500000}),async()=>{runs++;});});assert.equal(result.code,'insufficient');assert.equal(api.ready,true,'Insufficient credit must leave the purchase route usable');assert.equal(runs,2);
 const beforeOrder=api.balance;
 await click(button(renderer.root,'模拟开通创作版'));await change(renderer.root.findByProps({className:'billing-consent'}).findByType('input'),true);
 purchaseFailure=true;await click(button(renderer.root,'确认模拟开通'));
 assert.equal(api.balance,beforeOrder);assert.equal(api.account.orders.length,0);assert.ok(text(renderer.root).includes('服务端未确认开通'));
 purchaseFailure=false;await act(async()=>api.refresh());await click(button(renderer.root,'确认模拟开通'));
 assert.equal(api.balance,5288);assert.equal(api.account.orders.length,1);assert.ok(text(renderer.root).includes('已模拟到账，未发生真实付款'));
 billingFailure=true;await act(async()=>api.refresh());const runsBefore=runs;
 await act(async()=>{result=await api.runTask(quote,async()=>{runs++;});});assert.equal(result.ok,false);assert.equal(runs,runsBefore);assert.equal(api.ready,false);
 assert.equal(await api.purchase({kind:'pack',id:'small'},'offline-order'),false);
 billingFailure=false;await act(async()=>api.refresh());assert.equal(api.ready,true);
 settleFailure=true;await act(async()=>{result=await api.runTask(quote,async()=>{runs++;},{force:true});});assert.equal(result.ok,true);assert.ok(result.message.includes('结算状态尚未确认'));assert.equal(api.ready,false);
 settleFailure=false;
 for(const row of ledger.ledger.filter(row=>row.status==='pending'))ledger=finishTask(ledger,row.id,false);
 await act(async()=>api.refresh());await act(async()=>renderer.unmount());renderer=null;
 console.log('PASS server-only balances, free samples, authoritative reservation/settlement, failure refund, insufficient-credit conversion, awaited checkout and service outage blocking');

 const reserveCalls=()=>calls.filter(call=>call.url==='/api/billing/reservations').length;
 await act(async()=>{renderer=TestRenderer.create(mountBilling({ai:true}));});
 const aiBefore=reserveCalls(),balanceBefore=api.balance;
 await act(async()=>{result=await api.runTask(quote,async()=>{runs++;});});
 assert.equal(result.ok,true);assert.equal(reserveCalls(),aiBefore,'Real AI must not create a second client reservation');assert.equal(api.balance,balanceBefore);
 await act(async()=>{result=await api.runTask(quote,async()=>{}, {force:true});});assert.equal(reserveCalls(),aiBefore+1,'An explicit billing trial still reserves even when AI mode is active');
 assert.equal(localWrites,writesBefore,'No server balance or account credential is persisted to browser storage');
 assert.ok(calls.filter(call=>call.url.startsWith('/api/billing')).every(call=>call.headers['X-Mdd-Space']==='writer'),'Every server ledger request must carry its owning account space');
 await act(async()=>renderer.unmount());renderer=null;
 console.log('PASS real-AI producer plus ledger refresh without duplicate reservation, explicit trial reservation and no browser-balance persistence');
}finally{
 if(renderer)await act(async()=>renderer.unmount());await server.close();globalThis.fetch=originalFetch;
 if(originalNavigator)Object.defineProperty(globalThis,'navigator',originalNavigator);else delete globalThis.navigator;
}

// Contract integration against a disposable API/database, never the user's service or files.
{
 const {mkdtemp,rm}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');
 const {join}=await import('node:path');
 const {createServer:makeHttpServer}=await import('node:http');
 const {createApi}=await import('../server/api.mjs');
 const directory=await mkdtemp(join(tmpdir(),'mdd-account-ui-'));
 const handler=createApi({directory}),http=makeHttpServer(handler);
 await new Promise(resolve=>http.listen(0,'127.0.0.1',resolve));
 const address=`http://127.0.0.1:${http.address().port}`;
 let cookie='';const nativeFetch=globalThis.fetch;
 const apiFetch=async(url,options={})=>{const response=await nativeFetch(address+url,{...options,headers:{...options.headers,...(cookie?{Cookie:cookie}:{})}});if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];return response;};
 globalThis.fetch=apiFetch;
 const map=new Map([['mdd-works-v1',JSON.stringify([{id:'private-owner',title:'Owner private draft',kind:'长篇小说',genre:'悬疑',outline:'',characters:'',chapters:[{id:'private-chapter',title:'私有章节',text:'只有管理员应看到的正文。'}]}])]]);
 globalThis.localStorage={getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)};
 globalThis.window={innerWidth:1280,addEventListener(){},removeEventListener(){}};
 const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
 let view,session,workspace,billing;
 const tick=async predicate=>{for(let attempt=0;attempt<100;attempt++){await act(async()=>new Promise(resolve=>setTimeout(resolve,10)));if(predicate())return;}throw new Error('Timed out waiting for disposable API state');};
 try{
  const {AccountProvider,AccountAccess,useAccount}=await vite.ssrLoadModule('/src/Account.jsx');
  const {WorkspaceProvider,useWorkspace}=await vite.ssrLoadModule('/src/Workspace.jsx');
  const {BillingProvider,useBilling}=await vite.ssrLoadModule('/src/Billing.jsx');
  const {requestApi}=await vite.ssrLoadModule('/src/Generation.jsx');
  function Observe(){session=useAccount();workspace=useWorkspace();billing=useBilling();return React.createElement(AccountAccess);}
  await act(async()=>{view=TestRenderer.create(React.createElement(AccountProvider,null,React.createElement(WorkspaceProvider,null,React.createElement(BillingProvider,null,React.createElement(Observe)))));});
  await tick(()=>workspace?.status==='saved'&&billing?.ready);
  assert.equal(workspace.client.entries.works.data[0].title,'Owner private draft');
  await click(button(view.root,'设置账号'));await change(view.root.findByProps({'aria-label':'创作账号'}),'owner_test');await change(view.root.findByProps({'aria-label':'创作密码'}),'safe-owner-password');await submit(view.root);
  const ownerRecovery=text(view.root.findByProps({'aria-label':'账号恢复码'}));assert.ok(ownerRecovery.length>20);assert.equal(session.user,null);
  await change(view.root.findByProps({'aria-label':'已安全保存恢复码'}),true);await click(button(view.root,'已保存，继续'));
  await tick(()=>session?.user?.role==='admin');assert.equal(session.spaceId,'local');assert.equal(workspace.client.entries.works.data[0].title,'Owner private draft');
  await click(button(view.root,'退出登录'));await click(button(view.root,'注册新账号'));
  await change(view.root.findByProps({'aria-label':'创作账号'}),'author_test');await change(view.root.findByProps({'aria-label':'创作密码'}),'safe-author-password');await submit(view.root);
  await change(view.root.findByProps({'aria-label':'已安全保存恢复码'}),true);await click(button(view.root,'已保存，继续'));
  await tick(()=>session?.user?.role==='author'&&workspace?.status==='saved'&&billing?.ready);
  const authorSpace=session.spaceId;assert.notEqual(authorSpace,'local');assert.ok(!JSON.stringify(workspace.client.entries).includes('Owner private draft'));
  await act(async()=>{assert.equal(await billing.purchase({kind:'pack',id:'small'},'integration-pack'),true);assert.equal(await billing.setEnabled(true),true);});
  assert.equal(billing.balance,1300);
  await act(async()=>{assert.equal((await billing.runTask(quoteTask({inputChars:1000}),async()=>{})).ok,true);});assert.equal(billing.balance,1288);
  await act(async()=>{assert.equal((await billing.runTask(quoteTask({inputChars:1000}),async()=>{throw new Error('test failure');})).ok,false);});assert.equal(billing.balance,1288);assert.equal(billing.account.ledger[0].status,'refunded');
  assert.ok(map.has(`mdd-space:${authorSpace}:mdd-works-v1`));assert.ok(map.get('mdd-works-v1').includes('Owner private draft'));
  // Another tab logs into the owner; this tab still owns the author's explicit header.
  const login=await apiFetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json','X-Mdd-Client':'workspace-v1'},body:JSON.stringify({username:'owner_test',password:'safe-owner-password'})});assert.equal(login.ok,true);
  await act(async()=>{workspace.client.set('works',[{id:'author-local',title:'Author pending edit',chapters:[{id:'author-c',title:'章',text:'不能写入管理员空间。'}]}]);await workspace.client.flush();});assert.equal(workspace.client.state.status,'space-mismatch');
  await act(async()=>billing.refresh());assert.equal(billing.ready,false);
  const ownerDataResponse=await apiFetch('/api/data',{headers:{'X-Mdd-Space':'local'}}),ownerData=await ownerDataResponse.json();assert.equal(ownerData.collections.works.data[0].title,'Owner private draft');
  assert.ok(!JSON.stringify(ownerData).includes('Author pending edit'));
  assert.ok(map.get(`mdd-space:${authorSpace}:mdd-works-v1`).includes('Author pending edit'));
  await assert.rejects(requestApi('/api/billing/purchase',{offer:{kind:'pack',id:'small'},requestId:'wrong-space'},{spaceId:authorSpace}),error=>error.status===412);
  console.log('PASS disposable API plus React providers: owner migration, author isolation, authoritative orders and refunds, and switched-cookie workspace/billing write protection');
 }finally{
  if(view)await act(async()=>view.unmount());await vite.close();globalThis.fetch=nativeFetch;http.closeAllConnections();await new Promise(resolve=>http.close(resolve));handler.close();await rm(directory,{recursive:true,force:true});
 }
}
