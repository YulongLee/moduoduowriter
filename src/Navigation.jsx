import React, {useEffect, useRef, useState} from 'react';
import {ArrowUpRight, Bell, ChevronRight, CircleHelp, Crown, Menu, PanelLeftClose, PanelLeftOpen, Plus, Search, Settings2, X} from 'lucide-react';
import {Brand} from './Art';
import {BillingBadge} from './Billing.jsx';

export const SIDEBAR_PREFERENCE_KEY = 'mdd-sidebar-collapsed-v1';

function savedCollapsePreference() {
  try { return JSON.parse(globalThis.localStorage?.getItem(SIDEBAR_PREFERENCE_KEY)) === true; }
  catch { return false; }
}

export function WorkbenchFrame({items, route, navigate, setModal, onSearch, dialogOpen = false, children}) {
  const [collapsed, setCollapsed] = useState(savedCollapsePreference);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktop, setDesktop] = useState(() => typeof window === 'undefined' || window.innerWidth > 1024);
  const sidebarRef = useRef(null);
  const mobileToggleRef = useRef(null);
  const hidden = desktop ? collapsed : !mobileOpen;
  const current = items.find(item => item.id === route) || items[0];

  useEffect(() => {
    const resize = () => setDesktop(window.innerWidth > 1024);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  useEffect(() => { setMobileOpen(false); }, [route, desktop, dialogOpen]);
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
  const toggleSidebar = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { globalThis.localStorage?.setItem(SIDEBAR_PREFERENCE_KEY, JSON.stringify(next)); }
    catch { /* Navigation remains usable when local preferences cannot be saved. */ }
  };

  return <div className={`app-shell commercial${desktop && collapsed ? ' sidebar-collapsed' : ''}`}>
    {mobileOpen && !desktop && <button className="mobile-scrim" aria-label="关闭菜单" onClick={() => setMobileOpen(false)}/>}
    <aside id="main-sidebar" ref={sidebarRef} className={`sidebar${mobileOpen ? ' mobile-open' : ''}`} aria-label="工作台导航" aria-hidden={hidden} inert={hidden}>
      <div className="sidebar-header"><button className="brand" aria-label="墨多多写作首页" onClick={() => go('home')}><Brand/><span>墨多多<span className="brand-writing">写作</span><small>让好故事发生</small></span></button><button className="icon-button mobile-nav-close" aria-label="关闭导航" onClick={() => setMobileOpen(false)}><X size={19}/></button></div>
      <button className="sidebar-create" onClick={() => {setMobileOpen(false); setModal({type:'create'});}}><Plus size={17}/>新建作品<span>＋</span></button>
      <nav aria-label="主导航">{items.map(item => <React.Fragment key={item.id}>{item.section && <div className="nav-section">{item.section}</div>}<button className={`nav-item${item.nested ? ' nested' : ''}${route === item.id ? ' active' : ''}`} aria-current={route === item.id ? 'page' : undefined} onClick={() => go(item.id)}><item.icon size={19} strokeWidth={1.75}/><span>{item.label}</span>{item.badge && <small>{item.badge}</small>}{route === item.id && <i/>}</button></React.Fragment>)}</nav>
      <div className="sidebar-bottom"><div className="membership"><div><Crown size={18}/><strong>创作，不止于此</strong></div><p>会员与墨点 · 方案预览</p><button onClick={() => go('membership')}>会员与墨点 <ArrowUpRight size={14}/></button></div><button className="help-link" onClick={() => {setMobileOpen(false); setModal({type:'help'});}}><CircleHelp size={17}/>帮助与反馈<ArrowUpRight size={14}/></button><button className="sidebar-user" onClick={() => {setMobileOpen(false); setModal({type:'account'});}}><div className="avatar">墨</div><span><strong>我的创作空间</strong><small><i/>本机创作空间</small></span><Settings2 size={16}/></button></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div className="breadcrumb"><button className="icon-button desktop-sidebar-toggle" aria-label={collapsed ? '展开侧栏' : '收起侧栏'} title={collapsed ? '展开侧栏' : '收起侧栏'} aria-controls="main-sidebar" aria-expanded={!collapsed} onClick={toggleSidebar}>{collapsed ? <PanelLeftOpen size={20}/> : <PanelLeftClose size={20}/>}</button><button ref={mobileToggleRef} className="icon-button mobile-menu" aria-label="打开菜单" aria-controls="main-sidebar" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}><Menu size={21}/></button><span>我的工作台</span><ChevronRight size={13}/><strong>{current.label}</strong></div><div className="topbar-right"><button className="global-search" onClick={onSearch}><Search size={16}/><span>搜索作品、工具或灵感</span><kbd>⌘ K</kbd></button><BillingBadge onClick={() => go('membership')}/><div className="topbar-divider"/><button className="icon-button" aria-label="AI 与数据设置" onClick={() => setModal({type:'settings'})}><Settings2 size={19}/></button><button className="icon-button notification" aria-label="通知" onClick={() => setModal({type:'notifications'})}><Bell size={19}/><i/></button><button className="avatar small" aria-label="个人空间" onClick={() => setModal({type:'account'})}>墨</button></div></header>
      {children}
    </div>
  </div>;
}
