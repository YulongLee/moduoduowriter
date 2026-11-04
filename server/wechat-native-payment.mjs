// Isolated protocol primitives only; this module does not create, settle or fulfill orders.
import {createSign,createVerify,createDecipheriv,randomBytes} from 'node:crypto';
const fail=()=>{throw new Error('微信支付数据验证失败');};
const line=value=>typeof value==='string'&&value.length>0&&!/[\r\n\0]/.test(value);
const header=(headers,name)=>{const value=typeof headers.get==='function'?headers.get(name):headers[name.toLowerCase()]??headers[name];return typeof value==='string'?value:'';};
const json=body=>{try{return JSON.parse(body);}catch{fail();}};
export function buildWechatNativeRequest({config,order,notifyUrl,now=Date.now(),nonce=randomBytes(16).toString('hex')}) {
 const {appId,mchId,serialNo,privateKey}=config||{};
 if(!/^wx[A-Za-z0-9]{16}$/.test(appId||'')||!/^\d{6,32}$/.test(mchId||'')||!/^[A-Fa-f0-9]{1,128}$/.test(serialNo||'')||!/^[A-Za-z0-9]{1,32}$/.test(nonce||'')||!privateKey||!order||!/^[A-Za-z0-9_-]{6,32}$/.test(order.id)||!Number.isSafeInteger(order.amountCents)||order.amountCents<1||typeof order.description!=='string'||!order.description.trim()||order.description.length>127)fail();
 let url;try{url=new URL(notifyUrl);}catch{fail();}if(url.protocol!=='https:'||url.username||url.password||url.hash||url.search)fail();
 const body=JSON.stringify({appid:appId,mchid:mchId,description:order.description,out_trade_no:order.id,notify_url:url.href,amount:{total:order.amountCents,currency:'CNY'}});
 const timestamp=String(Math.floor(now/1000)),method='POST',path='/v3/pay/transactions/native';if(!/^\d+$/.test(timestamp))fail();
 const message=`${method}\n${path}\n${timestamp}\n${nonce}\n${body}\n`;
 let signature;try{signature=createSign('RSA-SHA256').update(message).end().sign(privateKey,'base64');}catch{fail();}
 return {method,url:'https://api.mch.weixin.qq.com'+path,headers:{Accept:'application/json','Content-Type':'application/json',Authorization:`WECHATPAY2-SHA256-RSA2048 mchid="${mchId}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${serialNo}",signature="${signature}"`},body};
}
export function verifyWechatMessage({headers,rawBody,verificationKeys,now=Date.now(),maxSkewSeconds=300}) {
 if(typeof rawBody!=='string'||Buffer.byteLength(rawBody)>1000000||!verificationKeys||typeof verificationKeys!=='object')fail();
 const timestamp=header(headers,'Wechatpay-Timestamp'),nonce=header(headers,'Wechatpay-Nonce'),serial=header(headers,'Wechatpay-Serial'),signature=header(headers,'Wechatpay-Signature'),signatureType=header(headers,'Wechatpay-Signature-Type');
 if(!/^\d{1,12}$/.test(timestamp)||!line(nonce)||!line(serial)||!line(signature)||(signatureType&&signatureType!=='WECHATPAY2-SHA256-RSA2048')||Math.abs(now/1000-Number(timestamp))>maxSkewSeconds)fail();
 if(!Object.hasOwn(verificationKeys,serial))fail();const key=verificationKeys[serial];
 try{if(!createVerify('RSA-SHA256').update(`${timestamp}\n${nonce}\n${rawBody}\n`).end().verify(key,signature,'base64'))fail();}catch{fail();}
 return true;
}
export function parseWechatNativeResponse({headers,rawBody,verificationKeys,now}) {
 verifyWechatMessage({headers,rawBody,verificationKeys,now});const result=json(rawBody);
 if(!result||typeof result.code_url!=='string'||!result.code_url.startsWith('weixin://wxpay/'))fail();return {codeUrl:result.code_url};
}
export function parseWechatPaymentNotification({headers,rawBody,verificationKeys,apiV3Key,expected,now}) {
 verifyWechatMessage({headers,rawBody,verificationKeys,now});const payload=json(rawBody),resource=payload?.resource;
 if(payload?.event_type!=='TRANSACTION.SUCCESS'||resource?.original_type!=='transaction'||resource?.algorithm!=='AEAD_AES_256_GCM'||typeof resource.ciphertext!=='string'||typeof resource.nonce!=='string'||typeof resource.associated_data!=='string'||typeof apiV3Key!=='string'||Buffer.byteLength(apiV3Key)!==32)fail();
 let transaction;try{const encrypted=Buffer.from(resource.ciphertext,'base64');if(encrypted.length<=16)fail();const decipher=createDecipheriv('aes-256-gcm',Buffer.from(apiV3Key),Buffer.from(resource.nonce));decipher.setAAD(Buffer.from(resource.associated_data));decipher.setAuthTag(encrypted.subarray(-16));transaction=JSON.parse(Buffer.concat([decipher.update(encrypted.subarray(0,-16)),decipher.final()]).toString('utf8'));}catch{fail();}
 if(!expected||transaction.appid!==expected.appId||transaction.mchid!==expected.mchId||transaction.out_trade_no!==expected.orderId||transaction.trade_state!=='SUCCESS'||transaction.trade_type!=='NATIVE'||transaction.amount?.currency!=='CNY'||!Number.isSafeInteger(expected.amountCents)||expected.amountCents<1||transaction.amount?.total!==expected.amountCents||typeof transaction.transaction_id!=='string'||!/^\d{1,64}$/.test(transaction.transaction_id))fail();
 return {orderId:transaction.out_trade_no,transactionId:transaction.transaction_id,amountCents:transaction.amount.total};
}
