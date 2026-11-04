// Isolated Alipay PC page-pay primitives. No routes, requests, ledger mutations,
// or automatic fulfilment are installed by this module.
import {createPrivateKey,createPublicKey,sign,verify} from 'node:crypto';

const fail=message=>{throw new Error(message);};
const GATEWAYS=Object.freeze({production:'https://openapi.alipay.com/gateway.do',sandbox:'https://openapi-sandbox.dl.alipaydev.com/gateway.do'});
const exact=(v,re,message)=>{if(typeof v!=='string'||!re.test(v))fail(message);return v;};
const rsa=(key,privateKey=false)=>{let parsed;try{parsed=privateKey?createPrivateKey(key):createPublicKey(key);}catch{fail('支付宝密钥无效');}if(parsed.asymmetricKeyType!=='rsa'||(parsed.asymmetricKeyDetails?.modulusLength||0)<2048)fail('支付宝密钥须为至少 2048 位 RSA 密钥');return parsed;};
const clean=(params,excluded)=>Object.keys(params).filter(k=>!excluded.includes(k)&&params[k]!==''&&params[k]!==undefined&&params[k]!==null).sort().map(k=>`${k}=${params[k]}`).join('&');
const amountString=cents=>{if(!Number.isSafeInteger(cents)||cents<=0||cents>10000000000)fail('订单金额无效');return `${Math.floor(cents/100)}.${String(cents%100).padStart(2,'0')}`;};
const amountCents=value=>{exact(value,/^(?:0|[1-9]\d{0,9})\.\d{2}$/,'支付金额格式无效');const [yuan,fraction]=value.split('.');const n=Number(yuan)*100+Number(fraction);if(!Number.isSafeInteger(n)||n<=0)fail('支付金额无效');return n;};
const endpoint=(value,origin)=>{let u,base;try{u=new URL(value);base=new URL(origin);}catch{fail('支付回调地址无效');}if(u.protocol!=='https:'||base.protocol!=='https:'||base.origin!==origin||u.origin!==base.origin||u.username||u.password||u.hash)fail('支付回调地址须属于指定 HTTPS 网站');return u.href;};
const timestamp=date=>{if(!(date instanceof Date)||!Number.isFinite(date.getTime()))fail('支付时间无效');const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date);const p=Object.fromEntries(parts.map(v=>[v.type,v.value]));return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;};

/** Construct an Alipay-hosted PC cashier URL from a pre-existing server order.
 * The caller MUST persist and price the order before calling. Never use a client
 * price. Returning to returnUrl is informational, never proof of payment. */
export function createAlipayPagePayUrl({config,order,origin,notifyUrl,returnUrl,now=new Date()}){
 const appId=exact(config?.appId,/^\d{6,80}$/,'支付宝应用 ID 无效');
 const privateKey=rsa(config.privateKey,true);
 const gateway=GATEWAYS[config.environment];if(!gateway)fail('支付环境无效');
 const id=exact(order?.id,/^[A-Za-z0-9_-]{1,64}$/,'商户订单号无效');
 const subject=exact(order?.subject,/^[^\x00-\x1f\x7f]{1,128}$/u,'订单名称无效');
 const params={app_id:appId,method:'alipay.trade.page.pay',format:'JSON',charset:'utf-8',sign_type:'RSA2',timestamp:timestamp(now),version:'1.0',notify_url:endpoint(notifyUrl,origin),return_url:endpoint(returnUrl,origin),biz_content:JSON.stringify({out_trade_no:id,total_amount:amountString(order.amountCents),subject,product_code:'FAST_INSTANT_TRADE_PAY'})};
 params.sign=sign('RSA-SHA256',Buffer.from(clean(params,['sign']),'utf8'),privateKey).toString('base64');
 return `${gateway}?${new URLSearchParams(params).toString()}`;
}

/** Verify a complete form-encoded async notification against a stored order.
 * This validates only the notification. Callers must perform atomic idempotent
 * order transition, unique trade-number checks and entitlement grant separately. */
export function verifyAlipayNotification({body,config,order}){
 const raw=typeof body==='string'?body:new TextDecoder('utf-8',{fatal:true}).decode(body);
 if(Buffer.byteLength(raw)>65536||/%(?![\da-f]{2})/i.test(raw))fail('支付通知格式无效');
 const entries=new URLSearchParams(raw),params=Object.create(null);
 for(const [key,value] of entries){if(!/^[A-Za-z0-9_]{1,100}$/.test(key)||Object.hasOwn(params,key)||value.includes('\ufffd'))fail('支付通知包含重复或无效参数');params[key]=value;}
 if(params.sign_type!=='RSA2'||params.charset?.toLowerCase()!=='utf-8'||!params.sign||!/^[A-Za-z0-9+/]+={0,2}$/.test(params.sign))fail('支付通知签名格式无效');
 let valid=false;try{valid=verify('RSA-SHA256',Buffer.from(clean(params,['sign','sign_type']),'utf8'),rsa(config?.alipayPublicKey),Buffer.from(params.sign,'base64'));}catch{valid=false;}if(!valid)fail('支付通知验签失败');
 const appId=exact(config?.appId,/^\d{6,80}$/,'支付宝应用 ID 无效');
 const sellerId=exact(config?.sellerId,/^\d{6,32}$/,'支付宝收款方 ID 无效');
 const expectedId=exact(order?.id,/^[A-Za-z0-9_-]{1,64}$/,'商户订单号无效');
 amountString(order.amountCents);
 if(params.app_id!==appId||params.seller_id!==sellerId||params.out_trade_no!==expectedId||amountCents(params.total_amount)!==order.amountCents)fail('支付通知与订单不一致');
 exact(params.trade_no,/^\d{6,64}$/,'支付宝交易号无效');
 if(!['TRADE_SUCCESS','TRADE_FINISHED'].includes(params.trade_status))fail('交易尚未支付成功');
 return {orderId:expectedId,tradeNo:params.trade_no,amountCents:order.amountCents,status:params.trade_status};
}
