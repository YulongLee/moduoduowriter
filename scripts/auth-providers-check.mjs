import assert from 'node:assert/strict';
import {createAuthProviders,defaultAuthConfig,validateAuthConfig,publicAuthConfig,authMethods,signAliyunRequest,wechatAuthorizationUrl} from '../server/auth-providers.mjs';

// Provider behavior is exercised with controlled responses only; no real OTP is sent.
const settings=validateAuthConfig({
 phone:{enabled:true,accessKeyId:'fixtureAccessKeyId',accessKeySecret:'fixture-sms-secret',signName:'墨多多',templateCode:'SMS_123456',codeParam:'code'},
 email:{enabled:true,host:'smtp.example.test',port:465,secure:true,user:'sender@example.test',password:'fixture-smtp-secret',from:'sender@example.test',fromName:'墨多多'},
 wechat:{enabled:true,appId:'wx1234567890abcdef',appSecret:'fixture-wechat-secret',redirectUri:'https://writer.example.test/api/auth/wechat/callback'}
});
assert.ok(Object.values(authMethods(defaultAuthConfig)).every(value=>!value.enabled&&!value.available));
assert.equal(authMethods({phone:{enabled:true}}).phone.available,false);
assert.ok(Object.values(authMethods(settings)).every(value=>value.enabled&&value.available));
const redacted=publicAuthConfig(settings);
for(const sensitive of ['fixtureAccessKeyId','fixture-sms-secret','fixture-smtp-secret','fixture-wechat-secret'])assert.ok(!JSON.stringify(redacted).includes(sensitive));
assert.equal(redacted.phone.hasAccessKeyId,true);assert.equal(redacted.email.hasPassword,true);assert.equal(redacted.wechat.hasAppSecret,true);
assert.deepEqual(validateAuthConfig(redacted,settings),settings,'Blank admin fields preserve existing secrets');
assert.equal(validateAuthConfig({phone:{clearAccessKeySecret:true}},settings).phone.accessKeySecret,'');
assert.equal(validateAuthConfig({email:{clearPassword:true}},settings).email.password,'');
assert.equal(validateAuthConfig({wechat:{clearAppSecret:true}},settings).wechat.appSecret,'');
for(const bad of [
 {phone:{enabled:'true'}},{phone:{templateCode:'not-a-template'}},{phone:{codeParam:'code\nInjected'}},
 {email:{host:'localhost'}},{email:{host:'127.0.0.1'}},{email:{host:'https://smtp.example.test'}},{email:{from:'sender@example.test\r\nBcc:x@example.test'}},{email:{port:465,secure:false}},
 {wechat:{appId:'invalid'}},{wechat:{redirectUri:'http://writer.example.test/api/auth/wechat/callback'}},{wechat:{redirectUri:'https://127.0.0.1/api/auth/wechat/callback'}},{wechat:{redirectUri:'https://writer.example.test/api/auth/wechat/callback?next=https://evil.example'}},{wechat:{redirectUri:'https://writer.example.test/other'}}
])assert.throws(()=>validateAuthConfig(bad,settings));
console.log('PASS disabled defaults, explicit readiness, redacted admin configuration, secret retention/clear and invalid host/header/redirect rejection');

