import {createHash,createHmac,randomBytes} from 'node:crypto';
import {isIP} from 'node:net';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const clean=(value,max,label)=>{if(typeof value!=='string'||value.length>max||/[\r\n\0]/.test(value))throw fail(`${label}格式不正确`);return value.trim();};
const field=(input,previous,key,max,label)=>clean(input[key]===undefined?previous[key]:input[key],max,label);
const enabled=(input,previous)=>{if(input.enabled!==undefined&&typeof input.enabled!=='boolean')throw fail('请选择是否启用登录方式');return input.enabled===undefined?previous.enabled:input.enabled;};
const secret=(input,previous,key,clearKey,label)=>{
 if(input[clearKey]!==undefined&&typeof input[clearKey]!=='boolean')throw fail(`${label}清除选项不正确`);
 if(input[clearKey])return '';
 if(input[key]===undefined||input[key]==='')return previous[key]||'';
 if(typeof input[key]!=='string'||input[key].length>4096||/[\r\n\0]/.test(input[key]))throw fail(`${label}格式不正确`);
 return input[key];
};
const hostValid=value=>typeof value==='string'&&value.length<=253&&value.includes('.')&&!isIP(value)&&/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/i.test(value)&&!/(?:^|\.)(?:localhost|local|internal|invalid)$/i.test(value);
export const validEmail=value=>typeof value==='string'&&value.length<=254&&/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z][A-Za-z0-9-]{1,62}$/.test(value);
const validPhone=value=>typeof value==='string'&&/^(?:\+86)?1[3-9]\d{9}$/.test(value);

export const defaultAuthConfig=Object.freeze({
 phone:Object.freeze({enabled:false,accessKeyId:'',accessKeySecret:'',signName:'',templateCode:'',codeParam:'code'}),
 email:Object.freeze({enabled:false,host:'',port:465,secure:true,user:'',password:'',from:'',fromName:'墨多多'}),
 wechat:Object.freeze({enabled:false,appId:'',appSecret:'',redirectUri:''})
});

export function validateAuthConfig(value={},previous=defaultAuthConfig) {
 if(!plain(value)||!plain(previous))throw fail('登录服务配置格式不正确');
 const parts={};
 for(const channel of ['phone','email','wechat']){
  if(value[channel]!==undefined&&!plain(value[channel]))throw fail('登录服务配置格式不正确');
  parts[channel]={input:value[channel]||{},before:{...defaultAuthConfig[channel],...(previous[channel]||{})}};
 }
 const p=parts.phone,e=parts.email,w=parts.wechat;
 const phone={enabled:enabled(p.input,p.before),accessKeyId:secret(p.input,p.before,'accessKeyId','clearAccessKeyId','短信 AccessKey ID').trim(),accessKeySecret:secret(p.input,p.before,'accessKeySecret','clearAccessKeySecret','短信 AccessKey Secret').trim(),signName:field(p.input,p.before,'signName',100,'短信签名'),templateCode:field(p.input,p.before,'templateCode',64,'短信模板'),codeParam:field(p.input,p.before,'codeParam',32,'验证码变量')};
 if(phone.accessKeyId&&!/^[A-Za-z0-9_-]{8,150}$/.test(phone.accessKeyId))throw fail('短信 AccessKey ID 格式不正确');
 if(phone.templateCode&&!/^SMS_\d{1,30}$/.test(phone.templateCode))throw fail('请填写 SMS_ 开头的短信模板编号');
 if(!/^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(phone.codeParam))throw fail('短信验证码变量格式不正确');
 const port=e.input.port===undefined?e.before.port:e.input.port,secure=e.input.secure===undefined?e.before.secure:e.input.secure;
 if(!Number.isInteger(port)||port<1||port>65535||typeof secure!=='boolean'||(port===465&&!secure))throw fail('SMTP 端口或 TLS 方式不正确');
 const email={enabled:enabled(e.input,e.before),host:field(e.input,e.before,'host',253,'SMTP 主机').toLowerCase(),port,secure,user:field(e.input,e.before,'user',320,'SMTP 账号'),password:secret(e.input,e.before,'password','clearPassword','SMTP 密码'),from:field(e.input,e.before,'from',254,'发件邮箱'),fromName:field(e.input,e.before,'fromName',60,'发件名称')};
 if(email.host&&!hostValid(email.host))throw fail('SMTP 主机须为公开域名，不含协议、路径或本机地址');
 if(email.from&&!validEmail(email.from))throw fail('请填写有效的发件邮箱');
 const wechat={enabled:enabled(w.input,w.before),appId:field(w.input,w.before,'appId',80,'微信 AppID'),appSecret:secret(w.input,w.before,'appSecret','clearAppSecret','微信 AppSecret').trim(),redirectUri:field(w.input,w.before,'redirectUri',1500,'微信回调地址')};
 if(wechat.appId&&!/^wx[A-Za-z0-9]{16}$/.test(wechat.appId))throw fail('请填写有效的微信网站应用 AppID');
 if(wechat.redirectUri){
  let url;try{url=new URL(wechat.redirectUri);}catch{throw fail('微信回调地址格式不正确');}
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.port||!hostValid(url.hostname)||url.pathname!=='/api/auth/wechat/callback')throw fail('微信回调须为正式 HTTPS 域名下的 /api/auth/wechat/callback');
  wechat.redirectUri=url.href;
 }
 return {phone,email,wechat};
}

