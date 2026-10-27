import React, {createContext,useContext,useEffect,useRef,useState} from 'react';
import {Bell, ChevronRight, ChevronsUpDown, CircleHelp, Crown, Menu, PanelLeftClose, PanelLeftOpen, Search, Settings2, UserRound, X} from 'lucide-react';
import {Brand} from './Art';
import {BillingBadge} from './Billing.jsx';
import {useAccount} from './Account.jsx';
import {WorkspaceStatus} from './Workspace.jsx';

const SidebarPreferenceContext=createContext(null);
export function SidebarPreferenceProvider({children}) {
  const [open,setOpen]=useState(true);
  return <SidebarPreferenceContext.Provider value={{open,setOpen}}>{children}</SidebarPreferenceContext.Provider>;
}

export function WorkbenchFrame({items, route, navigate, setModal, onSearch, dialogOpen = false, publicView=false, navigationId='main-sidebar', children}) {
  const preference=useContext(SidebarPreferenceContext);
  const [localOpen,setLocalOpen]=useState(true);
  const desktopOpen=preference?preference.open:localOpen,setDesktopOpen=preference?preference.setOpen:setLocalOpen;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const account = useAccount();
  const accountMenuId=navigationId==='main-sidebar'?'sidebar-account-menu':navigationId+'-account-menu';
  const [desktop, setDesktop] = useState(() => typeof window === 'undefined' || window.innerWidth > 1024);
  const sidebarRef = useRef(null);
  const mobileToggleRef = useRef(null);
  const desktopToggleRef = useRef(null);
  const accountButtonRef = useRef(null);
  const accountWrapRef = useRef(null);
  const accountMenuRef = useRef(null);
  const accountOpenRef = useRef(false);
  const accountInitialFocus = useRef('first');
  accountOpenRef.current = accountOpen;
  const hidden = !desktop && !mobileOpen;
  const current = route === 'service-admin' ? {label:'本机服务管理'} : items.find(item => item.id === route) || items[0];

  useEffect(() => {
    const resize = () => setDesktop(window.innerWidth > 1024);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  useEffect(() => { setMobileOpen(false); setAccountOpen(false); }, [route, desktop, dialogOpen]);
  useEffect(() => {
    if (dialogOpen || (desktop ? !desktopOpen : !mobileOpen)) setAccountOpen(false);
  }, [desktop, desktopOpen, mobileOpen, dialogOpen]);
  const toggleSidebar=()=>{if(!desktop||dialogOpen)return;setDesktopOpen(previous=>!previous);setAccountOpen(false);};
  useEffect(()=>{
    if(!desktop)return;
    const key=event=>{if(event.key==='Escape'&&accountOpenRef.current){event.preventDefault?.();setAccountOpen(false);accountButtonRef.current?.focus();}};
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  },[desktop]);
  useEffect(() => {
    if (!mobileOpen || desktop) return;
    const sidebar = sidebarRef.current;
    const controls = () => Array.from(sidebar?.querySelectorAll('button:not([disabled])') || []);
    controls().find(button => button.classList.contains('mobile-nav-close'))?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (accountOpenRef.current) { setAccountOpen(false); accountButtonRef.current?.focus(); }
        else setMobileOpen(false);
      }
      if (event.key !== 'Tab') return;
      const buttons = controls(), first = buttons[0], last = buttons.at(-1);
      if (!first) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      mobileToggleRef.current?.focus();
    };
  }, [mobileOpen, desktop]);

  useEffect(() => {
    if (!accountOpen) return;
    const options = Array.from(accountMenuRef.current?.querySelectorAll('[role="menuitem"]') || []);
    (accountInitialFocus.current === 'last' ? options.at(-1) : options[0])?.focus();
    const outside = event => {
      if (!accountWrapRef.current?.contains(event.target)) setAccountOpen(false);
    };
    const blur = () => setAccountOpen(false);
    window.addEventListener('pointerdown', outside);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('pointerdown', outside);
      window.removeEventListener('blur', blur);
    };
  }, [accountOpen]);

  const go = destination => { setAccountOpen(false); setMobileOpen(false); navigate(destination); };
  const openAccountMenu = (position = 'first') => {
    accountInitialFocus.current = position;
    setAccountOpen(true);
  };
  const openAccountPanel = type => { setAccountOpen(false); setMobileOpen(false); setModal({type}); };
  const accountMenuKeyDown = event => {
    if (event.key === 'Tab') { setAccountOpen(false); accountButtonRef.current?.focus(); return; }
    if (!['ArrowDown','ArrowUp','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const options = Array.from(accountMenuRef.current?.querySelectorAll('[role="menuitem"]') || []);
    const currentIndex = options.indexOf(document.activeElement);
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : event.key === 'ArrowDown' ? (currentIndex + 1) % options.length : (currentIndex - 1 + options.length) % options.length;
    options[index]?.focus();
  };
  const accountName = account?.user?.username || '个人空间';


  return <div className={`app-shell commercial sidebar-auto${publicView?' public-home-shell':''}`} data-sidebar-expanded={desktop&&desktopOpen}>
    {mobileOpen && !desktop && <button className="mobile-scrim" aria-label="关闭菜单" onClick={() => setMobileOpen(false)}/>}
    <div className="sidebar-hover-zone" data-open={desktop && desktopOpen}>

    <aside id={navigationId} ref={sidebarRef} className={`sidebar${mobileOpen ? ' mobile-open' : ''}`} aria-label="工作台导航" data-collapsed={desktop && !desktopOpen} aria-hidden={hidden} inert={hidden}>
      <div className="sidebar-header"><button className="brand" aria-label="墨多多写作首页" onClick={() => go('home')}><Brand/><span className="brand-lockup"><span className="brand-wordmark"><strong>墨多多</strong><span className="brand-writing">写作</span></span><small>让好故事发生</small></span></button><button className="icon-button mobile-nav-close" aria-label="关闭导航" onClick={() => setMobileOpen(false)}><X size={19}/></button></div>
      <nav aria-label="主导航">{items.map(item => <React.Fragment key={item.id}>{item.section && <div className="nav-section">{item.section}</div>}<button className={`nav-item${item.nested ? ' nested' : ''}${route === item.id ? ' active' : ''}`} data-nav={item.id} aria-label={item.label} title={item.label} aria-current={route === item.id ? 'page' : undefined} onClick={() => go(item.id)}><item.icon size={19} strokeWidth={1.75}/><span>{item.label}</span>{item.badge && <small>{item.badge}</small>}{route === item.id && <i/>}</button></React.Fragment>)}</nav>
      <div className="sidebar-bottom">
        <button className="sidebar-plan" aria-label="会员与墨点" title="会员与墨点" onClick={() => go('membership')}><Crown size={19}/><span><strong>会员与墨点</strong><small>查看创作方案</small></span><ChevronRight size={15}/></button>
        <div className="sidebar-user-wrap" ref={accountWrapRef} onBlurCapture={event => {if (!event.currentTarget.contains(event.relatedTarget)) setAccountOpen(false);}}>
          {accountOpen && <div id={accountMenuId} className="sidebar-account-menu" role="menu" aria-label="账号菜单" ref={accountMenuRef} onKeyDown={accountMenuKeyDown}>
            <p>创作空间</p>
            <button type="button" role="menuitem" tabIndex={-1} onClick={() => openAccountPanel('account')}><UserRound size={17}/>个人空间<ChevronRight size={14}/></button>
            <button type="button" role="menuitem" tabIndex={-1} onClick={() => openAccountPanel('settings')}><Settings2 size={17}/>创作与数据设置</button>
            <button type="button" role="menuitem" tabIndex={-1} onClick={() => openAccountPanel('help')}><CircleHelp size={17}/>帮助与反馈</button>
          </div>}
          <button className="sidebar-user" ref={accountButtonRef} aria-label="我的创作空间" title="账号与设置" aria-haspopup="menu" aria-expanded={accountOpen} aria-controls={accountMenuId} onClick={() => accountOpen ? setAccountOpen(false) : openAccountMenu()} onKeyDown={event => {if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {event.preventDefault();openAccountMenu(event.key === 'ArrowUp' ? 'last' : 'first');}}}><div className="avatar">{account?.user?.username?.slice(0,1).toUpperCase() || '墨'}</div><span><strong>{accountName}</strong><small>账号与设置</small></span><ChevronsUpDown size={16}/></button>
        </div>
      </div>
    </aside>
    </div>
    <div className="workspace">
      <header className="topbar"><div className="breadcrumb"><button ref={desktopToggleRef} className="icon-button desktop-sidebar-toggle" aria-label={desktopOpen?'收起导航':'展开导航'} title={desktopOpen?'收起导航':'展开导航'} aria-controls={navigationId} aria-expanded={desktopOpen} onClick={toggleSidebar}>{desktopOpen?<PanelLeftClose size={20}/>:<PanelLeftOpen size={20}/>}</button><button ref={mobileToggleRef} className="icon-button mobile-menu" aria-label="打开菜单" aria-controls={navigationId} aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}><Menu size={21}/></button><button className="topbar-brand" aria-label="墨多多写作首页" onClick={()=>go('home')}><Brand small/><span>墨多多写作</span></button><span className="topbar-location-separator" aria-hidden="true"/><strong className="topbar-location">{route==='home'?(publicView?'首页':'创作工作台'):current.label}</strong>{!publicView&&<WorkspaceStatus compact/>}</div><div className="topbar-right"><button className="global-search" onClick={onSearch}><Search size={16}/><span>{publicView?'搜索工具与创作方法':'搜索作品、工具或灵感'}</span><kbd>⌘ K</kbd></button>{!publicView&&<BillingBadge onClick={() => go('membership')}/>}<div className="topbar-divider"/><button className="icon-button" aria-label="创作与数据设置" onClick={() => setModal({type:'settings'})}><Settings2 size={19}/></button><button className="icon-button notification" aria-label="通知" onClick={() => setModal({type:'notifications'})}><Bell size={19}/><i/></button>{publicView?<button type="button" className="public-account-action" aria-label={account?.user?'个人中心':'登录或注册'} onClick={()=>setModal({type:'account'})}>{account?.user?'个人中心':'登录 / 注册'}</button>:<button className="avatar small" aria-label="个人空间" onClick={() => setModal({type:'account'})}>墨</button>}</div></header>
      {children}
    </div>
  </div>;
}
