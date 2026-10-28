const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const sessionToken=req=>String(req.headers.cookie||'').split(';').map(value=>value.trim()).find(value=>value.startsWith('mdd_session='))?.slice(12)||'';
const pagination=url=>{
 const number=(key,fallback,max)=>{const raw=url.searchParams.get(key);if(raw===null)return fallback;if(!/^\d{1,7}$/.test(raw))throw fail('分页参数不正确。');const value=Number(raw);if(value<1||value>max)throw fail('分页参数超出范围。');return value;};
 const q=url.searchParams.get('q')||'',status=url.searchParams.get('status')||'';
 if(q.length>254||/[\r\n\0]/.test(q))throw fail('搜索内容过长或格式不正确。');
 return {page:number('page',1,1000000),pageSize:number('pageSize',20,100),q:q.trim(),status};
};
export function createAdminApi({database,sendJSON,readBody}) {
 return async(req,res,{url})=>{
  if(!url.pathname.startsWith('/api/admin/'))return false;
  const store=database(),auth=store.auth(sessionToken(req));
  if(!auth.configured||!auth.user)throw fail('请先登录管理员账号。',401);
  if(auth.user.role!=='admin')throw fail('此页面仅供管理员访问。',403);
  if(req.headers['x-mdd-space']&&req.headers['x-mdd-space']!==auth.user.id)throw fail('账号空间已变化，请重新登录后操作。',412);
  const path=url.pathname;
  if(req.method==='GET'){
   const input=pagination(url);let data;
   if(path==='/api/admin/overview')data=store.adminOverview();
   else if(path==='/api/admin/users')data=store.adminUsers(input);
   else if(path==='/api/admin/generations')data=store.adminGenerations(input);
   else if(path==='/api/admin/orders')data=store.adminOrders(input);
   else if(path==='/api/admin/audit')data=store.adminAudit(input);
   else throw fail('后台接口不存在。',404);
   sendJSON(res,200,data);return true;
  }
  const match=path.match(/^\/api\/admin\/users\/([a-zA-Z0-9_-]{1,120})\/status$/);
  if(match&&req.method==='PUT'){
   const body=await readBody(req,1000);if(!body||typeof body!=='object'||Array.isArray(body)||!['active','disabled'].includes(body.status))throw fail('请选择启用或停用。');
   const result=store.setUserStatus({actorId:auth.user.id,userId:match[1],status:body.status});sendJSON(res,200,{user:result});return true;
  }
  throw fail('不支持的后台操作。',405);
 };
}