export function authMethods(config=defaultAuthConfig) {
 const settings=validateAuthConfig(config),complete={
  phone:!!(settings.phone.accessKeyId&&settings.phone.accessKeySecret&&settings.phone.signName&&settings.phone.templateCode),
  email:!!(settings.email.host&&settings.email.user&&settings.email.password&&settings.email.from),
  wechat:!!(settings.wechat.appId&&settings.wechat.appSecret&&settings.wechat.redirectUri)
 };
 const names={phone:'手机短信登录',email:'邮箱登录',wechat:'微信扫码登录'};
 return Object.fromEntries(Object.keys(complete).map(channel=>[channel,{enabled:settings[channel].enabled,configured:complete[channel],available:settings[channel].enabled&&complete[channel],reason:!settings[channel].enabled?`${names[channel]}暂未开放`:!complete[channel]?`${names[channel]}尚未完成服务配置`:''}]));
}

export function publicAuthConfig(config=defaultAuthConfig) {
 const value=validateAuthConfig(config);
 return {
  phone:{...value.phone,accessKeyId:'',accessKeySecret:'',hasAccessKeyId:!!value.phone.accessKeyId,hasAccessKeySecret:!!value.phone.accessKeySecret},
  email:{...value.email,password:'',hasPassword:!!value.email.password},
  wechat:{...value.wechat,appSecret:'',hasAppSecret:!!value.wechat.appSecret}
 };
}

const digest=value=>createHash('sha256').update(value).digest('hex');
const encode=value=>encodeURIComponent(String(value)).replace(/[!'()*]/g,char=>'%'+char.charCodeAt(0).toString(16).toUpperCase());
// Pure ACS3 implementation: production sendCode below fixes both the endpoint and action.
export function signAliyunRequest({accessKeyId,accessKeySecret,host,action,version,query={},body='',date=new Date().toISOString().replace(/\.\d{3}Z$/,'Z'),nonce=randomBytes(16).toString('hex')}) {
 const canonicalQuery=Object.entries(query).map(([key,value])=>[encode(key),encode(value)]).sort(([a,av],[b,bv])=>a<b?-1:a>b?1:av<bv?-1:av>bv?1:0).map(([key,value])=>`${key}=${value}`).join('&');
 const headers={host,'x-acs-action':action,'x-acs-content-sha256':digest(body),'x-acs-date':date,'x-acs-signature-nonce':nonce,'x-acs-version':version};
 const names=Object.keys(headers).sort(),signedHeaders=names.join(';'),canonicalHeaders=names.map(name=>`${name}:${String(headers[name]).trim()}\n`).join('');
 const canonicalRequest=['POST','/',canonicalQuery,canonicalHeaders,signedHeaders,digest(body)].join('\n');
 const stringToSign='ACS3-HMAC-SHA256\n'+digest(canonicalRequest);
 const signature=createHmac('sha256',accessKeySecret).update(stringToSign).digest('hex');
 return {url:`https://${host}/?${canonicalQuery}`,headers:{...headers,Authorization:`ACS3-HMAC-SHA256 Credential=${accessKeyId},SignedHeaders=${signedHeaders},Signature=${signature}`},body,canonicalRequest,stringToSign,signature};
}

export function wechatAuthorizationUrl(config,state,{embedded=true}={}) {
 const settings=validateAuthConfig(config);
 if(!authMethods(settings).wechat.available)throw fail('微信扫码登录尚未开放',503);
 if(typeof state!=='string'||!/^[A-Za-z0-9_-]{16,128}$/.test(state))throw fail('微信登录请求已失效，请重新获取二维码');
 const url=new URL('https://open.weixin.qq.com/connect/qrconnect');
 url.searchParams.set('appid',settings.wechat.appId);url.searchParams.set('redirect_uri',settings.wechat.redirectUri);url.searchParams.set('response_type','code');url.searchParams.set('scope','snsapi_login');url.searchParams.set('state',state);
 if(embedded){url.searchParams.set('login_type','jssdk');url.searchParams.set('self_redirect','true');}
 url.hash='wechat_redirect';return url.href;
}

async function timed(operation,timeoutMs) {
 const controller=new AbortController();let timer;
 try{return await Promise.race([Promise.resolve().then(()=>operation(controller.signal)),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(fail('登录服务响应超时，请稍后再试',502));},timeoutMs);})]);}
 finally{clearTimeout(timer);controller.abort();}
}
async function readResponse(response) {
 if(!response?.ok)throw fail('登录服务暂时不可用，请稍后再试',502);
 let bytes=0;const chunks=[];
 if(!response.body)throw fail('登录服务响应不完整，请稍后再试',502);
 for await(const chunk of response.body){bytes+=chunk.length;if(bytes>65536)throw fail('登录服务响应不正确，请稍后再试',502);chunks.push(chunk);}
 let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw fail('登录服务响应不正确，请稍后再试',502);}
 if(!plain(data))throw fail('登录服务响应不正确，请稍后再试',502);return data;
}

