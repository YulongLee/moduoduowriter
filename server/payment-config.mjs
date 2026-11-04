import {createPrivateKey,createPublicKey,X509Certificate} from 'node:crypto';
const fail=message=>Object.assign(new Error(message),{status:400});
export const defaultPaymentConfig=Object.freeze({wechat:{enabled:false,appId:'',mchId:'',serialNo:'',apiV3Key:'',privateKey:'',platformCertificate:'',platformPublicKeyId:'',platformPublicKey:''},alipay:{enabled:false,appId:'',sellerId:'',privateKey:'',alipayPublicKey:''}});
const field=(input,previous,key,max)=>{
 if(input[key]===undefined)return previous[key]||'';
 if(typeof input[key]!=='string'||input[key].length>max||input[key].includes('\0'))throw fail(`支付配置 ${key} 格式不正确`);
 return input[key].trim();
};
const secret=(input,previous,key,clear)=>{
 if(input[clear]!==undefined&&typeof input[clear]!=='boolean')throw fail('清除密钥的选项无效');
 if(input[clear])return '';
 if(input[key]===undefined||input[key]==='')return previous[key]||'';
 if(typeof input[key]==='string'&&!input[key].trim())return previous[key]||'';
 return field(input,previous,key,20000);
};
export function validatePaymentConfig(value,previous=defaultPaymentConfig){
 if(!value||typeof value!=='object'||Array.isArray(value))throw fail('支付配置格式不正确');
 const w=value.wechat===undefined?{}:value.wechat,a=value.alipay===undefined?{}:value.alipay,pw=previous.wechat||defaultPaymentConfig.wechat,pa=previous.alipay||defaultPaymentConfig.alipay;
 if([w,a].some(v=>!v||typeof v!=='object'||Array.isArray(v)))throw fail('支付渠道配置格式不正确');
 const allowed=(object,keys)=>{if(Object.keys(object).some(key=>!keys.includes(key)))throw fail('支付配置包含未知字段');};
 allowed(value,['wechat','alipay']);
 allowed(w,['enabled','appId','mchId','serialNo','apiV3Key','privateKey','platformCertificate','platformPublicKeyId','platformPublicKey','clearApiV3Key','clearPrivateKey','clearPlatformCertificate','clearPlatformPublicKey']);
 allowed(a,['enabled','appId','sellerId','privateKey','alipayPublicKey','clearPrivateKey','clearAlipayPublicKey']);
 for(const x of [w,a])if(x.enabled!==undefined&&typeof x.enabled!=='boolean')throw fail('支付渠道开关无效');
 const wechat={enabled:w.enabled??pw.enabled,appId:field(w,pw,'appId',80),mchId:field(w,pw,'mchId',32),serialNo:field(w,pw,'serialNo',128),apiV3Key:secret(w,pw,'apiV3Key','clearApiV3Key'),privateKey:secret(w,pw,'privateKey','clearPrivateKey'),platformCertificate:secret(w,pw,'platformCertificate','clearPlatformCertificate'),platformPublicKeyId:field(w,pw,'platformPublicKeyId',128),platformPublicKey:secret(w,pw,'platformPublicKey','clearPlatformPublicKey')};
 const alipay={enabled:a.enabled??pa.enabled,appId:field(a,pa,'appId',80),sellerId:field(a,pa,'sellerId',16),privateKey:secret(a,pa,'privateKey','clearPrivateKey'),alipayPublicKey:secret(a,pa,'alipayPublicKey','clearAlipayPublicKey')};
 if(wechat.appId&&!/^wx[A-Za-z0-9]{16}$/.test(wechat.appId))throw fail('微信 AppID 格式不正确');
 if(wechat.mchId&&!/^\d{6,32}$/.test(wechat.mchId))throw fail('微信商户号格式不正确');
 if(wechat.serialNo&&!/^[A-Fa-f0-9]{1,128}$/.test(wechat.serialNo))throw fail('微信商户证书序列号格式不正确');
 if(wechat.platformPublicKeyId&&!/^PUB_KEY_ID_\d{1,100}$/.test(wechat.platformPublicKeyId))throw fail('微信支付公钥 ID 格式不正确');
 if(wechat.apiV3Key&&Buffer.byteLength(wechat.apiV3Key,'utf8')!==32)throw fail('微信 API v3 密钥须为 32 字节');
 if(alipay.appId&&!/^\d{6,80}$/.test(alipay.appId))throw fail('支付宝应用 ID 格式不正确');
 if(alipay.sellerId&&!/^\d{16}$/.test(alipay.sellerId))throw fail('支付宝收款商户 PID 应为 16 位数字');
 for(const [label,key,parser,pattern] of [['微信商户私钥',wechat.privateKey,createPrivateKey,/-----BEGIN (?:RSA )?PRIVATE KEY-----/],['微信平台证书',wechat.platformCertificate,value=>new X509Certificate(value),/-----BEGIN CERTIFICATE-----/],['微信支付公钥',wechat.platformPublicKey,createPublicKey,/-----BEGIN (?:RSA )?PUBLIC KEY-----/],['支付宝应用私钥',alipay.privateKey,createPrivateKey,/-----BEGIN (?:RSA )?PRIVATE KEY-----/],['支付宝公钥',alipay.alipayPublicKey,createPublicKey,/-----BEGIN (?:RSA )?PUBLIC KEY-----/]]){
  if(!key)continue;
  try{if(!pattern.test(key))throw Error('PEM');const parsed=parser(key);if(!(parsed instanceof X509Certificate)&&parsed.asymmetricKeyType!=='rsa')throw Error('RSA');}catch{throw fail(`${label} 格式不正确，请检查 PEM 内容`);}
 }
 return {wechat,alipay};
}
export function publicPaymentConfig(value){const {wechat:w,alipay:a}=value;return {wechat:{enabled:w.enabled,appId:w.appId,mchId:w.mchId,serialNo:w.serialNo,platformPublicKeyId:w.platformPublicKeyId||'',hasPlatformPublicKey:!!w.platformPublicKey,hasApiV3Key:!!w.apiV3Key,hasPrivateKey:!!w.privateKey,hasPlatformCertificate:!!w.platformCertificate},alipay:{enabled:a.enabled,appId:a.appId,sellerId:a.sellerId||'',hasPrivateKey:!!a.privateKey,hasAlipayPublicKey:!!a.alipayPublicKey},collectionAvailable:false};}
export const paymentStatus=()=>({wechat:{available:false},alipay:{available:false},reason:'支付功能尚未开通'});