// Fixed non-secret example from Alibaba Cloud's official ACS3 reference.
const signature=signAliyunRequest({accessKeyId:'YourAccessKeyId',accessKeySecret:'YourAccessKeySecret',host:'ecs.cn-shanghai.aliyuncs.com',action:'RunInstances',version:'2014-05-26',query:{ImageId:'win2019_1809_x64_dtc_zh-cn_40G_alibase_20230811.vhd',RegionId:'cn-shanghai'},date:'2023-10-26T10:22:32Z',nonce:'3156853299f313e23d1673dc12e1703d'});
assert.equal(signature.stringToSign,'ACS3-HMAC-SHA256\n7ea06492da5221eba5297e897ce16e55f964061054b7695beedaac1145b1e259');
assert.equal(signature.signature,'06563a9e1b43f5dfe96b81484da74bceab24a1d853912eee15083a6f0f3283c0');
const encoded=signAliyunRequest({accessKeyId:'fixtureAccessKeyId',accessKeySecret:'fixture-secret',host:'dysmsapi.aliyuncs.com',action:'SendSms',version:'2017-05-25',query:{SignName:'墨多多! 写作',TemplateParam:'{"code":"123456"}'},date:'2026-10-28T00:00:00Z',nonce:'fixture-nonce'});
assert.ok(encoded.url.includes('%21%20'));assert.ok(!encoded.url.includes('+'));
let requests=[];
const sms=createAuthProviders({now:()=>new Date('2026-10-28T00:00:00Z'),nonce:()=> 'fixture-nonce',fetchImpl:async(url,options)=>{requests.push({url,options});return Response.json({Code:'OK',RequestId:'fixture-request'});}});
assert.deepEqual(await sms.sendCode(settings,{channel:'phone',target:'+8613900001234',code:'123456'}),{accepted:true});
const smsRequest=requests[0],smsURL=new URL(smsRequest.url);
assert.equal(smsURL.origin,'https://dysmsapi.aliyuncs.com');assert.equal(smsURL.searchParams.get('PhoneNumbers'),'13900001234');assert.deepEqual(JSON.parse(smsURL.searchParams.get('TemplateParam')),{code:'123456'});
assert.equal(smsRequest.options.redirect,'error');assert.equal(smsRequest.options.headers['x-acs-action'],'SendSms');assert.ok(smsRequest.options.headers.Authorization.startsWith('ACS3-HMAC-SHA256 Credential='));
for(const [channel,target,code]of [['phone','not-phone','123456'],['email','bad-mail','123456'],['phone','13900001234','12345']])await assert.rejects(()=>sms.sendCode(settings,{channel,target,code}),/参数/);
await assert.rejects(()=>sms.sendCode(defaultAuthConfig,{channel:'phone',target:'13900001234',code:'123456'}),/暂未开放/);assert.equal(requests.length,1);
const rejectedSMS=createAuthProviders({fetchImpl:async()=>Response.json({Code:'isv.FORBIDDEN',Message:'fixture-sms-secret should never escape'})});
await assert.rejects(()=>rejectedSMS.sendCode(settings,{channel:'phone',target:'13900001234',code:'123456'}),error=>error.status===502&&!error.message.includes('fixture-sms-secret'));
console.log('PASS official ACS3 signature vector, RFC3986 encoding, fixed SMS endpoint/action, disabled no-send and sanitized provider rejection');

let mailOptions,message,closed=0;
const email=createAuthProviders({mailTransport:async options=>{mailOptions=options;return {async sendMail(value){message=value;return {accepted:[value.to],rejected:[]};},close(){closed++;}};}});
assert.deepEqual(await email.sendCode(settings,{channel:'email',target:'reader@example.test',code:'654321'}),{accepted:true});
assert.equal(mailOptions.secure,true);assert.equal(mailOptions.tls.rejectUnauthorized,true);assert.equal(mailOptions.tls.minVersion,'TLSv1.2');assert.equal(mailOptions.logger,false);assert.equal(mailOptions.debug,false);assert.equal(mailOptions.disableFileAccess,true);assert.equal(mailOptions.disableUrlAccess,true);
assert.equal(message.to,'reader@example.test');assert.ok(message.text.includes('654321'));assert.equal(message.subject,'墨多多登录验证码');assert.deepEqual(message.envelope,{from:'sender@example.test',to:['reader@example.test']});assert.equal(closed,1);
await email.sendCode(validateAuthConfig({email:{port:587,secure:false}},settings),{channel:'email',target:'reader@example.test',code:'654321'});assert.equal(mailOptions.requireTLS,true);
const rejectedEmail=createAuthProviders({mailTransport:()=>({sendMail:async()=>({accepted:[],rejected:['reader@example.test']})})});
await assert.rejects(()=>rejectedEmail.sendCode(settings,{channel:'email',target:'reader@example.test',code:'654321'}),error=>error.status===502&&!error.message.includes('reader@'));
const unconfirmedEmail=createAuthProviders({mailTransport:()=>({sendMail:async()=>({})})});
await assert.rejects(()=>unconfirmedEmail.sendCode(settings,{channel:'email',target:'reader@example.test',code:'654321'}),error=>error.status===502);
console.log('PASS SMTP TLS/STARTTLS enforcement, sender envelope, no diagnostics/file/URL access and rejected-recipient handling');

