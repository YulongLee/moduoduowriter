import React,{useEffect,useRef,useState} from 'react';
import {ArrowRight,BookOpen,CircleHelp,Search,UserRound,X} from 'lucide-react';
import {Brand,BrandWordmark} from './Art.jsx';
import {ReferenceHome} from './HomeDesk.jsx';
import {AccountAccess,AccountForm,canAccessPrivate,useAccount} from './Account.jsx';
import {tools} from './data.js';
import {SiteRegistration} from './SiteRegistration.jsx';
import {SeoResourceLinks} from './SeoResourceLinks.jsx';
import LandingWorkspacePreview from './LandingWorkspacePreview.jsx';
import './public-home.css';

const productDemoTabs=[
 {id:'outline',label:'大纲',title:'先看清故事的方向',paragraphs:['《苍山行记》讲述少年沈砚受托送出一封旧信，沿途逐渐发现师门与临江城的往事。以下节点只是预写的规划示例，作者可以调整方向。'],list:['起点：沈砚离开山门，必须将带有飞鸟墨印的信送到临江城。','变化：青伞客认出了墨印，却提醒他不要急着交信。两条相反的指示让他必须自己核实。','选择：在继续履行师命前，沈砚决定先找到能够解释墨印来历的人。']},
 {id:'character',label:'人物',title:'让行动有自己的理由',paragraphs:['沈砚｜初次离山的少年。外在目标是完成送信之托，内在矛盾是习惯服从与开始独立判断之间的拉扯。遇到不确定的事，他会先握住背带，再重新检查信封。','青伞客｜守在山道尽头的人。眼下只确定他认识墨印；他的身份、目的与可信程度仍是候选设定，不能提前当作正文事实。']},
 {id:'opening',label:'开篇',title:'把设定落到一个具体场景',paragraphs:['晨雾未散，山门前的石阶已经湿透。沈砚背好旧剑，回头看了一眼住了十六年的小院。','师父没有送他，只留下一个信封：“去临江城，把它交给等你的人。”封口的墨印上，是一只从未见过的飞鸟。','他把信收入怀中，沿着山道走向晨光。石阶尽头，一个撑着青伞的陌生人抬起头，像是已经等了很久。']},
];

