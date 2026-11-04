import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,verify} from 'node:crypto';
import {createAlipayPagePayUrl,verifyAlipayNotification} from '../server/alipay-page-pay.mjs';
const merchant=generateKeyPairSync('rsa',{modulusLength:2048});const alipay=generateKeyPairSync('rsa',{modulusLength:2048});
const config={appId:'2026000012345678',sellerId:'2088000012345678',privateKey:merchant.privateKey.export({type:'pkcs8',format:'pem'}),alipayPublicKey:alipay.publicKey.export({type:'spki',format:'pem'}),environment:'sandbox'};
const order={id:'order_123',amountCents:2999,subject:'墨多多创作版'};
const settings={config,order,origin:'https://moduoduowriter.com',notifyUrl:'https://moduoduowriter.com/api/payment/alipay/notify',returnUrl:'https://moduoduowriter.com/#membership',now:new Date('2026-11-04T16:01:02.000Z')};
// Fragments are intentionally forbidden: browser return must be a fixed server URL.
assert.throws(()=>createAlipayPagePayUrl(settings));settings.returnUrl='https://moduoduowriter.com/payment/return';
const url=new URL(createAlipayPagePayUrl(settings));assert.equal(url.origin,'https://openapi-sandbox.dl.alipaydev.com');assert.equal(url.searchParams.get('timestamp'),'2026-11-05 00:01:02');
const req=Object.fromEntries(url.searchParams);const reqSign=req.sign;delete req.sign;
const canonical=o=>Object.keys(o).filter(k=>o[k]!==''&&o[k]!=null).sort().map(k=>`${k}=${o[k]}`).join('&');
assert.ok(verify('RSA-SHA256',Buffer.from(canonical(req)),merchant.publicKey,Buffer.from(reqSign,'base64')));
assert.deepEqual(JSON.parse(req.biz_content),{out_trade_no:order.id,total_amount:'29.99',subject:order.subject,product_code:'FAST_INSTANT_TRADE_PAY'});
assert.throws(()=>createAlipayPagePayUrl({...settings,notifyUrl:'https://attacker.example/callback'}));
assert.throws(()=>createAlipayPagePayUrl({...settings,order:{...order,amountCents:1.5}}));
assert.throws(()=>createAlipayPagePayUrl({...settings,config:{...config,environment:'custom'}}));
const fields={app_id:config.appId,seller_id:config.sellerId,out_trade_no:order.id,trade_no:'202611052100123456789',total_amount:'29.99',trade_status:'TRADE_SUCCESS',charset:'utf-8',notify_type:'trade_status_sync',notify_id:'notify1',subject:'含有空格 & 加号+'};
function notification(patch={},key=alipay.privateKey){const p={...fields,...patch};const sig=sign('RSA-SHA256',Buffer.from(canonical(p)),key).toString('base64');return new URLSearchParams({...p,sign_type:'RSA2',sign:sig}).toString();}
const good=notification();assert.deepEqual(verifyAlipayNotification({body:good,config,order}),{orderId:order.id,tradeNo:fields.trade_no,amountCents:2999,status:'TRADE_SUCCESS'});
assert.equal(verifyAlipayNotification({body:notification({trade_status:'TRADE_FINISHED'}),config,order}).status,'TRADE_FINISHED');
for(const patch of [{total_amount:'29.98'},{app_id:'999999999'},{seller_id:'999999999'},{out_trade_no:'wrong'},{trade_status:'WAIT_BUYER_PAY'},{trade_status:'TRADE_CLOSED'},{trade_no:'wrong'},{total_amount:'29.990'}])assert.throws(()=>verifyAlipayNotification({body:notification(patch),config,order}));
assert.throws(()=>verifyAlipayNotification({body:notification({},merchant.privateKey),config,order}));
assert.throws(()=>verifyAlipayNotification({body:good+'&total_amount=29.99',config,order}));
assert.throws(()=>verifyAlipayNotification({body:good.replace('RSA2','RSA'),config,order}));
assert.throws(()=>verifyAlipayNotification({body:good+'&bad=%FF',config,order}));
assert.throws(()=>verifyAlipayNotification({body:good,config:{...config,sellerId:''},order}));
console.log('PASS Alipay page-pay RSA2 signatures, fixed gateway/origin, exact cents, signed callback identity/status validation and malformed or duplicate parameter rejection');
