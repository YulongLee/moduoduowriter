import React,{useEffect,useRef,useState} from 'react';
import {Link,Mail,MessageCircle,RefreshCw,Smartphone} from 'lucide-react';
import {requestApi} from './Generation.jsx';
import {LoginMethods} from './LoginMethods.jsx';

const labels={phone:'手机号',email:'邮箱',wechat:'微信'},icons={phone:Smartphone,email:Mail,wechat:MessageCircle};
export function IdentitySettings({account}) {
 const [items,setItems]=useState([]),[binding,setBinding]=useState(false),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const alive=useRef(true),sequence=useRef(0);
 const load=async()=>{const current=++sequence.current;setLoading(true);setError('');try{const data=await requestApi('/api/auth/identities',undefined,{method:'GET'});if(!Array.isArray(data.identities))throw Error('登录方式未能载入，请重试。');if(alive.current&&current===sequence.current)setItems(data.identities);}catch(value){if(alive.current&&current===sequence.current)setError(value.message);}finally{if(alive.current&&current===sequence.current)setLoading(false);}};
 useEffect(()=>{alive.current=true;load();return()=>{alive.current=false;sequence.current++;};},[account?.user?.id]);
 if(!account?.user)return null;
 return <section className="identity-settings" aria-label="登录方式管理"><header><h3><Link size={17}/>登录方式</h3><button type="button" className="text-button" disabled={loading||binding} aria-label="重新载入绑定方式" onClick={load}><RefreshCw size={14}/>刷新</button></header><p>绑定后，可通过不同方式进入同一个创作空间。</p>{loading?<p role="status">正在读取登录方式…</p>:<ul>{items.map(item=>{const Icon=icons[item.provider]||Link;return <li key={item.id}><Icon size={17}/><span>{labels[item.provider]||'已验证身份'}</span><strong>{item.masked}</strong></li>;})}{!items.length&&<li>尚未绑定微信、手机号或邮箱。</li>}</ul>}{error&&<p role="alert" className="login-error">{error}</p>}{binding?<div><button type="button" className="text-button" onClick={()=>setBinding(false)}>返回绑定列表</button><LoginMethods account={account} purpose="bind" onSuccess={()=>{setBinding(false);load();}}/></div>:<button type="button" className="button secondary" disabled={loading||Boolean(error)} onClick={()=>setBinding(true)}>绑定登录方式</button>}</section>;
}
