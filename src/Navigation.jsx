import React, {useEffect, useRef, useState} from 'react';
import {Bell, ChevronRight, ChevronsUpDown, CircleHelp, Crown, Menu, PanelLeftOpen, Search, Settings2, UserRound, X} from 'lucide-react';
import {Brand} from './Art';
import {BillingBadge} from './Billing.jsx';
import {useAccount} from './Account.jsx';
import {WorkspaceStatus} from './Workspace.jsx';

export function WorkbenchFrame({items, route, navigate, setModal, onSearch, dialogOpen = false, children}) {
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const account = useAccount();
  const [desktop, setDesktop] = useState(() => typeof window === 'undefined' || window.innerWidth > 1024);
  const sidebarRef = useRef(null);
  const mobileToggleRef = useRef(null);
  const desktopToggleRef = useRef(null);
  const hoverZoneRef = useRef(null);
  const hideTimer = useRef(null);
  const pointerInside = useRef(false);
  const keyboardMode = useRef(false);
  const ignoreFocus = useRef(false);
  const focusAfterOpen = useRef(false);
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
  const cancelHide = () => clearTimeout(hideTimer.current);
  const reveal = () => {
    if (!desktop || dialogOpen || ignoreFocus.current) return;
    cancelHide();
    setDesktopOpen(true);
  };
  const scheduleHide = () => {
    cancelHide();
    hideTimer.current = setTimeout(() => {
      const keyboardInside = keyboardMode.current && hoverZoneRef.current?.contains(document.activeElement);
      if (!pointerInside.current && !keyboardInside) setDesktopOpen(false);
    }, 150);
  };
  const focusSidebar = () => {
    if (!desktop || dialogOpen) return;
    keyboardMode.current = true;
    if (desktopOpen) sidebarRef.current?.querySelector('button')?.focus();
    else { focusAfterOpen.current = true; reveal(); }
  };
  useEffect(() => {
    if (desktopOpen && focusAfterOpen.current) {
      focusAfterOpen.current = false;
      sidebarRef.current?.querySelector('button')?.focus();
    }
  }, [desktopOpen]);
  useEffect(() => {
    cancelHide();
    pointerInside.current = false;
    focusAfterOpen.current = false;
    setDesktopOpen(false);
  }, [desktop, dialogOpen]);
  useEffect(() => {
    if (!desktop) return;
    const onKey = event => {
      if (event.key !== 'Escape') return;
      if (accountOpenRef.current) {
        event.preventDefault?.();
        setAccountOpen(false);
        accountButtonRef.current?.focus();
        return;
      }
      cancelHide();
      pointerInside.current = false;
      focusAfterOpen.current = false;
      setDesktopOpen(false);
      if (hoverZoneRef.current?.contains(document.activeElement)) {
        ignoreFocus.current = true;
        desktopToggleRef.current?.focus();
        ignoreFocus.current = false;
      }
    };
    const onBlur = () => { cancelHide(); pointerInside.current = false; setDesktopOpen(false); setAccountOpen(false); };
    const onOutside = event => {
      if (!hoverZoneRef.current?.contains(event.target) && !desktopToggleRef.current?.contains(event.target)) onBlur();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', onBlur);
    window.addEventListener('pointerdown', onOutside);
    return () => {
      cancelHide();
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('pointerdown', onOutside);
    };
  }, [desktop]);
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
    cancelHide();
    accountInitialFocus.current = position;
    if (desktop) setDesktopOpen(true);
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


  return <div className="app-shell commercial sidebar-auto">
    {mobileOpen && !desktop && <button className="mobile-scrim" aria-label="关闭菜单" onClick={() => setMobileOpen(false)}/>}
    <div className="sidebar-hover-zone" ref={hoverZoneRef} data-open={desktop && desktopOpen} onPointerEnter={event => {
      if (!desktop || event.pointerType === 'touch') return;
      pointerInside.current = true; keyboardMode.current = false; reveal();
    }} onPointerLeave={event => {
      if (!desktop || event.pointerType === 'touch') return;
      pointerInside.current = false; keyboardMode.current = false; scheduleHide();
    }} onPointerDownCapture={() => {keyboardMode.current = false;}} onKeyDownCapture={() => {keyboardMode.current = true;}} onFocusCapture={reveal} onBlurCapture={event => {
      if (desktop && !event.currentTarget.contains(event.relatedTarget)) scheduleHide();
    }}>

    <aside id="main-sidebar" ref={sidebarRef} className={`sidebar${mobileOpen ? ' mobile-open' : ''}`} aria-label="工作台导航" data-collapsed={desktop && !desktopOpen} aria-hidden={hidden} inert={hidden}>
      <div className="sidebar-header"><button className="brand" aria-label="墨多多写作首页" onClick={() => go('home')}><Brand/><span className="brand-lockup"><span className="brand-wordmark"><strong>墨多多</strong><span className="brand-writing">写作</span></span><small>让好故事发生</small></span></button><button className="icon-button mobile-nav-close" aria-label="关闭导航" onClick={() => setMobileOpen(false)}><X size={19}/></button></div>
      <nav aria-label="主导航">{items.map(item => <React.Fragment key={item.id}>{item.section && <div className="nav-section">{item.section}</div>}<button className={`nav-item${item.nested ? ' nested' : ''}${route === item.id ? ' active' : ''}`} data-nav={item.id} aria-label={item.label} title={item.label} aria-current={route === item.id ? 'page' : undefined} onClick={() => go(item.id)}><item.icon size={19} strokeWidth={1.75}/><span>{item.label}</span>{item.badge && <small>{item.badge}</small>}{route === item.id && <i/>}</button></React.Fragment>)}</nav>
      <div className="sidebar-bottom">
        <button className="sidebar-plan" aria-label="会员与墨点" title="会员与墨点" onClick={() => go('membership')}><Crown size={19}/><span><strong>会员与墨点</strong><small>查看创作方案</small></span><ChevronRight size={15}/></button>
        <div className="sidebar-user-wrap" ref={accountWrapRef} onBlurCapture={event => {if (!event.currentTarget.contains(event.relatedTarget)) setAccountOpen(false);}}>
          {accountOpen && <div id="sidebar-account-menu" className="sidebar-account-menu" role="menu" aria-label="账号菜单" ref={accountMenuRef} onKeyDown={accountMenuKeyDown}>
            <p>创作空间</p>
            <button type="button" role="menuitem" tabIndex={-1} onClick={() => openAccountPanel('account')}><UserRound size={17}/>个人空间<ChevronRight size={14}/></button>
            <button type="button" role="menuitem" tabIndex={-1} onClick={() => openAccountPanel('settings')}><Settings2 size={17}/>创作与数据设置</button>
            <button type="button" role="menuitem" tabIndex={-1} onClick={() => openAccountPanel('help')}><CircleHelp size={17}/>帮助与反馈</button>
          </div>}
          <button className="sidebar-user" ref={accountButtonRef} aria-label="我的创作空间" title="账号与设置" aria-haspopup="menu" aria-expanded={accountOpen} aria-controls="sidebar-account-menu" onClick={() => accountOpen ? setAccountOpen(false) : openAccountMenu()} onKeyDown={event => {if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {event.preventDefault();openAccountMenu(event.key === 'ArrowUp' ? 'last' : 'first');}}}><div className="avatar">{account?.user?.username?.slice(0,1).toUpperCase() || '墨'}</div><span><strong>{accountName}</strong><small>账号与设置</small></span><ChevronsUpDown size={16}/></button>
        </div>
      </div>
    </aside>
    </div>
    <div className="workspace">
      <header className="topbar"><div className="breadcrumb"><button ref={desktopToggleRef} className="icon-button desktop-sidebar-toggle" aria-label="显示导航" title="显示完整导航，也可将鼠标移到左侧图标栏" aria-controls="main-sidebar" aria-expanded={desktopOpen} onClick={focusSidebar}><PanelLeftOpen size={20}/></button><button ref={mobileToggleRef} className="icon-button mobile-menu" aria-label="打开菜单" aria-controls="main-sidebar" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}><Menu size={21}/></button><button className="topbar-brand" aria-label="墨多多写作首页" onClick={()=>go('home')}><Brand small/><span>墨多多写作</span></button><span className="topbar-location-separator" aria-hidden="true"/><strong className="topbar-location">{route==='home'?'创作工作台':current.label}</strong><WorkspaceStatus compact/></div><div className="topbar-right"><button className="global-search" onClick={onSearch}><Search size={16}/><span>搜索作品、工具或灵感</span><kbd>⌘ K</kbd></button><BillingBadge onClick={() => go('membership')}/><div className="topbar-divider"/><button className="icon-button" aria-label="创作与数据设置" onClick={() => setModal({type:'settings'})}><Settings2 size={19}/></button><button className="icon-button notification" aria-label="通知" onClick={() => setModal({type:'notifications'})}><Bell size={19}/><i/></button><button className="avatar small" aria-label="个人空间" onClick={() => setModal({type:'account'})}>墨</button></div></header>
      {children}
    </div>
  </div>;
}
