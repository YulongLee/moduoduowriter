import {promises as fs} from 'node:fs';
import {join} from 'node:path';
import {randomBytes,randomInt,randomUUID} from 'node:crypto';
import {defaultAuthConfig,validateAuthConfig,publicAuthConfig,authMethods,createAuthProviders,wechatAuthorizationUrl} from './auth-providers.mjs';
import {createLoginFlows} from './login-flows.mjs';
import {normalizeLoginTarget} from './auth-identity.mjs';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const cookieValue=(req,name)=>String(req.headers.cookie||'').split(';').map(value=>value.trim()).find(value=>value.startsWith(name+'='))?.slice(name.length+1)||'';
const nonceValid=value=>/^[a-f0-9]{64}$/.test(value);
const callbackPath='/api/auth/wechat/callback';

export function createLoginApi({directory,database,fetchImpl,sendJSON,readBody,setSessionCookie,publicOrigin='',mailTransport}) {
 const file=join(directory,'auth.json'),providers=createAuthProviders({fetchImpl,mailTransport});let flows,queue=Promise.resolve();
 const getFlows=()=>flows||(flows=createLoginFlows(directory));
 const load=async()=>{try{return validateAuthConfig(JSON.parse(await fs.readFile(file,'utf8')),defaultAuthConfig);}catch(error){if(error.code==='ENOENT')return structuredClone(defaultAuthConfig);throw fail('登录配置无法读取，请管理员检查配置文件。',500);}};
 const save=body=>{const job=queue.then(async()=>{const config=validateAuthConfig(body,await load());await fs.mkdir(directory,{recursive:true,mode:0o700});const temp=file+'.'+randomUUID()+'.tmp';try{await fs.writeFile(temp,JSON.stringify(config),{mode:0o600});await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true}).catch(()=>{});}return config;});queue=job.catch(()=>{});return job;};
 const status=(config,auth,origin)=>{
  const result=authMethods(config);
  for(const name of ['phone','email','wechat'])if(!auth.configured)result[name]={...result[name],available:false,reason:'请先设置首个管理员账号，再启用此登录方式。'};
  if(result.wechat.available&&(!publicOrigin||origin!==publicOrigin||new URL(config.wechat.redirectUri).origin!==publicOrigin))result.wechat={...result.wechat,available:false,reason:'微信登录需要通过已配置的正式域名访问，当前环境尚未就绪。'};
  return {...result,ownerConfigured:auth.configured};
 };
 const assertAvailable=(methods,name)=>{if(!methods[name]?.available)throw fail(methods[name]?.reason||'此登录方式尚未配置。',503);};
 const authenticated=(req,auth)=>{
  if(!auth.user)throw fail('请先登录后管理账号绑定。',401);
  if(req.headers['x-mdd-space']&&req.headers['x-mdd-space']!==auth.user.id)throw fail('账号空间已切换，请重新登录后操作。',412);
  return auth.user.id;
 };
 const callbackResponse=(res,ok)=>{res.writeHead(ok?200:400,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self'"});res.end(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>墨多多微信登录</title><body style="font-family:system-ui;padding:32px;color:#245f4b"><h2>${ok?'微信身份已确认':'微信登录未完成'}</h2><p>${ok?'请回到墨多多页面继续，当前窗口可以关闭。':'请回到打开二维码的浏览器重试；也可使用新窗口微信登录。'}</p></body></html>`);};
 return {
  async handle(req,res,{url,origin,secure=false}) {
   const path=url.pathname;
   if(!['/api/auth/methods','/api/auth/settings','/api/auth/code/send','/api/auth/code/login','/api/auth/identities','/api/auth/identities/code/send','/api/auth/identities/code/bind','/api/auth/wechat/start','/api/auth/wechat/status','/api/auth/wechat/consume','/api/auth/wechat/cancel',callbackPath].includes(path))return false;
   const auth=database().auth(cookieValue(req,'mdd_session'));
   if(path==='/api/auth/settings'){
    authenticated(req,auth);if(auth.user.role!=='admin')throw fail('登录服务配置需要管理员权限。',403);
    if(req.method==='GET'){sendJSON(res,200,publicAuthConfig(await load()));return true;}
    if(req.method==='PUT'){const saved=await save(await readBody(req,20000));database().addAdminAudit({actorId:auth.user.id,action:'login-settings.update',targetLabel:'登录服务配置'});sendJSON(res,200,publicAuthConfig(saved));return true;}
    throw fail('不支持的请求方式。',405);
   }
   if(path==='/api/auth/identities'&&req.method==='GET'){const userId=authenticated(req,auth);sendJSON(res,200,{identities:database().identities(userId)});return true;}
   const config=await load(),methods=status(config,auth,origin);
   if(path==='/api/auth/methods'&&req.method==='GET'){sendJSON(res,200,methods);return true;}
   if(path===callbackPath&&req.method==='GET'){
    let claim;
    try{
     assertAvailable(methods,'wechat');claim=getFlows().claimCallback({state:url.searchParams.get('state'),browserToken:cookieValue(req,'mdd_login_browser'),appId:config.wechat.appId});
     const code=url.searchParams.get('code');if(typeof code!=='string'||!code||code.length>1000)throw fail('微信授权已取消。');
     const identity=await providers.exchangeWechatCode(config,code);getFlows().approve(claim.id,identity);callbackResponse(res,true);
    }catch{if(claim)getFlows().fail(claim.id);callbackResponse(res,false);}return true;
   }
   if(req.method!=='POST')throw fail('不支持的请求方式。',405);
   const body=await readBody(req,5000),requester=req.socket?.remoteAddress||'local';
   if(['/api/auth/code/send','/api/auth/identities/code/send'].includes(path)){
    const channel=body.channel;if(!['phone','email'].includes(channel))throw fail('请选择手机号或邮箱登录。');assertAvailable(methods,channel);
    const binding=path.includes('/identities/'),userId=binding?authenticated(req,auth):null,code=String(randomInt(0,1000000)).padStart(6,'0'),target=normalizeLoginTarget(channel,body.target);
    const challenge=database().createCodeChallenge({channel,target,code,requester,purpose:binding?'bind':'login',userId});
    try{await providers.sendCode(config,{channel,target,code});database().activateCodeChallenge(challenge.id);}catch(error){database().failCodeChallenge(challenge.id);throw error;}
    sendJSON(res,200,{challengeId:challenge.id,expiresAt:challenge.expiresAt,retryAfter:challenge.retryAfter});return true;
   }
   if(['/api/auth/code/login','/api/auth/identities/code/bind'].includes(path)){
    if(!['phone','email'].includes(body.channel))throw fail('请选择手机号或邮箱登录。');assertAvailable(methods,body.channel);
    const input={channel:body.channel,target:body.target,challengeId:body.challengeId,code:body.code};
    if(path.includes('/identities/')){const result=database().bindWithCode({...input,userId:authenticated(req,auth)});sendJSON(res,200,{...result,bound:true});}
    else{const result=database().loginWithCode(input);setSessionCookie(res,result.token,secure);sendJSON(res,200,{user:result.user,created:result.created});}return true;
   }
   if(path==='/api/auth/wechat/start'){
    assertAvailable(methods,'wechat');const purpose=body.purpose==='bind'?'bind':'login',userId=purpose==='bind'?authenticated(req,auth):null;
    let browserToken=cookieValue(req,'mdd_login_browser');if(!nonceValid(browserToken))browserToken=randomBytes(32).toString('hex');
    const flow=getFlows().begin({browserToken,requester,appId:config.wechat.appId,purpose,userId});
    res.setHeader('Set-Cookie',`mdd_login_browser=${browserToken}; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age=600${secure?'; Secure':''}`);
    sendJSON(res,200,{requestId:flow.requestId,pollToken:flow.pollToken,expiresAt:flow.expiresAt,authorizationUrl:wechatAuthorizationUrl(config,flow.state),openUrl:wechatAuthorizationUrl(config,flow.state,{embedded:false})});return true;
   }
   const input={requestId:body.requestId,pollToken:body.pollToken,browserToken:cookieValue(req,'mdd_login_browser')};
   if(path==='/api/auth/wechat/status'){sendJSON(res,200,getFlows().status(input));return true;}
   if(path==='/api/auth/wechat/cancel'){sendJSON(res,200,getFlows().cancel(input));return true;}
   if(path==='/api/auth/wechat/consume'){
    assertAvailable(methods,'wechat');if(auth.user)authenticated(req,auth);const flow=getFlows().consume({...input,userId:auth.user?.id||null,appId:config.wechat.appId}),subject=flow.identity.appid+':'+flow.identity.openid;
    if(flow.purpose==='bind'){authenticated(req,auth);sendJSON(res,200,{...database().bindProviderIdentity({userId:flow.userId,provider:'wechat',subject}),bound:true});}
    else{const result=database().providerLogin({provider:'wechat',subject});setSessionCookie(res,result.token,secure);sendJSON(res,200,{user:result.user,created:result.created});}return true;
   }
   throw fail('不支持的登录请求。',404);
  },
  close(){flows?.close();}
 };
}
