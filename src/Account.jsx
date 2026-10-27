import React,{createContext,useContext,useEffect,useRef,useState} from 'react';
import { ArrowRight, Check, Copy, KeyRound, LoaderCircle, LockKeyhole, LogIn, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import {requestApi} from './Generation';
import {setRequestSpace} from './sessionScope.js';
import {LoginMethods} from './LoginMethods.jsx';
import {IdentitySettings} from './IdentitySettings.jsx';
export const AccountContext=createContext(null);

export function AccountProvider({children,allowPublic=false}) {
 const [session,setSession]=useState({ready:false,configured:false,user:null,spaceId:'local',canRegister:true,error:''});
 const alive=useRef(true),requestSequence=useRef(0);
 const refresh=async()=>{
  const sequence=++requestSequence.current;
  try{
   const result=await requestApi('/api/auth/status',undefined,{method:'GET'});
   if(typeof result?.configured!=='boolean'||(result.user&&(!result.configured||typeof result.user.id!=='string'||!result.user.id||result.spaceId!==result.user.id))||(!result.configured&&result.spaceId!=='local'))throw new Error('账号状态尚未确认，请重新连接。');
   if(!alive.current||sequence!==requestSequence.current)return null;
   setRequestSpace(result.configured&&!result.user?null:result.spaceId||null);setSession({...result,spaceId:result.spaceId||result.user?.id||'local',ready:true,error:''});return result;
  }catch(e){if(alive.current&&sequence===requestSequence.current){setRequestSpace(null);setSession(previous=>({...previous,user:null,ready:true,error:e.message}));}return null;}
 };
 useEffect(()=>{alive.current=true;refresh();return()=>{alive.current=false;requestSequence.current++;setRequestSpace(null);};},[]);
 const value={...session,refresh};
 return <AccountContext.Provider value={value}>{allowPublic?children:!session.ready||session.error?<div className="account-gate"><div className="account-form"><span className="modal-symbol"><LockKeyhole/></span><h2>{session.error?'创作空间暂未连接':'正在打开创作空间'}</h2><p className="modal-desc" role="status">{session.error||'正在检查账号与保存状态…'}</p>{session.error&&<button className="button primary full" onClick={refresh}>重新连接</button>}</div></div>:session.configured&&!session.user?<div className="account-gate"><AccountForm loginOnly/></div>:<React.Fragment key={session.spaceId||'local'}>{children}</React.Fragment>}</AccountContext.Provider>;
}
export function useAccount(){return useContext(AccountContext);}

export function canAccessPrivate(account) {return Boolean(account?.ready&&!account.error&&((account.configured===false&&account.spaceId==='local')||(account.configured===true&&typeof account.user?.id==='string'&&account.user.id.length>0&&account.user.id===account.spaceId)));}
export function PrivateAccountGate({children,onHome,requireLogin=false}) {
 const account=useAccount();
 if(!canAccessPrivate(account)||(requireLogin&&(account?.configured!==true||!account?.user)))return <div className="account-gate"><div>{!account?.ready||account.error?<div className="account-form"><span className="modal-symbol"><LockKeyhole/></span><h2>{account?.error?'创作空间暂未连接':'正在打开创作空间'}</h2><p className="modal-desc" role="status">{account?.error||'正在检查账号与保存状态…'}</p>{account?.error&&<button type="button" className="button primary full" onClick={()=>account.refresh()}>重新连接</button>}</div>:<AccountForm modern loginOnly={Boolean(account?.configured)}/>}{onHome&&<button type="button" className="button secondary full" onClick={onHome}>返回首页</button>}</div></div>;
 return children;
}

function RecoveryCode({code,onContinue,busy=false}) {
 const [saved,setSaved]=useState(false),[copyStatus,setCopyStatus]=useState('');
 const copy=async()=>{try{if(!globalThis.navigator?.clipboard?.writeText)throw new Error();await navigator.clipboard.writeText(code);setCopyStatus('恢复码已复制，请保存到安全位置。');}catch{setCopyStatus('复制未完成，请选择恢复码手动复制。');}};
 return <div className="account-recovery-code"><span className="modal-symbol"><KeyRound/></span><h2>保存你的账号恢复码</h2><p className="modal-desc">恢复码仅在这次操作后展示。忘记密码时，可凭账号和恢复码设置新密码。请保存到密码管理器或其他安全位置。</p><code aria-label="账号恢复码">{code}</code><button type="button" className="button secondary full" onClick={copy}><Copy size={15}/>复制恢复码</button>{copyStatus&&<p role="status">{copyStatus}</p>}<label className="account-recovery-consent"><input type="checkbox" aria-label="已安全保存恢复码" checked={saved} onChange={e=>setSaved(e.target.checked)}/><span>我已安全保存恢复码，了解新恢复码会替代旧码。</span></label><button type="button" className="button primary full" disabled={!saved||busy} onClick={()=>{if(saved&&!busy)onContinue();}}>{busy?<LoaderCircle className="spin" size={16}/>:<Check size={16}/>}已保存，继续</button></div>;
}

export function AccountForm({modern=false,loginOnly=false,onSuccess}) {
 const account=useAccount();
 return modern&&account?.configured!==false?<LoginMethods account={account} onSuccess={onSuccess} renderLegacy={()=><LegacyAccountForm loginOnly allowRegistration={false} onSuccess={onSuccess}/>}/>:<LegacyAccountForm loginOnly={loginOnly} onSuccess={onSuccess}/>;
}

export function LegacyAccountForm({loginOnly=false,onSuccess,allowRegistration=true}) {
 const account=useAccount();const [mode,setMode]=useState(loginOnly?'login':'register');
 const [username,setUsername]=useState(''),[password,setPassword]=useState(''),[recoveryCode,setRecoveryCode]=useState(''),[pendingCode,setPendingCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const finish=async()=>{setBusy(true);try{const refreshed=account?await account.refresh():true;if(refreshed!==null)onSuccess?.();}finally{setBusy(false);}};
 const changeMode=value=>{setMode(value);setPassword('');setRecoveryCode('');setError('');};
 const submit=async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');try{const result=await requestApi(`/api/auth/${mode==='recover'?'recover':mode}`,{username:username.trim(),password,...(mode==='recover'?{recoveryCode:recoveryCode.trim()}:{})});setPassword('');setRecoveryCode('');if(mode==='register'||mode==='recover'){if(!result.recoveryCode)throw new Error('服务未返回恢复码，请保留当前页面并重试。');setPendingCode(result.recoveryCode);}else{const refreshed=account?await account.refresh():true;if(refreshed!==null)onSuccess?.();}}catch(e){setError(e.message);}finally{setBusy(false);}};
 if(pendingCode)return <div className="account-form"><RecoveryCode code={pendingCode} busy={busy} onContinue={finish}/></div>;
 const canRegister=allowRegistration&&account?.canRegister!==false;
 const title=mode==='login'?'登录墨多多':mode==='recover'?'用恢复码重置密码':account?.configured?'注册创作账号':'设置首个创作账号';
 return <form className="account-form" onSubmit={submit}><span className="modal-symbol"><LockKeyhole/></span><h2>{title}</h2><p className="modal-desc">{mode==='login'?'登录后访问自己的文稿、素材与墨点记录。':mode==='recover'?'输入注册时保存的恢复码和新密码。重置后旧恢复码与此前登录会失效。':account?.configured?'新账号使用独立创作空间，文稿与账本按账号保存。':'首个账号成为管理员，并接管当前本机作品和资料。'}</p><label className="field">账号<input required disabled={busy} aria-label="创作账号" autoComplete="username" minLength={3} maxLength={30} value={username} onChange={e=>setUsername(e.target.value)} placeholder="3–30 位中文、字母或数字"/></label>{mode==='recover'&&<label className="field">恢复码<input required disabled={busy} aria-label="账号恢复码输入" autoComplete="off" value={recoveryCode} onChange={e=>setRecoveryCode(e.target.value)} placeholder="输入此前保存的恢复码"/></label>}<label className="field">{mode==='recover'?'新密码':'密码'}<input required disabled={busy} type="password" aria-label="创作密码" autoComplete={mode==='login'?'current-password':'new-password'} minLength={8} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} placeholder="至少 8 个字符"/></label>{error&&<p className="settings-message" role="alert">{error}</p>}<button className="button primary full" disabled={busy} type="submit">{busy?<LoaderCircle size={16} className="spin"/>:<LogIn size={16}/>} {mode==='login'?'登录创作空间':mode==='recover'?'重置密码并查看新恢复码':account?.configured?'注册并查看恢复码':'设置账号并查看恢复码'}<ArrowRight size={16}/></button><div className="account-mode-links">{mode!=='login'&&<button type="button" disabled={busy} onClick={()=>changeMode('login')}>已有账号，去登录</button>}{mode!=='register'&&canRegister&&<button type="button" disabled={busy} onClick={()=>changeMode('register')}>注册新账号</button>}{mode!=='recover'&&<button type="button" disabled={busy} onClick={()=>changeMode('recover')}>忘记密码？使用恢复码</button>}</div><p className="form-footnote">账号用于当前写作服务；密码找回依靠你保存的恢复码，不提供邮件或短信找回。</p></form>;
}

export function AccountAccess({onClose}) {
 const account=useAccount(),[setting,setSetting]=useState(false),[managing,setManaging]=useState(false),[password,setPassword]=useState(''),[pendingCode,setPendingCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [identityOpen,setIdentityOpen]=useState(false);
 if(!account)return null;
 const passwordCapable=account.user?.hasPassword!==false;
 if(setting)return <AccountForm onSuccess={()=>{setSetting(false);onClose?.();}}/>;
 if(pendingCode)return <RecoveryCode code={pendingCode} busy={busy} onContinue={async()=>{setBusy(true);try{const result=await account.refresh();if(result!==null){setPendingCode('');setManaging(false);}}finally{setBusy(false);}}}/>;
 const rotate=async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');try{const result=await requestApi('/api/auth/recovery',{password});if(!result.recoveryCode)throw new Error('服务未返回恢复码，请重试。');setPassword('');setPendingCode(result.recoveryCode);}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <div className="account-access"><div><ShieldCheck size={18}/><span><strong>{account.user?account.user.username:'本机创作空间'}</strong><small>{account.user?`${account.user.role==='admin'?'管理员':'作者'} · 独立创作空间`:'尚未设置账号，当前使用本机空间'}</small></span></div>{account.user?<><button type="button" className="button secondary" aria-label="管理登录方式" aria-expanded={identityOpen} disabled={busy} onClick={()=>setIdentityOpen(value=>!value)}><UserRound size={14}/>{identityOpen?'收起登录方式':'管理登录方式'}</button>{passwordCapable&&<button className="button secondary" disabled={busy} onClick={()=>{setManaging(!managing);setError('');setPassword('');}}><KeyRound size={14}/>管理恢复码</button>}<button className="button secondary" disabled={busy} onClick={async()=>{setBusy(true);try{await requestApi('/api/auth/logout',{});setRequestSpace(null);await account.refresh();onClose?.();}catch(e){setError(e.message);}finally{setBusy(false);}}}><LogOut size={14}/>退出登录</button></>:<button className="button secondary" onClick={()=>setSetting(true)}><UserRound size={14}/>设置账号</button>}{account.user&&identityOpen&&<IdentitySettings account={account}/>}{managing&&passwordCapable&&<form className="account-recovery-form" onSubmit={rotate}><p>生成新恢复码会使旧码失效。请先验证当前密码，并在下一步保存新码。</p><label className="field">当前密码<input type="password" aria-label="管理恢复码当前密码" autoComplete="current-password" required minLength={8} disabled={busy} value={password} onChange={e=>setPassword(e.target.value)}/></label><button type="submit" className="button secondary" disabled={busy||!password}>{busy?<LoaderCircle className="spin" size={14}/>:<KeyRound size={14}/>}生成新的恢复码</button></form>}{account.user&&!passwordCapable&&<p className="form-footnote">此账号通过已验证的登录方式访问，请在登录方式中管理绑定。</p>}{error&&<p role="alert">{error}</p>}</div>;
}
