import { DatabaseSync } from 'node:sqlite';
import { mkdirSync,chmodSync } from 'node:fs';
import { join } from 'node:path';
import { createHash,randomBytes,scrypt,timingSafeEqual,randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { validateBackup } from '../src/backup.js';
import {newBillingAccount,refreshBilling,reserveTask,finishTask,applyDemoPurchase,balanceOf,quoteTask} from '../src/billing.js';
import {createAuthIdentityStore} from './auth-identity.mjs';
const derive=promisify(scrypt),hash=value=>createHash('sha256').update(value).digest('hex');
const fail=(message,status=400,code)=>Object.assign(new Error(message),{status,code});
export const collections=['works','favorites','submissions','reading','workflows','video','planningDrafts','evaluations','conversations'];
export function createStore(directory,{authNow=()=>Date.now()}={}) {
 mkdirSync(directory,{recursive:true,mode:0o700});const file=join(directory,'studio.sqlite');const db=new DatabaseSync(file);chmodSync(file,0o600);
 db.exec([
 'PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;',
 'CREATE TABLE IF NOT EXISTS collections(name TEXT PRIMARY KEY,revision INTEGER NOT NULL,data TEXT NOT NULL,updated_at TEXT NOT NULL);',
 'CREATE TABLE IF NOT EXISTS owner(id INTEGER PRIMARY KEY CHECK(id=1),username TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,salt TEXT NOT NULL,created_at TEXT NOT NULL);',
 'CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,expires_at INTEGER NOT NULL,user_id TEXT NOT NULL DEFAULT \'local\');',
 'CREATE TABLE IF NOT EXISTS generations(id TEXT PRIMARY KEY,task TEXT NOT NULL,status TEXT NOT NULL,request TEXT NOT NULL,result TEXT,error TEXT,started_at TEXT NOT NULL,finished_at TEXT);',
 'CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT COLLATE NOCASE UNIQUE NOT NULL,password_hash TEXT NOT NULL,salt TEXT NOT NULL,role TEXT NOT NULL,recovery_hash TEXT,created_at TEXT NOT NULL);',
 'CREATE TABLE IF NOT EXISTS user_collections(user_id TEXT NOT NULL,name TEXT NOT NULL,revision INTEGER NOT NULL,data TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(user_id,name));',
 'CREATE TABLE IF NOT EXISTS user_generations(user_id TEXT NOT NULL,id TEXT NOT NULL,task TEXT NOT NULL,status TEXT NOT NULL,request TEXT NOT NULL,result TEXT,error TEXT,started_at TEXT NOT NULL,finished_at TEXT,PRIMARY KEY(user_id,id));',
 'CREATE TABLE IF NOT EXISTS billing_accounts(user_id TEXT PRIMARY KEY,data TEXT NOT NULL,updated_at TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0);',
 'CREATE TABLE IF NOT EXISTS billing_requests(user_id TEXT NOT NULL,request_id TEXT NOT NULL,ticket TEXT NOT NULL,scope TEXT NOT NULL,quote TEXT NOT NULL,PRIMARY KEY(user_id,request_id));'
 ].join('\n'));
 if(!db.prepare('PRAGMA table_info(billing_accounts)').all().some(c=>c.name==='revision'))db.exec("ALTER TABLE billing_accounts ADD COLUMN revision INTEGER NOT NULL DEFAULT 0");
 if(!db.prepare('PRAGMA table_info(sessions)').all().some(c=>c.name==='user_id'))db.exec("ALTER TABLE sessions ADD COLUMN user_id TEXT NOT NULL DEFAULT 'local'");
 const legacy=db.prepare('SELECT * FROM owner WHERE id=1').get();
 if(legacy&&!db.prepare("SELECT 1 FROM users WHERE id='local'").get())db.prepare('INSERT OR IGNORE INTO users VALUES(?,?,?,?,?,?,?)').run('local',legacy.username,legacy.password_hash,legacy.salt,'admin',null,legacy.created_at);
 db.exec("INSERT OR IGNORE INTO user_collections SELECT 'local',name,revision,data,updated_at FROM collections; INSERT OR IGNORE INTO user_generations SELECT 'local',id,task,status,request,result,error,started_at,finished_at FROM generations;");
 const interrupted=db.prepare("SELECT user_id,id FROM user_generations WHERE status='running' AND (task!='video' OR result IS NULL)").all();
 db.prepare("UPDATE user_generations SET status='interrupted',error='服务重启，任务未完成。可以手动继续。',finished_at=? WHERE status='running' AND (task!='video' OR result IS NULL)").run(new Date().toISOString());
 const transaction=fn=>{db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}};
 let authIdentity;
 const publicUser=u=>({id:u.id,username:u.username,role:u.role,createdAt:u.created_at,hasPassword:authIdentity?authIdentity.hasPassword(u.id):true});
 const profile=username=>db.prepare('SELECT * FROM users WHERE username=? COLLATE NOCASE').get(username);
 const userCount=()=>db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
 const validUser=value=>typeof value==='string'&&/^[a-zA-Z0-9_\u4e00-\u9fff-]{3,30}$/.test(value);
 const validatePassword=p=>{if(typeof p!=='string'||p.length<8||p.length>128)throw fail('密码需为 8–128 个字符');};
 const session=userId=>{const token=randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions(token_hash,expires_at,user_id) VALUES(?,?,?)').run(hash(token),Date.now()+7*86400000,userId);db.prepare('DELETE FROM sessions WHERE expires_at<?').run(Date.now());return token;};
 const credentials=async(password,salt)=>derive(password,salt,64,{N:32768,maxmem:64*1024*1024});
 const verify=async(u,password)=>{if(typeof password!=='string'||password.length>128)return false;const actual=await credentials(password,u?.salt||'unconfigured-workspace');return !!u&&authIdentity.hasPassword(u.id)&&timingSafeEqual(Buffer.from(u.password_hash,'hex'),actual);};
 try{authIdentity=createAuthIdentityStore({db,directory,transaction,publicUser,createSession:session,now:authNow});}catch(error){db.close();throw error;}
 const saveBilling=(id,data)=>{db.prepare('INSERT INTO billing_accounts(user_id,data,updated_at,revision) VALUES(?,?,?,1) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at,revision=billing_accounts.revision+1').run(id,JSON.stringify(data),new Date().toISOString());return data;};
 const readBilling=id=>{const row=db.prepare('SELECT data FROM billing_accounts WHERE user_id=?').get(id);const before=row?JSON.parse(row.data):newBillingAccount();const current=refreshBilling(before);if(!row||current!==before)saveBilling(id,current);return current;};
 const snapshot=id=>{const account=readBilling(id);return {account,revision:db.prepare('SELECT revision FROM billing_accounts WHERE user_id=?').get(id).revision,mode:'server-demo',paymentConfigured:false};};
 const releaseDemo=id=>{for(const row of db.prepare("SELECT ticket FROM billing_requests WHERE user_id=? AND scope='demo'").all(id))settle(id,row.ticket,false);};
 const settle=(id,ticket,success)=>{const before=readBilling(id),after=finishTask(before,ticket,success);if(after!==before)saveBilling(id,after);return snapshot(id);};
 // Refund any reservation for a request that cannot still be running after restart.
 for(const row of db.prepare('SELECT user_id,data FROM billing_accounts').all()){
  let account=JSON.parse(row.data),changed=false;
  for(const entry of account.ledger.filter(e=>e.status==='pending')){
   const request=db.prepare('SELECT request_id FROM billing_requests WHERE user_id=? AND ticket=?').get(row.user_id,entry.id);
   const task=request&&db.prepare('SELECT status FROM user_generations WHERE user_id=? AND id=?').get(row.user_id,request.request_id);
   if(!task||task.status!=='running'){account=finishTask(account,entry.id,task?.status==='succeeded');changed=true;}
  }
  if(changed)saveBilling(row.user_id,account);
 }
 const reserve=(id,requestId,request,scope='demo')=>transaction(()=>{
  if(typeof requestId!=='string'||!/^[a-zA-Z0-9_:-]{8,120}$/.test(requestId))throw fail('任务编号格式不正确');
  const quote=quoteTask(request),current=readBilling(id);
  const existing=db.prepare('SELECT * FROM billing_requests WHERE user_id=? AND request_id=?').get(id,requestId);
  if(existing){
   if(existing.scope!==scope||JSON.stringify(JSON.parse(existing.quote).request)!==JSON.stringify(quote.request))throw fail('任务编号已用于不同的创作参数',409);
   const entry=current.ledger.find(e=>e.id===existing.ticket);
   if(entry?.status!=='refunded')return {...snapshot(id),ticket:existing.ticket,quote};
  }
  let result;try{result=reserveTask(current,quote);}catch(e){throw fail(e.message,e.code==='insufficient'?402:400,e.code);}
  saveBilling(id,result.account);
  db.prepare('INSERT INTO billing_requests VALUES(?,?,?,?,?) ON CONFLICT(user_id,request_id) DO UPDATE SET ticket=excluded.ticket,quote=excluded.quote').run(id,requestId,result.ticket,scope,JSON.stringify(quote));
  return {...snapshot(id),ticket:result.ticket,quote};
 });
 const forUser=(id='local')=>{
  const readCollection=name=>{const row=db.prepare('SELECT * FROM user_collections WHERE user_id=? AND name=?').get(id,name);return row?{revision:row.revision,data:JSON.parse(row.data),updatedAt:row.updated_at}:{revision:0,data:null};};
  return {
   all(){return Object.fromEntries(collections.map(name=>[name,readCollection(name)]));},
   save(name,data,revision){
    if(!collections.includes(name))throw fail('不支持的工作区记录');
    try{validateBackup({format:'mdd-workspace',version:1,works:name==='works'?data:[],[name]:data});}catch(e){throw fail(e.message);}
    return transaction(()=>{const current=readCollection(name);if(current.revision!==revision)throw fail('另一窗口更新了此记录，正在合并保存',409);if(name==='submissions'&&current.data){for(const incoming of data){const original=current.data.find(value=>value.id===incoming.id);if(!original)continue;if(original.snapshot&&JSON.stringify(original.snapshot)!==JSON.stringify(incoming.snapshot))throw fail('已留存的投递版本不能覆盖，请追加修订版');for(const version of original.versions||[]){const retained=incoming.versions?.find(value=>value.id===version.id);if(JSON.stringify(retained)!==JSON.stringify(version))throw fail('已留存的投递版本不能覆盖或删除，请追加修订版');}}}const now=new Date().toISOString();db.prepare('INSERT INTO user_collections VALUES(?,?,?,?,?) ON CONFLICT(user_id,name) DO UPDATE SET revision=excluded.revision,data=excluded.data,updated_at=excluded.updated_at').run(id,name,revision+1,JSON.stringify(data),now);return {revision:revision+1,updatedAt:now};});
   },
   beginTask(key,body){const existing=db.prepare('SELECT * FROM user_generations WHERE user_id=? AND id=?').get(id,key);if(existing)return existing;db.prepare('INSERT INTO user_generations(user_id,id,task,status,request,started_at) VALUES(?,?,?,?,?,?)').run(id,key,body.task,'running',JSON.stringify(body),new Date().toISOString());return null;},
   restartTask(key,body){db.prepare("UPDATE user_generations SET status='running',request=?,result=NULL,error=NULL,started_at=?,finished_at=NULL WHERE user_id=? AND id=? AND status IN ('interrupted','cancelled')").run(JSON.stringify(body),new Date().toISOString(),id,key);},
   pendingTask(key,result){db.prepare('UPDATE user_generations SET result=? WHERE user_id=? AND id=?').run(JSON.stringify(result),id,key);},
   mediaTasks(draftId){return db.prepare("SELECT * FROM user_generations WHERE user_id=? AND task IN ('image','video') ORDER BY started_at DESC LIMIT 100").all(id).filter(row=>!draftId||JSON.parse(row.request).draftId===draftId).map(row=>({id:row.id,task:row.task,status:row.status,error:row.error,request:JSON.parse(row.request),result:row.result?JSON.parse(row.result):null,startedAt:row.started_at}));},
   finishTask(key,result,error,status=error?'failed':'succeeded'){db.prepare('UPDATE user_generations SET status=?,result=?,error=?,finished_at=? WHERE user_id=? AND id=?').run(status,result?JSON.stringify(result):null,error||null,new Date().toISOString(),id,key);},
   tasks(){return db.prepare("SELECT id,task,status,started_at,finished_at,error,result FROM user_generations WHERE user_id=? AND task NOT IN ('image','video') ORDER BY started_at DESC LIMIT 200").all(id).map(row=>({id:row.id,task:row.task,status:row.status,startedAt:row.started_at,finishedAt:row.finished_at,error:row.error,result:row.result?((v)=>({model:v.model,usage:v.usage,text:v.text?.slice(0,100)}))(JSON.parse(row.result)):null}));},
   task(key){const row=db.prepare('SELECT * FROM user_generations WHERE user_id=? AND id=?').get(id,key);if(!row)throw fail('生成记录不存在',404);return {...row,request:JSON.parse(row.request),result:row.result?JSON.parse(row.result):null};},
   billing(){return snapshot(id);},
   purchase(offer,key){return transaction(()=>{const before=readBilling(id),after=applyDemoPurchase(before,offer,key);saveBilling(id,after);return snapshot(id);});},
   billingEnabled(enabled){if(typeof enabled!=='boolean')throw fail('请选择是否启用计费演示');return transaction(()=>{saveBilling(id,{...readBilling(id),enabled});return snapshot(id);});},
   resetBilling(){return transaction(()=>{if(readBilling(id).ledger.some(e=>e.status==='pending'))throw fail('请先完成或取消正在进行的任务',409);db.prepare('DELETE FROM billing_requests WHERE user_id=?').run(id);saveBilling(id,newBillingAccount());return snapshot(id);});},
   reserveDemo(key,request){return reserve(id,key,request,'demo');},
   settleDemo(ticket,success){if(typeof success!=='boolean')throw fail('结算状态不正确');return transaction(()=>{if(!db.prepare("SELECT 1 FROM billing_requests WHERE user_id=? AND ticket=? AND scope='demo'").get(id,ticket))throw fail('演示任务不存在',404);return settle(id,ticket,success);});},
   reserveGeneration(key,request){if(!readBilling(id).enabled)return null;return reserve(id,key,request,'generation');},
   settleGeneration(key,success){return transaction(()=>{const row=db.prepare("SELECT ticket FROM billing_requests WHERE user_id=? AND request_id=? AND scope='generation'").get(id,key);if(row)settle(id,row.ticket,success);return snapshot(id);});}
  };
 };
 const api={
  ...forUser(),forUser,...authIdentity,
  auth(token){const configured=userCount()>0;const row=token&&db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').get(hash(token),Date.now());return {configured,user:row?publicUser(row):null,spaceId:row?.id||(!configured?'local':null),canRegister:true};},
  async register(username,password){
   if(!validUser(username))throw fail('账号需为 3–30 位中文、字母、数字或下划线');validatePassword(password);
   if(profile(username))throw fail('此账号名称已存在',409);
   const salt=randomBytes(16).toString('hex'),derived=await credentials(password,salt),recoveryCode=randomBytes(24).toString('hex');
   return transaction(()=>{if(profile(username))throw fail('此账号名称已存在',409);const first=userCount()===0,userId=first?'local':randomUUID(),now=new Date().toISOString();db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)').run(userId,username,derived.toString('hex'),salt,first?'admin':'author',hash(recoveryCode),now);const user=publicUser(profile(username));return {token:session(userId),user,recoveryCode};});
  },
  async login(username,password){const u=typeof username==='string'?profile(username):null;if(!await verify(u,password)||profile(username)?.password_hash!==u.password_hash)throw fail('账号或密码不正确',401);return {token:session(u.id),user:publicUser(u)};},
  async recover(username,recoveryCode,password){
   validatePassword(password);const u=typeof username==='string'?profile(username):null;
   if(typeof recoveryCode!=='string'||recoveryCode.length>128||!u?.recovery_hash||!timingSafeEqual(Buffer.from(u.recovery_hash,'hex'),Buffer.from(hash(recoveryCode),'hex')))throw fail('账号或恢复码不正确',401);
   const expected=u.recovery_hash,salt=randomBytes(16).toString('hex'),derived=await credentials(password,salt),nextCode=randomBytes(24).toString('hex');
   return transaction(()=>{if(profile(username)?.recovery_hash!==expected)throw fail('恢复码已使用，请使用最新的恢复码',409);db.prepare('UPDATE users SET password_hash=?,salt=?,recovery_hash=? WHERE id=?').run(derived.toString('hex'),salt,hash(nextCode),u.id);db.prepare('DELETE FROM sessions WHERE user_id=?').run(u.id);releaseDemo(u.id);return {token:session(u.id),user:publicUser(profile(username)),recoveryCode:nextCode};});
  },
  async rotateRecovery(userId,password){const u=db.prepare('SELECT * FROM users WHERE id=?').get(userId);if(!await verify(u,password))throw fail('当前密码不正确',401);const code=randomBytes(24).toString('hex');return transaction(()=>{const latest=db.prepare('SELECT password_hash,recovery_hash FROM users WHERE id=?').get(userId);if(latest?.password_hash!==u.password_hash||latest?.recovery_hash!==u.recovery_hash)throw fail('账号安全信息已变化，请重新验证当前密码',409);db.prepare('UPDATE users SET recovery_hash=? WHERE id=?').run(hash(code),userId);return {recoveryCode:code};});},
  logout(token){if(!token)return;const current=db.prepare('SELECT user_id FROM sessions WHERE token_hash=?').get(hash(token));transaction(()=>{if(current)releaseDemo(current.user_id);db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token));});},
  close(){db.close();}
 };
 return api;
}