export function createAuthProviders({fetchImpl=globalThis.fetch,mailTransport,timeoutMs=10000,now=()=>new Date(),nonce=()=>randomBytes(16).toString('hex')}={}) {
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)throw fail('登录服务等待时间配置不正确');
 const sendCode=async(config,{channel,target,code})=>{
  const settings=validateAuthConfig(config);
  if(!['phone','email'].includes(channel)||!authMethods(settings)[channel].available)throw fail('该验证码登录方式暂未开放',503);
  if(typeof code!=='string'||!/^\d{6}$/.test(code)||(channel==='phone'?!validPhone(target):!validEmail(target)))throw fail('验证码发送参数不正确');
  if(channel==='phone'){
   const phone=settings.phone,query={PhoneNumbers:target.replace(/^\+86/,''),SignName:phone.signName,TemplateCode:phone.templateCode,TemplateParam:JSON.stringify({[phone.codeParam]:code})};
   const request=signAliyunRequest({accessKeyId:phone.accessKeyId,accessKeySecret:phone.accessKeySecret,host:'dysmsapi.aliyuncs.com',action:'SendSms',version:'2017-05-25',query,date:now().toISOString().replace(/\.\d{3}Z$/,'Z'),nonce:nonce()});
   try{await timed(async signal=>{const data=await readResponse(await fetchImpl(request.url,{method:'POST',headers:{...request.headers,Accept:'application/json'},signal,redirect:'error'}));if(data.Code!=='OK')throw fail('短信发送未成功，请稍后重试或使用其他登录方式',502);},timeoutMs);}
   catch{throw fail('短信发送未成功，请稍后重试或使用其他登录方式',502);}
  }else{
   const email=settings.email;let transport;
   try{
    const options={host:email.host,port:email.port,secure:email.secure,requireTLS:!email.secure,auth:{user:email.user,pass:email.password},tls:{rejectUnauthorized:true,minVersion:'TLSv1.2'},connectionTimeout:timeoutMs,greetingTimeout:timeoutMs,socketTimeout:timeoutMs,logger:false,debug:false,disableFileAccess:true,disableUrlAccess:true,pool:false};
    const message={from:{name:email.fromName||'墨多多',address:email.from},to:target,envelope:{from:email.from,to:[target]},subject:'墨多多登录验证码',text:`你的墨多多登录验证码是：${code}\n\n验证码 5 分钟内有效，仅用于本次登录或绑定。请勿向任何人透露验证码。\n如果不是你发起的操作，请忽略本邮件。`,disableFileAccess:true,disableUrlAccess:true};
    const result=await timed(async signal=>{
     transport=mailTransport?await mailTransport(options):(await import('nodemailer')).default.createTransport(options);
     if(signal.aborted){try{transport?.close?.();}catch{}throw fail('邮件服务响应超时',502);}
     if(typeof transport?.sendMail!=='function')throw fail('邮件服务尚未就绪',503);
     return transport.sendMail(message);
    },timeoutMs);
    if(Array.isArray(result?.rejected)&&result.rejected.length)throw fail('邮件发送未成功',502);
    if(!Array.isArray(result?.accepted)||!result.accepted.some(address=>String(address).toLowerCase()===target.toLowerCase()))throw fail('邮件发送未成功',502);
   }catch{throw fail('邮件发送未成功，请稍后重试或使用其他登录方式',502);}
   finally{try{transport?.close?.();}catch{}}
  }
  return {accepted:true};
 };
 const exchangeWechatCode=async(config,code)=>{
  const settings=validateAuthConfig(config);
  if(!authMethods(settings).wechat.available)throw fail('微信扫码登录尚未开放',503);
  if(typeof code!=='string'||!/^[A-Za-z0-9_-]{1,512}$/.test(code))throw fail('微信授权码不正确，请重新扫码');
  const url=new URL('https://api.weixin.qq.com/sns/oauth2/access_token');
  url.searchParams.set('appid',settings.wechat.appId);url.searchParams.set('secret',settings.wechat.appSecret);url.searchParams.set('code',code);url.searchParams.set('grant_type','authorization_code');
  try{return await timed(async signal=>{
   const data=await readResponse(await fetchImpl(url.href,{method:'GET',headers:{Accept:'application/json'},signal,redirect:'error'}));
   if((data.errcode!==undefined&&Number(data.errcode)!==0)||typeof data.access_token!=='string'||!data.access_token||data.access_token.length>8192||typeof data.openid!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(data.openid)||(data.unionid!==undefined&&(typeof data.unionid!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(data.unionid))))throw fail('微信授权未完成，请重新扫码',502);
   return {appid:settings.wechat.appId,openid:data.openid,...(data.unionid?{unionid:data.unionid}:{})};
  },timeoutMs);}catch{throw fail('微信授权未完成，请重新扫码或使用其他登录方式',502);}
 };
 return {sendCode,wechatAuthorizationUrl,exchangeWechatCode};
}
