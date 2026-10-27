import assert from 'node:assert/strict';
import React, {useState} from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import {createServer} from 'vite';

// In-memory component behavior only; no browser or user workspace access.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const listeners = new Map();
let focused = '', preferenceReads = 0;
globalThis.localStorage = {
  getItem() { preferenceReads++; throw Error('Old preferences must not control manual navigation'); },
  setItem() { throw Error('Navigation state must not be persisted'); }
};
globalThis.window = {
  innerWidth:1440,
  addEventListener(type, listener) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(listener); },
  removeEventListener(type, listener) { listeners.get(type)?.delete(listener); }
};
globalThis.document = {body:{style:{overflow:'auto'}}, activeElement:null};
const emit = (type, event = {}) => { for (const listener of listeners.get(type) || []) listener(event); };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const controls = ['brand', 'close', 'account'].map(name => ({
  classList:{contains:className => name === 'close' && className === 'mobile-nav-close'},
  focus() { focused = name; document.activeElement = this; }
}));
const menuControls = ['personal-space', 'settings', 'help'].map(name => ({
  focus() { focused = name; document.activeElement = this; }
}));
const desktopToggle = {focus(){focused = 'desktop-toggle'; document.activeElement = this;}, contains:target => target === desktopToggle};
const mobileToggle = {focus(){focused = 'mobile-toggle'; document.activeElement = this;}};
const accountMenuNode = {querySelectorAll:() => menuControls, contains:target => menuControls.includes(target)};
const accountWrapNode = {contains:target => target === controls[2] || target === accountMenuNode || menuControls.includes(target)};
const zoneNode = {contains:target => controls.includes(target) || target === accountWrapNode || accountWrapNode.contains(target)};
const server = await createServer({server:{middlewareMode:true, hmr:false}, appType:'custom'});
let renderer;
try {
  const {WorkbenchFrame, SidebarPreferenceProvider} = await server.ssrLoadModule('/src/Navigation.jsx');
  const Icon = props => React.createElement('svg', props);
  const items = [{id:'home', label:'首页', icon:Icon}, {id:'novels', label:'小说写作', icon:Icon}];
  let destination;
  const modalRequests = [];
  const props = {items, route:'home', navigate:value => destination = value, setModal:value => modalRequests.push(value), onSearch(){}};
  function Draft() { const [text, setText] = useState(''); return React.createElement('textarea', {'aria-label':'未提交灵感', value:text, onChange:event => setText(event.target.value)}); }
  const tree = overrides => React.createElement(WorkbenchFrame, {...props, ...overrides}, React.createElement(Draft));
  const button = label => renderer.root.findByProps({'aria-label':label});
  const click = async label => { await act(async () => button(label).props.onClick()); };
  const sidebar = () => renderer.root.findByProps({id:'main-sidebar'});
  const zone = () => sidebar().parent;
  const desktopButton = (scope = renderer.root) => scope.findAllByType('button').find(node => node.props.className?.split(' ').includes('desktop-sidebar-toggle'));
  const toggleDesktop = async () => { await act(async () => desktopButton().props.onClick()); };
  const accountMenus = () => renderer.root.findAllByProps({role:'menu', 'aria-label':'账号菜单'});
  const accountMenu = () => renderer.root.findByProps({role:'menu', 'aria-label':'账号菜单'});
  const accountItems = () => accountMenu().findAllByProps({role:'menuitem'});
  const accountWrap = () => renderer.root.findByProps({className:'sidebar-user-wrap'});
  const assertAccountClosed = () => {
    assert.equal(button('我的创作空间').props['aria-expanded'], false);
    assert.equal(accountMenus().length, 0);
  };
  const menuKey = async (key, shiftKey = false) => {
    let prevented = false;
    const event = {key, shiftKey, preventDefault(){prevented = true;}};
    await act(async () => {
      accountMenu().props.onKeyDown(event);
      emit('keydown', event);
    });
    return prevented;
  };
  const isCollapsed = () => sidebar().props['data-collapsed'] || sidebar().props['aria-hidden'];
  const navigationEvent = async (handler, event = {}) => { await act(async () => zone().props[handler]?.(event)); };
  const enter = async (pointerType = 'mouse') => navigationEvent('onPointerEnter', {pointerType});
  const leave = async () => navigationEvent('onPointerLeave', {pointerType:'mouse'});
  const settle = async () => { await act(async () => delay(190)); };
  const mount = async overrides => {
    document.activeElement = null;
    await act(async () => { renderer = TestRenderer.create(tree(overrides), {createNodeMock:element => {
      if (element.props.id === 'main-sidebar') return {querySelectorAll:() => controls, querySelector:() => controls[0]};
      if (element.props.className === 'sidebar-hover-zone') return zoneNode;
      if (element.props.className === 'sidebar-user-wrap') return accountWrapNode;
      if (element.props.role === 'menu' && element.props['aria-label'] === '账号菜单') return accountMenuNode;
      if (element.props['aria-label'] === '我的创作空间') return controls[2];
      if (element.props.className?.split(' ').includes('desktop-sidebar-toggle')) return desktopToggle;
      if (element.props['aria-label'] === '打开菜单') return mobileToggle;
      return null;
    }}); });
  };
  const unmount = async () => { await act(async () => renderer.unmount()); renderer = undefined; };
  await mount();
  assert.equal(isCollapsed(), false, 'Desktop navigation is expanded on the first visit');
  assert.equal(desktopButton().props['aria-expanded'], true);
  assert.equal(desktopButton().props['aria-label'], '收起导航');
  assert.equal(sidebar().props.inert, false);
  assert.equal(sidebar().props['aria-hidden'], false, 'Desktop navigation remains accessible');
  for (const item of items) {
    const iconButton = sidebar().findByProps({'aria-label':item.label});
    assert.equal(iconButton.props.title, item.label);
  }
  assert.equal(sidebar().findByProps({'aria-label':'首页'}).props['aria-current'], 'page');
  await act(async () => button('未提交灵感').props.onChange({target:{value:'尚未保存的故事构思'}}));
  await toggleDesktop();
  assert.equal(isCollapsed(), true, 'The topbar button collapses desktop navigation');
  assert.equal(desktopButton().props['aria-expanded'], false);
  assert.equal(desktopButton().props['aria-label'], '展开导航');
  assert.equal(sidebar().props.inert, false, 'Collapsed navigation keeps its icon controls available');
  assert.equal(sidebar().props['aria-hidden'], false);
  await click('小说写作');
  assert.equal(destination, 'novels');
  assert.equal(isCollapsed(), true, 'Collapsed icons navigate without expanding the sidebar');
  assert.equal(button('未提交灵感').props.value, '尚未保存的故事构思');
  await enter();
  assert.equal(isCollapsed(), true, 'Hover does not expand a manually collapsed sidebar');
  await leave(); await enter('touch');
  assert.equal(isCollapsed(), true, 'Touch pointer movement does not expand desktop navigation');
  await act(async () => {controls[0].focus(); zone().props.onKeyDownCapture?.(); zone().props.onFocusCapture?.();});
  assert.equal(isCollapsed(), true, 'Focusing an icon does not expand the sidebar');
  await navigationEvent('onBlurCapture', {currentTarget:zoneNode, relatedTarget:{}});
  await act(async () => {emit('pointerdown', {target:{}}); emit('blur'); emit('keydown', {key:'Escape'});});
  await settle();
  assert.equal(isCollapsed(), true, 'Pointer and focus movement do not expand a manually collapsed sidebar');
  await act(async () => renderer.update(tree({route:'novels'})));
  assert.equal(isCollapsed(), true, 'Route changes preserve the manual collapsed state');
  await act(async () => renderer.update(tree({route:'novels', dialogOpen:true})));
  assert.equal(isCollapsed(), true, 'Opening a dialog preserves the manual collapsed state');
  await act(async () => renderer.update(tree({route:'novels'})));
  await toggleDesktop();
  assert.equal(isCollapsed(), false, 'The same topbar button reopens desktop navigation');
  assert.equal(desktopButton().props['aria-expanded'], true);
  assert.equal(desktopButton().props['aria-label'], '收起导航');
  assert.equal(button('未提交灵感').props.value, '尚未保存的故事构思', 'Toggling navigation preserves the active draft');
  await enter(); await leave();
  await settle();
  assert.equal(isCollapsed(), false, 'Leaving the sidebar does not schedule an automatic collapse');
  await navigationEvent('onBlurCapture', {currentTarget:zoneNode, relatedTarget:controls[2]});
  await navigationEvent('onBlurCapture', {currentTarget:zoneNode, relatedTarget:{}});
  await settle();
  assert.equal(isCollapsed(), false, 'Moving focus outside navigation does not collapse it');
  await act(async () => {document.activeElement = {}; emit('pointerdown', {target:{}});});
  assert.equal(isCollapsed(), false, 'Clicking outside navigation does not collapse it');
  await act(async () => emit('blur'));
  assert.equal(isCollapsed(), false, 'Window blur does not collapse navigation');
  await act(async () => emit('keydown', {key:'Escape'}));
  assert.equal(isCollapsed(), false, 'Escape does not change the manual desktop navigation state');
  await act(async () => renderer.update(tree({dialogOpen:true})));
  assert.equal(isCollapsed(), false, 'Opening a dialog preserves the manual sidebar state');
  await act(async () => renderer.update(tree()));
  assert.equal(isCollapsed(), false);
  await unmount(); await mount();
  assert.equal(isCollapsed(), false, 'New visits start with expanded navigation');
  assert.equal(preferenceReads, 0, 'Legacy pin/collapse preferences are ignored');
  await unmount();
  assert.ok([...listeners.values()].every(set => set.size === 0), 'Unmount removes navigation listeners');
  console.log('PASS expanded desktop default, manual toggle, accessible icon rail, preserved draft and no automatic navigation changes');

  const sharedTree = visible => React.createElement(SidebarPreferenceProvider, null,
    visible !== 'private' && React.createElement(WorkbenchFrame, {...props, key:'public', publicView:true, navigationId:'public-sidebar'}),
    visible !== 'public' && React.createElement(WorkbenchFrame, {...props, key:'private', navigationId:'main-sidebar'})
  );
  const sharedFrame = navigationId => renderer.root.findAllByType(WorkbenchFrame).find(node => node.props.navigationId === navigationId);
  const assertSharedState = expanded => {
    for (const frame of renderer.root.findAllByType(WorkbenchFrame)) {
      assert.equal(frame.findByProps({id:frame.props.navigationId}).props['data-collapsed'], !expanded);
      assert.equal(desktopButton(frame).props['aria-expanded'], expanded);
      assert.equal(desktopButton(frame).props['aria-label'], expanded ? '收起导航' : '展开导航');
    }
  };
  await act(async () => {renderer = TestRenderer.create(sharedTree('both'));});
  assert.equal(renderer.root.findAllByType(WorkbenchFrame).length, 2);
  assertSharedState(true);
  await act(async () => desktopButton(sharedFrame('public-sidebar')).props.onClick());
  assertSharedState(false);
  await act(async () => renderer.update(sharedTree('private')));
  assertSharedState(false);
  await act(async () => renderer.update(sharedTree('public')));
  assertSharedState(false);
  await act(async () => desktopButton(sharedFrame('public-sidebar')).props.onClick());
  assertSharedState(true);
  await act(async () => renderer.update(sharedTree('both')));
  assertSharedState(true);
  await act(async () => desktopButton(sharedFrame('main-sidebar')).props.onClick());
  assertSharedState(false);
  await unmount();
  assert.ok([...listeners.values()].every(set => set.size === 0), 'Shared frame navigation listeners are removed on unmount');
  console.log('PASS public and private frames share manual sidebar state across simultaneous rendering and page replacement');

  await mount();
  assertAccountClosed();
  assert.equal(button('我的创作空间').props['aria-haspopup'], 'menu');
  await toggleDesktop();
  await click('会员与墨点');
  assert.equal(destination, 'membership');
  assert.equal(isCollapsed(), true, 'Membership is available directly from the icon rail');
  await click('我的创作空间');
  assert.equal(isCollapsed(), true, 'Opening the account menu preserves the manually collapsed icon rail');
  assert.equal(button('我的创作空间').props['aria-expanded'], true);
  assert.deepEqual(accountItems().map(item => item.children.filter(child => typeof child === 'string').join('')), ['个人空间', '创作与数据设置', '帮助与反馈']);
  assert.equal(focused, 'personal-space', 'Opening the menu focuses its first action');
  await act(async () => emit('pointerdown', {target:menuControls[1]}));
  assert.equal(accountMenus().length, 1, 'Clicks within the account menu are not outside clicks');
  await act(async () => accountWrap().props.onBlurCapture({currentTarget:accountWrapNode, relatedTarget:menuControls[1]}));
  assert.equal(accountMenus().length, 1, 'Focus can move between account actions without closing the menu');
  await act(async () => emit('pointerdown', {target:controls[0]}));
  assertAccountClosed();
  assert.equal(isCollapsed(), true, 'A click elsewhere inside the sidebar closes only the account menu');
  await click('我的创作空间');
  let escapePrevented = false;
  await act(async () => emit('keydown', {key:'Escape', preventDefault(){escapePrevented = true;}}));
  assert.equal(escapePrevented, true);
  assertAccountClosed();
  assert.equal(isCollapsed(), true, 'Escape closes the account menu without changing the collapsed sidebar');
  assert.equal(focused, 'account');
  await act(async () => emit('keydown', {key:'Escape'}));
  assert.equal(isCollapsed(), true, 'Further Escape presses do not change the manual navigation state');
  await toggleDesktop();
  assert.equal(isCollapsed(), false);

  let arrowPrevented = false;
  await act(async () => button('我的创作空间').props.onKeyDown({key:'ArrowUp', preventDefault(){arrowPrevented = true;}}));
  assert.equal(arrowPrevented, true);
  assert.equal(isCollapsed(), false);
  assert.equal(focused, 'help', 'ArrowUp on the account button opens at the last action');
  assert.equal(await menuKey('ArrowDown'), true); assert.equal(focused, 'personal-space', 'ArrowDown wraps from the last action to the first');
  assert.equal(await menuKey('ArrowUp'), true); assert.equal(focused, 'help', 'ArrowUp wraps from the first action to the last');
  assert.equal(await menuKey('Home'), true); assert.equal(focused, 'personal-space');
  assert.equal(await menuKey('ArrowDown'), true); assert.equal(focused, 'settings');
  assert.equal(await menuKey('End'), true); assert.equal(focused, 'help');
  await act(async () => emit('keydown', {key:'Escape', preventDefault(){}}));
  await act(async () => button('我的创作空间').props.onKeyDown({key:'ArrowDown', preventDefault(){}}));
  assert.equal(focused, 'personal-space', 'ArrowDown on the account button opens at the first action');
  // The renderer can verify default Tab is allowed; the browser determines its final focus target.
  assert.equal(await menuKey('Tab'), false, 'Tab keeps the browser default focus movement');
  assertAccountClosed();
  await click('我的创作空间');
  assert.equal(await menuKey('Tab', true), false, 'Shift+Tab also keeps the browser default focus movement');
  assertAccountClosed();

  for (const [index, type] of ['account', 'settings', 'help'].entries()) {
    await click('我的创作空间');
    const previousRequests = modalRequests.length;
    await act(async () => accountItems()[index].props.onClick());
    assert.deepEqual(modalRequests.at(-1), {type});
    assert.equal(modalRequests.length, previousRequests + 1, 'Each menu action opens its own panel once');
    assertAccountClosed();
  }
  await click('我的创作空间');
  await act(async () => accountWrap().props.onBlurCapture({currentTarget:accountWrapNode, relatedTarget:{}}));
  assertAccountClosed();
  await click('我的创作空间'); await click('小说写作');
  assert.equal(destination, 'novels'); assertAccountClosed();
  await click('我的创作空间');
  await act(async () => renderer.update(tree({route:'novels'})));
  assertAccountClosed();
  await click('我的创作空间');
  await act(async () => emit('pointerdown', {target:{}}));
  assertAccountClosed(); assert.equal(isCollapsed(), false, 'Outside clicks dismiss the account menu while keeping navigation expanded');
  await click('我的创作空间');
  await act(async () => emit('blur'));
  assertAccountClosed(); assert.equal(isCollapsed(), false, 'Window blur dismisses the account menu without collapsing navigation');
  await click('我的创作空间');
  await toggleDesktop();
  assertAccountClosed(); assert.equal(isCollapsed(), true, 'Manual collapse also dismisses the account menu');
  await toggleDesktop();
  await click('我的创作空间');
  await act(async () => renderer.update(tree({dialogOpen:true})));
  assertAccountClosed();
  assert.equal(isCollapsed(), false, 'Account dialogs preserve the manual navigation state');
  await unmount();
  console.log('PASS membership entry, account menu actions, inside/outside clicks, focus exit, navigation dismissal and menu keyboard controls');

  window.innerWidth = 375;
  await mount();
  await enter(); assert.equal(isCollapsed(), true, 'Mobile hover does not open its drawer');
  await click('打开菜单');
  assert.equal(isCollapsed(), false);
  assert.equal(button('打开菜单').props['aria-expanded'], true);
  assert.equal(document.body.style.overflow, 'hidden'); assert.equal(focused, 'close');
  document.activeElement = controls[0];
  let prevented = false;
  await act(async () => emit('keydown', {key:'Tab', shiftKey:true, preventDefault(){prevented = true;}}));
  assert.equal(prevented, true); assert.equal(focused, 'account');
  await click('关闭菜单');
  assert.equal(sidebar().props.inert, true); assert.equal(focused, 'mobile-toggle');
  assert.equal(document.body.style.overflow, 'auto');
  await click('打开菜单'); await click('关闭导航'); assert.equal(isCollapsed(), true);
  await click('打开菜单');
  await act(async () => emit('keydown', {key:'Escape', preventDefault(){}}));
  assert.equal(isCollapsed(), true);
  await click('打开菜单');
  await act(async () => renderer.update(tree({route:'novels'})));
  assert.equal(isCollapsed(), true);
  await click('打开菜单');
  await act(async () => {window.innerWidth = 1440; emit('resize');});
  assert.equal(isCollapsed(), false, 'Desktop resumes its expanded default after a mobile visit');
  assert.equal(document.body.style.overflow, 'auto');
  await leave(); await settle(); assert.equal(isCollapsed(), false);
  await toggleDesktop(); assert.equal(isCollapsed(), true);
  await act(async () => {window.innerWidth = 375; emit('resize');});
  await click('打开菜单');
  await act(async () => {window.innerWidth = 1440; emit('resize');});
  assert.equal(isCollapsed(), true, 'Desktop restores the manual collapsed choice after a mobile visit');
  assert.equal(document.body.style.overflow, 'auto');
  await enter(); await leave(); await settle();
  assert.equal(isCollapsed(), true, 'Pointer movement after resize does not change the restored manual choice');
  await toggleDesktop(); assert.equal(isCollapsed(), false);
  console.log('PASS independent mobile drawer, focus containment, close controls and manual desktop state across resize');

  await unmount();
  window.innerWidth = 375;
  await mount();
  await click('打开菜单'); await click('我的创作空间');
  await act(async () => emit('keydown', {key:'Escape', preventDefault(){}}));
  assertAccountClosed();
  assert.equal(isCollapsed(), false, 'Escape closes the account menu before the mobile drawer');
  assert.equal(focused, 'account');
  assert.equal(document.body.style.overflow, 'hidden');
  await act(async () => emit('keydown', {key:'Escape', preventDefault(){}}));
  assert.equal(isCollapsed(), true);
  assert.equal(document.body.style.overflow, 'auto');
  await click('打开菜单'); await click('我的创作空间');
  await act(async () => emit('pointerdown', {target:menuControls[0]}));
  assert.equal(accountMenus().length, 1);
  await act(async () => emit('pointerdown', {target:{}}));
  assertAccountClosed();
  assert.equal(isCollapsed(), false, 'An outside account-menu click leaves the mobile drawer open');
  await click('我的创作空间');
  assert.equal(await menuKey('Tab'), true, 'Tab from the closing account menu stays within the mobile drawer');
  assertAccountClosed();
  assert.equal(focused, 'brand', 'The drawer wraps forward Tab from its final account button to its first control');
  await click('我的创作空间');
  assert.equal(await menuKey('Tab', true), false, 'The mobile drawer allows Shift+Tab from the closing account menu');
  assertAccountClosed();
  for (const [index, type] of ['account', 'settings', 'help'].entries()) {
    if (isCollapsed()) await click('打开菜单');
    await click('我的创作空间');
    await act(async () => accountItems()[index].props.onClick());
    assert.deepEqual(modalRequests.at(-1), {type});
    assertAccountClosed();
    assert.equal(isCollapsed(), true, 'Account actions close the mobile drawer');
    assert.equal(document.body.style.overflow, 'auto');
  }
  await click('打开菜单'); await click('会员与墨点');
  assert.equal(destination, 'membership');
  assert.equal(isCollapsed(), true, 'Membership navigation closes the mobile drawer');
  assert.equal(document.body.style.overflow, 'auto');
  await unmount();
  assert.ok([...listeners.values()].every(set => set.size === 0), 'Account-menu listeners are removed on unmount');
  console.log('PASS mobile account menu dismissal, Escape priority, drawer focus containment and drawer-closing actions');
} finally {
  if (renderer) await act(async () => renderer.unmount());
  await server.close();
}
