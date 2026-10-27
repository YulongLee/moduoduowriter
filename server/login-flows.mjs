import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync,writeFileSync,chmodSync} from 'node:fs';
import {join} from 'node:path';
import {createHash,createCipheriv,createDecipheriv,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';

const hash=value=>createHash('sha256').update(String(value||'')).digest('hex');
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const same=(value,expected)=>typeof value==='string'&&value.length<=200&&timingSafeEqual(Buffer.from(hash(value),'hex'),Buffer.from(expected,'hex'));
const token=()=>randomBytes(32).toString('base64url');

// Only digests and an encrypted, short-lived verified identity are persisted.
// A browser must possess both its HttpOnly nonce and the separate polling token.
export function createLoginFlows(directory,{now=()=>Date.now()}={}) {
 mkdirSync(directory,{recursive:true,mode:0o700});
 const keyFile=join(directory,'auth-flow-key');let key;
 try{key=readFileSync(keyFile);}catch(error){if(error.code!=='ENOENT')throw error;try{writeFileSync(keyFile,randomBytes(32),{mode:0o600,flag:'wx'});}catch(value){if(value.code!=='EEXIST')throw value;}key=readFileSync(keyFile);}
 if(key.length!==32)throw fail('登录安全配置无法读取，请联系管理员。',500);chmodSync(keyFile,0o600);
 const file=join(directory,'login-flows.sqlite'),db=new DatabaseSync(file);chmodSync(file,0o600);
 db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS wechat_flows(id TEXT PRIMARY KEY,state_hash TEXT UNIQUE NOT NULL,poll_hash TEXT NOT NULL,browser_hash TEXT NOT NULL,requester_hash TEXT NOT NULL,purpose TEXT NOT NULL,user_id TEXT,app_id TEXT NOT NULL,status TEXT NOT NULL,identity TEXT,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL);");
 const transaction=fn=>{db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}};
 const seal=value=>{const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv),data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),data]).toString('base64');};
 const unseal=value=>{const data=Buffer.from(value,'base64'),decipher=createDecipheriv('aes-256-gcm',key,data.subarray(0,12));decipher.setAuthTag(data.subarray(12,28));return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)),decipher.final()]).toString('utf8'));};
 const access=(id,pollToken,browserToken)=>{
  if(typeof id!=='string'||id.length>80)throw fail('扫码请求不存在或已失效。',404);
  const row=db.prepare('SELECT * FROM wechat_flows WHERE id=?').get(id);
  if(!row||!same(pollToken,row.poll_hash)||!same(browserToken,row.browser_hash))throw fail('扫码请求不存在或已失效。',404);
  return row;
 };
 return {
  begin({browserToken,requester,appId,purpose='login',userId=null}) {
   if(typeof browserToken!=='string'||browserToken.length<32||!['login','bind'].includes(purpose)||(purpose==='bind'&&!userId)||typeof appId!=='string'||!appId)throw fail('扫码请求参数不正确。');
   return transaction(()=>{
    const timestamp=now(),requesterHash=hash(requester),browserHash=hash(browserToken);
    db.prepare('DELETE FROM wechat_flows WHERE expires_at<?').run(timestamp-3600000);
    if(db.prepare('SELECT COUNT(*) AS n FROM wechat_flows WHERE requester_hash=? AND created_at>?').get(requesterHash,timestamp-600000).n>=10)throw fail('扫码请求过于频繁，请稍后再试。',429);
    db.prepare("UPDATE wechat_flows SET status='cancelled',identity=NULL WHERE browser_hash=? AND status IN ('waiting','processing','approved')").run(browserHash);
    const id=randomUUID(),state=token(),pollToken=token(),expiresAt=timestamp+300000;
    db.prepare('INSERT INTO wechat_flows VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(id,hash(state),hash(pollToken),browserHash,requesterHash,purpose,userId,appId,'waiting',null,timestamp,expiresAt);
    return {requestId:id,state,pollToken,expiresAt:new Date(expiresAt).toISOString()};
   });
  },
  claimCallback({state,browserToken,appId}) {
   if(typeof state!=='string'||state.length>200)throw fail('扫码验证已失效，请重新获取二维码。',400);
   return transaction(()=>{
    const row=db.prepare('SELECT * FROM wechat_flows WHERE state_hash=?').get(hash(state));
    if(!row||!same(browserToken,row.browser_hash)||row.app_id!==appId||row.expires_at<=now()||row.status!=='waiting')throw fail('扫码验证已失效，请重新获取二维码。',400);
    db.prepare("UPDATE wechat_flows SET status='processing' WHERE id=?").run(row.id);return {id:row.id,purpose:row.purpose,userId:row.user_id};
   });
  },
  approve(id,identity) {
   const row=db.prepare('SELECT * FROM wechat_flows WHERE id=?').get(id);
   if(!row||row.status!=='processing'||row.expires_at<=now()||identity?.appid!==row.app_id||typeof identity.openid!=='string'||!identity.openid)throw fail('扫码请求已失效，请重新开始。',409);
   const sealed=seal({appid:identity.appid,openid:identity.openid});
   db.prepare("UPDATE wechat_flows SET status='approved',identity=? WHERE id=? AND status='processing'").run(sealed,id);
  },
  fail(id){db.prepare("UPDATE wechat_flows SET status='failed',identity=NULL WHERE id=? AND status IN ('waiting','processing')").run(id);},
  status({requestId,pollToken,browserToken}) {
   const row=access(requestId,pollToken,browserToken),expired=row.expires_at<=now();
   if(expired)db.prepare("UPDATE wechat_flows SET status='expired',identity=NULL WHERE id=?").run(row.id);
   return {status:expired?'expired':row.status==='processing'?'waiting':['cancelled','consumed'].includes(row.status)?'failed':row.status,expiresAt:new Date(row.expires_at).toISOString()};
  },
  consume({requestId,pollToken,browserToken,userId=null,appId}) {
   return transaction(()=>{
    const row=access(requestId,pollToken,browserToken);
    if(row.status!=='approved'||row.expires_at<=now()||!row.identity||(appId&&row.app_id!==appId))throw fail('扫码尚未完成或已失效，请重新开始。',409);
    if(row.purpose==='bind'&&(!userId||userId!==row.user_id))throw fail('绑定账号已变化，请重新登录后操作。',403);
    const identity=unseal(row.identity);db.prepare("UPDATE wechat_flows SET status='consumed',identity=NULL WHERE id=?").run(row.id);
    return {identity,purpose:row.purpose,userId:row.user_id};
   });
  },
  cancel({requestId,pollToken,browserToken}){const row=access(requestId,pollToken,browserToken);db.prepare("UPDATE wechat_flows SET status='cancelled',identity=NULL WHERE id=? AND status IN ('waiting','processing','approved')").run(row.id);return {ok:true};},
  close(){db.close();key.fill(0);}
 };
}
