import {randomBytes,randomUUID} from 'node:crypto';
import {normalizeLoginTarget} from './auth-identity.mjs';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const safeJSON=value=>{try{return JSON.parse(value);}catch{return null;}};
const positive=value=>Number.isFinite(value)&&value>0?Math.floor(value):0;
const usage=result=>{const value=safeJSON(result)?.usage;return {inputTokens:positive(value?.inputTokens),outputTokens:positive(value?.outputTokens),totalTokens:positive(value?.totalTokens)};};
const queryOptions=input=>{const page=Number(input?.page??1),pageSize=Number(input?.pageSize??20),q=String(input?.q??'').trim();if(!Number.isInteger(page)||page<1||page>1000000||!Number.isInteger(pageSize)||pageSize<1||pageSize>100||q.length>254)throw fail('分页或搜索参数不正确。');return {page,pageSize,q};};
const paginate=(items,{page,pageSize})=>({items:items.slice((page-1)*pageSize,page*pageSize),total:items.length,page,pageSize});
const includes=(value,q)=>String(value||'').toLowerCase().includes(q.toLowerCase());
const workStats=data=>{const works=safeJSON(data);if(!Array.isArray(works))return {total:0,words:0,chapters:0};return works.filter(work=>work&&typeof work==='object'&&!work.deletedAt&&!work.deleted).reduce((result,work)=>{result.total++;for(const chapter of Array.isArray(work.chapters)?work.chapters:[]){result.chapters++;result.words+=typeof chapter?.text==='string'?chapter.text.replace(/\s/g,'').length:0;}return result;},{total:0,words:0,chapters:0});};

