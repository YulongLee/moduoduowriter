import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer,request as httpRequest} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {createApi} from '../server/api.mjs';

// All records, sessions, model replies and cloud operations are controlled fixtures.
// This check never opens the user's workspace or contacts an external service.
const directory=await mkdtemp(join(tmpdir(),'mdd-public-home-security-'));
await writeFile(join(directory,'ai.json'),JSON.stringify({baseUrl:'https://fixture.invalid/v1',model:'fixture-chat',apiKey:'fixture-only-key',protocol:'chat',defaultMode:'ai'}));
let modelCalls=0,cloudCalls=0;
const cloudStore=Object.fromEntries(['list','save','get','test','readMedia','saveMedia'].map(name=>[name,async()=>{cloudCalls++;throw Error(`Unexpected fixture cloud operation: ${name}`);} ]));
const handler=createApi({directory,cloudStore,fetchImpl:async()=>{
 modelCalls++;return Response.json({model:'fixture-chat',choices:[{finish_reason:'stop',message:{content:`受控对话回复 ${modelCalls}`}}],usage:{prompt_tokens:10,completion_tokens:20,total_tokens:30}});
}});
const server=createServer(handler);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const chat=(requestId,prompt)=>({task:'chat',requestId,prompt,context:{history:[]},mode:'standard',target:1000});
const sample=id=>({id,title:`私有作品 ${id}`,kind:'长篇小说',genre:'悬疑',outline:'该账号的私有大纲',characters:'该账号的私有人物',chapters:[{id:`chapter-${id}`,title:'第一章',text:`私有正文 ${id}`} ]});
const request=async(path,{method='GET',body,cookie='',spaceId,headers={},client=true}={})=>{
 const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(client?{'X-Mdd-Client':'workspace-v1'}:{}),...(cookie?{Cookie:cookie}:{}),...(spaceId?{'X-Mdd-Space':spaceId}:{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
 return {response,status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]||''};
};
const expect=async(status,path,options)=>{const result=await request(path,options);assert.equal(result.status,status,`${options?.method||'GET'} ${path}: ${JSON.stringify(result.data)}`);return result;};
try{
 const local=await expect(200,'/api/auth/status');
 assert.deepEqual(local.data,{configured:false,user:null,spaceId:'local',canRegister:true});
 assert.equal(local.response.headers.get('cache-control'),'no-store');
 assert.deepEqual(Object.keys(local.data).sort(),['canRegister','configured','spaceId','user']);
 await expect(200,'/api/data/works',{method:'PUT',body:{data:[sample('legacy-local')],revision:0}});
 assert.equal((await expect(200,'/api/data')).data.collections.works.data[0].id,'legacy-local','unconfigured local mode remains an explicit compatibility case');
 const registration=await expect(200,'/api/auth/register',{method:'POST',body:{username:'public_home_owner',password:'fixture-owner-password-123'}});
 const aliceCookie=registration.cookie,aliceId=registration.data.user.id;
 assert.equal(aliceId,'local');assert.equal(registration.data.user.role,'admin');assert.ok(registration.data.recoveryCode);
 const cookieOptions=registration.response.headers.get('set-cookie');assert.match(cookieOptions,/HttpOnly/);assert.match(cookieOptions,/SameSite=Strict/);assert.match(cookieOptions,/Path=\/api/);
 assert.equal(registration.data.token,undefined);assert.equal(registration.data.password_hash,undefined);
 assert.equal((await expect(200,'/api/data',{cookie:aliceCookie,spaceId:aliceId})).data.collections.works.data[0].id,'legacy-local','the first account takes ownership of the preexisting local space');

 const guest=await expect(200,'/api/auth/status');
 assert.deepEqual(guest.data,{configured:true,user:null,spaceId:null,canRegister:true},'configured anonymous status must not imply local authorization');
 assert.ok(!JSON.stringify(guest.data).includes('public_home_owner'));
 const unauthenticated=[
  ['/api/data'],['/api/data/conversations','PUT',{revision:0,data:[]}],
  ['/api/tasks'],['/api/tasks/fixture-task'],['/api/billing'],['/api/billing/purchase','POST',{offer:'credits-small',requestId:'guest-purchase'}],
  ['/api/billing/reservations','POST',{}],['/api/billing/reset','POST',{}],
  ['/api/service/status'],['/api/settings'],['/api/settings','PUT',{}],['/api/test','POST',{}],
  ['/api/generate','POST',chat('guest-generation','匿名问题')],['/api/generation/quote','POST',chat('guest-quote','匿名问题')],
  ['/api/oss/settings'],['/api/oss/backups'],['/api/oss/backups','POST',{}],['/api/oss/restore','POST',{key:'private'}],
  ['/api/workspace'],['/api/workspace','PUT',{}],['/api/media/status'],['/api/auth/recovery','POST',{password:'fixture-owner-password-123'}]
 ];
 for(const [path,method='GET',body]of unauthenticated)await expect(401,path,{method,body});
 await expect(401,'/api/data',{spaceId:aliceId});
 await expect(401,'/api/generate',{method:'POST',spaceId:aliceId,body:chat('spoofed-local-task','伪造空间')});
 assert.equal(modelCalls,0);assert.equal(cloudCalls,0,'authorization must run before provider or cloud work');
 console.log('PASS public status, explicit legacy-local compatibility, first-owner adoption and authenticated-only private API boundaries');

 const badHost=await new Promise((resolve,reject)=>{
  const pending=httpRequest(base+'/api/auth/status',{headers:{Host:'public.example.com'}},response=>{let text='';response.setEncoding('utf8');response.on('data',chunk=>text+=chunk);response.on('end',()=>resolve({status:response.statusCode,data:JSON.parse(text)}));});
  pending.on('error',reject);pending.end();
 });assert.equal(badHost.status,403);
 await expect(403,'/api/auth/status',{headers:{Origin:'https://malicious.invalid'}});
 await expect(403,'/api/auth/login',{method:'POST',client:false,body:{username:'public_home_owner',password:'fixture-owner-password-123'}});
 await expect(403,'/api/data/works',{method:'PUT',client:false,cookie:aliceCookie,spaceId:aliceId,body:{revision:1,data:[]}});
 await expect(403,'/api/data',{cookie:aliceCookie,spaceId:aliceId,headers:{Origin:'https://malicious.invalid'}});
 const aliceTask=chat('private-alice-request','Alice 私有讨论需求');
 const aliceResult=await expect(200,'/api/generate',{method:'POST',cookie:aliceCookie,spaceId:aliceId,body:aliceTask});
 assert.equal(aliceResult.data.text,'受控对话回复 1');assert.equal(modelCalls,1);
 const bobRegistration=await expect(200,'/api/auth/register',{method:'POST',body:{username:'public_home_author',password:'fixture-author-password-123'}});
 const bobCookie=bobRegistration.cookie,bobId=bobRegistration.data.user.id;assert.notEqual(bobId,aliceId);assert.equal(bobRegistration.data.user.role,'author');
 const bobData=await expect(200,'/api/data',{cookie:bobCookie,spaceId:bobId});assert.equal(bobData.data.collections.works.data,null);
 await expect(200,'/api/data/works',{method:'PUT',cookie:bobCookie,spaceId:bobId,body:{revision:0,data:[sample('bob-only')]}});
 assert.equal((await expect(200,'/api/data',{cookie:aliceCookie,spaceId:aliceId})).data.collections.works.data[0].id,'legacy-local');
 assert.equal((await expect(200,'/api/data',{cookie:bobCookie,spaceId:bobId})).data.collections.works.data[0].id,'bob-only');
 for(const [path,method='GET',body]of [['/api/data'],['/api/tasks'],['/api/data/works','PUT',{revision:0,data:[]}],['/api/generate','POST',chat('wrong-space-request','错误空间')]]){
  const result=await expect(412,path,{method,body,cookie:bobCookie,spaceId:aliceId});assert.equal(result.data.code,'space-mismatch');
 }
 await expect(404,`/api/tasks/${aliceTask.requestId}`,{cookie:bobCookie,spaceId:bobId});
 assert.deepEqual((await expect(200,'/api/tasks',{cookie:bobCookie,spaceId:bobId})).data.items,[]);
 const bobTask={...aliceTask,prompt:'Bob 私有讨论需求'};
 const bobResult=await expect(200,'/api/generate',{method:'POST',cookie:bobCookie,spaceId:bobId,body:bobTask});assert.equal(bobResult.data.text,'受控对话回复 2');
 const restoredAlice=await expect(200,`/api/tasks/${aliceTask.requestId}`,{cookie:aliceCookie,spaceId:aliceId});
 const restoredBob=await expect(200,`/api/tasks/${bobTask.requestId}`,{cookie:bobCookie,spaceId:bobId});
 assert.equal(restoredAlice.data.request.prompt,'Alice 私有讨论需求');assert.equal(restoredAlice.data.result.text,'受控对话回复 1');
 assert.equal(restoredBob.data.request.prompt,'Bob 私有讨论需求');assert.equal(restoredBob.data.result.text,'受控对话回复 2','matching IDs across accounts must stay independent');
 for(const path of ['/api/settings','/api/test','/api/oss/test'])await expect(403,path,{method:path==='/api/settings'?'GET':'POST',body:path==='/api/settings'?undefined:{},cookie:bobCookie,spaceId:bobId});
 const bobStorage=await expect(200,'/api/oss/settings',{cookie:bobCookie,spaceId:bobId});assert.equal(bobStorage.data.canManage,false);assert.equal(bobStorage.data.accessKeySecret,undefined);assert.equal(bobStorage.data.prefix,undefined);
 await expect(403,'/api/oss/settings',{method:'PUT',cookie:bobCookie,spaceId:bobId,body:{}});
 await expect(200,'/api/billing/settings',{method:'POST',cookie:aliceCookie,spaceId:aliceId,body:{enabled:true}});
 assert.equal((await expect(200,'/api/billing',{cookie:aliceCookie,spaceId:aliceId})).data.account.enabled,true);
 assert.equal((await expect(200,'/api/billing',{cookie:bobCookie,spaceId:bobId})).data.account.enabled,false,'billing state must be scoped too');
 assert.equal(modelCalls,2);assert.equal(cloudCalls,0);
 console.log('PASS Host/Origin/client protections, space-mismatch rejection, task/data/billing isolation and admin-only configuration');

 await expect(200,'/api/auth/logout',{method:'POST',cookie:aliceCookie,spaceId:aliceId,body:{}});
 await expect(401,'/api/data',{cookie:aliceCookie,spaceId:aliceId});
 const loggedOut=await expect(200,'/api/auth/status',{cookie:aliceCookie});assert.equal(loggedOut.data.user,null);assert.equal(loggedOut.data.spaceId,null);
 await expect(401,'/api/data',{cookie:'mdd_session=invalid-session-cookie',spaceId:aliceId});
 const db=new DatabaseSync(join(directory,'studio.sqlite'));try{db.prepare('UPDATE sessions SET expires_at=0 WHERE user_id=?').run(bobId);}finally{db.close();}
 const expired=await expect(200,'/api/auth/status',{cookie:bobCookie});assert.equal(expired.data.configured,true);assert.equal(expired.data.user,null);assert.equal(expired.data.spaceId,null);
 await expect(401,'/api/data',{cookie:bobCookie,spaceId:bobId});await expect(401,'/api/billing',{cookie:bobCookie});
 assert.equal(modelCalls,2);assert.equal(cloudCalls,0);
 console.log('PASS logout, stale/invalid/expired cookies and no anonymous fallback into the old local account');
}finally{
 server.closeAllConnections();await new Promise(resolve=>server.close(resolve));handler.close();await rm(directory,{recursive:true,force:true});
}
