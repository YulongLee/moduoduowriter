import assert from 'node:assert/strict';
import React from 'react';
import TestRenderer,{act} from 'react-test-renderer';
import {createServer} from 'vite';

// Memory-only management responses; no browser, real accounts, manuscripts or providers.
const globals=['fetch','window','document','location','localStorage','IS_REACT_ACT_ENVIRONMENT'];
const originals=Object.fromEntries(globals.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const listeners=new Map();let hash='#admin',renderer,holdUsers=false,releaseUsers,malformedStatus=false,failOverview=false;
globalThis.location={get hash(){return hash;},set hash(value){hash=value;}};
globalThis.window={addEventListener(name,handler){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(handler);},removeEventListener(name,handler){listeners.get(name)?.delete(handler);}};
globalThis.document={activeElement:null,getElementById(){return null;}};
globalThis.localStorage={getItem(){return null;},setItem(){}};
const calls=[],admin={id:'fixture-admin',username:'fixture-admin@example.com',role:'admin',hasPassword:true},author={id:'fixture-author',username:'fixture-author',role:'author',status:'active',createdAt:'2026-10-28T00:00:00Z',hasPassword:true,providers:['email'],workCount:2,generationCount:3};
const overview={users:{total:2,active:2,disabled:0,admins:1},works:{total:3,words:12345,chapters:9},generations:{total:8,succeeded:6,failed:1,running:1,interrupted:0,totalTokens:4000},orders:{total:1,amountCents:990,credits:1000,mode:'server-demo'},trend:[{date:'2026-10-28',users:1,generations:3,tokens:1000}],recentAudit:[]};
const list=(items,page=1,total=items.length)=>({items,page,total,pageSize:20});
const publicAuth={phone:{enabled:false,accessKeyId:'',accessKeySecret:'',signName:'',templateCode:'',codeParam:'code',hasAccessKeyId:false,hasAccessKeySecret:false},email:{enabled:false,host:'',port:465,secure:true,user:'',password:'',from:'',fromName:'墨多多',hasPassword:false},wechat:{enabled:false,appId:'',appSecret:'',redirectUri:'',hasAppSecret:false}};
globalThis.fetch=async(url,options={})=>{
 const method=options.method||'GET',body=options.body?JSON.parse(options.body):undefined;calls.push({url,method,body});
 if(url==='/api/admin/overview')return failOverview?Response.json({error:'受控后台读取失败'},{status:503}):Response.json(overview);
 if(String(url).startsWith('/api/admin/users?')){
  const params=new URL(url,'http://fixture').searchParams,page=Number(params.get('page'));
  const data=list([{...admin,status:'active',providers:[],workCount:1,generationCount:5},author],page,21);
  if(holdUsers)return new Promise(resolve=>{releaseUsers=()=>resolve(Response.json({...data,items:[{...author,username:'LATE USER SHOULD NOT APPEAR'}]}));});
  return Response.json(data);
 }
 if(url==='/api/admin/users/fixture-author/status'&&method==='PUT'){author.status=body.status;return Response.json(malformedStatus?{}:{user:{...author}});}
 if(String(url).startsWith('/api/admin/generations?'))return Response.json(list([{id:'fixture-generation',userId:author.id,username:author.username,task:'chapterDraft',status:'succeeded',startedAt:'2026-10-28T00:00:00Z',finishedAt:'2026-10-28T00:00:01Z',usage:{inputTokens:400,outputTokens:600,totalTokens:1000},hasError:false}]));
 if(String(url).startsWith('/api/admin/orders?'))return Response.json({...list([{id:'fixture-order',userId:author.id,username:author.username,name:'演示轻量补给',amount:990,credits:1000,status:'demo-completed',createdAt:'2026-10-28T00:00:00Z'}]),mode:'server-demo'});
 if(String(url).startsWith('/api/admin/audit?'))return Response.json(list([{id:'fixture-audit',actorName:admin.username,action:'user.disabled',targetLabel:author.username,createdAt:'2026-10-28T00:00:00Z'}]));
 if(url==='/api/settings')return Response.json({baseUrl:'',model:'',protocol:'chat',apiKey:'',hasKey:false,jsonMode:false,defaultMode:'demo'});
 if(url==='/api/service/status')return Response.json({configured:false,defaultMode:'demo'});
 if(url==='/api/auth/settings')return Response.json(publicAuth);
 if(url==='/api/auth/logout')return Response.json({ok:true});
 throw Error('Unexpected admin UI fixture: '+url);
};
const vite=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const {AdminConsole}=await vite.ssrLoadModule('/src/AdminConsole.jsx'),{AccountContext}=await vite.ssrLoadModule('/src/Account.jsx');
 const text=node=>typeof node==='string'?node:(node?.children||[]).map(text).join('');
 const button=label=>renderer.root.findAllByType('button').find(node=>text(node)===label);
 const labeled=label=>renderer.root.findByProps({'aria-label':label});
 const click=async node=>{assert.ok(node,'Expected admin control');await act(async()=>{await node.props.onClick();});};
 const unmount=async()=>{if(renderer)await act(async()=>renderer.unmount());renderer=null;};
 const mount=async state=>{await unmount();hash='#admin';calls.length=0;holdUsers=false;const account={ready:true,error:'',configured:true,user:null,spaceId:null,refresh:async()=>({configured:true,user:admin,spaceId:admin.id}),...state};await act(async()=>{renderer=TestRenderer.create(React.createElement(AccountContext.Provider,{value:account},React.createElement(AdminConsole)),{createNodeMock:()=>({focus(){},querySelectorAll(){return[];}})});});};
 await mount();assert.equal(calls.length,0);assert.ok(renderer.root.findAllByProps({'aria-label':'创作账号'}).length);assert.ok(!text(renderer.root).includes('注册新账号'));
 await mount({user:author,spaceId:author.id});assert.equal(calls.length,0);assert.ok(text(renderer.root).includes('没有后台权限'));
 await mount({user:admin,spaceId:'another-space'});assert.equal(calls.length,0);assert.ok(!renderer.root.findAllByProps({'data-admin-console':'true'}).length);
 await mount({ready:false,user:admin,spaceId:admin.id});assert.equal(calls.length,0);
 console.log('PASS administrator-only shell, visitor password gate and no management requests for author, pending or mismatched identities');
 await mount({user:admin,spaceId:admin.id});assert.deepEqual(calls.map(call=>call.url),['/api/admin/overview']);assert.ok(text(renderer.root).includes('12,345'));assert.ok(text(renderer.root).includes('75%'));assert.ok(renderer.root.findAllByProps({role:'img'}).length);
 await click(button('用户管理'));assert.ok(calls.at(-1).url.startsWith('/api/admin/users?'));assert.equal(labeled('停用用户 '+admin.username).props.disabled,true);
 await click(labeled('停用用户 '+author.username));assert.equal(calls.filter(call=>call.method==='PUT').length,0,'Opening a confirmation cannot mutate the account');assert.ok(text(labeled('确认修改用户状态')).includes(author.username));
 await click(button('确认停用'));assert.equal(author.status,'disabled');assert.equal(calls.filter(call=>call.method==='PUT').length,1);assert.ok(text(renderer.root).includes('已停用用户'));assert.equal(renderer.root.findAllByProps({role:'alertdialog'}).length,0);
 await click(labeled('下一页'));assert.ok(calls.at(-1).url.includes('page=2'));
 await act(async()=>{labeled('搜索后台用户').props.onChange({target:{value:'fixture@example.com'}});});
 await act(async()=>{await renderer.root.findByProps({className:'admin-search'}).props.onSubmit({preventDefault(){}});});assert.ok(calls.at(-1).url.includes('q=fixture%40example.com'));assert.ok(calls.at(-1).url.includes('page=1'));
 malformedStatus=true;await click(labeled('启用用户 '+author.username));await click(button('确认启用'));assert.ok(text(labeled('确认修改用户状态')).includes('修改结果尚未确认'));assert.ok(!text(renderer.root).includes('已启用用户'));await click(button('取消'));malformedStatus=false;
 console.log('PASS explicit user-state confirmation, current-admin guard, applied status refresh, searchable users and server pagination');
 await click(button('订单账本演示'));assert.ok(text(renderer.root).includes('¥9.90'));assert.ok(text(renderer.root).includes('无真实收款')||text(renderer.root).includes('不产生真实收款'));assert.ok(!renderer.root.findAllByType('button').some(node=>/退款|发放|修改余额/.test(text(node))));
 await click(button('操作日志'));assert.ok(text(renderer.root).includes('停用用户'));
 await click(button('服务配置'));assert.ok(calls.some(call=>call.url==='/api/auth/settings'));assert.ok(calls.every(call=>!String(call.url).startsWith('/api/data')&&!String(call.url).startsWith('/api/oss')&&call.url!=='/api/billing'));assert.ok(calls.every(call=>call.method==='GET'||call.url.includes('/users/')));
 console.log('PASS read-only demo orders, operation logs and isolated service settings without workspace, storage or paid provider calls');
 await mount({user:admin,spaceId:admin.id});holdUsers=true;await click(button('用户管理'));assert.equal(typeof releaseUsers,'function');await click(button('生成记录'));await act(async()=>{releaseUsers();});assert.ok(text(renderer.root).includes('章节正文'));assert.ok(!text(renderer.root).includes('LATE USER SHOULD NOT APPEAR'));await unmount();
 console.log('PASS switching management pages aborts and rejects late responses instead of rendering another page or account data');
 failOverview=true;await mount({user:admin,spaceId:admin.id});assert.ok(text(renderer.root).includes('数据暂时无法载入'));assert.equal(renderer.root.findAllByProps({className:'admin-metric'}).length,0,'A failed response cannot render fabricated zero statistics');failOverview=false;await click(button('重新加载'));assert.ok(text(renderer.root).includes('12,345'));console.log('PASS failed overview stays explicit, supports retry and never presents invented zero metrics');
}finally{
 if(renderer)await act(async()=>renderer.unmount());await vite.close();for(const name of globals){const original=originals[name];if(original)Object.defineProperty(globalThis,name,original);else delete globalThis[name];}
}
