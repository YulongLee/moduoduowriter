import {readFileSync} from 'node:fs';

let brandMark;
const copy={
 login:{subject:'墨多多 · 登录验证码',eyebrow:'登录验证',title:'你的登录验证码',intro:'你正在使用邮箱登录墨多多。请回到发起请求的页面，输入下方验证码。'},
 bind:{subject:'墨多多 · 邮箱绑定验证',eyebrow:'邮箱绑定',title:'确认绑定你的邮箱',intro:'你正在为当前墨多多账号绑定邮箱。请回到发起请求的页面，输入下方验证码。'}
};

/** A transactional email with an embedded brand mark and a plain-text fallback. */
export function createVerificationEmail({code,purpose='login'}={}) {
 if(typeof code!=='string'||!/^\d{6}$/.test(code))throw new TypeError('邮件验证码必须为 6 位数字。');
 if(typeof purpose!=='string'||!Object.hasOwn(copy,purpose))throw new TypeError('邮件验证用途不正确。');
 const message=copy[purpose];
 // Load a fixed, local asset as bytes. Nodemailer remains free to disable file
 // and URL access for all message content and attachments.
 brandMark??=readFileSync(new URL('./assets/brand-mark.png',import.meta.url));
 const text=[
  '墨多多 · 写作',
  '',
  message.title,
  message.intro,
  '',
  `验证码：${code}`,
  '5 分钟内有效，请及时使用。',
  '',
  '为保护账号安全，请勿将验证码透露给他人。',
  '如果这不是你发起的操作，忽略这封邮件即可。',
  '这是一封系统邮件，无需回复。',
  '',
  '让好故事发生。'
 ].join('\n');
 const html=`<!doctype html>
<html lang="zh-CN">
<head>
 <meta charset="utf-8">
 <meta name="viewport" content="width=device-width,initial-scale=1">
 <meta name="format-detection" content="telephone=no,date=no,address=no,email=no">
 <meta name="color-scheme" content="light">
 <meta name="supported-color-schemes" content="light">
 <title>${message.subject}</title>
</head>
<body style="margin:0;padding:0;width:100%;background-color:#f3f6f3;color:#172522;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
 <div style="display:none!important;visibility:hidden;mso-hide:all;max-height:0;max-width:0;overflow:hidden;font-size:1px;line-height:1px;color:#f3f6f3;opacity:0;">请回到墨多多页面输入验证码，5 分钟内有效。</div>
 <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#f3f6f3" style="width:100%;border-collapse:collapse;background-color:#f3f6f3;">
  <tr><td align="center" style="padding:36px 12px;">
   <!--[if mso]><table role="presentation" width="560" border="0" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
   <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="width:100%;max-width:560px;border:1px solid #dfe7e1;border-spacing:0;background-color:#ffffff;border-radius:14px;">
    <tr><td height="4" bgcolor="#174b3b" style="height:4px;line-height:4px;font-size:0;background-color:#174b3b;border-radius:14px 14px 0 0;">&nbsp;</td></tr>
    <tr><td style="padding:28px 24px 24px;">
     <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
      <tr>
       <td width="42" valign="middle" style="width:42px;vertical-align:middle;"><img src="cid:mdd-brand-mark" width="42" height="42" alt="" style="display:block;width:42px;height:42px;border:0;outline:none;text-decoration:none;"></td>
       <td valign="middle" style="padding-left:12px;vertical-align:middle;">
        <p style="margin:0;color:#172522;font-size:21px;font-weight:700;line-height:28px;">墨多多&nbsp; <span style="color:#21614e;font-size:12px;font-weight:500;vertical-align:middle;">写作</span></p>
        <p style="margin:2px 0 0;color:#758379;font-size:12px;line-height:18px;">让好故事发生</p>
       </td>
      </tr>
     </table>
    </td></tr>
    <tr><td style="padding:0 24px;"><table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;"><tr><td height="1" bgcolor="#e9eeea" style="height:1px;line-height:1px;font-size:0;background-color:#e9eeea;">&nbsp;</td></tr></table></td></tr>
    <tr><td style="padding:28px 24px 24px;">
     <p style="margin:0 0 8px;color:#5f7968;font-size:12px;font-weight:600;line-height:20px;">${message.eyebrow}</p>
     <h1 style="margin:0;color:#172522;font-size:26px;font-weight:700;line-height:36px;">${message.title}</h1>
     <p style="margin:14px 0 24px;color:#607066;font-size:14px;line-height:26px;">${message.intro}</p>
     <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#f1f7f2" style="width:100%;border:1px solid #dce8de;border-spacing:0;border-radius:10px;background-color:#f1f7f2;">
      <tr><td align="center" style="padding:20px 10px;">
       <p style="margin:0 0 6px;color:#627b69;font-size:12px;line-height:20px;">本次验证码</p>
       <p style="margin:0;color:#174b3b;font-family:'SFMono-Regular',Consolas,'Liberation Mono',monospace;font-size:40px;font-weight:700;letter-spacing:6px;line-height:54px;white-space:nowrap;">${code}</p>
       <p style="margin:8px 0 0;color:#526b5a;font-size:13px;line-height:22px;"><strong style="font-weight:600;">5 分钟</strong>内有效，请及时使用</p>
      </td></tr>
     </table>
     <p style="margin:20px 0 0;color:#69786e;font-size:13px;line-height:24px;">为保护账号安全，请勿将验证码透露给他人。</p>
    </td></tr>
    <tr><td style="padding:0 24px 26px;">
     <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border-top:1px solid #e9eeea;">
      <tr><td style="padding-top:18px;color:#7c887f;font-size:12px;line-height:23px;">如果这不是你发起的操作，忽略这封邮件即可。<br>这是一封系统邮件，无需回复。</td></tr>
     </table>
    </td></tr>
   </table>
   <!--[if mso]></td></tr></table><![endif]-->
   <p style="margin:20px 0 0;color:#7a897f;font-size:12px;line-height:22px;">墨多多 · 写作</p>
  </td></tr>
 </table>
</body>
</html>`;
 return {
  subject:message.subject,text,html,
  attachments:[{filename:'moduoduo.png',content:brandMark,contentType:'image/png',contentDisposition:'inline',cid:'mdd-brand-mark'}]
 };
}
