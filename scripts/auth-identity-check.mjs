import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,stat,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createStore} from '../server/store.mjs';
import {normalizeLoginTarget,maskLoginTarget} from '../server/auth-identity.mjs';

// Every identity, phone, email and database below is synthetic. Nothing is delivered externally.
const directory=await mkdtemp(join(tmpdir(),'mdd-auth-identities-'));
let time=Date.now(),store=createStore(directory,{authNow:()=>time}),observer;
const errorStatus=(fn,status)=>assert.throws(fn,error=>error.status===status);
const ownerPassword='identity-test-owner-password';
const challenge=(channel,target,{code='012345',requester='fixture-main',purpose='login',userId=null,activate=true,ttlMs=300000}={})=>{
 const value=store.createCodeChallenge({channel,target,code,requester,purpose,userId,ttlMs});
 if(activate)store.activateCodeChallenge(value.id);
 return {...value,channel,target,code,challengeId:value.id};
};
try{
 assert.equal(normalizeLoginTarget('phone','0086 138-0000-1234'),'+8613800001234');
 assert.equal(normalizeLoginTarget('email',' Writer.Test+tag@EXAMPLE.test '),'writer.test+tag@example.test');
 assert.equal(maskLoginTarget('phone','13800001234'),'138****1234');
 assert.equal(maskLoginTarget('email','a@example.test'),'a***@example.test');
 for(const [channel,target]of [['sms','13800001234'],['phone','+12025550123'],['phone','12800001234'],['phone','13800001234\nX'],['email','a\r\nBcc:x@example.test'],['email','.a@example.test'],['email','a..b@example.test'],['email','a@-bad.test'],['email','a@example'],['email','a@ex_ample.test']])assert.throws(()=>normalizeLoginTarget(channel,target));
 errorStatus(()=>store.createCodeChallenge({channel:'phone',target:'13800001234',code:'012345',requester:'fixture'}),409);
 errorStatus(()=>store.providerLogin({provider:'wechat',subject:'appA:openid_A'}),409);
 const owner=await store.register('fixture_owner',ownerPassword);
 assert.equal(owner.user.id,'local');assert.equal(owner.user.role,'admin');assert.equal(owner.user.hasPassword,true);
 store.forUser('local').save('favorites',['owner-only'],0);

 const phone=challenge('phone','13800001234',{activate:false});
 errorStatus(()=>store.loginWithCode(phone),401);
 store.activateCodeChallenge(phone.id);
 const phoneLogin=store.loginWithCode(phone);
 assert.equal(phoneLogin.created,true);assert.equal(phoneLogin.user.role,'author');assert.equal(phoneLogin.user.hasPassword,false);assert.notEqual(phoneLogin.user.id,'local');
 assert.equal(store.auth(phoneLogin.token).user.id,phoneLogin.user.id);assert.equal(store.forUser(phoneLogin.user.id).all().favorites.data,null);
 assert.deepEqual(store.forUser('local').all().favorites.data,['owner-only']);
 errorStatus(()=>store.loginWithCode(phone),401);
 await assert.rejects(store.login(phoneLogin.user.username,'012345'),error=>error.status===401);
 errorStatus(()=>store.createCodeChallenge({channel:'phone',target:'+8613800001234',code:'123456',requester:'different-ip'}),429);
 time+=60001;
 const repeated=store.loginWithCode(challenge('phone','+86 13800001234'));
 assert.equal(repeated.created,false);assert.equal(repeated.user.id,phoneLogin.user.id);
 assert.equal(store.identities(phoneLogin.user.id)[0].masked,'138****1234');
 assert.equal((await stat(join(directory,'auth-pepper'))).mode&0o777,0o600);
 observer=new DatabaseSync(join(directory,'studio.sqlite'));
 const persisted=JSON.stringify(observer.prepare('SELECT * FROM auth_code_challenges').all())+JSON.stringify(observer.prepare('SELECT * FROM auth_identities').all());
 assert.ok(!persisted.includes('13800001234'),'Raw identifiers must not be stored in identity/challenge tables');
 assert.ok(observer.prepare('SELECT code_hash FROM auth_code_challenges WHERE id=?').get(phone.id).code_hash==='','A consumed challenge must erase its code hash');
 observer.close();observer=null;
 console.log('PASS conservative target normalization, first-owner protection, verified author creation, session/data isolation, no password bypass and masked HMAC-only identity persistence');

 const failed=challenge('email','failed@example.test',{activate:false});store.failCodeChallenge(failed.id);
 errorStatus(()=>store.activateCodeChallenge(failed.id),409);errorStatus(()=>store.loginWithCode(failed),401);
 const expiring=challenge('email','expired@example.test',{ttlMs:1000});time+=1001;errorStatus(()=>store.loginWithCode(expiring),401);
 const locked=challenge('email','Locked@Example.test');
 for(let attempt=0;attempt<3;attempt++)errorStatus(()=>store.loginWithCode({...locked,code:'999999'}),401);
 store.close();store=createStore(directory,{authNow:()=>time});
 for(let attempt=0;attempt<2;attempt++)errorStatus(()=>store.loginWithCode({...locked,code:'999999'}),401);
 errorStatus(()=>store.loginWithCode(locked),401);
 time+=60001;
 const emailLogin=store.loginWithCode(challenge('email','locked@example.test'));
 assert.equal(emailLogin.user.role,'author');assert.notEqual(emailLogin.user.id,phoneLogin.user.id);
 const superseded=challenge('email','resend@example.test',{activate:false});time+=60001;
 const replacement=challenge('email','resend@example.test');
 errorStatus(()=>store.activateCodeChallenge(superseded.id),409);errorStatus(()=>store.loginWithCode(superseded),401);
 assert.ok(store.loginWithCode(replacement).token);
 console.log('PASS delivery activation/failure, expiry, replay rejection, persisted five-attempt lockout, fresh challenge and superseded delayed-delivery protection');

 const bindEmail=challenge('email','owner@example.test',{purpose:'bind',userId:owner.user.id});
 errorStatus(()=>store.bindWithCode({...bindEmail,userId:emailLogin.user.id}),401);
 const linked=store.bindWithCode({...bindEmail,userId:owner.user.id});
 assert.equal(linked.user.id,'local');assert.equal(linked.identities[0].provider,'email');assert.equal(linked.identities[0].masked,'ow***@example.test');
 time+=60001;assert.equal(store.loginWithCode(challenge('email','OWNER@example.test')).user.id,'local');
 assert.equal((await store.login('fixture_owner',ownerPassword)).user.id,'local');
 const foreignBind=challenge('phone','13800001234',{purpose:'bind',userId:owner.user.id});
 errorStatus(()=>store.bindWithCode({...foreignBind,userId:owner.user.id}),409);errorStatus(()=>store.bindWithCode({...foreignBind,userId:owner.user.id}),401);
 assert.equal(store.identities(phoneLogin.user.id).length,1);assert.equal(store.identities(owner.user.id).filter(item=>item.provider==='phone').length,0);
 const wrongPurpose=challenge('email','wrongpurpose@example.test',{purpose:'bind',userId:owner.user.id});errorStatus(()=>store.loginWithCode(wrongPurpose),401);
 const ownerAlreadyBound=challenge('email','otherowner@example.test',{purpose:'bind',userId:owner.user.id});errorStatus(()=>store.bindWithCode({...ownerAlreadyBound,userId:owner.user.id}),409);
 assert.equal(store.identities(owner.user.id).find(item=>item.provider==='email').masked,'ow***@example.test');
 console.log('PASS verified explicit binding, user/purpose-bound challenges, identity collision consumption, existing-binding preservation and unchanged owner password login');

 const wxA=store.providerLogin({provider:'wechat',subject:'fixtureAppA:openid_one',unionId:'same-union'});
 const wxRepeat=store.providerLogin({provider:'wechat',subject:'fixtureAppA:openid_one'});
 const wxB=store.providerLogin({provider:'wechat',subject:'fixtureAppB:openid_one',unionId:'same-union'});
 assert.equal(wxA.user.role,'author');assert.equal(wxA.user.hasPassword,false);assert.equal(wxRepeat.user.id,wxA.user.id);assert.equal(wxRepeat.created,false);assert.notEqual(wxA.user.id,wxB.user.id,'Different website apps must not be implicitly merged via unionid');
 errorStatus(()=>store.bindProviderIdentity({userId:owner.user.id,provider:'wechat',subject:'fixtureAppA:openid_one'}),409);
 const ownWechat=store.bindProviderIdentity({userId:owner.user.id,provider:'wechat',subject:'fixtureAppA:owner_openid'});
 assert.equal(ownWechat.identities.find(item=>item.provider==='wechat').masked,'已绑定微信');
 assert.equal(store.providerLogin({provider:'wechat',subject:'fixtureAppA:owner_openid'}).user.id,'local');
 errorStatus(()=>store.bindProviderIdentity({userId:owner.user.id,provider:'wechat',subject:'fixtureAppA:new_owner_openid'}),409);
 for(const input of [{provider:'email',subject:'x:y'},{provider:'wechat',subject:'no-app-scope'},{provider:'wechat',subject:'app:openid\n'}])assert.throws(()=>store.providerLogin(input));
 await store.register('13900001234','unrelated-username-password');
 const noImplicitUsernameMerge=store.loginWithCode(challenge('phone','13900001234'));
 assert.notEqual(noImplicitUsernameMerge.user.username,'13900001234');assert.equal(noImplicitUsernameMerge.user.role,'author');
 console.log('PASS app-scoped verified WeChat login, no unionid/name implicit merging, explicit provider linking and collision protection');

 const rateTarget='ratelimit@example.test';
 for(let index=0;index<5;index++){time+=60001;challenge('email',rateTarget,{requester:'target-rate-fixture',activate:false});}
 time+=60001;errorStatus(()=>challenge('email',rateTarget,{requester:'another-requester',activate:false}),429);
 for(let index=0;index<20;index++)challenge('email',`ip-${index}@example.test`,{requester:'fixture-ip-burst',activate:false});
 errorStatus(()=>challenge('email','ip-overflow@example.test',{requester:'fixture-ip-burst',activate:false}),429);
 for(let index=0;index<100;index++){time+=60001;challenge('email',`daily-${index}@example.test`,{requester:'fixture-ip-daily',activate:false});}
 time+=60001;errorStatus(()=>challenge('email','daily-overflow@example.test',{requester:'fixture-ip-daily',activate:false}),429);
 console.log('PASS persisted target cooldown/hourly cap and requester burst/daily quotas without any real delivery');
 const keyPath=join(directory,'auth-pepper'),originalKey=await readFile(keyPath,'utf8');
 store.close();store=null;await rm(keyPath);
 errorStatus(()=>createStore(directory,{authNow:()=>time}),500);
 await writeFile(keyPath,originalKey,{mode:0o600});store=createStore(directory,{authNow:()=>time});
 assert.equal(store.providerLogin({provider:'wechat',subject:'fixtureAppA:openid_one'}).user.id,wxA.user.id);
 console.log('PASS missing identity pepper fails closed instead of silently forking accounts, restored key preserves identity continuity');
}finally{observer?.close();store?.close();await rm(directory,{recursive:true,force:true});}
