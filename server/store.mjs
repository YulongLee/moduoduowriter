import { DatabaseSync } from 'node:sqlite';
import { mkdirSync,chmodSync } from 'node:fs';
import { join } from 'node:path';
import { createHash,randomBytes,scrypt,timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { validateBackup } from '../src/backup.js';
const derive=promisify(scrypt),hash=value=>createHash('sha256').update(value).digest('hex');
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
export const collections=['works','favorites','submissions','reading','workflows','video'];
export function createStore(directory) {
 mkdirSync(directory,{recursive:true,mode:0o700});const file=join(directory,'studio.sqlite');const db=new DatabaseSync(file);chmodSync(file,0o600);
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS collections(name TEXT PRIMARY KEY,revision INTEGER NOT NULL,data TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS owner(id INTEGER PRIMARY KEY CHECK(id=1),username TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,salt TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,expires_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS generations(id TEXT PRIMARY KEY,task TEXT NOT NULL,status TEXT NOT NULL,request TEXT NOT NULL,result TEXT,error TEXT,started_at TEXT NOT NULL,finished_at TEXT);`);
 db.prepare("UPDATE generations SET status='interrupted',error='服务重启，任务未完成。可以使用原始需求重试。',finished_at=? WHERE status='running' AND (task!='video' OR result IS NULL)").run(new Date().toISOString());
 const readCollection=name=>{const row=db.prepare('SELECT * FROM collections WHERE name=?').get(name);return row?{revision:row.revision,data:JSON.parse(row.data),updatedAt:row.updated_at}:{revision:0,data:null};};
 const owner=()=>db.prepare('SELECT username,created_at FROM owner WHERE id=1').get();
 const validUser=value=>typeof value==='string'&&/^[a-zA-Z0-9_\u4e00-\u9fff-]{3,30}$/.test(value);
 const session=()=>{const token=randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions VALUES(?,?)').run(hash(token),Date.now()+7*86400000);db.prepare('DELETE FROM sessions WHERE expires_at<?').run(Date.now());return token;};
 return {
  all(){return Object.fromEntries(collections.map(name=>[name,readCollection(name)]));},
  save(name,data,revision){
   if(!collections.includes(name))throw fail('不支持的工作区记录');
   try{validateBackup({format:'mdd-workspace',version:1,works:name==='works'?data:[],[name]:data});}catch(e){throw fail(e.message);}
   db.exec('BEGIN IMMEDIATE');try{const current=readCollection(name);if(current.revision!==revision)throw fail('另一窗口更新了此记录，正在合并保存',409);const now=new Date().toISOString();db.prepare('INSERT INTO collections VALUES(?,?,?,?) ON CONFLICT(name) DO UPDATE SET revision=excluded.revision,data=excluded.data,updated_at=excluded.updated_at').run(name,revision+1,JSON.stringify(data),now);db.exec('COMMIT');return {revision:revision+1,updatedAt:now};}catch(e){db.exec('ROLLBACK');throw e;}
  },
  auth(token){const profile=owner();if(!profile)return {configured:false,user:null};const valid=token&&db.prepare('SELECT 1 FROM sessions WHERE token_hash=? AND expires_at>?').get(hash(token),Date.now());return {configured:true,user:valid?{username:profile.username,createdAt:profile.created_at}:null};},
  async register(username,password){
   if(owner())throw fail('本机创作空间已设置账号，请登录',409);if(!validUser(username))throw fail('账号需为 3–30 位中文、字母、数字或下划线');if(typeof password!=='string'||password.length<8||password.length>128)throw fail('密码需为 8–128 个字符');
   const salt=randomBytes(16).toString('hex');const derived=await derive(password,salt,64,{N:32768,maxmem:64*1024*1024});
   if(owner())throw fail('本机创作空间已设置账号，请登录',409);
   db.prepare('INSERT INTO owner VALUES(1,?,?,?,?)').run(username,derived.toString('hex'),salt,new Date().toISOString());return {token:session(),user:{username}};
  },
  async login(username,password){
   const profile=db.prepare('SELECT * FROM owner WHERE id=1').get();if(typeof password!=='string'||password.length>128)throw fail('账号或密码不正确',401);
   const salt=profile?.salt||'unconfigured-workspace';const derived=await derive(password,salt,64,{N:32768,maxmem:64*1024*1024});
   if(!profile||profile.username!==username||!timingSafeEqual(Buffer.from(profile.password_hash,'hex'),derived))throw fail('账号或密码不正确',401);return {token:session(),user:{username:profile.username}};
  },
  logout(token){if(token)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token));},
  beginTask(id,body){const existing=db.prepare('SELECT * FROM generations WHERE id=?').get(id);if(existing)return existing;db.prepare('INSERT INTO generations(id,task,status,request,started_at) VALUES(?,?,?,?,?)').run(id,body.task,'running',JSON.stringify(body),new Date().toISOString());return null;},
  pendingTask(id,result){db.prepare('UPDATE generations SET result=? WHERE id=?').run(JSON.stringify(result),id);},
  mediaTasks(draftId){return db.prepare("SELECT * FROM generations WHERE task IN ('image','video') ORDER BY started_at DESC LIMIT 100").all().filter(row=>!draftId||JSON.parse(row.request).draftId===draftId).map(row=>({id:row.id,task:row.task,status:row.status,error:row.error,request:JSON.parse(row.request),result:row.result?JSON.parse(row.result):null,startedAt:row.started_at}));},
  finishTask(id,result,error,status=error?'failed':'succeeded'){db.prepare('UPDATE generations SET status=?,result=?,error=?,finished_at=? WHERE id=?').run(status,result?JSON.stringify(result):null,error||null,new Date().toISOString(),id);},
  tasks(){return db.prepare("SELECT id,task,status,started_at,finished_at,error,result FROM generations WHERE task NOT IN ('image','video') ORDER BY started_at DESC LIMIT 200").all().map(row=>({id:row.id,task:row.task,status:row.status,startedAt:row.started_at,finishedAt:row.finished_at,error:row.error,result:row.result?((value)=>({model:value.model,usage:value.usage,text:value.text?.slice(0,100)}))(JSON.parse(row.result)):null}));},
  task(id){const row=db.prepare('SELECT * FROM generations WHERE id=?').get(id);if(!row)throw fail('生成记录不存在',404);return {...row,request:JSON.parse(row.request),result:row.result?JSON.parse(row.result):null};},
  close(){db.close();}
 };
}