export function createAdminStore({db,transaction,publicUser,profile,credentials,validatePassword,now=()=>Date.now()}) {
 db.exec("CREATE TABLE IF NOT EXISTS user_controls(user_id TEXT PRIMARY KEY,status TEXT NOT NULL CHECK(status IN ('active','disabled')),updated_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS auth_username_aliases(alias TEXT COLLATE NOCASE PRIMARY KEY,user_id TEXT NOT NULL); CREATE TABLE IF NOT EXISTS admin_audit(id TEXT PRIMARY KEY,actor_id TEXT NOT NULL,actor_name TEXT NOT NULL,action TEXT NOT NULL,target_id TEXT,target_label TEXT NOT NULL,created_at TEXT NOT NULL); CREATE INDEX IF NOT EXISTS admin_audit_date ON admin_audit(created_at);");
 const userStatus=userId=>db.prepare('SELECT status FROM user_controls WHERE user_id=?').get(userId)?.status||'active';
 const assertEnabled=userId=>{if(userStatus(userId)!=='active')throw fail('此账号已停用，请联系管理员。',403);};
 const administrator=actorId=>{if(typeof actorId!=='string'||!actorId||actorId.length>120)throw fail('此操作需要管理员权限。',403);const user=db.prepare('SELECT * FROM users WHERE id=?').get(actorId);if(!user||user.role!=='admin')throw fail('此操作需要管理员权限。',403);assertEnabled(actorId);return user;};
 const audit=({actorId,actorName,action,targetId=null,targetLabel=''})=>{if(typeof action!=='string'||action.length<1||action.length>80||typeof targetLabel!=='string'||targetLabel.length>254||/[\r\n\0]/.test(action+targetLabel)||targetId!==null&&(typeof targetId!=='string'||targetId.length>120))throw fail('审计记录格式不正确。');const item={id:randomUUID(),actorId,actorName,action,targetId,targetLabel,createdAt:new Date(now()).toISOString()};db.prepare('INSERT INTO admin_audit VALUES(?,?,?,?,?,?,?)').run(item.id,item.actorId,item.actorName,item.action,item.targetId,item.targetLabel,item.createdAt);return item;};
 const auditRows=()=>db.prepare('SELECT id,actor_id AS actorId,actor_name AS actorName,action,target_id AS targetId,target_label AS targetLabel,created_at AS createdAt FROM admin_audit ORDER BY created_at DESC,id DESC').all();
 const taskRows=()=>db.prepare('SELECT g.id,g.user_id AS userId,COALESCE(u.username,\'已移除账号\') AS username,g.task,g.status,g.started_at AS startedAt,g.finished_at AS finishedAt,g.result,g.error IS NOT NULL AS hasError FROM user_generations g LEFT JOIN users u ON u.id=g.user_id ORDER BY g.started_at DESC,g.id DESC').all().map(({result,...item})=>({...item,hasError:Boolean(item.hasError),usage:usage(result)}));
 const orderRows=()=>db.prepare('SELECT b.user_id AS userId,COALESCE(u.username,\'已移除账号\') AS username,b.data FROM billing_accounts b LEFT JOIN users u ON u.id=b.user_id').all().flatMap(({data,userId,username})=>{const orders=safeJSON(data)?.orders;return (Array.isArray(orders)?orders:[]).filter(order=>order&&typeof order==='object').map(order=>({id:String(order.id||''),userId,username,name:String(order.name||''),amount:positive(order.amount),credits:positive(order.credits),kind:order.kind==='plan'?'plan':'pack',status:'demo-completed',createdAt:order.createdAt,expiresAt:order.expiresAt}));}).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)||a.id.localeCompare(b.id));
 return {
  userStatus,assertEnabled,
  addAdminAudit(input){const actor=administrator(input.actorId);return audit({...input,actorName:actor.username});},
  async provisionAdmin({username,password}) {
   const normalized=normalizeLoginTarget('email',username);validatePassword(password);const salt=randomBytes(16).toString('hex'),derived=await credentials(password,salt);
   return transaction(()=>{
    let account=profile(normalized),created=false;
    if(account&&account.role!=='admin')throw fail('此邮箱已用于普通账号，不能自动提升管理员，请先核实账号归属。',409);
    if(!account)account=db.prepare("SELECT * FROM users WHERE id='local' AND role='admin'").get()||db.prepare("SELECT * FROM users WHERE role='admin' ORDER BY created_at LIMIT 1").get();
    if(account){
     db.prepare('UPDATE users SET password_hash=?,salt=?,role=\'admin\',recovery_hash=NULL WHERE id=?').run(derived.toString('hex'),salt,account.id);
     db.prepare('DELETE FROM auth_external_users WHERE user_id=?').run(account.id);
     if(account.username.toLowerCase()!==normalized)db.prepare('INSERT INTO auth_username_aliases(alias,user_id) VALUES(?,?) ON CONFLICT(alias) DO UPDATE SET user_id=excluded.user_id').run(normalized,account.id);
    }else{
     created=true;const id=db.prepare('SELECT 1 FROM users LIMIT 1').get()?randomUUID():'local';
     db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)').run(id,normalized,derived.toString('hex'),salt,'admin',null,new Date(now()).toISOString());account=db.prepare('SELECT * FROM users WHERE id=?').get(id);
    }
    db.prepare("INSERT INTO user_controls VALUES(?,'active',?) ON CONFLICT(user_id) DO UPDATE SET status='active',updated_at=excluded.updated_at").run(account.id,new Date(now()).toISOString());db.prepare('DELETE FROM sessions WHERE user_id=?').run(account.id);
    audit({actorId:'system',actorName:'本地管理员初始化',action:'admin.provision',targetId:account.id,targetLabel:normalized});
    return {user:publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(account.id)),loginAlias:normalized,created};
   });
  },
  adminUsers(input={}) {
   const options=queryOptions(input);if(input.status&&!['active','disabled'].includes(input.status))throw fail('账号状态筛选不正确。');
   const works=new Map(db.prepare("SELECT user_id,data FROM user_collections WHERE name='works'").all().map(row=>[row.user_id,workStats(row.data).total]));
   const counts=new Map(db.prepare('SELECT user_id,COUNT(*) AS n FROM user_generations GROUP BY user_id').all().map(row=>[row.user_id,row.n]));
   const users=db.prepare('SELECT * FROM users ORDER BY created_at DESC,id DESC').all().map(user=>({...publicUser(user),status:userStatus(user.id),providers:db.prepare('SELECT provider FROM auth_identities WHERE user_id=? ORDER BY provider').all(user.id).map(item=>item.provider),workCount:works.get(user.id)||0,generationCount:counts.get(user.id)||0}));
   return paginate(users.filter(user=>(!input.status||user.status===input.status)&&(!options.q||includes(user.username,options.q)||includes(user.id,options.q)||db.prepare('SELECT alias FROM auth_username_aliases WHERE user_id=?').all(user.id).some(row=>includes(row.alias,options.q)))),options);
  },
  setUserStatus({actorId,userId,status}) {
   if(!['active','disabled'].includes(status)||typeof userId!=='string'||userId.length>120)throw fail('账号状态参数不正确。');
   return transaction(()=>{administrator(actorId);const user=db.prepare('SELECT * FROM users WHERE id=?').get(userId);if(!user)throw fail('账号不存在。',404);if(status==='disabled'&&userId===actorId)throw fail('不能停用当前管理员账号。',409);if(status==='disabled'&&user.role==='admin'&&db.prepare("SELECT COUNT(*) AS n FROM users u LEFT JOIN user_controls c ON c.user_id=u.id WHERE u.role='admin' AND COALESCE(c.status,'active')='active'").get().n<=1)throw fail('至少保留一个可用管理员账号。',409);
    db.prepare('INSERT INTO user_controls VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at').run(userId,status,new Date(now()).toISOString());if(status==='disabled')db.prepare('DELETE FROM sessions WHERE user_id=?').run(userId);
    const actor=administrator(actorId);audit({actorId,actorName:actor.username,action:status==='disabled'?'user.disable':'user.enable',targetId:userId,targetLabel:user.username});return {...publicUser(user),status};
   });
  },
  adminGenerations(input={}){const options=queryOptions(input);if(input.status&&!['running','succeeded','failed','interrupted','cancelled'].includes(input.status))throw fail('任务状态筛选不正确。');return paginate(taskRows().filter(item=>(!input.status||item.status===input.status)&&(!options.q||[item.id,item.username,item.task].some(value=>includes(value,options.q)))),options);},
  adminOrders(input={}){const options=queryOptions(input);return {...paginate(orderRows().filter(item=>!options.q||[item.id,item.username,item.name].some(value=>includes(value,options.q))),options),mode:'server-demo'};},
  adminAudit(input={}){const options=queryOptions(input);return paginate(auditRows().filter(item=>!options.q||[item.actorName,item.action,item.targetLabel].some(value=>includes(value,options.q))),options);},
  adminOverview() {
   const users=db.prepare('SELECT id,role,created_at FROM users').all(),works={total:0,words:0,chapters:0};
   for(const row of db.prepare("SELECT data FROM user_collections WHERE name='works'").all()){const stats=workStats(row.data);for(const name of Object.keys(works))works[name]+=stats[name];}
   const tasks=taskRows(),orders=orderRows(),generations={total:tasks.length,succeeded:0,failed:0,running:0,interrupted:0,totalTokens:0,inputTokens:0,outputTokens:0};
   for(const task of tasks){if(Object.hasOwn(generations,task.status))generations[task.status]++;for(const name of ['totalTokens','inputTokens','outputTokens'])generations[name]+=task.usage[name];}
   const trend=Array.from({length:7},(_,index)=>{const date=new Date(now()-(6-index)*86400000).toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'});const matches=value=>new Date(value).toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'})===date;const recent=tasks.filter(item=>matches(item.startedAt));return {date,users:users.filter(item=>matches(item.created_at)).length,generations:recent.length,tokens:recent.reduce((sum,item)=>sum+item.usage.totalTokens,0)};});
   return {users:{total:users.length,active:users.filter(user=>userStatus(user.id)==='active').length,disabled:users.filter(user=>userStatus(user.id)==='disabled').length,admins:users.filter(user=>user.role==='admin').length},works,generations,orders:{total:orders.length,amountCents:orders.reduce((sum,item)=>sum+item.amount,0),credits:orders.reduce((sum,item)=>sum+item.credits,0),mode:'server-demo'},trend,recentAudit:auditRows().slice(0,6)};
  }
 };
}
