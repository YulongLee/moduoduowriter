import React,{useEffect,useId,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,Check,KeyRound,LoaderCircle,Mail,MessageCircle,RefreshCw,Smartphone} from 'lucide-react';
import {requestApi} from './Generation.jsx';
import './login.css';

const methodLabels={phone:'手机号',email:'邮箱',wechat:'微信扫码'};
const icons={phone:Smartphone,email:Mail,wechat:MessageCircle};
const expires=value=>typeof value==='number'?value:Date.parse(value);
const seconds=value=>Math.max(0,Math.ceil(value/1000));
function normalizeTarget(channel,value) {
 if(channel==='email')return value.trim().toLowerCase();
 const compact=value.replace(/[\s-]/g,'').replace(/^0086/,'+86');
 const digits=compact.replace(/^(\+?86)/,'');return /^1[3-9]\d{9}$/.test(digits)?'+86'+digits:compact;
}
function validateTarget(channel,value) {
 const target=normalizeTarget(channel,value);
 if(channel==='phone'&&!/^\+861[3-9]\d{9}$/.test(target))throw new Error('请输入有效的中国大陆手机号。');
 if(channel==='email'&&(target.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)))throw new Error('请输入有效的邮箱地址。');
 return target;
}
function authorizationUrl(value) {
 let url;try{url=new URL(value);}catch{throw new Error('未获得有效的微信登录地址，请重新获取。');}
 if(url.protocol!=='https:'||url.hostname!=='open.weixin.qq.com'||url.pathname!=='/connect/qrconnect'||url.username||url.password)throw new Error('微信登录地址尚未确认，请重新获取。');
 return url.href;
}

