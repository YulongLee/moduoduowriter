import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {generateKeyPairSync} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,rm,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createStore} from '../server/store.mjs';
import {createApi} from '../server/api.mjs';

const directory=await mkdtemp(join(tmpdir(),'mdd-admin-api-'));let api,server;let providerCalls=0;
const start=async()=>{api=createApi({directory,fetchImpl:async()=>{providerCalls++;throw Error('No real provider in admin tests');}});server=createServer(api);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));};
const close=async()=>{if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));api.close();server=null;}};
const call=async(path,{session='',method='GET',body,space,origin,marker=true}={})=>{const base='http://127.0.0.1:'+server.address().port;const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(marker?{'X-Mdd-Client':'workspace-v1'}:{}),...(session?{Cookie:'mdd_session='+session}:{}),...(space?{'X-Mdd-Space':space}:{}),...(origin?{Origin:origin}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,data:await response.json()};};
try{
 await start();assert.equal((await call('/api/admin/overview')).status,401);await close();
 const store=createStore(directory),owner=await store.register('fixture_owner','fixture-owner-password'),author=await store.register('fixture_author','fixture-author-password');
 const workspace=store.forUser(author.user.id);workspace.save('works',[{id:'private-fixture-work',title:'PRIVATE_MANUSCRIPT_TITLE',kind:'长篇小说',genre:'玄幻',chapters:[{id:'private-chapter',title:'第一章',text:'PRIVATE_MANUSCRIPT_TEXT'}],outline:'PRIVATE_OUTLINE',characters:'PRIVATE_CHARACTERS'}],0);
 workspace.beginTask('admin-generation-1',{task:'ideas',prompt:'PRIVATE_GENERATION_PROMPT'});workspace.finishTask('admin-generation-1',{text:'PRIVATE_GENERATION_RESULT',model:'PRIVATE_MODEL_ID',usage:{inputTokens:20,outputTokens:30,totalTokens:50}},null);
 workspace.beginTask('admin-generation-2',{task:'polish',prompt:'PRIVATE_FAILED_PROMPT'});workspace.finishTask('admin-generation-2',null,'PRIVATE_PROVIDER_SECRET_ERROR');workspace.purchase({kind:'pack',id:'small'},'admin-purchase-1');store.close();await start();
 for(const path of ['/api/admin/overview','/api/admin/users','/api/admin/generations','/api/admin/orders','/api/admin/audit','/api/admin/payment-settings']){
  assert.equal((await call(path)).status,401);assert.equal((await call(path,{session:author.token})).status,403);
  const value=await call(path,{session:owner.token,space:owner.user.id});assert.equal(value.status,200);assert.ok(!JSON.stringify(value.data).includes('PRIVATE_'),'Admin summaries never include manuscript, prompt, raw provider error or model secrets');
 }
 let result=await call('/api/admin/overview',{session:owner.token});assert.equal(result.data.users.total,2);assert.equal(result.data.works.total,1);assert.equal(result.data.generations.totalTokens,50);assert.equal(result.data.orders.amountCents,990);assert.equal(result.data.orders.mode,'server-demo');
 assert.equal((await call('/api/admin/users?page=0',{session:owner.token})).status,400);assert.equal((await call('/api/admin/users?pageSize=101',{session:owner.token})).status,400);assert.equal((await call('/api/admin/users?status=unknown',{session:owner.token})).status,400);
 result=await call('/api/admin/users?q=fixture_author',{session:owner.token});assert.equal(result.data.total,1);assert.equal(result.data.items[0].workCount,1);
 assert.equal((await call('/api/admin/users',{session:owner.token,space:'wrong-space'})).status,412);assert.equal((await call('/api/admin/overview',{session:owner.token,origin:'https://attacker.example'})).status,403);
 const path='/api/admin/users/'+author.user.id+'/status';
 for(const body of [null,[],{},'disabled',{status:'admin'}])assert.equal((await call(path,{session:owner.token,method:'PUT',body})).status,400);
 assert.equal((await call(path,{session:owner.token,method:'PUT',body:{status:'disabled'},marker:false})).status,403);
 assert.equal((await call('/api/admin/users/'+owner.user.id+'/status',{session:owner.token,method:'PUT',body:{status:'disabled'}})).status,409);
 result=await call(path,{session:owner.token,method:'PUT',body:{status:'disabled'}});assert.equal(result.status,200);assert.equal(result.data.user.id,author.user.id);assert.equal(result.data.user.status,'disabled');
 assert.equal((await call('/api/data',{session:author.token})).status,401);assert.equal((await call('/api/auth/login',{method:'POST',body:{username:'fixture_author',password:'fixture-author-password'}})).status,403);
 result=await call(path,{session:owner.token,method:'PUT',body:{status:'active'}});assert.equal(result.status,200);assert.equal((await call('/api/data',{session:author.token})).status,401,'Reactivation does not restore revoked cookies');
 assert.equal((await call('/api/settings',{session:owner.token,method:'PUT',body:{baseUrl:'',model:'',protocol:'chat',apiKey:'fixture-secret-key',defaultMode:'demo'}})).status,200);
 assert.equal((await call('/api/auth/settings',{session:owner.token,method:'PUT',body:{}})).status,200);assert.equal(providerCalls,0,'Saving configuration never tests or calls real providers');
 const pay='/api/admin/payment-settings';
 assert.equal((await call(pay)).status,401);assert.equal((await call(pay,{session:author.token})).status,401);
 const initialPayment=await call(pay,{session:owner.token});assert.equal(initialPayment.status,200);assert.equal(initialPayment.data.collectionAvailable,false);
 let paymentRevision=initialPayment.data.revision;const savePay=async body=>{const result=await call(pay,{session:owner.token,method:'PUT',body:{...body,revision:paymentRevision}});if(result.status===200)paymentRevision=result.data.revision;return result;};

 assert.equal((await savePay({wechat:{unknown:'invalid'}})).status,400);
 assert.equal((await savePay({wechat:{apiV3Key:'short'}})).status,400);
 assert.equal((await savePay({wechat:{privateKey:'invalid'}})).status,400);
 assert.equal((await savePay({wechat:{platformCertificate:'invalid'}})).status,400);
 assert.equal((await savePay({wechat:{platformPublicKey:'invalid'}})).status,400);
 assert.equal((await savePay({wechat:{platformPublicKeyId:'invalid'}})).status,400);
 assert.equal((await savePay({alipay:{alipayPublicKey:'invalid'}})).status,400);
 assert.equal((await savePay({alipay:{sellerId:'invalid'}})).status,400);
 const pair=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
 const payment=await savePay({wechat:{enabled:true,appId:'wx1234567890123456',mchId:'1234567890',serialNo:'ABC123',apiV3Key:'12345678901234567890123456789012',privateKey:pair.privateKey,platformPublicKeyId:'PUB_KEY_ID_1234567890',platformPublicKey:pair.publicKey},alipay:{enabled:true,appId:'2026123456789012',sellerId:'2088123456789012',privateKey:pair.privateKey,alipayPublicKey:pair.publicKey}});
 assert.equal(payment.status,200);assert.equal(payment.data.collectionAvailable,false);assert.equal(payment.data.wechat.hasApiV3Key,true);assert.equal(payment.data.wechat.hasPlatformPublicKey,true);assert.equal(payment.data.wechat.platformPublicKeyId,'PUB_KEY_ID_1234567890');assert.equal(payment.data.alipay.sellerId,'2088123456789012');assert.equal(payment.data.alipay.hasPrivateKey,true);assert.ok(!JSON.stringify(payment.data).includes('PRIVATE KEY'));assert.ok(!JSON.stringify(payment.data).includes('PUBLIC KEY'));assert.ok(!JSON.stringify(payment.data).includes('12345678901234567890123456789012'));
 assert.equal((await stat(join(directory,'payment-settings.json'))).mode&0o777,0o600,'Payment credentials must be stored in a private file');
 const stale=await call(pay,{session:owner.token,method:'PUT',body:{revision:initialPayment.data.revision,wechat:{mchId:'9999999'}}});assert.equal(stale.status,409);assert.equal((await call(pay,{session:owner.token})).data.wechat.mchId,'1234567890');
 const auditDb=new DatabaseSync(join(directory,'studio.sqlite'));
 auditDb.exec("CREATE TRIGGER fail_payment_audit BEFORE INSERT ON admin_audit WHEN NEW.action='payment-settings.update-attempt' BEGIN SELECT RAISE(ABORT, 'test-audit-unavailable'); END");
 try{assert.notEqual((await savePay({wechat:{mchId:'9999999'}})).status,200);const afterFailedAudit=await call(pay,{session:owner.token});assert.equal(afterFailedAudit.data.wechat.mchId,'1234567890');assert.equal(afterFailedAudit.data.revision,paymentRevision,'Audit failure must prevent any config change');}finally{auditDb.exec('DROP TRIGGER fail_payment_audit');auditDb.close();}
 const retained=await savePay({wechat:{apiV3Key:'',privateKey:'',platformPublicKey:''},alipay:{privateKey:'  \n'}});assert.equal(retained.data.wechat.hasApiV3Key,true);assert.equal(retained.data.wechat.hasPlatformPublicKey,true);assert.equal(retained.data.alipay.hasPrivateKey,true);
 const cleared=await savePay({wechat:{clearApiV3Key:true,clearPlatformPublicKey:true},alipay:{clearPrivateKey:true}});assert.equal(cleared.data.wechat.hasApiV3Key,false);assert.equal(cleared.data.wechat.hasPlatformPublicKey,false);assert.equal(cleared.data.alipay.hasPrivateKey,false);
 const status=await call('/api/payments/status');assert.equal(status.status,200);assert.equal(status.data.wechat.available,false);assert.equal(status.data.alipay.available,false);assert.equal(providerCalls,0);
 result=await call('/api/admin/audit',{session:owner.token});for(const action of ['user.disable','user.enable','ai-settings.update','login-settings.update'])assert.ok(result.data.items.some(item=>item.action===action));assert.ok(!JSON.stringify(result.data).includes('fixture-secret-key'));
 assert.equal((await call('/api/admin/orders',{session:owner.token,method:'POST',body:{}})).status,405);assert.equal((await call('/api/admin/provision',{session:owner.token,method:'POST',body:{}})).status,405,'No remote credential provisioning endpoint');
 console.log('PASS strict admin authorization, source/space checks, validated writes, safe aggregates and private-data-free audit/record pages');
 console.log('PASS status changes revoke sessions, self-protection, read-only demo orders and audited configuration saves without provider calls');
}finally{await close();await rm(directory,{recursive:true,force:true});}
