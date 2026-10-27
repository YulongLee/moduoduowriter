import assert from 'node:assert/strict';
import React from 'react';
import TestRenderer,{act} from 'react-test-renderer';
import {createServer} from 'vite';
import {publicAuthConfig,validateAuthConfig} from '../server/auth-providers.mjs';

// Memory-only administrator settings and account fixtures. No real services, credentials or files are read.
const keys=['fetch','window','document','localStorage','IS_REACT_ACT_ENVIRONMENT'];
const original=Object.fromEntries(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.window={addEventListener(){},removeEventListener(){}};
globalThis.document={getElementById(){return null;}};
globalThis.localStorage={getItem(){return null;},setItem(){}};
const fixture=()=>validateAuthConfig({
 phone:{enabled:true,accessKeyId:'FixtureSmsId123456',accessKeySecret:'fixture-sms-private',signName:'墨多多测试',templateCode:'SMS_123456789',codeParam:'code'},
 email:{enabled:true,host:'smtp.example.com',port:465,secure:true,user:'author@example.com',password:'fixture-smtp-private',from:'author@example.com',fromName:'墨多多'},
 wechat:{enabled:false,appId:'wx1234567890123456',appSecret:'fixture-wechat-private',redirectUri:'https://writer.example.com/api/auth/wechat/callback'}
});
let settings=fixture(),behavior='ready',saveBehavior='ready',renderer,refreshUser='alice',refreshes=0;
let identities=[{id:'fixture-email',provider:'email',masked:'a***@example.com'}],holdIdentities=false,releaseIdentities=null;
const calls=[],user=id=>({id,username:'fixture-'+id,hasPassword:true,role:'author'}),text=node=>typeof node==='string'?node:(node?.children||[]).map(text).join('');
globalThis.fetch=async(url,options={})=>{
 const body=options.body?JSON.parse(options.body):undefined,method=options.method||'GET';calls.push({url,method,body});
 if(url==='/api/auth/settings'&&method==='GET'){
  if(behavior==='failure')return Response.json({error:'配置服务暂不可用'},{status:503});
  if(behavior==='missing')return Response.json({phone:{},email:{},wechat:{}});
  if(behavior==='wrong-type')return Response.json({...publicAuthConfig(settings),email:{...publicAuthConfig(settings).email,port:'465'}});
  if(behavior==='secret-leak')return Response.json({...publicAuthConfig(settings),email:{...publicAuthConfig(settings).email,password:'unexpected-unredacted-fixture'}});
  return Response.json(publicAuthConfig(settings));
 }
 if(url==='/api/auth/settings'&&method==='PUT'){
  if(saveBehavior==='failure')return Response.json({error:'配置保存未完成'},{status:503});
  settings=validateAuthConfig(body,settings);
  return Response.json(saveBehavior==='malformed'?{phone:{},email:{},wechat:{}}:publicAuthConfig(settings));
 }
 if(url==='/api/auth/identities'&&method==='GET'){
  if(holdIdentities)return await new Promise(resolve=>{releaseIdentities=()=>resolve(Response.json({identities}));});
  return Response.json({identities});
 }
 if(url==='/api/auth/methods')return Response.json({ownerConfigured:true,phone:{enabled:true,available:true},email:{enabled:true,available:true},wechat:{enabled:false,available:false,reason:'微信扫码登录尚未开放'}});
 if(url==='/api/auth/identities/code/send')return Response.json({challengeId:'fixture-binding-challenge',expiresAt:new Date(Date.now()+300000).toISOString(),retryAfter:60});
 if(url==='/api/auth/identities/code/bind'){
  identities=[...identities,{id:'fixture-phone',provider:'phone',masked:'+86 138****8000'}];return Response.json({bound:true,user:user('alice'),identities});
 }
 throw new Error('Unexpected settings fixture request: '+url);
};
const vite=await createServer({configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const {LoginServiceSettings}=await vite.ssrLoadModule('/src/LoginServiceSettings.jsx');
 const {AccountContext,AccountAccess}=await vite.ssrLoadModule('/src/Account.jsx');
 const byLabel=label=>renderer.root.findByProps({'aria-label':label});
 const button=label=>renderer.root.findAllByType('button').find(node=>text(node)===label);
 const click=async node=>{assert.ok(node,'Expected settings control');await act(async()=>{await node.props.onClick();});};
 const fill=async(label,value)=>{await act(async()=>byLabel(label).props.onChange({target:{value}}));};
 const checkByText=async(label,checked=true)=>{const node=renderer.root.findAllByType('label').find(node=>text(node)===label);assert.ok(node,'Expected explicit clear option');await act(async()=>node.findByType('input').props.onChange({target:{checked}}));};
 const unmount=async()=>{if(renderer)await act(async()=>renderer.unmount());renderer=null;};
 const mountSettings=async mode=>{await unmount();behavior=mode;saveBehavior='ready';calls.length=0;settings=fixture();await act(async()=>{renderer=TestRenderer.create(React.createElement(LoginServiceSettings));});};

 for(const mode of ['failure','missing','wrong-type','secret-leak']){
  await mountSettings(mode);assert.equal(button('保存登录配置').props.disabled,true,mode+' must not enable saving');assert.ok(renderer.root.findAllByType('fieldset').every(node=>node.props.disabled));
  await click(button('保存登录配置'));assert.equal(calls.filter(call=>call.method==='PUT').length,0,'A blocked load must not overwrite existing configuration');
  assert.equal(byLabel('SMTP 密码或授权码').props.value,'');assert.ok(!text(renderer.root).includes('unexpected-unredacted-fixture'));
 }
 console.log('PASS failed, incomplete, mistyped and unredacted settings responses keep all edits and saving locked');

 await mountSettings('ready');assert.equal(button('保存登录配置').props.disabled,false);
 for(const label of ['短信 AccessKey ID','短信 AccessKey Secret','SMTP 密码或授权码','微信网站 AppSecret']){
  assert.equal(byLabel(label).props.value,'');assert.equal(byLabel(label).props.type,'password');assert.ok(byLabel(label).props.placeholder.includes('留空保留'));
 }
 await fill('发件名称','墨多多测试邮件');await click(button('保存登录配置'));
 let saved=calls.findLast(call=>call.method==='PUT').body;
 assert.equal(saved.email.password,'');assert.equal(settings.email.password,'fixture-smtp-private');assert.equal(settings.phone.accessKeySecret,'fixture-sms-private');assert.equal(settings.wechat.appSecret,'fixture-wechat-private');
 await fill('SMTP 密码或授权码','fixture-replacement-password');await click(button('保存登录配置'));assert.equal(settings.email.password,'fixture-replacement-password');assert.equal(byLabel('SMTP 密码或授权码').props.value,'','A successful redacted response must discard the entered secret');
 await fill('SMTP 密码或授权码','');await click(button('保存登录配置'));assert.equal(settings.email.password,'fixture-replacement-password');
 await checkByText('清除已保存的 SMTP 密码');await click(button('保存登录配置'));saved=calls.findLast(call=>call.method==='PUT').body;assert.equal(saved.email.clearPassword,true);assert.equal(settings.email.password,'');assert.equal(byLabel('SMTP 密码或授权码').props.placeholder,'');
 await checkByText('清除已保存的短信 AccessKey ID');await checkByText('清除已保存的短信 AccessKey Secret');await checkByText('清除已保存的微信 AppSecret');await click(button('保存登录配置'));
 assert.equal(settings.phone.accessKeyId,'');assert.equal(settings.phone.accessKeySecret,'');assert.equal(settings.wechat.appSecret,'');
 assert.ok(calls.every(call=>call.url==='/api/auth/settings'),'Loading, changing and saving service configuration must never send a verification or start OAuth');
 assert.ok(text(renderer.root).includes('保存不会发送短信、邮件或发起微信授权'));
 console.log('PASS blank secret retention, redacted replacement, explicit clearing and config-only saves without delivery or OAuth requests');

 behavior='failure';await click(button('重新载入登录配置'));assert.equal(button('保存登录配置').props.disabled,true);const before=calls.filter(call=>call.method==='PUT').length;await click(button('保存登录配置'));assert.equal(calls.filter(call=>call.method==='PUT').length,before);
 behavior='ready';await click(button('重新载入登录配置'));assert.equal(button('保存登录配置').props.disabled,false);saveBehavior='malformed';await click(button('保存登录配置'));assert.ok(!text(renderer.root).includes('登录配置已保存。'));assert.ok(text(renderer.root).includes('登录配置保存结果无法确认'));
 console.log('PASS reload failures revoke readiness and malformed save acknowledgements cannot claim configuration success');

 await unmount();behavior='ready';saveBehavior='ready';calls.length=0;refreshUser='alice';refreshes=0;identities=[{id:'fixture-email',provider:'email',masked:'a***@example.com'}];
 const account={ready:true,configured:true,spaceId:'alice',user:user('alice'),refresh:async()=>{refreshes++;return {configured:true,spaceId:refreshUser,user:user(refreshUser)};}};
 const mountAccount=async()=>{await act(async()=>{renderer=TestRenderer.create(React.createElement(AccountContext.Provider,{value:account},React.createElement(AccountAccess)));});};
 await mountAccount();assert.equal(calls.length,0);await click(byLabel('管理登录方式'));assert.equal(calls.filter(call=>call.url==='/api/auth/identities').length,1);assert.ok(text(renderer.root).includes('a***@example.com'));assert.ok(!text(renderer.root).includes('author@example.com'));
 await click(button('绑定登录方式'));assert.equal(calls.filter(call=>call.url==='/api/auth/methods').length,1);assert.ok(renderer.root.findByProps({'aria-label':'绑定登录方式'}));
 await fill('登录手机号','13800138000');await click(byLabel('获取登录验证码'));await fill('登录验证码','123456');await act(async()=>renderer.root.findByType('form').props.onSubmit({preventDefault(){}}));
 const request=calls.findLast(call=>call.url==='/api/auth/identities/code/bind');assert.equal(request.body.target,'+8613800138000');assert.equal(refreshes,1);assert.equal(account.user.id,'alice');assert.equal(calls.filter(call=>call.url==='/api/auth/identities').length,2);assert.ok(text(renderer.root).includes('+86 138****8000'));assert.equal(renderer.root.findAllByProps({'aria-label':'绑定登录方式'}).length,0);assert.ok(!calls.some(call=>['/api/auth/login','/api/auth/code/login','/api/auth/register'].includes(call.url)));
 console.log('PASS identity management is opt-in, shows masked data and returns to a refreshed list after binding without changing the account or logging in again');

 await click(button('绑定登录方式'));refreshUser='bob';await fill('登录手机号','13900139000');await click(byLabel('获取登录验证码'));await fill('登录验证码','123456');const identityReads=calls.filter(call=>call.url==='/api/auth/identities').length;
 await act(async()=>renderer.root.findByType('form').props.onSubmit({preventDefault(){}}));assert.equal(calls.filter(call=>call.url==='/api/auth/identities').length,identityReads);assert.ok(text(renderer.root).includes('账号状态暂未确认'));assert.ok(renderer.root.findByProps({'aria-label':'绑定登录方式'}));assert.equal(account.user.id,'alice');
 await unmount();calls.length=0;holdIdentities=true;await mountAccount();await click(byLabel('管理登录方式'));assert.equal(typeof releaseIdentities,'function');await click(byLabel('管理登录方式'));releaseIdentities();await act(async()=>{await Promise.resolve();await Promise.resolve();});assert.equal(renderer.root.findAllByProps({'aria-label':'登录方式管理'}).length,0);
 console.log('PASS a changed account cannot report a binding handoff as successful, and a late identity-list response cannot reopen a closed manager');
}finally{
 if(renderer)await act(async()=>renderer.unmount());await vite.close();
 for(const [key,value]of Object.entries(original)){if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];}
}
