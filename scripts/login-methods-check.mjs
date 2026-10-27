import assert from 'node:assert/strict';
import React from 'react';
import TestRenderer,{act} from 'react-test-renderer';
import {createServer} from 'vite';

// Controlled UI responses only. No SMS, email, OAuth exchange, real user or paid provider is contacted.
const keys=['fetch','window','document','localStorage','IS_REACT_ACT_ENVIRONMENT'];
const original=Object.fromEntries(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.window={addEventListener(){},removeEventListener(){}};
globalThis.document={getElementById(){return null;}};
globalThis.localStorage={getItem(){return null;},setItem(){}};
const user={id:'fixture-author',username:'fixture-author',hasPassword:false},calls=[];
let renderer,refreshes=0,successes=0,hold=null,holdPath='',wechatStatus='waiting',failedMethods=false,disabled=false,wrongBind=false;
const methods=()=>({ownerConfigured:true,...Object.fromEntries(['phone','email','wechat'].map(key=>[key,{enabled:!disabled,available:!disabled,reason:'此登录方式尚未开通，请先使用账号密码登录。'}]))});
const qr=()=>({requestId:'fixture-wechat-0001',pollToken:'fixture-poll-token',authorizationUrl:'https://open.weixin.qq.com/connect/qrconnect?appid=fixture-app&state=fixture-state',openUrl:'https://open.weixin.qq.com/connect/qrconnect?appid=fixture-app&state=fixture-state&self_redirect=false',expiresAt:new Date(Date.now()+300000).toISOString()});
const reply=(url,body)=>{
 if(url==='/api/auth/methods')return failedMethods?Response.json({error:'登录方式暂不可用'},{status:503}):Response.json(methods());
 if(url.endsWith('/code/send'))return Response.json({challengeId:'fixture-code-0001',expiresAt:new Date(Date.now()+300000).toISOString(),retryAfter:60});
 if(url==='/api/auth/code/login')return Response.json({user});
 if(url==='/api/auth/identities/code/bind')return Response.json({bound:true,user:wrongBind?{...user,id:'another-user'}:user});
 if(url==='/api/auth/wechat/start')return Response.json(qr());
 if(url==='/api/auth/wechat/status')return Response.json({status:wechatStatus});
 if(url==='/api/auth/wechat/consume')return Response.json({user,bound:true});
 if(url==='/api/auth/wechat/cancel')return Response.json({ok:true});
 if(url==='/api/auth/identities')return Response.json({identities:[{id:'fixture-phone',provider:'phone',masked:'+86 138****8000'}]});
 throw new Error('Unexpected controlled request: '+url);
};
globalThis.fetch=async(url,options={})=>{
 const body=options.body?JSON.parse(options.body):undefined;calls.push({url,method:options.method||'GET',body,signal:options.signal});
 if(url===holdPath)return await new Promise(resolve=>{hold=()=>resolve(reply(url,body));});
 return reply(url,body);
};
const vite=await createServer({configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const {LoginMethods}=await vite.ssrLoadModule('/src/LoginMethods.jsx');
 const {AccountContext,AccountForm,AccountAccess}=await vite.ssrLoadModule('/src/Account.jsx');
 const account={ready:true,configured:true,spaceId:user.id,user,refresh:async()=>{refreshes++;return {configured:true,spaceId:user.id,user};}};
 const text=node=>typeof node==='string'?node:(node?.children||[]).map(text).join('');
 const byLabel=label=>renderer.root.findByProps({'aria-label':label});
 const click=async node=>{await act(async()=>{await node.props.onClick();});};
 const fill=async(label,value)=>{await act(async()=>byLabel(label).props.onChange({target:{value}}));};
 const tab=label=>renderer.root.findAllByProps({role:'tab'}).find(node=>text(node).includes(label));
 const submit=async()=>{await act(async()=>{await renderer.root.findByType('form').props.onSubmit({preventDefault(){}});});};
 const unmount=async()=>{if(renderer)await act(async()=>renderer.unmount());renderer=null;};
 const mount=async props=>{await unmount();calls.length=0;refreshes=0;successes=0;hold=null;holdPath='';failedMethods=false;disabled=false;wrongBind=false;wechatStatus='waiting';await act(async()=>{renderer=TestRenderer.create(React.createElement(LoginMethods,{account,onSuccess:()=>successes++,renderLegacy:()=>React.createElement('p',null,'legacy-credentials'),...props}));});};

 await mount();assert.equal(calls.filter(call=>call.url==='/api/auth/methods').length,1);assert.equal(calls.length,1);assert.equal(renderer.root.findAllByType('iframe').length,0);
 await fill('登录手机号','bad');await click(byLabel('获取登录验证码'));assert.equal(calls.length,1);assert.ok(text(renderer.root).includes('有效的中国大陆手机号'));
 await fill('登录手机号','138 0013 8000');
 const send=byLabel('获取登录验证码');await act(async()=>{await Promise.all([send.props.onClick(),send.props.onClick()]);});
 assert.equal(calls.filter(call=>call.url==='/api/auth/code/send').length,1,'A repeated click must not send two codes');assert.equal(calls.at(-1).body.target,'+8613800138000');assert.equal(byLabel('获取登录验证码').props.disabled,true);
 await fill('登录验证码','123456');const form=renderer.root.findByType('form');await act(async()=>{await Promise.all([form.props.onSubmit({preventDefault(){}}),form.props.onSubmit({preventDefault(){}})]);});
 assert.equal(calls.filter(call=>call.url==='/api/auth/code/login').length,1);assert.equal(successes,1);assert.equal(refreshes,1);
 console.log('PASS phone normalization, local validation, server countdown, duplicate guards and single confirmed-session handoff');

 await mount();await click(tab('邮箱'));await fill('登录邮箱','  Author@Example.com  ');await click(byLabel('获取登录验证码'));assert.equal(calls.at(-1).body.target,'author@example.com');
 await fill('登录验证码','123456');await fill('登录邮箱','new@example.com');assert.equal(byLabel('登录验证码').props.value,'');await submit();assert.equal(calls.filter(call=>call.url==='/api/auth/code/login').length,0);assert.ok(text(renderer.root).includes('先获取当前账号'));
 holdPath='/api/auth/code/send';let pending;await act(async()=>{pending=byLabel('获取登录验证码').props.onClick();await Promise.resolve();});assert.equal(typeof hold,'function');await click(tab('手机号'));const oldSignal=calls.at(-1).signal;hold();await act(async()=>pending);assert.equal(oldSignal.aborted,true);assert.equal(byLabel('登录手机号').props.value,'');assert.ok(!text(renderer.root).includes('验证码已发送'));
 console.log('PASS email normalization, changed-recipient invalidation and abandoned send responses cannot restore a stale challenge');

 await mount();await click(tab('微信扫码'));assert.equal(calls.length,1,'Opening the tab must not fabricate or start an authorization');await click(byLabel('获取微信登录二维码'));
 const frame=renderer.root.findByType('iframe');assert.equal(new URL(frame.props.src).hostname,'open.weixin.qq.com');assert.ok(frame.props.title.includes('官方'));assert.ok(renderer.root.findByType('a').props.rel.includes('noopener'));
 await click(byLabel('检查微信扫码状态'));assert.equal(calls.at(-1).url,'/api/auth/wechat/status');assert.equal(calls.at(-1).method,'POST');assert.equal(calls.at(-1).body.pollToken,'fixture-poll-token');assert.ok(!calls.some(call=>String(call.url).includes('pollToken=')));
 wechatStatus='approved';const check=byLabel('检查微信扫码状态');await act(async()=>{await Promise.all([check.props.onClick(),check.props.onClick()]);});
 assert.equal(calls.filter(call=>call.url==='/api/auth/wechat/consume').length,1);assert.equal(successes,1);assert.equal(refreshes,1);
 console.log('PASS official WeChat iframe, new-window fallback, POST-only status tokens and one-time approval consumption');

 await mount();await click(tab('微信扫码'));await click(byLabel('获取微信登录二维码'));holdPath='/api/auth/wechat/status';wechatStatus='approved';
 await act(async()=>{pending=byLabel('检查微信扫码状态').props.onClick();await Promise.resolve();});await click(tab('邮箱'));hold();await act(async()=>pending);
 assert.equal(calls.filter(call=>call.url==='/api/auth/wechat/consume').length,0);assert.equal(calls.filter(call=>call.url==='/api/auth/wechat/cancel').length,1);assert.equal(refreshes,0);assert.equal(successes,0);
 await mount();await fill('登录手机号','13800138000');await click(byLabel('获取登录验证码'));await fill('登录验证码','123456');holdPath='/api/auth/code/login';await act(async()=>{pending=renderer.root.findByType('form').props.onSubmit({preventDefault(){}});await Promise.resolve();});await unmount();hold();await act(async()=>pending);assert.equal(refreshes,0);assert.equal(successes,0);
 console.log('PASS tab switches cancel pending QR flows, late approvals are ignored and unmount prevents login callbacks');

 await mount({purpose:'bind'});await fill('登录手机号','13800138000');await click(byLabel('获取登录验证码'));assert.equal(calls.at(-1).url,'/api/auth/identities/code/send');await fill('登录验证码','123456');await submit();assert.equal(calls.filter(call=>call.url==='/api/auth/identities/code/bind').length,1);assert.equal(successes,1);assert.ok(text(renderer.root).includes('已绑定'));assert.equal(renderer.root.findAllByProps({'aria-label':'账号密码登录'}).length,0);
 await mount({purpose:'bind'});wrongBind=true;await fill('登录手机号','13800138000');await click(byLabel('获取登录验证码'));await fill('登录验证码','123456');await submit();assert.equal(successes,0);assert.equal(refreshes,0);assert.ok(text(renderer.root).includes('绑定结果尚未确认'));
 console.log('PASS explicit identity-binding paths preserve the current account and reject a mismatched binding result');

 await unmount();disabled=true;calls.length=0;await act(async()=>{renderer=TestRenderer.create(React.createElement(LoginMethods,{account,renderLegacy:()=>React.createElement('p',null,'legacy-credentials')}));});assert.equal(renderer.root.findAllByType('iframe').length,0);assert.equal(renderer.root.findAllByProps({'aria-label':'获取登录验证码'}).length,0);await click(byLabel('账号密码登录'));assert.ok(text(renderer.root).includes('legacy-credentials'));await click(byLabel('返回其他登录方式'));assert.ok(text(renderer.root).includes('尚未开通'));
 await unmount();failedMethods=true;disabled=false;await act(async()=>{renderer=TestRenderer.create(React.createElement(LoginMethods,{account,renderLegacy:()=>React.createElement('p',null,'legacy-credentials')}));});await click(byLabel('账号密码登录'));assert.ok(text(renderer.root).includes('legacy-credentials'));
 await unmount();calls.length=0;await act(async()=>{renderer=TestRenderer.create(React.createElement(AccountContext.Provider,{value:{...account,configured:false,user:null,spaceId:'local'}},React.createElement(AccountForm,{modern:true})));});assert.ok(text(renderer.root).includes('设置首个创作账号'));assert.equal(calls.length,0);
 await unmount();await act(async()=>{renderer=TestRenderer.create(React.createElement(AccountContext.Provider,{value:account},React.createElement(AccountForm,{loginOnly:true})));});assert.ok(renderer.root.findByProps({'aria-label':'创作账号'}));assert.equal(calls.length,0);
 await unmount();calls.length=0;await act(async()=>{renderer=TestRenderer.create(React.createElement(AccountContext.Provider,{value:account},React.createElement(AccountAccess)));});assert.ok(!text(renderer.root).includes('管理恢复码'));assert.ok(text(renderer.root).includes('退出登录'));assert.equal(calls.length,0,'Identity settings must not load before an explicit user action');await click(byLabel('管理登录方式'));assert.equal(calls.filter(call=>call.url==='/api/auth/identities').length,1);assert.ok(text(renderer.root).includes('+86 138****8000'));await click(byLabel('管理登录方式'));assert.equal(renderer.root.findAllByProps({'aria-label':'登录方式管理'}).length,0);
 console.log('PASS disabled/unavailable methods never fake delivery, legacy fallback remains reachable, owner bootstrap stays unchanged and passwordless accounts hide password-only recovery');
}finally{
 if(renderer)await act(async()=>renderer.unmount());await vite.close();
 for(const [key,value]of Object.entries(original)){if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];}
}
