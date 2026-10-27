import React,{useEffect,useRef,useState} from 'react';
import {ArrowRight,BookOpen,CircleHelp,Search,X} from 'lucide-react';
import {Brand} from './Art.jsx';
import {ReferenceHome} from './HomeDesk.jsx';
import {AccountForm,canAccessPrivate,useAccount} from './Account.jsx';
import {tools} from './data.js';
import './public-home.css';

// Public content deliberately has no workspace, billing or generation provider.
export function PublicHomeShell({visible=true,onLaunch,onNavigate}) {
 const account=useAccount(),[dialog,setDialog]=useState(null),[query,setQuery]=useState(''),[activeSection,setActiveSection]=useState('首页');
 const authenticated=Boolean(account?.user)&&account?.configured===true&&canAccessPrivate(account);
 const pending=useRef(null),dialogRef=useRef(null),triggerRef=useRef(null);
 const finishLogin=()=>{const action=pending.current;pending.current=null;setDialog(null);action?.();};
 const requireAccount=action=>{
  if(authenticated){action?.();return;}
  pending.current=action||null;triggerRef.current=globalThis.document?.activeElement;setDialog('auth');
 };
 const close=()=>{pending.current=null;setDialog(null);triggerRef.current?.focus?.();};
 useEffect(()=>{
  if(dialog==='auth'&&authenticated&&(pending.current||account?.user))finishLogin();
 },[account?.ready,account?.error,account?.configured,account?.user,dialog]);
 useEffect(()=>{if(!visible){pending.current=null;setDialog(null);}},[visible]);
 useEffect(()=>{
  if(!visible||!dialog)return;
  const before=document.activeElement,node=dialogRef.current;
  const controls=()=>Array.from(node?.querySelectorAll('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),a[href]')||[]).filter(element=>element.offsetParent!==null);
  const frame=requestAnimationFrame(()=>(node?.querySelector('input:not([disabled]),textarea:not([disabled]),select:not([disabled])')||controls()[0])?.focus());
  const key=event=>{
   if(event.key==='Escape'){event.preventDefault();close();}
   if(event.key==='Tab'){const list=controls(),first=list[0],last=list.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
  };
  window.addEventListener('keydown',key);
  return()=>{cancelAnimationFrame(frame);window.removeEventListener('keydown',key);if(before?.isConnected)before.focus();};
 },[visible,dialog]);
 useEffect(()=>{
  if(!visible)return;
  const shortcut=event=>{if((event.metaKey||event.ctrlKey)&&event.key==='k'){event.preventDefault();setQuery('');setDialog('search');}};
  window.addEventListener('keydown',shortcut);return()=>window.removeEventListener('keydown',shortcut);
 },[visible]);
 const navigate=id=>onNavigate(id);
 const enterStudio=()=>requireAccount(()=>onNavigate('works'));
 const scrollTo=(label,id)=>{setActiveSection(label);const behavior=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches?'auto':'smooth';if(id){const target=document.getElementById(id);if(target?.tagName==='DETAILS')target.open=true;target?.scrollIntoView?.({behavior,block:'start'});}else window.scrollTo?.({top:0,behavior});};
 const sections=[['首页',''],['AI创作','landing-create'],['作品示例','landing-examples'],['创作工具','landing-tools'],['会员权益','landing-plans']];
 const pageModal=options=>{if(['help','notifications'].includes(options.type))setDialog(options.type);else onLaunch(options);};
 return <div className="public-landing" data-public-home="true" hidden={!visible}>
  <header className="public-landing-header" aria-label="网站导航"><button type="button" className="public-landing-brand" aria-label="墨多多写作首页" onClick={()=>scrollTo('首页','')}><Brand/><span>墨多多写作</span></button><nav aria-label="网站主导航">{sections.map(([label,id])=><button type="button" key={label} aria-current={activeSection===label?'page':undefined} onClick={()=>scrollTo(label,id)}>{label}</button>)}</nav><div className="public-landing-header-actions"><button type="button" className="public-landing-search" aria-label="搜索写作工具" onClick={()=>{setQuery('');setDialog('search');}}><Search size={16}/><span>搜索工具与创作方法…</span></button>{!authenticated&&<button type="button" className="public-landing-login" aria-label="登录" onClick={enterStudio}>登录</button>}<button type="button" className="public-landing-start" aria-label={authenticated?'进入创作台':'免费使用'} onClick={enterStudio}>{authenticated?'进入创作台':'免费使用'}<ArrowRight size={15}/></button></div></header>
  <main className="public-landing-main" aria-label="公共首页"><ReferenceHome navigate={navigate} setModal={pageModal} notify={()=>{}} onRequireAccount={requireAccount} onEnterStudio={enterStudio} authenticated={authenticated}/><footer className="public-landing-footer"><span>墨多多写作 · 让好故事发生</span><button type="button" onClick={()=>setDialog('help')}>使用帮助</button><span>会员与墨点为方案演示</span></footer></main>
  {dialog&&<div className="modal-backdrop public-dialog-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close();}}><section className={`modal public-home-dialog${dialog==='search'?' search-modal':''}`} role="dialog" aria-modal="true" aria-label={dialog==='auth'?'登录或注册':dialog==='search'?'搜索写作工具':'使用帮助'} ref={dialogRef}><button type="button" className="modal-close icon-button" aria-label="关闭公共首页弹窗" onClick={close}><X size={20}/></button>
   {dialog==='auth'&&(!account?.ready||account.error?<div className="account-form"><h2>{account?.error?'暂时无法连接创作服务':'正在检查账号状态'}</h2><p className="modal-desc" role="status">{account?.error||'你可以关闭此窗口继续浏览首页。'}</p>{account?.error&&<button type="button" className="button primary full" onClick={()=>account.refresh()}>重新连接</button>}</div>:<AccountForm loginOnly={account.configured} onSuccess={finishLogin}/>)}
   {dialog==='search'&&<><h2><Search size={22}/>查找写作工具</h2><label className="public-tool-search">输入工具或创作需求<input aria-label="搜索公开写作工具" value={query} onChange={event=>setQuery(event.target.value)} placeholder="试试：大纲、人物、润色…"/></label><div className="search-results">{tools.filter(tool=>`${tool.title}${tool.desc}`.includes(query.trim())).map(tool=><button type="button" key={tool.id} onClick={()=>requireAccount(()=>onLaunch({type:'tool',tool}))}><BookOpen size={18}/><span>{tool.title}<small>{tool.desc}</small></span><ArrowRight size={15}/></button>)}</div></>}
   {['help','notifications'].includes(dialog)&&<><span className="modal-symbol"><CircleHelp/></span><h2>从一个灵感开始</h2><p className="modal-desc">首页展示通用创作入口与预写示例。你可以先浏览和输入想法；进入真实创作时，再登录自己的创作空间。</p><div className="public-help-copy"><p>在「我的作品」管理文稿、导入 TXT 和继续写作。</p><p>创作对话用于讨论灵感和情节，回复经你确认后再带入规划或改稿。</p><p>个人作品、历史与账本不会出现在公共首页。</p></div><button type="button" className="button primary full" onClick={close}>继续浏览</button></>}
  </section></div>}
 </div>;
}
