import React,{useEffect,useRef,useState} from 'react';
import {ArrowRight,BookOpen,CircleHelp,Search,X} from 'lucide-react';
import {WorkbenchFrame} from './Navigation.jsx';
import {ReferenceHome} from './HomeDesk.jsx';
import {AccountForm,canAccessPrivate,useAccount} from './Account.jsx';
import {tools} from './data.js';
import './public-home.css';

// Public content deliberately has no workspace, billing or generation provider.
export function PublicHomeShell({items,visible=true,onLaunch,onNavigate}) {
 const account=useAccount(),[dialog,setDialog]=useState(null),[query,setQuery]=useState('');
 const pending=useRef(null),dialogRef=useRef(null),triggerRef=useRef(null);
 const finishLogin=()=>{const action=pending.current;pending.current=null;setDialog(null);action?.();};
 const requireAccount=action=>{
  if(canAccessPrivate(account)){action?.();return;}
  pending.current=action||null;triggerRef.current=globalThis.document?.activeElement;setDialog('auth');
 };
 const close=()=>{pending.current=null;setDialog(null);triggerRef.current?.focus?.();};
 useEffect(()=>{
  if(dialog==='auth'&&canAccessPrivate(account)&&(pending.current||account?.user))finishLogin();
 },[account?.ready,account?.error,account?.configured,account?.user,dialog]);
 useEffect(()=>{if(!visible){pending.current=null;setDialog(null);}},[visible]);
 useEffect(()=>{
  if(!visible||!dialog)return;
  const before=document.activeElement,node=dialogRef.current;
  const controls=()=>Array.from(node?.querySelectorAll('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),a[href]')||[]).filter(element=>element.offsetParent!==null);
  const frame=requestAnimationFrame(()=>controls()[0]?.focus());
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
 const navigate=id=>id==='home'?onNavigate(id):requireAccount(()=>onNavigate(id));
 const open=options=>{
  if(['help','notifications'].includes(options.type)){setDialog(options.type);return;}
  if(options.type==='account'&&!account?.user){requireAccount();if(canAccessPrivate(account))setDialog('auth');return;}
  requireAccount(()=>onLaunch(options));
 };
 const pageModal=options=>{if(['help','notifications'].includes(options.type))setDialog(options.type);else onLaunch(options);};
 return <div data-public-home="true" hidden={!visible}>
  <WorkbenchFrame publicView navigationId="public-main-sidebar" items={items} route="home" navigate={navigate} setModal={open} onSearch={()=>{setQuery('');setDialog('search');}} dialogOpen={Boolean(dialog)}>
   <main className="main-content market-content home-content" aria-label="公共首页"><ReferenceHome navigate={navigate} setModal={pageModal} notify={()=>{}} onRequireAccount={requireAccount} authenticated={Boolean(account?.user)}/><footer className="page-footer"><span>墨多多写作</span><i/>让灵感落笔，让故事生长。</footer></main>
  </WorkbenchFrame>
  {dialog&&<div className="modal-backdrop public-dialog-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close();}}><section className={`modal public-home-dialog${dialog==='search'?' search-modal':''}`} role="dialog" aria-modal="true" aria-label={dialog==='auth'?'登录或注册':dialog==='search'?'搜索写作工具':'使用帮助'} ref={dialogRef}><button type="button" className="modal-close icon-button" aria-label="关闭公共首页弹窗" onClick={close}><X size={20}/></button>
   {dialog==='auth'&&(!account?.ready||account.error?<div className="account-form"><h2>{account?.error?'暂时无法连接创作服务':'正在检查账号状态'}</h2><p className="modal-desc" role="status">{account?.error||'你可以关闭此窗口继续浏览首页。'}</p>{account?.error&&<button type="button" className="button primary full" onClick={()=>account.refresh()}>重新连接</button>}</div>:<AccountForm loginOnly={account.configured} onSuccess={finishLogin}/>)}
   {dialog==='search'&&<><h2><Search size={22}/>查找写作工具</h2><label className="public-tool-search">输入工具或创作需求<input aria-label="搜索公开写作工具" value={query} onChange={event=>setQuery(event.target.value)} placeholder="试试：大纲、人物、润色…"/></label><div className="search-results">{tools.filter(tool=>`${tool.title}${tool.desc}`.includes(query.trim())).map(tool=><button type="button" key={tool.id} onClick={()=>requireAccount(()=>onLaunch({type:'tool',tool}))}><BookOpen size={18}/><span>{tool.title}<small>{tool.desc}</small></span><ArrowRight size={15}/></button>)}</div></>}
   {['help','notifications'].includes(dialog)&&<><span className="modal-symbol"><CircleHelp/></span><h2>从一个灵感开始</h2><p className="modal-desc">首页展示通用创作入口与预写示例。你可以先浏览和输入想法；进入真实创作时，再登录自己的创作空间。</p><div className="public-help-copy"><p>在「我的作品」管理文稿、导入 TXT 和继续写作。</p><p>创作对话用于讨论灵感和情节，回复经你确认后再带入规划或改稿。</p><p>个人作品、历史与账本不会出现在公共首页。</p></div><button type="button" className="button primary full" onClick={close}>继续浏览</button></>}
  </section></div>}
 </div>;
}
