import React,{createContext,useContext,useEffect,useState} from 'react';
import { ArrowRight, LoaderCircle, LockKeyhole, LogIn, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import {requestApi} from './Generation';
const Context=createContext(null);
export function AccountProvider({children}) {
 const [session,setSession]=useState({ready:false,configured:false,user:null,error:''});
 const refresh=async()=>{try{const result=await requestApi('/api/auth/status',undefined,{method:'GET'});setSession({...result,ready:true,error:''});}catch(e){setSession(previous=>({...previous,ready:true,error:e.message}));}};
 useEffect(()=>{refresh();},[]);
 const value={...session,refresh};
 return <Context.Provider value={value}>{!session.ready||session.error?<div className="account-gate"><div className="account-form"><span className="modal-symbol"><LockKeyhole/></span><h2>{session.error?'创作空间暂未连接':'正在打开创作空间'}</h2><p className="modal-desc" role="status">{session.error||'正在检查本机账号与保存状态…'}</p>{session.error&&<button className="button primary full" onClick={refresh}>重新连接</button>}</div></div>:session.configured&&!session.user?<div className="account-gate"><AccountForm loginOnly onSuccess={refresh}/></div>:children}</Context.Provider>;
}
export function useAccount(){return useContext(Context);}
export function AccountForm({loginOnly=false,onSuccess}) {
 const account=useAccount();const [username,setUsername]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const submit=async e=>{e.preventDefault();setBusy(true);setError('');try{await requestApi(loginOnly?'/api/auth/login':'/api/auth/register',{username,password});await account?.refresh();onSuccess?.();}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <form className="account-form" onSubmit={submit}><span className="modal-symbol"><LockKeyhole/></span><h2>{loginOnly?'登录墨多多写作':'设置本机创作账号'}</h2><p className="modal-desc">{loginOnly?'登录后继续访问这台机器上的创作空间。':'设置后需登录才能访问本机服务与文稿，现有作品会保留。'}</p><label className="field">账号<input required aria-label="创作账号" autoComplete="username" minLength={3} maxLength={30} value={username} onChange={e=>setUsername(e.target.value)} placeholder="3–30 位中文、字母或数字"/></label><label className="field">密码<input required type="password" aria-label="创作密码" autoComplete={loginOnly?'current-password':'new-password'} minLength={8} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} placeholder="至少 8 个字符"/></label>{error&&<p className="settings-message" role="alert">{error}</p>}<button className="button primary full" disabled={busy} type="submit">{busy?<LoaderCircle size={16} className="spin"/>:<LogIn size={16}/>} {loginOnly?'登录创作空间':'设置账号并登录'}<ArrowRight size={16}/></button><p className="form-footnote">此账号用于当前本机空间，暂不提供手机号验证或找回密码。</p></form>;
}
export function AccountAccess({onClose}) {
 const account=useAccount(),[setting,setSetting]=useState(false),[error,setError]=useState('');
 if(!account)return null;
 if(setting)return <AccountForm onSuccess={()=>{setSetting(false);onClose?.();}}/>;
 return <div className="account-access"><div><ShieldCheck size={18}/><span><strong>{account.user?account.user.username:'本机创作空间'}</strong><small>{account.configured?'已设置账号保护':'可设置账号，保护本机文稿与服务配置'}</small></span></div>{account.user?<button className="button secondary" onClick={async()=>{try{await requestApi('/api/auth/logout',{});await account.refresh();onClose?.();}catch(e){setError(e.message);}}}><LogOut size={14}/>退出登录</button>:<button className="button secondary" onClick={()=>setSetting(true)}><UserRound size={14}/>设置账号</button>}{error&&<p role="alert">{error}</p>}</div>;
}