const state='fixtureState1234567890';
const authorization=new URL(wechatAuthorizationUrl(settings,state));
assert.equal(authorization.origin,'https://open.weixin.qq.com');assert.equal(authorization.pathname,'/connect/qrconnect');assert.equal(authorization.searchParams.get('scope'),'snsapi_login');assert.equal(authorization.searchParams.get('state'),state);assert.equal(authorization.searchParams.get('self_redirect'),'true');assert.equal(authorization.hash,'#wechat_redirect');assert.ok(!authorization.href.includes(settings.wechat.appSecret));
assert.equal(new URL(wechatAuthorizationUrl(settings,state,{embedded:false})).searchParams.has('self_redirect'),false);
assert.throws(()=>wechatAuthorizationUrl(settings,'too-short'));
let exchange;
const wechat=createAuthProviders({fetchImpl:async(url,options)=>{exchange={url:new URL(url),options};return Response.json({access_token:'fixture-private-token',refresh_token:'fixture-private-refresh',openid:'fixture-openid',unionid:'fixture-unionid',scope:'snsapi_login'});}});
const identity=await wechat.exchangeWechatCode(settings,'fixtureCode');
assert.deepEqual(identity,{appid:settings.wechat.appId,openid:'fixture-openid',unionid:'fixture-unionid'});assert.ok(!JSON.stringify(identity).includes('private-token'));
assert.equal(exchange.url.origin,'https://api.weixin.qq.com');assert.equal(exchange.url.pathname,'/sns/oauth2/access_token');assert.equal(exchange.url.searchParams.get('secret'),settings.wechat.appSecret);assert.equal(exchange.url.searchParams.get('grant_type'),'authorization_code');assert.equal(exchange.options.redirect,'error');
for(const upstream of [{errcode:40029,errmsg:'fixture-wechat-secret'}, {openid:'forged-without-token'}, {access_token:'token',openid:'bad\nidentity'}, {access_token:'token',openid:'valid',unionid:{bad:true}}]){
 const invalid=createAuthProviders({fetchImpl:async()=>Response.json(upstream)});
 await assert.rejects(()=>invalid.exchangeWechatCode(settings,'fixtureCode'),error=>error.status===502&&!error.message.includes('fixture-wechat-secret'));
}
console.log('PASS WeChat official iframe/standalone authorization URLs, server-side fixed-endpoint exchange and token/identity response bounds');

let timedSignal,timeoutClosed=0;
const timeoutSMS=createAuthProviders({timeoutMs:10,fetchImpl:async(url,options)=>{timedSignal=options.signal;return new Promise(()=>{});}});
await assert.rejects(()=>timeoutSMS.sendCode(settings,{channel:'phone',target:'13900001234',code:'123456'}),error=>error.status===502);assert.equal(timedSignal.aborted,true);
const timeoutEmail=createAuthProviders({timeoutMs:10,mailTransport:()=>({sendMail:()=>new Promise(()=>{}),close(){timeoutClosed++;}})});
await assert.rejects(()=>timeoutEmail.sendCode(settings,{channel:'email',target:'reader@example.test',code:'654321'}),error=>error.status===502);assert.equal(timeoutClosed,1);
const timeoutFactory=createAuthProviders({timeoutMs:10,mailTransport:()=>new Promise(()=>{})});
await assert.rejects(()=>timeoutFactory.sendCode(settings,{channel:'email',target:'reader@example.test',code:'654321'}),error=>error.status===502);
let finishLateFactory,lateSent=0,lateClosed=0;
const lateFactory=createAuthProviders({timeoutMs:10,mailTransport:()=>new Promise(resolve=>{finishLateFactory=resolve;})});
await assert.rejects(()=>lateFactory.sendCode(settings,{channel:'email',target:'reader@example.test',code:'654321'}),error=>error.status===502);
finishLateFactory({sendMail(){lateSent++;return Promise.resolve({accepted:['reader@example.test']});},close(){lateClosed++;}});
await new Promise(resolve=>setImmediate(resolve));assert.equal(lateSent,0);assert.equal(lateClosed,1);
const tooLarge=createAuthProviders({fetchImpl:async()=>Response.json({access_token:'x'.repeat(70000),openid:'fixture-openid'})});
await assert.rejects(()=>tooLarge.exchangeWechatCode(settings,'fixtureCode'),error=>error.status===502);
console.log('PASS bounded network/mail waits, abort/close cleanup and oversized upstream rejection without live provider calls');
