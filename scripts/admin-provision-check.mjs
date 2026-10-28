import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,rm,readdir,stat,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createStore} from '../server/store.mjs';

const directory=await mkdtemp(join(tmpdir(),'mdd-admin-provision-')),username='admin-fixture@example.com',password='fixture-private-password';
const invoke=input=>spawnSync(process.execPath,[resolve('scripts/provision-admin.mjs'),'--stdin','--directory',directory],{input:JSON.stringify(input)+'\n',encoding:'utf8'});
try{
 let value=invoke({username,password});assert.equal(value.status,0,value.stderr);let result=JSON.parse(value.stdout);assert.equal(result.role,'admin');assert.equal(result.backupCreated,false);assert.equal(result.credentialsVerified,true);assert.ok(!value.stdout.includes(password));
 let store=createStore(directory);let auth=await store.login(username,password);assert.equal(auth.user.id,'local');store.forUser('local').save('works',[{id:'fixture-book',title:'Keep this book',kind:'长篇小说',genre:'玄幻',chapters:[{id:'fixture-chapter',title:'Chapter',text:'Kept manuscript'}],outline:'',characters:''}],0);store.close();
 value=invoke({username,password:'fixture-next-password'});assert.equal(value.status,0,value.stderr);result=JSON.parse(value.stdout);assert.equal(result.backupCreated,true);assert.equal(result.existingSpacePreserved,true);assert.ok(!value.stdout.includes('fixture-next-password'));
 const names=await readdir(join(directory,'admin-snapshots'));assert.equal(names.length,1);const snapshot=join(directory,'admin-snapshots',names[0]);assert.equal((await stat(snapshot)).mode&0o777,0o600);const backup=new DatabaseSync(snapshot,{readOnly:true});assert.equal(backup.prepare('SELECT COUNT(*) AS n FROM users').get().n,1);assert.ok(backup.prepare("SELECT data FROM user_collections WHERE name='works'").get().data.includes('Kept manuscript'));backup.close();
 store=createStore(directory);await store.register('occupied@example.com','fixture-author-password');await assert.rejects(store.provisionAdmin({username:'occupied@example.com',password:'fixture-attempt-password'}),{status:409});assert.equal((await store.login('occupied@example.com','fixture-author-password')).user.role,'author');await assert.rejects(store.login(username,password));auth=await store.login(username,'fixture-next-password');assert.equal(auth.user.role,'admin');assert.equal(store.forUser('local').all().works.data[0].title,'Keep this book');store.close();
 assert.ok(!(await readFile(join(directory,'studio.sqlite'))).includes(Buffer.from('fixture-next-password')));value=invoke({username,password:'short'});assert.notEqual(value.status,0);assert.ok(!value.stderr.includes('short'));
 console.log('PASS stdin-only local initialization, verified admin credentials, private consistent pre-change snapshot and preserved manuscripts without plaintext persistence');
}finally{await rm(directory,{recursive:true,force:true});}
