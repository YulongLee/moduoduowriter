import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer,request as httpRequest} from 'node:http';
import {Readable} from 'node:stream';
import {createApi} from '../server/api.mjs';
import {createStore} from '../server/store.mjs';

// Public-deployment boundaries, using only temporary stores and in-memory
// fixture providers. No deployment host, local workspace or credentials read.
const root=await mkdtemp(join(tmpdir(),'mdd-production-boundary-'));
const origin='https://writer.example.com',username='fixture_production_admin',password='fixture-production-password';
const handlers=[],servers=[];let providerCalls=0;
const provider=async()=>{providerCalls++;throw Error('No real provider may be invoked in this check');};
async function app(name,{initialized=true,trustLoopbackProxy=true}={}){
 const directory=join(root,name);
 if(initialized){const store=createStore(directory);await store.register(username,password);store.close();}
 const handler=createApi({directory,requireAccount:true,trustLoopbackProxy,publicOrigin:origin,fetchImpl:provider});handlers.push(handler);
 const server=createServer(handler);servers.push(server);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=server.address().port;
 const request=(path,{method='GET',body,headers={},cookie='',host='writer.example.com',requestOrigin=origin,client=true}={})=>new Promise((resolve,reject)=>{
  const req=httpRequest({host:'127.0.0.1',port,path,method,headers:{Host:host,'Content-Type':'application/json',...(client?{'X-Mdd-Client':'workspace-v1'}:{}),...(requestOrigin?{Origin:requestOrigin}:{}),...(cookie?{Cookie:cookie}:{}),...headers}},res=>{
   const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>{let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{data=null;}resolve({status:res.statusCode,headers:res.headers,data});});
  });req.on('error',reject);req.end(body===undefined?undefined:JSON.stringify(body));
 });
 const fake=async(path,{method='POST',body,headers={},remote='198.51.100.100'}={})=>{
  const req=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);Object.assign(req,{url:path,method,headers:{host:'writer.example.com',origin,'x-mdd-client':'workspace-v1',...headers},socket:{remoteAddress:remote}});
  let status,data,responseHeaders;const res={destroyed:false,writeHead(value,all){status=value;responseHeaders=all;},setHeader(key,value){responseHeaders={...responseHeaders,[key]:value};},end(raw){try{data=JSON.parse(raw);}catch{data=null;}}};
  await handler(req,res);return {status,data,headers:responseHeaders};
 };
 return {request,fake};
}
const loginBody=(correct=false)=>({username,password:correct?password:'fixture-wrong-password'});
try{
 const uninitialized=await app('empty',{initialized:false});
 for(const [path,method='GET',body] of [
  ['/api/auth/status'],['/api/auth/methods'],['/api/data'],['/api/settings'],['/api/oss/settings'],['/api/billing'],['/api/admin/overview'],
  ['/api/auth/register','POST',{username:'never_become_owner',password:'fixture-owner-password'}],
  ['/api/settings','PUT',{baseUrl:'https://fixture.example/v1',model:'fixture',apiKey:'fixture-private-secret'}],
  ['/api/data/works','PUT',{revision:0,data:[]}],
 ]){
  const result=await uninitialized.request(path,{method,body});assert.equal(result.status,503,path+' must fail closed before owner initialization');assert.ok(!JSON.stringify(result.data).includes('fixture-private-secret'));
 }
 assert.equal(providerCalls,0);console.log('PASS production empty stores reject first-owner registration, private reads and configuration writes without provider calls');

 const deployed=await app('deployed');
 for(const host of ['attacker.example','writer.example.com.attacker.example','writer.example.com:1234'])assert.equal((await deployed.request('/api/auth/status',{host})).status,403);
 assert.equal((await deployed.request('/api/auth/status',{host:'attacker.example',headers:{'X-Forwarded-Host':'writer.example.com'}})).status,403);
 assert.equal((await deployed.request('/api/auth/status',{requestOrigin:'https://attacker.example'})).status,403);
 assert.equal((await deployed.request('/api/auth/status',{requestOrigin:'http://writer.example.com'})).status,403);
 assert.equal((await deployed.request('/api/auth/login',{method:'POST',body:loginBody(true),client:false})).status,403);
 const logged=await deployed.request('/api/auth/login',{method:'POST',body:loginBody(true),headers:{'X-Real-IP':'203.0.113.100'}});assert.equal(logged.status,200);const rawCookie=logged.headers['set-cookie'][0],cookie=rawCookie.split(';')[0];
 for(const flag of ['HttpOnly','SameSite=Strict','Secure','Path=/api'])assert.ok(rawCookie.includes(flag));
 assert.equal(logged.data.token,undefined);assert.equal(logged.data.password_hash,undefined);
 const state=await deployed.request('/api/auth/status',{cookie});assert.equal(state.status,200);assert.equal(state.data.user.role,'admin');assert.equal(state.data.spaceId,state.data.user.id);
 const anonymous=await deployed.request('/api/auth/status');assert.equal(anonymous.data.user,null);assert.equal(anonymous.data.spaceId,null);assert.equal(anonymous.headers['cache-control'],'no-store');assert.equal(anonymous.headers['access-control-allow-origin'],undefined);
 assert.equal((await deployed.request('/api/settings')).status,401);assert.equal((await deployed.request('/api/data')).status,401);
 console.log('PASS exact deployment host/origin, non-forwarded Host checks, explicit client marker, Secure/HttpOnly sessions and anonymous data isolation');

 for(let index=0;index<5;index++)assert.equal((await deployed.request('/api/auth/login',{method:'POST',body:loginBody(),headers:{'X-Real-IP':'203.0.113.1'}})).status,401);
 assert.equal((await deployed.request('/api/auth/login',{method:'POST',body:loginBody(true),headers:{'X-Real-IP':'203.0.113.1'}})).status,429);
 assert.equal((await deployed.request('/api/auth/login',{method:'POST',body:loginBody(true),headers:{'X-Real-IP':'203.0.113.2'}})).status,200,'Independent verified proxy IPs must not share a global login lockout');
 assert.equal((await deployed.request('/api/auth/login',{method:'POST',body:loginBody(true),headers:{'X-Real-IP':'203.0.113.1','X-Forwarded-For':'203.0.113.200'}})).status,429,'X-Forwarded-For never overrides the trusted proxy header');
 for(let index=0;index<5;index++)assert.equal((await deployed.fake('/api/auth/login',{body:loginBody(),remote:'198.51.100.7',headers:{'x-real-ip':'203.0.113.'+(index+10)}})).status,401);
 assert.equal((await deployed.fake('/api/auth/login',{body:loginBody(true),remote:'198.51.100.7',headers:{'x-real-ip':'203.0.113.50'}})).status,429,'Non-loopback peers cannot choose their limiter identity');
 assert.equal((await deployed.fake('/api/auth/login',{body:loginBody(true),remote:'198.51.100.8',headers:{'x-real-ip':'203.0.113.50'}})).status,200);
 console.log('PASS explicitly trusted loopback proxy isolates real-client limits while rejecting XFF and non-loopback IP spoofing');

 const notTrusted=await app('proxy-disabled',{trustLoopbackProxy:false});
 for(let index=0;index<5;index++)assert.equal((await notTrusted.request('/api/auth/login',{method:'POST',body:loginBody(),headers:{'X-Real-IP':'203.0.113.'+(index+60)}})).status,401);
 assert.equal((await notTrusted.request('/api/auth/login',{method:'POST',body:loginBody(true),headers:{'X-Real-IP':'203.0.113.80'}})).status,429,'Proxy trust defaults must remain opt-in');
 const invalid=await app('invalid-proxy');
 for(let index=0;index<5;index++)assert.equal((await invalid.request('/api/auth/login',{method:'POST',body:loginBody(),headers:{'X-Real-IP':'203.0.113.'+(index+100)+', 198.51.100.1'}})).status,401);
 assert.equal((await invalid.request('/api/auth/login',{method:'POST',body:loginBody(true),headers:{'X-Real-IP':'invalid-hostname.example'}})).status,429);
 assert.equal(providerCalls,0);console.log('PASS disabled proxy trust and malformed/multiple address headers retain the socket limiter; no external provider or private file access');
}finally{
 for(const server of servers){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
 for(const handler of handlers)handler.close();
 await rm(root,{recursive:true,force:true});
}
