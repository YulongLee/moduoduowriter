import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import {createVerificationEmail} from '../server/auth-email.mjs';

// Compile real MIME entirely in memory: no SMTP connection, credentials or delivery.
const transport=nodemailer.createTransport({streamTransport:true,buffer:true,newline:'windows',disableFileAccess:true,disableUrlAccess:true});
for(const purpose of ['login','bind']){
 const code='001234',message=createVerificationEmail({code,purpose});
 assert.ok(message.text.includes(code)&&message.html.includes('>'+code+'</p>'));
 assert.ok(!message.subject.includes(code));
 const preheader=message.html.match(/<div[^>]*>(.*?)<\/div>/s)?.[1];assert.ok(preheader&&!preheader.includes(code));
 assert.ok(message.text.includes('5 分钟')&&message.html.includes('5 分钟'));
 assert.ok(purpose==='bind'?message.subject.includes('邮箱绑定')&&!message.text.includes('使用邮箱登录'):message.subject.includes('登录验证码'));
 assert.ok(!/<(?:script|iframe|form|button)\b|https?:\/\/|\bon\w+\s*=/i.test(message.html));
 assert.ok(!/<(?:link|style)\b/i.test(message.html),'The email must not require external styles or fonts');
 assert.equal(message.attachments.length,1);
 const image=message.attachments[0];assert.equal(image.cid,'mdd-brand-mark');assert.equal(image.contentType,'image/png');assert.equal(image.contentDisposition,'inline');
 assert.ok(Buffer.isBuffer(image.content));assert.equal(image.content.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.ok(!('path' in image)&&!('href' in image));
 assert.ok(message.html.includes('src="cid:'+image.cid+'"'));
 const compiled=await transport.sendMail({...message,from:'墨多多 <sender@example.test>',to:'recipient@example.test',disableFileAccess:true,disableUrlAccess:true});
 const mime=compiled.message.toString('utf8');
 for(const type of ['multipart/alternative','multipart/related','text/plain','text/html','image/png'])assert.ok(mime.includes('Content-Type: '+type),type);
 assert.ok(mime.includes('Content-ID: <mdd-brand-mark>'));
 assert.ok(mime.includes('Content-Disposition: inline;'));
 assert.ok(compiled.message.byteLength<80*1024,'The message should stay below client clipping limits');
}
for(const code of ['',123456,'12345','1234567','<script>','１２３４５６'])assert.throws(()=>createVerificationEmail({code}),TypeError);
assert.throws(()=>createVerificationEmail({code:'001234',purpose:'constructor'}),TypeError);
assert.throws(()=>createVerificationEmail({code:'001234',purpose:'reset'}),TypeError);
console.log('PASS login/binding copy, leading-zero OTP, private preview text, embedded unchanged PNG and complete multipart MIME with file/URL access disabled; no live email sent');
