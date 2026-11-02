import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {request} from 'node:http';
import {runInNewContext} from 'node:vm';
import {createProductionServer} from '../server/http.mjs';
import {createStore} from '../server/store.mjs';
import {validateAuthConfig} from '../server/auth-providers.mjs';

// Temporary production HTTP server and controlled OAuth replies only. No live
// platform account, browser session, provider credentials or deliveries are used.
const directory=await mkdtemp(join(tmpdir(),'mdd-wechat-callback-')),dist=join(directory,'dist'),data=join(directory,'data');
const origin='https://writer.example.test',callbackPath='/api/auth/wechat/callback';
const config=validateAuthConfig({wechat:{enabled:true,appId:'wx1234567890abcdef',appSecret:'fixture-callback-secret',redirectUri:origin+callbackPath}});
let server,exchanges=0;
const fetchImpl=async value=>{
 const url=new URL(value);assert.equal(url.origin,'https://api.weixin.qq.com');assert.equal(url.pathname,'/sns/oauth2/access_token');exchanges++;
 return url.searchParams.get('code')==='provider-failure'?Response.json({errcode:40029,errmsg:'fixture-upstream-detail'}):Response.json({access_token:'fixture-upstream-token',openid:'fixture-verified-openid'});
};
const call=(path,{body,cookie='',method=body===undefined?'GET':'POST',requestOrigin=origin,client=true}={})=>new Promise((resolve,reject)=>{
 const req=request({hostname:'127.0.0.1',port:server.address().port,path,method,headers:{Host:'writer.example.test','Content-Type':'application/json',...(requestOrigin?{Origin:requestOrigin}:{}),...(client?{'X-Mdd-Client':'workspace-v1'}:{}),...(cookie?{Cookie:cookie}:{})}},res=>{
  const chunks=[];res.on('data',part=>chunks.push(part));res.on('end',()=>{const text=Buffer.concat(chunks).toString('utf8');let json;try{json=JSON.parse(text);}catch{}resolve({status:res.statusCode,headers:res.headers,text,json});});
 });req.on('error',reject);req.end(body===undefined?undefined:JSON.stringify(body));
});
const callbackUrl=(flow,code)=>callbackPath+'?'+new URLSearchParams({state:flow.state,...(code===undefined?{}:{code})});
const start=async()=>{
 const result=await call('/api/auth/wechat/start',{body:{}});assert.equal(result.status,200);
 const raw=result.headers['set-cookie'][0];for(const flag of ['HttpOnly','SameSite=Lax','Secure','Path=/api/auth'])assert.ok(raw.includes(flag));
 return {...result.json,cookie:raw.split(';')[0],state:new URL(result.json.authorizationUrl).searchParams.get('state')};
};
const poll=async flow=>(await call('/api/auth/wechat/status',{body:{requestId:flow.requestId,pollToken:flow.pollToken},cookie:flow.cookie})).json.status;
const bridgeScript=response=>{
 const match=response.text.match(/<script nonce="([A-Za-z0-9_-]+)">([\s\S]*?)<\/script>/);assert.ok(match);
 const policy=response.headers['content-security-policy'];assert.ok(policy.includes("script-src 'nonce-"+match[1]+"'"));assert.ok(policy.includes("connect-src 'self'"));assert.ok(policy.includes("frame-ancestors 'self'"));assert.ok(!policy.includes("script-src 'self'"),'The production default CSP must be replaced by the callback nonce policy');
 assert.equal(response.headers['cache-control'],'no-store');assert.equal(response.headers['referrer-policy'],'no-referrer');assert.equal(response.headers['x-frame-options'],'SAMEORIGIN');
 assert.equal(response.headers['set-cookie'],undefined);assert.match(response.text,/正在安全确认微信登录/);
 return match[2];
};
const executeBridge=async(response,flow,code)=>{
 const script=bridgeScript(response),nodes={status:{textContent:''},detail:{textContent:''}},historyCalls=[];let posts=0;
 await runInNewContext(script,{URLSearchParams,AbortController,setTimeout,clearTimeout,location:{search:'?'+new URLSearchParams({state:flow.state,...(code===undefined?{}:{code})}),pathname:callbackPath},history:{replaceState(...args){historyCalls.push(args);}},document:{getElementById:id=>nodes[id]},fetch:async(path,options)=>{
  assert.equal(path,callbackPath);assert.equal(options.method,'POST');assert.equal(options.credentials,'same-origin');assert.equal(options.redirect,'error');assert.equal(options.headers['X-Mdd-Client'],'workspace-v1');posts++;
  const result=await call(path,{body:JSON.parse(options.body),cookie:flow.cookie});return {ok:result.status===200,json:async()=>result.json};
 }},{timeout:1000});
 assert.equal(posts,1);assert.deepEqual(historyCalls,[[null,'',callbackPath]]);return nodes.status.textContent;
};
try{
 await mkdir(dist,{recursive:true});await writeFile(join(dist,'index.html'),'<!doctype html><html><body>Fixture only</body></html>');
 const store=createStore(data),owner=await store.register('fixture_callback_admin','fixture-callback-password');store.close();
 await writeFile(join(data,'auth.json'),JSON.stringify(config),{mode:0o600});
 server=await createProductionServer({directory:data,distDirectory:dist,publicOrigin:origin,fetchImpl});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));

 const flow=await start();
 const response=await call(callbackUrl(flow,'bridge-success'),{requestOrigin:'',client:false});assert.equal(response.status,200);bridgeScript(response);
 assert.equal(await poll(flow),'waiting');assert.equal(exchanges,0,'A cookie-free iframe GET must never confirm an identity');
 const malicious='</script><script>fixture-injected-script</script>',injected=await call(callbackUrl(flow,malicious),{requestOrigin:'',client:false});assert.equal(injected.status,200);assert.ok(!injected.text.includes('fixture-injected-script'));bridgeScript(injected);
 const payload={state:flow.state,code:'bridge-success'};
 for(const options of [{},{cookie:'mdd_login_browser='+'f'.repeat(64)},{cookie:flow.cookie,body:{...payload,state:'nonexistent_state_12345678901234567890'}}]){
  assert.equal((await call(callbackPath,{body:payload,...options})).status,400);
 }
 assert.equal((await call(callbackPath,{body:payload,cookie:flow.cookie,client:false})).status,403);
 assert.equal((await call(callbackPath,{body:payload,cookie:flow.cookie,requestOrigin:'https://attacker.example.test'})).status,403);
 assert.equal(exchanges,0);assert.equal(await poll(flow),'waiting');
 assert.equal(await executeBridge(response,flow,'bridge-success'),'微信身份已确认');assert.equal(exchanges,1);assert.equal(await poll(flow),'approved');
 assert.equal((await call(callbackPath,{body:payload,cookie:flow.cookie})).status,400);assert.equal(exchanges,1,'A callback cannot exchange twice');
 const consumed=await call('/api/auth/wechat/consume',{body:{requestId:flow.requestId,pollToken:flow.pollToken},cookie:flow.cookie});assert.equal(consumed.status,200);assert.equal(consumed.json.user.role,'author');
 assert.ok(consumed.headers['set-cookie'][0].includes('SameSite=Strict'));assert.ok(consumed.headers['set-cookie'][0].includes('Secure'));
 assert.ok(!JSON.stringify(consumed.json).includes('fixture-verified-openid'));
 console.log('PASS production iframe callback bridge executes a protected same-origin POST with exact CSP nonce, no parameter interpolation, preserved Lax browser binding and Strict login session');

 const direct=await start(),beforeDirect=exchanges;
 const directResult=await call(callbackUrl(direct,'direct-success'),{cookie:direct.cookie,requestOrigin:'',client:false});assert.equal(directResult.status,200);assert.match(directResult.text,/微信身份已确认/);assert.ok(!directResult.text.includes('<script'));assert.equal(await poll(direct),'approved');assert.equal(exchanges,beforeDirect+1);
 const cancelled=await start(),beforeCancel=exchanges,cancelPage=await call(callbackUrl(cancelled),{requestOrigin:'',client:false});assert.equal(cancelPage.status,200);
 assert.equal(await executeBridge(cancelPage,cancelled),'微信登录未完成');assert.equal(await poll(cancelled),'failed');assert.equal(exchanges,beforeCancel,'OAuth denial must not reach the provider');
 const failed=await start(),beforeFailure=exchanges,failedResult=await call(callbackUrl(failed,'provider-failure'),{cookie:failed.cookie,requestOrigin:'',client:false});assert.equal(failedResult.status,400);assert.equal(await poll(failed),'failed');assert.equal(exchanges,beforeFailure+1);assert.ok(!failedResult.text.includes('fixture-upstream-detail'));
 assert.equal((await call(callbackUrl(failed,'provider-failure'),{cookie:failed.cookie,requestOrigin:'',client:false})).status,400);assert.equal(exchanges,beforeFailure+1);
 console.log('PASS existing top-level GET callback stays functional; OAuth cancellation/failure are terminal, sanitized and never replayed');

 const ownerCookie='mdd_session='+owner.token;
 const changed=await call('/api/auth/settings',{method:'PUT',cookie:ownerCookie,body:{wechat:{redirectUri:'https://different.example.test'+callbackPath}}});assert.equal(changed.status,200);
 const methods=await call('/api/auth/methods');assert.equal(methods.json.wechat.configured,true);assert.equal(methods.json.wechat.available,false);
 const beforeMismatch=exchanges;assert.equal((await call('/api/auth/wechat/start',{body:{}})).status,503);assert.equal(exchanges,beforeMismatch);
 assert.equal((await call('/api/auth/settings',{method:'PUT',cookie:ownerCookie,body:{wechat:{redirectUri:origin+callbackPath}}})).status,200);
 assert.equal((await call('/api/auth/methods')).json.wechat.available,true);
 console.log('PASS complete WeChat credentials remain unavailable when the callback domain differs from the production origin');
}finally{if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}await rm(directory,{recursive:true,force:true});}
