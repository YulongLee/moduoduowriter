import {chmodSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHmac,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';

const fail=(message,status=400,code)=>Object.assign(new Error(message),{status,code});
const codeError=()=>fail('验证码不正确、已失效或已使用，请重新获取。',401,'invalid-code');
const channels=new Set(['phone','email']);
const validId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{16,120}$/.test(value);

export function normalizeLoginTarget(channel,value) {
 if(!channels.has(channel))throw fail('请选择手机号或邮箱登录。');
 if(typeof value!=='string'||value.length>254)throw fail(channel==='phone'?'请输入有效的中国大陆手机号。':'请输入有效的邮箱地址。');
 const input=value.trim();
 if(channel==='phone'){
  const normalized=input.replace(/[\s()-]/g,'').replace(/^0086/,'+86');
  const local=normalized.startsWith('+86')?normalized.slice(3):normalized;
  if(!/^1[3-9]\d{9}$/.test(local))throw fail('请输入有效的中国大陆手机号。');
  return '+86'+local;
 }
 const email=input.toLowerCase();
 const [local,domain,...extra]=email.split('@');
 if(extra.length||!local||local.length>64||!domain||email.length>254||!/^[-a-z0-9!#$%&'*+/=?^_`{|}~.]+$/.test(local)||local.startsWith('.')||local.endsWith('.')||local.includes('..')||!domain.includes('.')||domain.length>253||domain.split('.').some(label=>!label||label.length>63||!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)))throw fail('请输入有效的邮箱地址。');
 return email;
}

export function maskLoginTarget(channel,target) {
 const normalized=normalizeLoginTarget(channel,target);
 if(channel==='phone'){const local=normalized.slice(3);return local.slice(0,3)+'****'+local.slice(-4);}
 const [local,domain]=normalized.split('@');
 return local.slice(0,Math.min(local.length,2))+'***@'+domain;
}

function readPepper(directory,hasProtectedRecords) {
 const file=join(directory,'auth-pepper');
 let secret;
 try{secret=readFileSync(file,'utf8');}
 catch(error){
  if(error.code!=='ENOENT')throw fail('登录安全配置无法读取，请检查本机服务。',500);
  if(hasProtectedRecords)throw fail('登录安全配置缺失，请恢复原安全配置后再启动，避免身份资料失联。',500);
  const fresh=randomBytes(32).toString('hex');
  try{writeFileSync(file,fresh,{mode:0o600,flag:'wx'});secret=fresh;}
  catch(writeError){if(writeError.code!=='EEXIST')throw fail('登录安全配置无法保存，请检查本机服务。',500);secret=readFileSync(file,'utf8');}
 }
 if(!/^[a-f0-9]{64}$/.test(secret))throw fail('登录安全配置格式不正确，请保留资料并检查本机服务。',500);
 chmodSync(file,0o600);return secret;
}

export function createAuthIdentityStore({db,directory,transaction,publicUser,createSession,assertEnabled=()=>{},now=()=>Date.now()}) {
 db.exec([
  'CREATE TABLE IF NOT EXISTS auth_identities(id TEXT PRIMARY KEY,provider TEXT NOT NULL,subject_hash TEXT NOT NULL,user_id TEXT NOT NULL,masked TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(provider,subject_hash),UNIQUE(user_id,provider));',
  'CREATE TABLE IF NOT EXISTS auth_external_users(user_id TEXT PRIMARY KEY);',
  'CREATE TABLE IF NOT EXISTS auth_code_challenges(id TEXT PRIMARY KEY,channel TEXT NOT NULL,target_hash TEXT NOT NULL,requester_hash TEXT NOT NULL,purpose TEXT NOT NULL,user_id TEXT,status TEXT NOT NULL,code_hash TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,used_at INTEGER);',
  'CREATE INDEX IF NOT EXISTS auth_code_targets ON auth_code_challenges(target_hash,created_at);',
  'CREATE INDEX IF NOT EXISTS auth_code_requesters ON auth_code_challenges(requester_hash,created_at);'
 ].join('\n'));
 const hasProtectedRecords=Boolean(db.prepare('SELECT 1 FROM auth_identities LIMIT 1').get()||db.prepare('SELECT 1 FROM auth_code_challenges LIMIT 1').get());
 const pepper=readPepper(directory,hasProtectedRecords),digest=value=>createHmac('sha256',pepper).update(value).digest('hex');
 const subjectHash=(provider,subject)=>digest('identity:'+provider+':'+subject);
 const user=id=>typeof id==='string'?db.prepare('SELECT * FROM users WHERE id=?').get(id):null;
 const assertOwner=()=>{if(!db.prepare("SELECT 1 FROM users WHERE role='admin' LIMIT 1").get())throw fail('请先设置首个管理员账号，再开通其他登录方式。',409,'owner-required');};
 const assertUser=id=>{const found=user(id);if(!found)throw fail('请先登录，再绑定账号。',401);assertEnabled(id);return found;};
 const identities=userId=>{assertUser(userId);return db.prepare('SELECT id,provider,masked,created_at FROM auth_identities WHERE user_id=? ORDER BY created_at,id').all(userId).map(row=>({id:row.id,provider:row.provider,masked:row.masked,createdAt:row.created_at}));};
 const codeDigest=(id,code)=>digest('code:'+id+':'+code);
 const identity=(provider,subject)=>db.prepare('SELECT * FROM auth_identities WHERE provider=? AND subject_hash=?').get(provider,subjectHash(provider,subject));
 const hasPassword=userId=>!db.prepare('SELECT 1 FROM auth_external_users WHERE user_id=?').get(userId);
 const bind=(userId,provider,subject,masked)=>{
  const account=assertUser(userId),existing=identity(provider,subject);
  if(existing&&existing.user_id!==userId)return {error:fail('此登录方式已绑定其他账号，不能合并或替换。',409,'identity-in-use')};
  const previous=db.prepare('SELECT * FROM auth_identities WHERE user_id=? AND provider=?').get(userId,provider);
  if(previous&&previous.subject_hash!==subjectHash(provider,subject))return {error:fail('此账号已经绑定该登录方式，请先管理已有绑定。',409,'identity-already-bound')};
  if(!existing)db.prepare('INSERT INTO auth_identities VALUES(?,?,?,?,?,?)').run(randomUUID(),provider,subjectHash(provider,subject),userId,masked,new Date(now()).toISOString());
  return {user:publicUser(account),identities:identities(userId)};
 };
 const loginIdentity=(provider,subject,masked)=>{
  assertOwner();let entry=identity(provider,subject),account=entry&&user(entry.user_id),created=false;
  if(entry&&!account)throw fail('账号身份记录不完整，请联系管理员。',500);if(account)assertEnabled(account.id);
  if(!entry){
   const id=randomUUID(),prefix=provider==='phone'?'手机用户':provider==='email'?'邮箱用户':'微信用户';
   const username=prefix+'_'+randomBytes(6).toString('hex'),date=new Date(now()).toISOString();
   db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)').run(id,username,randomBytes(64).toString('hex'),randomBytes(16).toString('hex'),'author',null,date);
   db.prepare('INSERT INTO auth_external_users VALUES(?)').run(id);
   db.prepare('INSERT INTO auth_identities VALUES(?,?,?,?,?,?)').run(randomUUID(),provider,subjectHash(provider,subject),id,masked,date);
   account=user(id);created=true;
  }
  return {token:createSession(account.id),user:publicUser(account),created};
 };
 const consume=({channel,target,challengeId,code,purpose,userId})=>{
  const normalized=normalizeLoginTarget(channel,target);
  if(!validId(challengeId))return {error:codeError()};
  const row=db.prepare('SELECT * FROM auth_code_challenges WHERE id=?').get(challengeId),time=now();
  if(!row||row.status!=='active')return {error:codeError()};
  if(row.expires_at<=time){db.prepare("UPDATE auth_code_challenges SET status='expired',code_hash='' WHERE id=?").run(row.id);return {error:codeError()};}
  const supplied=typeof code==='string'&&/^\d{6}$/.test(code)?code:'invalid';
  const matches=row.channel===channel&&row.target_hash===subjectHash(channel,normalized)&&row.purpose===purpose&&(row.user_id||null)===(userId||null)&&timingSafeEqual(Buffer.from(row.code_hash,'hex'),Buffer.from(codeDigest(row.id,supplied),'hex'));
  if(!matches){const attempts=row.attempts+1;db.prepare('UPDATE auth_code_challenges SET attempts=?,status=?,code_hash=? WHERE id=?').run(attempts,attempts>=5?'locked':'active',attempts>=5?'':row.code_hash,row.id);return {error:codeError()};}
  db.prepare("UPDATE auth_code_challenges SET status='used',code_hash='',used_at=? WHERE id=?").run(time,row.id);
  return {normalized};
 };
 const unwrap=value=>{if(value.error)throw value.error;return value;};
 const providerSubject=({provider,subject})=>{
  if(provider!=='wechat'||typeof subject!=='string'||!/^[-_a-zA-Z0-9]{1,128}:[-_a-zA-Z0-9]{1,256}$/.test(subject))throw fail('微信身份格式不正确。');
  return subject;
 };
 return {
  hasPassword,identities,
  createCodeChallenge({channel,target,code,requester,purpose='login',userId=null,ttlMs=300000}) {
   assertOwner();const normalized=normalizeLoginTarget(channel,target);
   if(typeof code!=='string'||!/^\d{6}$/.test(code)||typeof requester!=='string'||!requester||requester.length>500||!['login','bind'].includes(purpose)||!Number.isInteger(ttlMs)||ttlMs<1000||ttlMs>300000)throw fail('验证码请求格式不正确。');
   if(purpose==='bind')assertUser(userId);else if(userId!==null)throw fail('登录请求不能绑定其他账号。');
   return transaction(()=>{
    const time=now(),targetKey=subjectHash(channel,normalized),requesterKey=digest('requester:'+requester);
    db.prepare('DELETE FROM auth_code_challenges WHERE created_at<?').run(time-2*86400000);
    const latest=db.prepare('SELECT created_at FROM auth_code_challenges WHERE target_hash=? ORDER BY created_at DESC LIMIT 1').get(targetKey);
    if(latest&&time-latest.created_at<60000)throw fail('请稍后再获取验证码。',429,'code-cooldown');
    const count=(column,key,since)=>db.prepare('SELECT COUNT(*) AS n FROM auth_code_challenges WHERE '+column+'=? AND created_at>?').get(key,since).n;
    if(count('target_hash',targetKey,time-3600000)>=5||count('target_hash',targetKey,time-86400000)>=20||count('requester_hash',requesterKey,time-900000)>=20||count('requester_hash',requesterKey,time-86400000)>=100)throw fail('验证码请求过于频繁，请稍后再试。',429,'code-rate-limit');
    db.prepare("UPDATE auth_code_challenges SET status='superseded',code_hash='' WHERE target_hash=? AND status IN ('pending','active')").run(targetKey);
    const id=randomBytes(24).toString('base64url'),expiresAt=time+ttlMs;
    db.prepare('INSERT INTO auth_code_challenges(id,channel,target_hash,requester_hash,purpose,user_id,status,code_hash,attempts,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,channel,targetKey,requesterKey,purpose,userId,'pending',codeDigest(id,code),0,time,expiresAt);
    return {id,expiresAt:new Date(expiresAt).toISOString(),retryAfter:60};
   });
  },
  activateCodeChallenge(id) {
   if(!validId(id))throw fail('验证码请求不存在。',404);
   const result=db.prepare("UPDATE auth_code_challenges SET status='active' WHERE id=? AND status='pending' AND expires_at>?").run(id,now());
   if(!result.changes)throw fail('验证码请求已过期或被替换，请重新获取。',409);
   return {ok:true};
  },
  failCodeChallenge(id) {if(validId(id))db.prepare("UPDATE auth_code_challenges SET status='failed',code_hash='' WHERE id=? AND status='pending'").run(id);return {ok:true};},
  loginWithCode(input) {assertOwner();return unwrap(transaction(()=>{const result=consume({...input,purpose:'login',userId:null});return result.error?result:loginIdentity(input.channel,result.normalized,maskLoginTarget(input.channel,result.normalized));}));},
  bindWithCode(input) {assertUser(input.userId);return unwrap(transaction(()=>{const result=consume({...input,purpose:'bind'});return result.error?result:bind(input.userId,input.channel,result.normalized,maskLoginTarget(input.channel,result.normalized));}));},
  providerLogin(input) {const subject=providerSubject(input);assertOwner();return transaction(()=>loginIdentity(input.provider,subject,'已绑定微信'));},
  bindProviderIdentity(input) {const subject=providerSubject(input);assertOwner();return unwrap(transaction(()=>bind(input.userId,input.provider,subject,'已绑定微信')));}
 };
}
