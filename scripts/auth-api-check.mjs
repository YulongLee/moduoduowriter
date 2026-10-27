import assert from 'node:assert/strict';
import {mkdtemp,rm,stat,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer,request} from 'node:http';
import {createApi} from '../server/api.mjs';
import {createLoginFlows} from '../server/login-flows.mjs';

const directory=await mkdtemp(join(tmpdir(),'mdd-auth-api-')),origin='https://writer.example.com';
const messages=[],upstream=[];let failDelivery=false;
const mailTransport=()=>({async sendMail(message){if(failDelivery){failDelivery=false;throw Error('fixture-secret-provider-error');}messages.push({channel:'email',target:message.envelope.to[0],code:message.text.match(/\d{6}/)[0]});return {accepted:message.envelope.to};},close(){}});
const fetchImpl=async(value,options)=>{
 const url=new URL(value);upstream.push(url.hostname);
 if(url.hostname==='dysmsapi.aliyuncs.com'){if(failDelivery){failDelivery=false;return Response.json({Code:'FAIL',Message:'fixture-secret-provider-error'});}messages.push({channel:'phone',target:url.searchParams.get('PhoneNumbers'),code:JSON.parse(url.searchParams.get('TemplateParam')).code});return Response.json({Code:'OK'});}
 if(url.hostname==='api.weixin.qq.com')return Response.json({access_token:'fixture-private-oauth-token',openid:url.searchParams.get('code')==='owner-code'?'owner-openid':'author-openid',unionid:'not-an-account-link'});
 throw Error('Unexpected provider fixture');
};
const api=createApi({directory,fetchImpl,mailTransport,publicOrigin:origin}),server=createServer(api);
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port,cookie=response=>response.headers.get('set-cookie')?.split(';')[0]||'';
const call=async(path,body,{session='',host='writer.example.com',requestOrigin=origin,method=body===undefined?'GET':'POST',space}={})=>{
 return new Promise((resolve,reject)=>{const req=request(base+path,{method,headers:{Host:host,'Content-Type':'application/json','X-Mdd-Client':'workspace-v1',...(requestOrigin?{Origin:requestOrigin}:{}),...(session?{Cookie:session}:{}),...(space?{'X-Mdd-Space':space}:{})}},response=>{const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>{const text=Buffer.concat(chunks).toString('utf8');let data;try{data=JSON.parse(text);}catch{data=text;}resolve({status:response.statusCode,data,response:{headers:new Headers(response.headers)}});});});req.on('error',reject);req.end(body===undefined?undefined:JSON.stringify(body));});
};
const sendCode=async(channel,target,options={},binding=false)=>{const result=await call(binding?'/api/auth/identities/code/send':'/api/auth/code/send',{channel,target},options);assert.equal(result.status,200);assert.deepEqual(Object.keys(result.data).sort(),['challengeId','expiresAt','retryAfter']);const message=messages.at(-1);assert.equal(message.channel,channel);return {...result.data,channel,target,code:message.code};};
const config={phone:{enabled:true,accessKeyId:'fixtureAccessKeyId',accessKeySecret:'fixture-phone-secret',signName:'墨多多测试',templateCode:'SMS_123456',codeParam:'code'},email:{enabled:true,host:'smtp.example.com',port:465,secure:true,user:'fixture-user',password:'fixture-mail-secret',from:'writer@example.com',fromName:'墨多多'},wechat:{enabled:true,appId:'wx1234567890abcdef',appSecret:'fixture-wechat-secret',redirectUri:origin+'/api/auth/wechat/callback'}};
try{
 assert.throws(()=>createApi({directory:join(directory,'invalid-origin'),publicOrigin:'http://localhost:5173'}));
 let result=await call('/api/auth/methods');assert.equal(result.status,200,JSON.stringify(result.data));assert.equal(result.data.ownerConfigured,false);assert.equal(result.data.phone.available,false);
 assert.equal((await call('/api/auth/code/send',{channel:'phone',target:'13800138000'})).status,503);assert.equal(upstream.length,0);
 assert.equal((await call('/api/auth/settings',config,{method:'PUT'})).status,401);
 const registered=await call('/api/auth/register',{username:'fixture_owner',password:'fixture-owner-password'});assert.equal(registered.status,200);const owner=cookie(registered.response);assert.ok(owner);assert.ok(registered.response.headers.get('set-cookie').includes('Secure'));assert.equal(registered.data.user.role,'admin');
 result=await call('/api/auth/settings',config,{session:owner,method:'PUT'});assert.equal(result.status,200);assert.equal(result.data.phone.accessKeyId,'');assert.equal(result.data.phone.hasAccessKeySecret,true);assert.ok(!JSON.stringify(result.data).includes('fixture-phone-secret'));assert.equal(upstream.length,0,'Saving settings must never send any message');
 result=await call('/api/auth/methods');assert.equal(result.data.phone.available,true);assert.equal(result.data.email.available,true);assert.equal(result.data.wechat.available,true);assert.ok(!JSON.stringify(result.data).includes('fixture-'));
 const localHost=new URL(base).host;
 result=await call('/api/auth/methods',undefined,{host:localHost,requestOrigin:base});assert.equal(result.data.wechat.available,false,'Local callbacks are never advertised as ready');assert.equal(result.data.phone.available,true);
 assert.equal((await call('/api/auth/code/send',{channel:'phone',target:'13800138000'},{requestOrigin:'https://attacker.example'})).status,403);
 assert.equal((await call('/api/auth/settings',config,{session:owner,space:'someone-else',method:'PUT'})).status,412);
 assert.equal((await call('/api/auth/settings',{email:{host:'127.0.0.1'}},{session:owner,method:'PUT'})).status,400);
 console.log('PASS disabled defaults, owner bootstrap, redacted admin settings, explicit deployment origin and no-send configuration');

 const phone=await sendCode('phone','13800138000');assert.equal((await call('/api/auth/code/send',{channel:'phone',target:phone.target})).status,429);
 const wrong=phone.code[0]==='9'?'0'+phone.code.slice(1):String(Number(phone.code[0])+1)+phone.code.slice(1);
 assert.notEqual((await call('/api/auth/code/login',{...phone,code:wrong})).status,200);
 result=await call('/api/auth/code/login',phone);assert.equal(result.status,200);const phoneSession=cookie(result.response),phoneUser=result.data.user;
 assert.equal(phoneUser.role,'author');assert.equal(phoneUser.hasPassword,false);assert.notEqual(phoneUser.id,'local');assert.ok(!JSON.stringify(phoneUser).includes(phone.target));
 assert.notEqual((await call('/api/auth/code/login',phone)).status,200);
 assert.equal((await call('/api/auth/settings',undefined,{session:phoneSession})).status,403);
 const email=await sendCode('email','reader@example.com');result=await call('/api/auth/code/login',email);assert.equal(result.status,200);assert.notEqual(result.data.user.id,phoneUser.id);
 const bound=await sendCode('email','owner@example.com',{session:owner},true);
 assert.notEqual((await call('/api/auth/code/login',bound)).status,200,'A bind challenge cannot be used to sign in');
 assert.notEqual((await call('/api/auth/identities/code/bind',bound,{session:phoneSession})).status,200,'A bind challenge belongs to its authenticated owner');
 result=await call('/api/auth/identities/code/bind',bound,{session:owner});assert.equal(result.status,200);assert.equal(result.data.bound,true);assert.equal(result.data.user.id,'local');
 result=await call('/api/auth/identities',undefined,{session:owner});assert.equal(result.data.identities.length,1);assert.ok(!JSON.stringify(result.data).includes('owner@example.com'));
 failDelivery=true;result=await call('/api/auth/code/send',{channel:'email',target:'failure@example.com'});assert.equal(result.status,502);assert.ok(!JSON.stringify(result.data).includes('fixture-secret'));
 console.log('PASS phone/email verification, replay/cooldown defenses, author isolation, explicit account linking and sanitized delivery failures');

 const start=async(purpose='login',session='')=>{const value=await call('/api/auth/wechat/start',{purpose},{session});assert.equal(value.status,200);return {...value.data,browser:cookie(value.response),state:new URL(value.data.authorizationUrl).searchParams.get('state')};};
 const poll=flow=>call('/api/auth/wechat/status',{requestId:flow.requestId,pollToken:flow.pollToken},{session:flow.browser});
 const callback=(flow,code,session=flow.browser)=>call('/api/auth/wechat/callback?state='+encodeURIComponent(flow.state)+'&code='+code,undefined,{session,requestOrigin:''});
 const flow=await start();assert.ok(flow.authorizationUrl.startsWith('https://open.weixin.qq.com/connect/qrconnect?'));assert.ok(flow.openUrl);assert.equal((await poll(flow)).data.status,'waiting');
 const before=upstream.length;assert.equal((await callback(flow,'author-code','mdd_login_browser='+'a'.repeat(64))).status,400);assert.equal(upstream.length,before);
 result=await callback(flow,'author-code');assert.equal(result.status,200);assert.equal(cookie(result.response),'','Callback must never directly issue a login session');assert.ok(!result.data.includes('author-openid'));assert.equal((await poll(flow)).data.status,'approved');
 assert.equal((await callback(flow,'author-code')).status,400);assert.equal(upstream.length,before+1,'The same OAuth state must never exchange a second code');
 assert.equal((await call('/api/auth/wechat/consume',{requestId:flow.requestId,pollToken:'wrong'},{session:flow.browser})).status,404);
 result=await call('/api/auth/wechat/consume',{requestId:flow.requestId,pollToken:flow.pollToken},{session:flow.browser});assert.equal(result.status,200);assert.equal(result.data.user.role,'author');assert.ok(cookie(result.response));assert.ok(!JSON.stringify(result.data).includes('openid'));assert.ok(!JSON.stringify(result.data).includes('fixture-private-oauth-token'));
 assert.equal((await call('/api/auth/wechat/consume',{requestId:flow.requestId,pollToken:flow.pollToken},{session:flow.browser})).status,409);
 const cancel=await start();assert.equal((await call('/api/auth/wechat/cancel',{requestId:cancel.requestId,pollToken:cancel.pollToken},{session:cancel.browser})).status,200);assert.equal((await callback(cancel,'author-code')).status,400);
 const bindingFlow=await start('bind',owner);assert.equal((await callback(bindingFlow,'owner-code')).status,200);
 assert.equal((await call('/api/auth/wechat/consume',{requestId:bindingFlow.requestId,pollToken:bindingFlow.pollToken},{session:bindingFlow.browser+'; '+phoneSession})).status,403);
 assert.equal((await call('/api/auth/wechat/consume',{requestId:bindingFlow.requestId,pollToken:bindingFlow.pollToken},{session:bindingFlow.browser+'; '+owner,space:'wrong-space'})).status,412);assert.equal((await poll(bindingFlow)).data.status,'approved','A rejected space check must not consume a valid binding flow');
 result=await call('/api/auth/wechat/consume',{requestId:bindingFlow.requestId,pollToken:bindingFlow.pollToken},{session:bindingFlow.browser+'; '+owner});assert.equal(result.status,200);assert.equal(result.data.bound,true);assert.equal(result.data.user.id,'local');assert.equal(cookie(result.response),'','Binding never replaces the active session');
 console.log('PASS browser-bound WeChat state, fixed callback exchange, separate one-time consumption, cancellation and authenticated binding');

 for(const name of ['auth.json','auth-pepper','auth-flow-key','studio.sqlite','login-flows.sqlite'])assert.equal((await stat(join(directory,name))).mode&0o777,0o600);
 const bytes=await readFile(join(directory,'login-flows.sqlite'));assert.ok(!bytes.includes(Buffer.from('author-openid')));assert.ok(!bytes.includes(Buffer.from(flow.pollToken)));
 const flowDirectory=join(directory,'flow-clock');let now=1000;let flows=createLoginFlows(flowDirectory,{now:()=>now});
 const original=flows.begin({browserToken:'b'.repeat(64),requester:'fixture',appId:'fixture-app'});flows.close();flows=createLoginFlows(flowDirectory,{now:()=>now});
 assert.equal(flows.status({...original,browserToken:'b'.repeat(64)}).status,'waiting');
 const approved=flows.begin({browserToken:'c'.repeat(64),requester:'another-fixture',appId:'fixture-app'});flows.claimCallback({state:approved.state,browserToken:'c'.repeat(64),appId:'fixture-app'});flows.approve(approved.requestId,{appid:'fixture-app',openid:'encrypted-fixture-identity'});flows.close();flows=createLoginFlows(flowDirectory,{now:()=>now});
 assert.throws(()=>flows.consume({...approved,browserToken:'c'.repeat(64),appId:'different-app'}));assert.equal(flows.status({...approved,browserToken:'c'.repeat(64)}).status,'approved');assert.equal(flows.consume({...approved,browserToken:'c'.repeat(64),appId:'fixture-app'}).identity.openid,'encrypted-fixture-identity');
 now+=300001;assert.equal(flows.status({...original,browserToken:'b'.repeat(64)}).status,'expired');assert.throws(()=>flows.claimCallback({state:original.state,browserToken:'b'.repeat(64),appId:'fixture-app'}));flows.close();
 console.log('PASS private file permissions, encrypted OAuth identity, hashed secrets and restart/expiry without live credentials or providers');
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));api.close();await rm(directory,{recursive:true,force:true});}
