import React, {useEffect, useRef, useState} from 'react';
import {ArrowUpRight, Bell, ChevronRight, CircleHelp, Crown, Menu, PanelLeftOpen, Search, Settings2, X} from 'lucide-react';
import {Brand} from './Art';
import {BillingBadge} from './Billing.jsx';

export function WorkbenchFrame({items, route, navigate, setModal, onSearch, dialogOpen = false, children}) {
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
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
  const hidden = !desktop && !mobileOpen;
  const current = route === 'service-admin' ? {label:'本机服务管理'} : items.find(item => item.id === route) || items[0];

  useEffect(() => {
    const resize = () => setDesktop(window.innerWidth > 1024);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  useEffect(() => { setMobileOpen(false); }, [route, desktop, dialogOpen]);
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
    const onBlur = () => { cancelHide(); pointerInside.current = false; setDesktopOpen(false); };
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
      if (event.key === 'Escape') { event.preventDefault(); setMobileOpen(false); }
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

  const go = destination => { setMobileOpen(false); navigate(destination); };


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
      <div className="sidebar-bottom"><div className="membership"><div><Crown size={18}/><strong>创作，不止于此</strong></div><p>会员与墨点 · 方案预览</p><button onClick={() => go('membership')}>会员与墨点 <ArrowUpRight size={14}/></button></div><button className="help-link" aria-label="帮助与反馈" title="帮助与反馈" onClick={() => {setMobileOpen(false); setModal({type:'help'});}}><CircleHelp size={17}/><span>帮助与反馈</span><ArrowUpRight size={14}/></button><button className="sidebar-user" aria-label="我的创作空间" title="我的创作空间" onClick={() => {setMobileOpen(false); setModal({type:'account'});}}><div className="avatar">墨</div><span><strong>我的创作空间</strong><small><i/>本机创作空间</small></span><Settings2 size={16}/></button></div>
    </aside>
    </div>
    <div className="workspace">
      <header className="topbar"><div className="breadcrumb"><button ref={desktopToggleRef} className="icon-button desktop-sidebar-toggle" aria-label="显示导航" title="显示完整导航，也可将鼠标移到左侧图标栏" aria-controls="main-sidebar" aria-expanded={desktopOpen} onClick={focusSidebar}><PanelLeftOpen size={20}/></button><button ref={mobileToggleRef} className="icon-button mobile-menu" aria-label="打开菜单" aria-controls="main-sidebar" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}><Menu size={21}/></button><span>我的工作台</span><ChevronRight size={13}/><strong>{current.label}</strong></div><div className="topbar-right"><button className="global-search" onClick={onSearch}><Search size={16}/><span>搜索作品、工具或灵感</span><kbd>⌘ K</kbd></button><BillingBadge onClick={() => go('membership')}/><div className="topbar-divider"/><button className="icon-button" aria-label="创作与数据设置" onClick={() => setModal({type:'settings'})}><Settings2 size={19}/></button><button className="icon-button notification" aria-label="通知" onClick={() => setModal({type:'notifications'})}><Bell size={19}/><i/></button><button className="avatar small" aria-label="个人空间" onClick={() => setModal({type:'account'})}>墨</button></div></header>
      {children}
    </div>
  </div>;
}