// Public content deliberately has no workspace, billing or generation provider.
export function PublicHomeShell({visible=true,onLaunch,onNavigate}) {
 const account=useAccount(),[dialog,setDialog]=useState(null),[query,setQuery]=useState(''),[activeSection,setActiveSection]=useState('首页'),[demoTab,setDemoTab]=useState('outline');
 const authenticated=Boolean(account?.user)&&account?.configured===true&&canAccessPrivate(account);
 const pending=useRef(null),dialogRef=useRef(null),triggerRef=useRef(null),demoTabRefs=useRef(new Map());
 const finishLogin=()=>{const action=pending.current;pending.current=null;setDialog(null);action?.();};
 const requireAccount=action=>{
  if(authenticated){action?.();return;}
  pending.current=action||null;triggerRef.current=globalThis.document?.activeElement;setDialog('auth');
 };
 const close=()=>{pending.current=null;setDialog(null);triggerRef.current?.focus?.();};
 useEffect(()=>{
  if(dialog==='auth'&&authenticated&&(pending.current||account?.user))finishLogin();
 },[account?.ready,account?.error,account?.configured,account?.user,dialog]);
 useEffect(()=>{if(dialog==='account'&&!authenticated)close();},[dialog,authenticated]);
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
 const enterStudio=()=>requireAccount(()=>onNavigate('workspace'));
 const scrollTo=(label,id)=>{setActiveSection(label);const behavior=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches?'auto':'smooth';if(id){const target=document.getElementById(id);if(target?.tagName==='DETAILS')target.open=true;target?.scrollIntoView?.({behavior,block:'start'});}else window.scrollTo?.({top:0,behavior});};
 const openPublicDialog=type=>{triggerRef.current=globalThis.document?.activeElement;if(type==='demo')setDemoTab('outline');setDialog(type);};
 const sections=[['首页',''],['功能介绍','landing-features'],['创作案例','landing-examples'],['定价会员',null]];
 const pageModal=options=>{if(options.type==='product-demo')openPublicDialog('demo');else if(['help','notifications'].includes(options.type))setDialog(options.type);else onLaunch(options);};
 const demoTabKey=(event,index)=>{let next;if(event.key==='ArrowRight')next=(index+1)%productDemoTabs.length;else if(event.key==='ArrowLeft')next=(index+productDemoTabs.length-1)%productDemoTabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=productDemoTabs.length-1;else return;event.preventDefault();const id=productDemoTabs[next].id;setDemoTab(id);demoTabRefs.current.get(id)?.focus?.();};
 return <div className="public-landing public-centered-shell" data-public-home="true" hidden={!visible}>
  <header className="public-landing-header" aria-label="网站导航">
   <div className="public-landing-header-inner">
    <button type="button" className="public-landing-brand" aria-label="墨多多首页" onClick={()=>scrollTo('首页','')}><Brand/><BrandWordmark/></button>
    <nav aria-label="网站主导航">{sections.map(([label,id])=><button type="button" key={label} aria-current={activeSection===label?'page':undefined} aria-haspopup={id===null?'dialog':undefined} onClick={()=>{if(id===null){setActiveSection(label);openPublicDialog('plans');}else scrollTo(label,id);}}>{label}</button>)}</nav>
    <div className="public-landing-header-actions">
     {authenticated?<button type="button" className="public-landing-account" aria-label="我的账号" aria-haspopup="dialog" onClick={()=>openPublicDialog('account')}><UserRound size={16} aria-hidden="true"/><span>我的账号</span></button>:<button type="button" className="public-landing-login" aria-label="登录" onClick={enterStudio}>登录</button>}
     <button type="button" className="public-landing-start" aria-label={authenticated?'进入创作台':'免费使用'} onClick={enterStudio}>{authenticated?'进入创作台':'免费开始创作'}<ArrowRight size={16}/></button>
    </div>
   </div>
  </header>
  <main className="public-landing-main" aria-label="公共首页">
   <ReferenceHome navigate={navigate} setModal={pageModal} notify={()=>{}} onRequireAccount={requireAccount} onEnterStudio={enterStudio} authenticated={authenticated}/>
   <footer className="public-landing-footer">
    <div className="public-landing-footer-main">
     <div className="public-footer-brand"><div className="public-footer-wordmark"><Brand/><BrandWordmark/></div><p>让好故事发生。</p><span>从灵感、大纲到正文，<br/>陪你把故事写成自己的作品。</span></div>
     <nav className="public-footer-links" aria-label="页脚产品导航"><strong>探索墨多多</strong><button type="button" onClick={()=>scrollTo('创作能力','landing-features')}>创作能力</button><button type="button" onClick={()=>scrollTo('作品示例','landing-examples')}>作品示例</button><button type="button" onClick={()=>scrollTo('写作工具','landing-tools')}>写作工具</button></nav>
     <nav className="public-footer-links" aria-label="页脚帮助导航"><strong>使用与支持</strong><button type="button" onClick={()=>scrollTo('常见问题','landing-faq')}>常见问题</button><button type="button" aria-label="搜索写作工具" title="搜索写作工具（⌘ / Ctrl K）" onClick={()=>{setQuery('');setDialog('search');}}><Search size={14}/>搜索写作工具</button><button type="button" onClick={()=>setDialog('help')}>使用帮助</button><button type="button" onClick={enterStudio}>进入创作空间<ArrowRight size={13}/></button></nav>
     <nav className="public-footer-links" aria-label="写作功能与指南"><strong>写作功能与指南</strong><a href="/features/ai-novel-writing/">AI 小说写作</a><a href="/features/novel-outline/">小说大纲规划</a><a href="/features/character-design/">小说人物设定</a><a href="/features/text-polish/">正文润色与改稿</a><a href="/guides/getting-started/">新手入门指南</a><a href="/about/">关于墨多多</a></nav>
    </div>
    <SeoResourceLinks/>
    <div className="public-footer-bottom"><span>© {new Date().getFullYear()} 墨多多 · 写作</span><span className="public-footer-demo">会员与墨点为方案演示，暂不提供在线付费。</span><SiteRegistration/></div>
   </footer>
  </main>
  {dialog&&<div className="modal-backdrop public-dialog-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close();}}><section className={`modal public-home-dialog${dialog==='search'?' search-modal':''}${dialog==='demo'?' product-demo-modal':''}${dialog==='plans'?' public-plans-modal':''}${dialog==='account'?' public-home-account':''}`} role="dialog" aria-modal="true" aria-label={dialog==='auth'?'登录或注册':dialog==='account'?'我的账号':dialog==='search'?'搜索写作工具':dialog==='demo'?'产品功能演示':dialog==='plans'?'创作方案演示':'使用帮助'} ref={dialogRef}><button type="button" className="modal-close icon-button" aria-label="关闭公共首页弹窗" onClick={close}><X size={20}/></button>
   {dialog==='account'&&authenticated&&<><h2><UserRound size={22}/>我的账号</h2><p className="modal-desc">你已登录，可以管理登录方式，或进入创作台继续写作。</p><AccountAccess onClose={close}/>{account?.user?.role==='admin'&&<button type="button" className="button secondary full" onClick={()=>{close();navigate('admin');}}>进入管理后台<ArrowRight size={16}/></button>}</>}
   {dialog==='auth'&&(!account?.ready||account.error?<div className="account-form"><h2>{account?.error?'暂时无法连接创作服务':'正在检查账号状态'}</h2><p className="modal-desc" role="status">{account?.error||'你可以关闭此窗口继续浏览首页。'}</p>{account?.error&&<button type="button" className="button primary full" onClick={()=>account.refresh()}>重新连接</button>}</div>:<AccountForm modern loginOnly={account.configured} onSuccess={finishLogin}/>)}
   {dialog==='search'&&<><h2><Search size={22}/>查找写作工具</h2><label className="public-tool-search">输入工具或创作需求<input aria-label="搜索公开写作工具" value={query} onChange={event=>setQuery(event.target.value)} placeholder="试试：大纲、人物、润色…"/></label><div className="search-results">{tools.filter(tool=>`${tool.title}${tool.desc}`.includes(query.trim())).map(tool=><button type="button" key={tool.id} onClick={()=>requireAccount(()=>onLaunch({type:'tool',tool}))}><BookOpen size={18}/><span>{tool.title}<small>{tool.desc}</small></span><ArrowRight size={15}/></button>)}</div></>}
   {dialog==='demo'&&<><span className="public-dialog-eyebrow">先看看，故事怎样开始</span><h2>从想法，到你的第一章</h2><p className="modal-desc">以下大纲、人物与开篇是原创预写内容，用于展示功能与整理方式。它们不是实时生成结果，也不来自任何用户的私人作品。</p><div className="product-demo-workspace"><LandingWorkspacePreview/></div><div className="product-demo-tabs" role="tablist" aria-label="预写功能示例">{productDemoTabs.map((tab,index)=><button type="button" role="tab" id={`public-product-demo-tab-${tab.id}`} key={tab.id} aria-selected={demoTab===tab.id} aria-controls={`public-product-demo-panel-${tab.id}`} tabIndex={demoTab===tab.id?0:-1} ref={node=>{if(node)demoTabRefs.current.set(tab.id,node);else demoTabRefs.current.delete(tab.id);}} onClick={()=>setDemoTab(tab.id)} onKeyDown={event=>demoTabKey(event,index)}>{tab.label}</button>)}</div>{productDemoTabs.map(tab=><section className="product-demo-panel" role="tabpanel" key={tab.id} id={`public-product-demo-panel-${tab.id}`} aria-labelledby={`public-product-demo-tab-${tab.id}`} hidden={demoTab!==tab.id} tabIndex={0}><h3>{tab.title}</h3>{tab.paragraphs.map(paragraph=><p key={paragraph}>{paragraph}</p>)}{tab.list&&<ol>{tab.list.map(item=><li key={item}>{item}</li>)}</ol>}</section>)}<div className="public-dialog-actions"><button type="button" className="button secondary" onClick={close}>继续浏览</button><button type="button" className="button primary" onClick={enterStudio}>开始自己的故事<ArrowRight size={15}/></button></div></>}
   {dialog==='plans'&&<><span className="public-dialog-eyebrow">按你的节奏，开始创作</span><h2>找到适合当前阶段的创作方式</h2><p className="modal-desc">先整理一个想法，或继续已经开始的作品。下方介绍可使用的创作路径，会员与墨点方案目前为功能演示，未接入真实支付。</p><div className="public-plan-grid"><article className="public-plan-card"><span>从零开始</span><h3>找到故事的方向</h3><p>用故事灵感、大纲与人物工具比较不同方案，选定你想继续写的故事。</p></article><article className="public-plan-card"><span>持续写作</span><h3>把章节逐步写完整</h3><p>在作品中组织文稿与设定，通过续写、对白和润色逐步完成修改。</p></article><article className="public-plan-card"><span>方案演示</span><h3>了解会员与墨点</h3><p>登录后可查看当前演示页面。展示的方案与墨点用于体验流程，不会进行真实扣款。</p></article></div><p className="public-plans-note">当前暂不提供在线付费；正式权益与价格以之后实际开放的说明为准。</p><div className="public-dialog-actions"><button type="button" className="button secondary" onClick={close}>继续浏览</button><button type="button" className="button primary" onClick={()=>requireAccount(()=>navigate('membership'))}>登录查看方案演示<ArrowRight size={15}/></button></div></>}
   {['help','notifications'].includes(dialog)&&<><span className="modal-symbol"><CircleHelp/></span><h2>从一个灵感开始</h2><p className="modal-desc">首页展示通用创作入口与预写示例。你可以先浏览和输入想法；进入真实创作时，再登录自己的创作空间。</p><div className="public-help-copy"><p>在「我的作品」管理文稿、导入 TXT 和继续写作。</p><p>创作对话用于讨论灵感和情节，回复经你确认后再带入规划或改稿。</p><p>个人作品、历史与账本不会出现在公共首页。</p></div><button type="button" className="button primary full" onClick={close}>继续浏览</button></>}
  </section></div>}
 </div>;
}
