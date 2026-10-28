import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {createStore} from '../server/store.mjs';

const directory=await mkdtemp(join(tmpdir(),'mdd-admin-store-'));let store,clock=Date.now();
try{
 store=createStore(directory,{authNow:()=>clock});const admin=await store.provisionAdmin({username:'admin@example.com',password:'fixture-admin-secret'});
 assert.equal(admin.user.id,'local');assert.equal(admin.user.role,'admin');assert.equal(admin.created,true);assert.equal(admin.loginAlias,'admin@example.com');assert.ok(!JSON.stringify(admin).includes('fixture-admin-secret'));
 const session=await store.login('ADMIN@EXAMPLE.COM','fixture-admin-secret');assert.equal(store.auth(session.token).user.id,'local');assert.equal(admin.user.hasPassword,true);
 const author=await store.register('fixture_author','fixture-author-secret');assert.equal(author.user.role,'author');
 const second=await store.register('second_fixture','fixture-second-secret');assert.equal(second.user.role,'author');
 assert.equal(store.adminUsers({q:'fixture',page:1,pageSize:1}).total,2);assert.equal(store.adminUsers({q:'fixture',page:2,pageSize:1}).items.length,1);
 assert.throws(()=>store.adminUsers({pageSize:101}));assert.throws(()=>store.setUserStatus({actorId:author.user.id,userId:second.user.id,status:'disabled'}),error=>error.status===403);assert.throws(()=>store.setUserStatus({actorId:'local',userId:'local',status:'disabled'}),error=>error.status===409);
 store.forUser(author.user.id).beginTask('fixture-task-one',{task:'ideas',prompt:'PRIVATE MANUSCRIPT REQUEST'});store.forUser(author.user.id).finishTask('fixture-task-one',{text:'PRIVATE MANUSCRIPT RESULT',usage:{inputTokens:11,outputTokens:13,totalTokens:24}},null);
 store.forUser(author.user.id).beginTask('fixture-task-two',{task:'polish',prompt:'PRIVATE REQUEST'});store.forUser(author.user.id).finishTask('fixture-task-two',null,'PRIVATE ERROR INCLUDING KEY');
 store.forUser(author.user.id).purchase({kind:'pack',id:'small'},'fixture-order-one');
 const fixtureDB=new DatabaseSync(join(directory,'studio.sqlite'));
 fixtureDB.prepare('INSERT INTO user_collections VALUES(?,?,?,?,?)').run(author.user.id,'works',1,JSON.stringify([{id:'fixture-work',title:'PRIVATE TITLE',chapters:[{id:'one',text:'你好 世界'}]},{id:'trash',deletedAt:'2026-01-01',chapters:[{text:'hidden'}]}]),new Date().toISOString());fixtureDB.close();
 const overview=store.adminOverview();assert.equal(overview.users.total,3);assert.deepEqual(overview.works,{total:1,words:4,chapters:1});assert.equal(overview.generations.total,2);assert.equal(overview.generations.succeeded,1);assert.equal(overview.generations.failed,1);assert.equal(overview.generations.totalTokens,24);assert.equal(overview.orders.amountCents,990);assert.equal(overview.orders.mode,'server-demo');assert.equal(overview.trend.length,7);
 const tasks=store.adminGenerations({status:'failed'});assert.equal(tasks.total,1);assert.equal(tasks.items[0].hasError,true);assert.equal(tasks.items[0].username,'fixture_author');
 const response=JSON.stringify({overview,tasks:store.adminGenerations(),users:store.adminUsers(),orders:store.adminOrders(),audit:store.adminAudit()});for(const forbidden of ['PRIVATE','fixture-admin-secret','password_hash','recovery_hash','salt'])assert.ok(!response.includes(forbidden));assert.equal(store.adminOrders().items[0].amount,990);assert.equal(store.adminOrders().items[0].status,'demo-completed');
 console.log('PASS email administrator provisioning, author-only public registration, pagination, aggregate metrics and private-data-free logs');

 const code=()=>{const challenge=store.createCodeChallenge({channel:'email',target:'reader@example.com',code:'123456',requester:'fixture-ip'});store.activateCodeChallenge(challenge.id);return {channel:'email',target:'reader@example.com',challengeId:challenge.id,code:'123456'};};
 const login=store.loginWithCode(code());store.bindProviderIdentity({userId:login.user.id,provider:'wechat',subject:'fixture-app:fixture-openid'});clock+=60001;const disabledCode=code();
 store.setUserStatus({actorId:'local',userId:login.user.id,status:'disabled'});assert.equal(store.auth(login.token).user,null);assert.throws(()=>store.loginWithCode(disabledCode),error=>error.status===403);assert.throws(()=>store.providerLogin({provider:'wechat',subject:'fixture-app:fixture-openid'}),error=>error.status===403);assert.throws(()=>store.bindProviderIdentity({userId:login.user.id,provider:'wechat',subject:'fixture-app:fixture-openid'}),error=>error.status===403);
 store.setUserStatus({actorId:'local',userId:author.user.id,status:'disabled'});assert.equal(store.auth(author.token).user,null);await assert.rejects(store.login('fixture_author','fixture-author-secret'),error=>error.status===403);await assert.rejects(store.recover('fixture_author',author.recoveryCode,'fixture-new-secret'),error=>error.status===403);await assert.rejects(store.rotateRecovery(author.user.id,'fixture-author-secret'),error=>error.status===403);
 store.setUserStatus({actorId:'local',userId:author.user.id,status:'active'});const active=await store.login('fixture_author','fixture-author-secret');assert.equal(store.auth(active.token).user.id,author.user.id);assert.equal(store.auth(author.token).user,null,'Reenable must not revive old sessions');assert.equal(store.adminUsers({status:'disabled'}).total,1);assert.equal(store.adminAudit({q:'user.disable'}).total,2);
 console.log('PASS protected administrators, author activation/deactivation, session revocation, password/recovery and external-login rejection');

 const original=store.forUser('local');original.beginTask('original-owner-task',{task:'outline'});original.finishTask('original-owner-task',{text:'PRIVATE ORIGINAL OWNER'},null);
 const old=await store.login('admin@example.com','fixture-admin-secret');const refreshed=await store.provisionAdmin({username:'new-owner@example.com',password:'fixture-changed-secret'});assert.equal(refreshed.user.id,'local');assert.equal(refreshed.created,false);assert.equal(refreshed.user.username,'admin@example.com');assert.equal(store.auth(old.token).user,null);assert.equal((await store.login('new-owner@example.com','fixture-changed-secret')).user.id,'local');assert.equal((await store.login('admin@example.com','fixture-changed-secret')).user.id,'local');assert.equal(store.forUser('local').task('original-owner-task').result.text,'PRIVATE ORIGINAL OWNER');await assert.rejects(store.register('new-owner@example.com','fixture-author-secret'),error=>error.status===409);await assert.rejects(store.login('admin@example.com','fixture-admin-secret'),error=>error.status===401);
 store.close();store=createStore(directory,{authNow:()=>clock});assert.equal((await store.login('NEW-OWNER@EXAMPLE.COM','fixture-changed-secret')).user.id,'local');assert.equal(store.adminAudit({q:'admin.provision'}).total,2);assert.equal(store.adminUsers({q:'new-owner@example.com'}).items[0].id,'local');
 const file=await readFile(join(directory,'studio.sqlite'));assert.ok(!file.includes(Buffer.from('fixture-admin-secret')));assert.ok(!file.includes(Buffer.from('fixture-changed-secret')));
 console.log('PASS alias/password rotation without owner renaming or manuscript loss, persistent controls/audit, and no plaintext password storage');
}finally{store?.close();await rm(directory,{recursive:true,force:true});}
