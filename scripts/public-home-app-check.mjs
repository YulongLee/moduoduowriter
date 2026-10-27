import assert from 'node:assert/strict';
import React from 'react';
import TestRenderer,{act} from 'react-test-renderer';
import {createServer} from 'vite';
import {newBillingAccount} from '../src/billing.js';
import {collectionKeys} from '../src/workspace.js';

// The complete App is rendered with controlled status/data responses and memory-only storage.
// No browser, private files, real account, external provider or real ledger is used.
const globals=['fetch','window','document','location','localStorage','requestAnimationFrame','cancelAnimationFrame','IS_REACT_ACT_ENVIRONMENT'];
const originals=Object.fromEntries(globals.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const listeners=new Map(),cache=new Map(),reads=[],writes=[],calls=[];
let renderer,statusBehavior='ready',statusPending=null;
let auth={configured:true,user:null,spaceId:null,canRegister:true};
const guest=()=>({configured:true,user:null,spaceId:null,canRegister:true});
const member=id=>({configured:true,user:{id,username:`fixture-${id}`,role:'author',createdAt:'2026-10-28T00:00:00.000Z'},spaceId:id,canRegister:true});
const legacy=()=>({configured:false,user:null,spaceId:'local',canRegister:true});
const mixedLegacy=()=>({...legacy(),user:{id:'local',username:'fixture-mixed-local',role:'admin'}});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const text=node=>typeof node==='string'?node:(node?.children||[]).map(text).join('');
const workFor=id=>({id:`private-${id}`,title:`PRIVATE MANUSCRIPT ${id}`,kind:'长篇小说',genre:'悬疑',outline:'private outline',characters:'private characters',chapters:[{id:`c-${id}`,title:'first',text:`PRIVATE TEXT ${id}`} ]});
globalThis.localStorage={getItem(key){reads.push(key);return cache.get(key)??null;},setItem(key,value){writes.push(key);cache.set(key,value);},removeItem:key=>cache.delete(key)};
let routeHash='#home';
globalThis.location={get hash(){return routeHash;},set hash(value){const next=String(value).startsWith('#')?String(value):`#${value}`;if(next===routeHash)return;routeHash=next;queueMicrotask(()=>{for(const handler of listeners.get('hashchange')||[])handler();});}};
globalThis.window={innerWidth:1440,addEventListener(type,handler){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(handler);},removeEventListener(type,handler){listeners.get(type)?.delete(handler);},scrollTo(){}};
globalThis.document={activeElement:null,body:{style:{}},querySelector(){return null;},querySelectorAll(){return [];},getElementById(){return null;},addEventListener(){},removeEventListener(){},createElement(){return {style:{},click(){},remove(){}};}};
globalThis.requestAnimationFrame=handler=>setTimeout(handler,0);globalThis.cancelAnimationFrame=clearTimeout;
globalThis.fetch=async(url,options={})=>{
 calls.push({url,method:options.method||'GET',headers:options.headers,body:options.body?JSON.parse(options.body):undefined});
 if(url==='/api/auth/status'){
  if(statusBehavior==='pending')return new Promise(resolve=>{statusPending=()=>resolve(Response.json(auth));});
  if(statusBehavior==='failure')return Response.json({error:'Controlled status unavailable'},{status:503});
  if(statusBehavior==='malformed')return Response.json({});
  if(statusBehavior==='mixed-local')return Response.json(mixedLegacy());
  return Response.json(auth);
 }
 if(url==='/api/auth/methods')return Response.json({ownerConfigured:true,...Object.fromEntries(['phone','email','wechat'].map(name=>[name,{enabled:false,configured:false,available:false,reason:'暂未开通'}]))});
 if(url==='/api/auth/login'){auth=member('alice');return Response.json({user:auth.user});}
 if(url==='/api/auth/register'){auth=member(auth.configured?'new-author':'local');return Response.json({user:auth.user,recoveryCode:'fixture-first-account-recovery-code'});}
 if(url==='/api/data'){
  const space=options.headers?.['X-Mdd-Space']||'local';
  return Response.json({spaceId:space,collections:Object.fromEntries(Object.keys(collectionKeys).map(name=>[name,{revision:1,data:name==='works'?[workFor(space)]:[]}]))});
 }
 if(url==='/api/service/status')return Response.json({configured:false,defaultMode:'demo'});
 if(url==='/api/billing')return Response.json({account:newBillingAccount(),revision:1,mode:'server-demo',paymentConfigured:false});
 if(String(url).startsWith('/api/data/')&&options.method==='PUT')return Response.json({spaceId:options.headers?.['X-Mdd-Space']||'local',revision:2});
 throw Error(`Unexpected public-home fixture request: ${url}`);
};
const nodeMock=()=>({focus(){},contains(){return false;},querySelector(){return null;},querySelectorAll(){return [];},addEventListener(){},removeEventListener(){},scrollTo(){},scrollIntoView(){},getBoundingClientRect(){return {left:0,top:0,width:1280,height:800};},style:{}});
const vite=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const {App,ApplicationRouter}=await vite.ssrLoadModule('/src/main.jsx');
 const {AccountContext,AccountProvider,canAccessPrivate,useAccount}=await vite.ssrLoadModule('/src/Account.jsx');
 const {setRequestSpace,getRequestSpace}=await vite.ssrLoadModule('/src/sessionScope.js');
 assert.equal(typeof ApplicationRouter,'function');
 const unmount=async()=>{if(renderer){await act(async()=>renderer.unmount());renderer=null;}statusPending=null;};
 const seedCache=()=>{cache.clear();for(const name of Object.keys(collectionKeys)){cache.set(collectionKeys[name],JSON.stringify(name==='works'?[workFor('LEGACY_SECRET')]:[]));cache.set(`mdd-space:alice:${collectionKeys[name]}`,JSON.stringify(name==='works'?[workFor('ALICE_SECRET')]:[]));}cache.set('mdd-billing-v1','{"private":"LEDGER_SECRET"}');};
 const mount=async({state=guest(),behavior='ready',hash='#home'}={})=>{
  await unmount();auth=state;statusBehavior=behavior;location.hash=hash;seedCache();reads.length=0;writes.length=0;calls.length=0;setRequestSpace(null);
  await act(async()=>{renderer=TestRenderer.create(React.createElement(App),{createNodeMock:nodeMock});await sleep(10);});
 };
 const publicWrapper=()=>renderer.root.findAll(node=>node.props['data-public-home']===true||node.props['data-public-home']==='true')[0];
 const publicMain=()=>renderer.root.findByProps({'aria-label':'公共首页'});
 const conversationSections=()=>renderer.root.findAll(node=>node.type==='section'&&node.props['aria-label']==='创作对话');
 const assertUniqueNavigationIds=()=>{
  const ids=renderer.root.findAll(node=>typeof node.type==='string'&&node.props.id).map(node=>node.props.id);
  assert.equal(new Set(ids).size,ids.length,'The landing and private workbench must not duplicate native DOM ids');
  assert.equal(renderer.root.findAll(node=>node.type==='aside').length,1,'Only the private workbench can mount a sidebar');
  assert.equal(renderer.root.findAll(node=>node.type==='aside'&&node.props.id==='public-main-sidebar').length,0);
  assert.equal(renderer.root.findAll(node=>node.type==='aside'&&node.props.id==='main-sidebar').length,1);
  assert.equal(renderer.root.findByProps({id:'main-sidebar'}).props['data-collapsed'],false,'the private desktop sidebar starts expanded');
  const controls=renderer.root.findAll(node=>node.type==='button'&&['展开导航','收起导航','打开菜单'].includes(node.props['aria-label']));
  assert.equal(controls.filter(node=>node.props['aria-controls']==='main-sidebar').length,2,'The one workbench associates its desktop and mobile navigation controls with its sidebar');
 };
 const privateCalls=()=>calls.filter(call=>!['/api/auth/status','/api/auth/methods'].includes(call.url));
 const privateReads=()=>reads.filter(key=>/mdd-(works|conversations|favorites|submissions|reading|workflows|video|planningDrafts|evaluations|billing|ai-mode)/.test(key));
 const assertPublic=label=>{
  assert.ok(publicWrapper(),`${label}: public shell should exist`);assert.ok(!publicWrapper().props.hidden,`${label}: public shell should remain visible`);
  assert.equal(renderer.root.findAllByType('aside').length,0,`${label}: the public marketing page must not mount a sidebar`);
  assert.ok(publicMain().findAllByType('h1').length,`${label}: the public entry must keep its main heading`);
  assert.deepEqual(calls.filter(call=>call.url!=='/api/auth/status'),[],`${label}: homepage must only read account status`);
  assert.deepEqual(privateCalls(),[],`${label}: homepage must not initialize private providers`);
  assert.deepEqual(privateReads(),[],`${label}: homepage must not read private browser caches`);
  assert.deepEqual(writes,[],`${label}: simply opening the homepage must not create workspace records`);
  assert.ok(!text(publicMain()).includes('PRIVATE MANUSCRIPT'));assert.ok(!text(publicMain()).includes('LEDGER_SECRET'));
 };
 const go=async route=>act(async()=>{location.hash=`#${route}`;for(const handler of listeners.get('hashchange')||[])handler();await sleep(20);});
 const change=async(node,value)=>act(async()=>node.props.onChange({target:{value,checked:value}}));
 const click=async node=>{assert.ok(node,'Expected a reachable public-home control');await act(async()=>{await node.props.onClick();await sleep(10);});};
 const submitPublic=async()=>act(async()=>{await publicMain().findByProps({'aria-label':'公开创作入口'}).findByType('form').props.onSubmit({preventDefault(){}});await sleep(10);});
 const submitAccount=async()=>{
  const form=renderer.root.findAllByType('form').find(node=>node.findAllByProps({'aria-label':'创作账号'}).length);assert.ok(form);
  await act(async()=>{await form.props.onSubmit({preventDefault(){}});await sleep(20);});
 };
 const revealPassword=async()=>{const button=renderer.root.findAllByProps({'aria-label':'账号密码登录'})[0];if(button)await click(button);};
 const fillAccount=async()=>{await revealPassword();await change(renderer.root.findByProps({'aria-label':'创作账号'}),'fixture_alice');await change(renderer.root.findByProps({'aria-label':'创作密码'}),'fixture-login-password');};

 let publicHeading,publicSections;
 for(const [name,state]of [['guest',guest()],['signed-in',member('alice')],['legacy-local',legacy()]]){
  await mount({state});assertPublic(name);
  if(state.user)assert.ok(renderer.root.findAllByProps({'aria-label':'进入创作台'}).length,'signed-in visitors should enter the private workbench from the marketing header');
  else{assert.equal(renderer.root.findAllByProps({'aria-label':'登录'}).length,1);assert.equal(renderer.root.findAllByProps({'aria-label':'免费使用'}).length,1);}
  const heading=publicMain().findAllByType('h1').map(text),sections=publicMain().findAllByType('section').map(node=>node.props['aria-label']||node.props.className||'');
  if(!publicHeading){publicHeading=heading;publicSections=sections;}else{assert.deepEqual(heading,publicHeading,'auth state must not replace the public homepage title');assert.deepEqual(sections,publicSections,'auth state must keep the same public homepage structure');}
 }
 await mount({behavior:'pending'});assertPublic('status-pending');assert.equal(typeof statusPending,'function');
 await act(async()=>{statusPending();await sleep(10);});assertPublic('status-resolved');
 await mount({behavior:'failure'});assertPublic('status-error');
 await mount({behavior:'malformed'});assertPublic('malformed-status');
 await mount({behavior:'mixed-local'});assertPublic('contradictory-local-user-status');
 console.log('PASS sidebar-free marketing homepage, visitor/member header actions and consistent public content across authentication states without private reads');

 assert.equal(canAccessPrivate({ready:false,configured:false,spaceId:'local'}),false);
 assert.equal(canAccessPrivate({ready:true,error:'offline',configured:false,spaceId:'local'}),false);
 assert.equal(canAccessPrivate({ready:true,spaceId:'local'}),false,'missing status fields must not grant legacy-local access');
 assert.equal(canAccessPrivate({...guest(),ready:true}),false);
 assert.equal(canAccessPrivate({...legacy(),ready:true}),true);
 assert.equal(canAccessPrivate({...member('alice'),ready:true}),true);
 assert.equal(canAccessPrivate({...member('alice'),spaceId:'bob',ready:true}),false,'a mismatched identity cannot open another cached space');
 assert.equal(canAccessPrivate({ready:true,configured:true,user:{id:123},spaceId:123}),false,'malformed identity values must not authorize a private cache');

 await mount();
 await click(renderer.root.findByProps({'aria-label':'登录'}));
 assert.ok(publicWrapper()&&!publicWrapper().props.hidden,'the login action should open over the public marketing homepage');
 assert.ok(renderer.root.findAllByProps({'aria-label':'账号密码登录'}).length);await revealPassword();assert.ok(renderer.root.findAllByProps({'aria-label':'创作账号'}).length);assert.deepEqual(privateCalls(),[]);assert.deepEqual(privateReads(),[]);
 await mount();await go('works');
 assert.ok(renderer.root.findAllByProps({'aria-label':'账号密码登录'}).length,'a direct private URL must show the login methods');await revealPassword();assert.ok(renderer.root.findAllByProps({'aria-label':'创作账号'}).length,'password login remains reachable');
 assert.deepEqual(privateCalls(),[]);assert.deepEqual(privateReads(),[]);
 for(const behavior of ['failure','malformed','mixed-local']){
  await mount({behavior,hash:'#works'});assert.deepEqual(privateCalls(),[],`${behavior}: private route must fail closed`);assert.deepEqual(privateReads(),[]);
  assert.ok(!text(renderer.root).includes('PRIVATE MANUSCRIPT LEGACY_SECRET'));
 }
 await mount({behavior:'pending',hash:'#works'});assert.deepEqual(privateCalls(),[]);assert.deepEqual(privateReads(),[]);
 await act(async()=>{statusPending();await sleep(10);});assert.deepEqual(privateCalls(),[]);assert.deepEqual(privateReads(),[]);
 console.log('PASS explicit guest navigation/login gate, direct private URLs, missing status fields and status failures never authorize local cache access');

 await mount({state:member('alice'),behavior:'pending'});
 await click(renderer.root.findByProps({'aria-label':'免费使用'}));
 assert.deepEqual(privateCalls(),[]);assert.deepEqual(privateReads(),[],'an explicit action still must wait for status confirmation');
 await act(async()=>{statusPending();await sleep(20);});
 assert.equal(calls.filter(call=>call.url==='/api/data').length,1,'a queued action executes once after the pending status confirms the account');
 assert.ok(privateCalls().every(call=>call.headers['X-Mdd-Space']==='alice'));
 assert.equal(location.hash,'#works');assertUniqueNavigationIds();

 await mount({state:member('alice'),behavior:'pending'});
 const discarded='只在公共输入中保留的故事灵感';
 await change(publicMain().findByProps({'aria-label':'故事灵感输入'}),discarded);await submitPublic();
 assert.deepEqual(privateCalls(),[]);await click(renderer.root.findByProps({'aria-label':'关闭公共首页弹窗'}));
 await act(async()=>{statusPending();await sleep(20);});
 assertPublic('cancelled-pending-action');assert.equal(publicMain().findByProps({'aria-label':'故事灵感输入'}).props.value,discarded);

 await mount();await click(renderer.root.findByProps({'aria-label':'登录'}));await fillAccount();await submitAccount();
 assert.equal(location.hash,'#works','a header login without another pending intent should enter the workbench');
 assert.equal(calls.filter(call=>call.url==='/api/data').length,1);assertUniqueNavigationIds();
 assert.equal(conversationSections().length,0);

 await mount();
 const idea='我想写一家会保存旧物记忆的书店，先一起确定主角和核心冲突。';
 await change(publicMain().findByProps({'aria-label':'故事灵感输入'}),idea);await submitPublic();
 assert.equal(publicMain().findByProps({'aria-label':'故事灵感输入'}).props.value,idea);assert.deepEqual(privateCalls(),[]);assert.deepEqual(privateReads(),[]);
 await fillAccount();await submitAccount();
 assert.equal(calls.filter(call=>call.url==='/api/data').length,1,'the login callback and status effect must not launch the private workspace twice');
 assert.equal(conversationSections().length,1);
 assert.equal(renderer.root.findAllByProps({'aria-label':'创作对话工作区'}).length,1);assert.equal(renderer.root.findAllByProps({role:'dialog'}).length,0,'the conversation intent opens a private page, not a modal over the landing');
 assertUniqueNavigationIds();
 assert.equal(location.hash,'#conversation','a public conversation intent should open the private conversation page after login');
 assert.equal(renderer.root.findByProps({'aria-label':'创作对话输入'}).props.value,idea,'the guest idea should prefill the independent conversation');
 assert.ok(!calls.some(call=>call.url==='/api/generate'),'login and prefill must never generate or charge automatically');
 assert.equal(publicMain().findByProps({'aria-label':'故事灵感输入'}).props.value,idea,'the public composer keeps its own input while hidden');
 await click(renderer.root.findByProps({'data-nav':'home'}));
 assert.equal(location.hash,'#home');
 assert.ok(!publicWrapper().props.hidden);assert.equal(publicMain().findByProps({'aria-label':'故事灵感输入'}).props.value,idea);
 assert.equal(conversationSections().length,0);assert.ok(!calls.some(call=>call.url==='/api/generate'));
 assert.equal(renderer.root.findAllByType('aside').length,0,'returning to the marketing page must remove the private sidebar');
 console.log('PASS queued/cancelled intents, header login into works, one-time login handoff into conversation and return home with the original public input');

 for(const [label,destination]of [['查看创作方案','membership'],['进入工具库','tools']]){
  await mount();
  if(destination==='tools')await act(async()=>publicMain().findByProps({id:'landing-tools'}).props.onToggle({currentTarget:{open:true}}));
  const action=publicMain().findAllByType('button').find(node=>text(node).trim()===label);await click(action);
  assert.equal(location.hash,'#home');assert.deepEqual(privateCalls(),[]);assert.deepEqual(privateReads(),[]);
  await fillAccount();await submitAccount();
  assert.equal(location.hash,`#${destination}`,`${label} keeps the original destination through login`);
  assert.equal(calls.filter(call=>call.url==='/api/data').length,1,'body action login must initialize only one workbench');assertUniqueNavigationIds();
  assert.equal(renderer.root.findAllByProps({'aria-label':'创作账号'}).length,0,'the queued body action cannot reopen login through an old guest closure');
  assert.ok(!calls.some(call=>call.url==='/api/generate'));
 }

 await mount({state:member('alice')});
 assert.ok(cache.get('mdd-space:alice:mdd-works-v1').includes('ALICE_SECRET'),'the fast-mount regression starts with an existing account cache');
 await click(publicMain().findByProps({'aria-label':'体验故事大纲'}));
 assert.equal(location.hash,'#tools');assert.equal(renderer.root.findAllByProps({role:'dialog'}).length,1);
 assert.equal(renderer.root.findAllByProps({'aria-label':'工具创作需求'}).length,1);assert.ok(text(renderer.root.findByProps({role:'dialog'})).includes('长篇大纲规划师'));
 const workspaceLoads=calls.filter(call=>call.url==='/api/data').length;
 await act(async()=>{for(const handler of listeners.get('hashchange')||[])handler();await sleep(20);});
 assert.equal(renderer.root.findAllByProps({role:'dialog'}).length,1,'a delayed hashchange for the current route must not clear the initial tool modal');
 assert.equal(renderer.root.findAllByProps({'aria-label':'工具创作需求'}).length,1);assert.equal(calls.filter(call=>call.url==='/api/data').length,workspaceLoads);
 assert.ok(!calls.some(call=>call.url==='/api/generate'),'opening an initial tool modal does not execute the tool');
 await click(renderer.root.findByProps({'data-nav':'works'}));
 assert.equal(location.hash,'#works');assert.equal(renderer.root.findAllByProps({'aria-label':'工具创作需求'}).length,0,'a real navigation away still closes the tool modal');
 console.log('PASS footer membership/tool-library login destinations and cached initial tool modal surviving a delayed same-route hashchange without generation');

 await mount({state:legacy()});await go('works');
 assert.deepEqual(privateCalls(),[],'legacy server compatibility must not open private UI before the first account is registered');assert.deepEqual(privateReads(),[]);
 assert.ok(text(renderer.root).includes('设置首个创作账号'));await fillAccount();await submitAccount();
 assert.ok(renderer.root.findAllByProps({'aria-label':'账号恢复码'}).length);assert.equal(calls.filter(call=>call.url==='/api/data').length,0,'the registration recovery code must be acknowledged before opening private UI');
 await change(renderer.root.findByProps({'aria-label':'已安全保存恢复码'}),true);
 const continueRegistration=renderer.root.findAllByType('button').find(node=>text(node).trim()==='已保存，继续');await click(continueRegistration);
 assert.ok(calls.some(call=>call.url==='/api/data'));assert.ok(privateCalls().filter(call=>!call.url.startsWith('/api/auth/')).every(call=>call.headers['X-Mdd-Space']==='local'));assertUniqueNavigationIds();

 for(const state of [member('alice')]){
  await mount({state});assertPublic(state.spaceId);await click(renderer.root.findByProps({'aria-label':'进入创作台'}));
  assert.equal(location.hash,'#works');assert.ok(calls.some(call=>call.url==='/api/data'),'an explicit signed-in navigation should initialize the workspace');
  assert.ok(calls.some(call=>call.url==='/api/billing'));assert.ok(calls.some(call=>call.url==='/api/service/status'));
  assertUniqueNavigationIds();
  assert.ok(privateCalls().every(call=>call.headers['X-Mdd-Space']===state.spaceId),'all private requests must use the authorized space');
  if(state.user)assert.ok(!reads.includes('mdd-works-v1'),'a signed-in private route cannot use the legacy cache namespace');
 }
 await unmount();auth=member('alice');statusBehavior='ready';location.hash='#works';reads.length=0;calls.length=0;setRequestSpace('alice');
 const controlled=value=>React.createElement(AccountContext.Provider,{value:{...value,ready:true,error:'',refresh:async()=>value}},React.createElement(ApplicationRouter));
 await act(async()=>{renderer=TestRenderer.create(controlled(member('alice')),{createNodeMock:nodeMock});await sleep(20);});
 assert.ok(text(renderer.root).includes('PRIVATE MANUSCRIPT alice'));
 auth=member('bob');setRequestSpace('bob');await act(async()=>{renderer.update(controlled(auth));await sleep(20);});
 assert.ok(text(renderer.root).includes('PRIVATE MANUSCRIPT bob'));assert.ok(!text(renderer.root).includes('PRIVATE MANUSCRIPT alice'),'switching account must unmount the previous private subtree');
 assert.deepEqual(calls.filter(call=>call.url==='/api/data').map(call=>call.headers['X-Mdd-Space']),['alice','bob']);
 await act(async()=>renderer.update(React.createElement(AccountContext.Provider,{value:{...auth,ready:true,error:'Controlled authentication status unavailable'}},React.createElement(ApplicationRouter))));
 assert.ok(!text(renderer.root).includes('PRIVATE MANUSCRIPT bob'),'authentication errors must remove the already-mounted private workspace');
 console.log('PASS first-account registration gate, scoped signed-in provider requests, account-switch remounts and removal of private content on authentication errors');
 await unmount();
 calls.length=0;reads.length=0;writes.length=0;location.hash='#works';setRequestSpace(null);
 await act(async()=>{renderer=TestRenderer.create(controlled(mixedLegacy()),{createNodeMock:nodeMock});await sleep(10);});
 assert.deepEqual(privateCalls(),[],'The require-login router must reject a mixed legacy/user context even without status-response validation');
 assert.deepEqual(privateReads(),[]);assert.ok(!text(renderer.root).includes('PRIVATE MANUSCRIPT'));
 assert.ok(renderer.root.findAllByProps({'aria-label':'创作账号'}).length,'A mixed local/user context must show account setup rather than private content');
 await unmount();
 console.log('PASS contradictory successful status payloads and directly injected legacy/user contexts fail closed');

 // Delayed status responses from a former login must never restore its cached space.
 const fixtureFetch=globalThis.fetch,queuedStatus=[];
 let observed;
 globalThis.fetch=async(url,options)=>url==='/api/auth/status'?new Promise(resolve=>queuedStatus.push({resolve})):fixtureFetch(url,options);
 function ObserveAccount(){observed=useAccount();return React.createElement('span',null,observed.user?.id||'guest');}
 const mountAccount=async()=>act(async()=>{renderer=TestRenderer.create(React.createElement(AccountProvider,{allowPublic:true},React.createElement(ObserveAccount)));await sleep(0);});
 const startRefresh=async()=>{let promise;await act(async()=>{promise=observed.refresh();await sleep(0);});return {request:queuedStatus.at(-1),promise};};
 const settleStatus=async(request,data,status=200,promise)=>act(async()=>{request.resolve(Response.json(data,{status}));if(promise)await promise;await sleep(0);});
 try{
  await mountAccount();await settleStatus(queuedStatus.at(-1),member('alice'));
  const oldSuccess=await startRefresh(),latestSuccess=await startRefresh();
  await settleStatus(latestSuccess.request,member('bob'),200,latestSuccess.promise);
  assert.equal(observed.user.id,'bob');assert.equal(getRequestSpace(),'bob');
  await settleStatus(oldSuccess.request,member('alice'),200,oldSuccess.promise);
  assert.equal(await oldSuccess.promise,null);assert.equal(observed.user.id,'bob');assert.equal(getRequestSpace(),'bob','A late old success cannot restore a former request scope');

  const oldFailure=await startRefresh(),newerSuccess=await startRefresh();
  await settleStatus(newerSuccess.request,member('carol'),200,newerSuccess.promise);
  await settleStatus(oldFailure.request,{error:'controlled stale status failure'},503,oldFailure.promise);
  assert.equal(await oldFailure.promise,null);assert.equal(observed.user.id,'carol');assert.equal(observed.error,'');assert.equal(getRequestSpace(),'carol','A stale failure cannot clear the newly confirmed session');

  const afterUnmountSuccess=await startRefresh();await unmount();assert.equal(getRequestSpace(),null);
  await mountAccount();await settleStatus(queuedStatus.at(-1),member('dora'));
  await settleStatus(afterUnmountSuccess.request,member('carol'),200,afterUnmountSuccess.promise);
  assert.equal(await afterUnmountSuccess.promise,null);assert.equal(observed.user.id,'dora');assert.equal(getRequestSpace(),'dora','An unmounted account provider cannot overwrite the replacement provider scope');

  const afterUnmountFailure=await startRefresh();await unmount();await mountAccount();await settleStatus(queuedStatus.at(-1),member('eric'));
  await settleStatus(afterUnmountFailure.request,{error:'controlled unmounted failure'},503,afterUnmountFailure.promise);
  assert.equal(await afterUnmountFailure.promise,null);assert.equal(observed.user.id,'eric');assert.equal(getRequestSpace(),'eric');
  await unmount();assert.equal(getRequestSpace(),null);
  console.log('PASS latest-only account refresh success/failure and late responses after unmount without reviving a previous account scope');
 }finally{await unmount();globalThis.fetch=fixtureFetch;}
}finally{
 if(renderer)await act(async()=>renderer.unmount());await vite.close();
 for(const [key,descriptor]of Object.entries(originals)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
}