export function LoginMethods({account,onSuccess,renderLegacy,purpose='login'}) {
 const binding=purpose==='bind';
 const [method,setMethod]=useState('phone'),[legacy,setLegacy]=useState(false),[methods,setMethods]=useState(null),[loadError,setLoadError]=useState('');
 const [targets,setTargets]=useState({phone:'',email:''}),[code,setCode]=useState(''),[challenge,setChallenge]=useState(null),[qr,setQr]=useState(null);
 const [busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[now,setNow]=useState(Date.now()),[confirmNeeded,setConfirmNeeded]=useState(false),[completed,setCompleted]=useState(false);
 const alive=useRef(true),sequence=useRef(0),controllers=useRef(new Set()),loadController=useRef(null),loadSequence=useRef(0),actionRef=useRef(null),methodRef=useRef(method),qrRef=useRef(null),polling=useRef(null),consuming=useRef(new Set()),delivered=useRef(false),finishing=useRef(false);
 const codeRef=useRef(null),instanceId=useId();methodRef.current=method;qrRef.current=qr;
 const current=operation=>alive.current&&operation===sequence.current;
 const request=async(url,body,options={})=>{
  const controller=new AbortController();controllers.current.add(controller);
  try{return await requestApi(url,body,{...options,signal:controller.signal});}finally{controllers.current.delete(controller);}
 };
 const cancel=()=>{
  sequence.current++;for(const controller of controllers.current)controller.abort();controllers.current.clear();actionRef.current=null;polling.current=null;finishing.current=false;
  const previous=qrRef.current;qrRef.current=null;
  if(previous&&['waiting','scanned'].includes(previous.state)&&!consuming.current.has(previous.requestId))requestApi('/api/auth/wechat/cancel',{requestId:previous.requestId,pollToken:previous.pollToken}).catch(()=>{});
 };
 const load=async()=>{
  loadController.current?.abort();const controller=new AbortController(),signal=controller.signal,loading=++loadSequence.current;loadController.current=controller;
  setLoadError('');
  try{
   const result=await requestApi('/api/auth/methods',undefined,{method:'GET',signal});
   if(!result||!['phone','email','wechat'].every(key=>result[key]&&typeof result[key]==='object'&&typeof result[key].enabled==='boolean'&&typeof result[key].available==='boolean')||(result.ownerConfigured!==undefined&&typeof result.ownerConfigured!=='boolean'))throw new Error('登录方式暂未载入，请稍后重试。');
   if(alive.current&&!signal.aborted&&loading===loadSequence.current)setMethods(result);
  }catch(value){if(alive.current&&!signal.aborted&&loading===loadSequence.current)setLoadError(value.message||'登录方式暂未载入，请稍后重试。');}
 };
 useEffect(()=>{
  alive.current=true;load();
  return()=>{alive.current=false;loadController.current?.abort();loadSequence.current++;cancel();};
 },[]);
 useEffect(()=>{if(!challenge&&!qr)return;setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[challenge?.challengeId,qr?.requestId]);
 const changeMethod=next=>{if(completed||next===methodRef.current)return;cancel();setMethod(next);methodRef.current=next;setChallenge(null);setCode('');setQr(null);setBusy('');setError('');setNotice('');setConfirmNeeded(false);};
 const changeTarget=value=>{cancel();setTargets(previous=>({...previous,[method]:value}));setChallenge(null);setCode('');setBusy('');setError('');setNotice('');setConfirmNeeded(false);};
 const openLegacy=()=>{cancel();setLegacy(true);setQr(null);setChallenge(null);setCode('');setBusy('');setError('');setNotice('');};
 const enabled=Boolean(methods?.[method]?.enabled&&methods?.[method]?.available&&methods?.ownerConfigured!==false);
 const finishSession=async operation=>{
  if(finishing.current||delivered.current||!current(operation))return;
  finishing.current=true;setBusy('confirm');
  try{
   const result=account?.refresh?await account.refresh():await request('/api/auth/status',undefined,{method:'GET'});
   if(!current(operation))return;
   if(!result?.configured||typeof result.user?.id!=='string'||!result.user.id||result.spaceId!==result.user.id||(binding&&result.user.id!==account?.user?.id))throw new Error('账号状态暂未确认，请重新检查后再继续。');
   delivered.current=true;setCompleted(true);setConfirmNeeded(false);setNotice(binding?'登录方式已绑定。':'登录成功，正在进入创作空间。');onSuccess?.();
  }catch(value){if(current(operation)){setConfirmNeeded(true);setError(value.message||'登录状态暂未确认，请重新检查。');}}
  finally{if(current(operation))setBusy('');finishing.current=false;}
 };
 const sendCode=async()=>{
  if(busy||actionRef.current||completed||!enabled)return;
  const operation=sequence.current,action={operation,type:'send'};
  try{
   const target=validateTarget(method,targets[method]);
   if(challenge&&challenge.retryAt>Date.now())return;
   actionRef.current=action;setBusy('send');setError('');setNotice('');
   const result=await request(binding?'/api/auth/identities/code/send':'/api/auth/code/send',{channel:method,target});
   if(!current(operation))return;
   const expiresAt=expires(result.expiresAt),retryAfter=Number(result.retryAfter);
   if(typeof result.challengeId!=='string'||!result.challengeId||!Number.isFinite(expiresAt)||expiresAt<=Date.now()||!Number.isFinite(retryAfter)||retryAfter<0||retryAfter>900)throw new Error('验证码发送状态未确认，请稍后重新获取。');
   setChallenge({challengeId:result.challengeId,target,channel:method,expiresAt,retryAt:Date.now()+retryAfter*1000});setCode('');setNow(Date.now());
   setNotice(method==='phone'?'验证码已发送，请查看手机短信。':'验证码已发送，请查看收件箱及垃圾邮件。');codeRef.current?.focus();
  }catch(value){if(current(operation))setError(value.message||'验证码未能发送，请稍后重试。');}
  finally{if(actionRef.current===action)actionRef.current=null;if(current(operation))setBusy('');}
 };
 const login=async event=>{
  event.preventDefault();if(busy||actionRef.current||completed||!enabled)return;
  const operation=sequence.current,action={operation,type:'login'};let submitted=false;
  try{
   const target=validateTarget(method,targets[method]);
   if(!challenge||challenge.target!==target||challenge.channel!==method)throw new Error('请先获取当前账号的验证码。');
   if(challenge.expiresAt<=Date.now())throw new Error('验证码已过期，请重新获取。');
   if(!/^\d{6}$/.test(code))throw new Error('请输入 6 位数字验证码。');
   actionRef.current=action;setBusy('login');setError('');setNotice('');
   submitted=true;
   const result=await request(binding?'/api/auth/identities/code/bind':'/api/auth/code/login',{channel:method,target,challengeId:challenge.challengeId,code});
   if(binding&&(result.bound!==true||result.user?.id!==account?.user?.id))throw new Error('绑定结果尚未确认，请返回登录方式列表核对。');
   if(current(operation)){setChallenge(null);setCode('');await finishSession(operation);}
  }catch(value){if(current(operation)){setError(value.message||(binding?'绑定结果尚未确认，请返回登录方式列表核对。':'验证未完成，请检查后重试。'));if(submitted&&!value.status&&!binding)setConfirmNeeded(true);}}
  finally{if(actionRef.current===action)actionRef.current=null;if(current(operation))setBusy('');}
 };
 const startWechat=async()=>{
  if(busy||actionRef.current||completed||!enabled)return;
  cancel();const operation=sequence.current,action={operation,type:'qr'};actionRef.current=action;setBusy('qr');setQr(null);setError('');setNotice('');setConfirmNeeded(false);
  try{
   const result=await request('/api/auth/wechat/start',binding?{purpose:'bind'}:{});
   if(!current(operation))return;
   const expiresAt=expires(result.expiresAt),url=authorizationUrl(result.authorizationUrl);
   if(typeof result.requestId!=='string'||!result.requestId||typeof result.pollToken!=='string'||!result.pollToken||!Number.isFinite(expiresAt)||expiresAt<=Date.now())throw new Error('二维码状态尚未确认，请重新获取。');
   setQr({requestId:result.requestId,pollToken:result.pollToken,authorizationUrl:url,openUrl:result.openUrl?authorizationUrl(result.openUrl):url,expiresAt,state:'waiting',operation});setNow(Date.now());
  }catch(value){if(current(operation))setError(value.message||'二维码暂未准备好，请稍后重试。');}
  finally{if(actionRef.current===action)actionRef.current=null;if(current(operation))setBusy('');}
 };
 const checkWechat=async snapshot=>{
  if(!snapshot||polling.current||!current(snapshot.operation)||methodRef.current!=='wechat'||snapshot.expiresAt<=Date.now())return false;
  const marker={requestId:snapshot.requestId};polling.current=marker;
  try{
   const result=await request('/api/auth/wechat/status',{requestId:snapshot.requestId,pollToken:snapshot.pollToken});
   if(!current(snapshot.operation)||methodRef.current!=='wechat')return false;
   if(!['waiting','scanned','approved','expired','failed'].includes(result.status))throw new Error('扫码状态尚未确认，请稍后检查。');
   if(result.status==='approved'){
    if(consuming.current.has(snapshot.requestId))return false;
    consuming.current.add(snapshot.requestId);setBusy('wechat');setQr(previous=>previous?.requestId===snapshot.requestId?{...previous,state:'approved'}:previous);
    try{
     const result=await request('/api/auth/wechat/consume',{requestId:snapshot.requestId,pollToken:snapshot.pollToken});
     if(binding&&(result.bound!==true||result.user?.id!==account?.user?.id))throw new Error('绑定结果尚未确认，请返回登录方式列表核对。');
     if(current(snapshot.operation))await finishSession(snapshot.operation);
    }catch(value){if(current(snapshot.operation)){setConfirmNeeded(!binding);setError(value.message||(binding?'绑定结果暂未确认，请返回登录方式列表核对。':'登录结果暂未确认，请重新检查账号状态。'));}}
    finally{if(current(snapshot.operation))setBusy('');}
    return false;
   }
   setQr(previous=>previous?.requestId===snapshot.requestId?{...previous,state:result.status}:previous);
   if(result.status==='failed')setError('微信授权未完成，请重新获取二维码后再试。');
   return ['waiting','scanned'].includes(result.status);
  }catch(value){if(current(snapshot.operation))setError(value.message||'扫码状态暂时无法确认，请稍后再试。');return current(snapshot.operation);}
  finally{if(polling.current===marker)polling.current=null;}
 };
 useEffect(()=>{
  if(legacy||method!=='wechat'||!qr||!['waiting','scanned'].includes(qr.state))return;
  let stopped=false,timer;
  const poll=async()=>{if(stopped)return;const repeat=await checkWechat(qr);if(!stopped&&repeat)timer=setTimeout(poll,2000);};
  timer=setTimeout(poll,1500);return()=>{stopped=true;clearTimeout(timer);};
 },[legacy,method,qr?.requestId,qr?.state]);

 if(legacy)return <div className="login-legacy"><button type="button" className="login-back" aria-label="返回其他登录方式" onClick={()=>{cancel();setLegacy(false);setCompleted(false);delivered.current=false;}}><ArrowLeft size={15}/>返回其他登录方式</button>{renderLegacy?.()}</div>;
 const remaining=challenge?seconds(challenge.retryAt-now):0,codeExpired=challenge&&challenge.expiresAt<=now;
 const qrExpired=qr&&(qr.expiresAt<=now||qr.state==='expired'),reason=methods?.ownerConfigured===false?'平台尚未开放自助登录，请先使用已有账号登录。':methods?.[method]?.reason||`${methodLabels[method]}登录暂未开放，可先使用账号密码登录。`;
 return <section className="login-methods" aria-label={binding?'绑定登录方式':'选择登录方式'}>
  <header><span className="login-welcome">{binding?'安全管理你的账号':'开始你的创作之旅'}</span><h2>{binding?'绑定登录方式':'登录墨多多'}</h2><p>{binding?'验证后绑定到当前创作账号，文稿与记录保持在同一空间。':'登录后，继续你的故事与创作记录。'}</p></header>
  <div className="login-tabs" role="tablist" aria-label="登录方式">{['phone','email','wechat'].map(value=>{const Icon=icons[value];return <button type="button" id={instanceId+'-'+value} role="tab" aria-selected={method===value} aria-controls={instanceId+'-panel'} tabIndex={method===value?0:-1} key={value} disabled={completed} onClick={()=>changeMethod(value)} onKeyDown={event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const values=['phone','email','wechat'],index=values.indexOf(method),next=event.key==='Home'?0:event.key==='End'?2:(index+(event.key==='ArrowRight'?1:2))%3;changeMethod(values[next]);document.getElementById(instanceId+'-'+values[next])?.focus();}}><Icon size={17}/>{methodLabels[value]}</button>;})}</div>
  <div id={instanceId+'-panel'} role="tabpanel" aria-labelledby={instanceId+'-'+method} className="login-panel">
   {!methods&&!loadError?<p className="login-status" role="status"><LoaderCircle size={16} className="spin"/>正在载入登录方式…</p>:loadError?<div className="login-availability" role="status"><p>{loadError}</p><button type="button" className="login-text-button" onClick={()=>load()}><RefreshCw size={14}/>重新载入</button></div>:!enabled?<div className="login-availability" role="status"><p>{reason}</p><small>此方式开通后即可使用，当前不会发送验证码或创建扫码请求。</small></div>:method==='wechat'?<div className="login-wechat">
    {!qr?<><div className="login-wechat-empty"><MessageCircle size={35}/><strong>用微信安全扫码登录</strong><p>获取二维码后，用手机微信扫描并确认授权。</p></div><button type="button" className="button primary full" aria-label="获取微信登录二维码" disabled={Boolean(busy)||completed} onClick={startWechat}>{busy==='qr'?<LoaderCircle size={16} className="spin"/>:<MessageCircle size={16}/>}获取登录二维码</button></>:<><div className="login-wechat-frame">{qrExpired?<div className="login-qr-overlay"><strong>二维码已过期</strong><span>请重新获取二维码。</span></div>:qr.state==='approved'?<div className="login-qr-overlay"><Check size={27}/><strong>微信已确认授权</strong><span>{completed?'登录成功':'正在确认登录状态…'}</span></div>:<iframe title="微信官方登录二维码" src={qr.authorizationUrl} referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"/>}</div><p className="login-qr-state" role="status">{qrExpired?'当前二维码已失效':qr.state==='scanned'?'已扫码，请在微信中确认授权':qr.state==='failed'?'授权未完成':qr.state==='approved'?'正在完成登录':`请使用微信扫码 · ${seconds(qr.expiresAt-now)} 秒内有效`}</p><div className="login-qr-actions"><button type="button" className="login-text-button" aria-label="重新获取微信二维码" disabled={Boolean(busy)||completed} onClick={startWechat}><RefreshCw size={14}/>重新获取</button>{!qrExpired&&['waiting','scanned'].includes(qr.state)&&<button type="button" className="login-text-button" aria-label="检查微信扫码状态" disabled={Boolean(busy)||completed} onClick={()=>checkWechat(qr)}>检查扫码状态</button>}</div>{!qrExpired&&['waiting','scanned'].includes(qr.state)&&<a className="login-wechat-new-window" href={qr.openUrl} target="_blank" rel="noopener noreferrer">无法显示二维码？在新窗口授权<ArrowRight size={13}/></a>}</>}
   </div>:<form className="login-code-form" onSubmit={login}>
    <label className="field">{method==='phone'?'手机号':'邮箱地址'}<input aria-label={method==='phone'?'登录手机号':'登录邮箱'} type={method==='phone'?'tel':'email'} autoComplete={method==='phone'?'tel':'email'} inputMode={method==='phone'?'tel':'email'} maxLength={method==='phone'?24:254} value={targets[method]} disabled={Boolean(busy)||completed} onChange={event=>changeTarget(event.target.value)} placeholder={method==='phone'?'请输入中国大陆手机号':'请输入你的邮箱地址'}/></label>
    <label className="field">验证码<div className="login-code-row"><input ref={codeRef} aria-label="登录验证码" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} disabled={Boolean(busy)||completed} onChange={event=>{setCode(event.target.value.replace(/\D/g,''));setError('');}} placeholder="6 位数字验证码"/><button type="button" aria-label="获取登录验证码" disabled={Boolean(busy)||remaining>0||completed} onClick={sendCode}>{busy==='send'?'正在发送…':remaining?`${remaining} 秒后重发`:'获取验证码'}</button></div></label>
    {codeExpired&&<p className="login-help" role="status">验证码已过期，请重新获取。</p>}
    <button type="submit" className="button primary full" aria-label={binding?'验证并绑定':'验证并登录'} disabled={Boolean(busy)||completed}>{busy==='login'||busy==='confirm'?<LoaderCircle size={16} className="spin"/>:completed?<Check size={16}/>:null}{completed?(binding?'绑定成功':'登录成功'):(binding?'验证并绑定':'验证并登录')}<ArrowRight size={16}/></button>
    <p className="login-help">{binding?'验证码仅用于绑定当前创作账号，不会创建其他账号。':'首次验证后将创建独立账号。已有作品的账号，请先登录原账号再绑定此登录方式。'}</p>
   </form>}
  </div>
  {notice&&<p className="login-notice" role="status">{notice}</p>}{error&&<p className="login-error" role="alert">{error}</p>}{confirmNeeded&&<button type="button" className="login-text-button" aria-label="重新确认账号状态" disabled={Boolean(busy)} onClick={()=>finishSession(sequence.current)}><RefreshCw size={14}/>重新确认账号状态</button>}
  {!binding&&<div className="login-other"><span>已有账号或管理员</span><button type="button" className="login-text-button" aria-label="账号密码登录" onClick={openLegacy}><KeyRound size={14}/>账号密码登录</button></div>}
 </section>;
}
