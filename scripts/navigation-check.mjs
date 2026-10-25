import assert from 'node:assert/strict';
import React, {useState} from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import {createServer} from 'vite';

// In-memory component behavior only; no browser or user workspace access.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const listeners = new Map();
let focused = '', preferenceReads = 0;
globalThis.localStorage = {
  getItem() { preferenceReads++; throw Error('Old preferences must not control hover navigation'); },
  setItem() { throw Error('Hover state must not be persisted'); }
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
  const {WorkbenchFrame} = await server.ssrLoadModule('/src/Navigation.jsx');
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
  const zone = () => renderer.root.findByProps({className:'sidebar-hover-zone'});
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
  const enter = async (pointerType = 'mouse') => { await act(async () => zone().props.onPointerEnter({pointerType})); };
  const leave = async () => { await act(async () => zone().props.onPointerLeave({pointerType:'mouse'})); };
  const settle = async () => { await act(async () => delay(190)); };
  const mount = async overrides => {
    document.activeElement = null;
    await act(async () => { renderer = TestRenderer.create(tree(overrides), {createNodeMock:element => {
      if (element.props.id === 'main-sidebar') return {querySelectorAll:() => controls, querySelector:() => controls[0]};
      if (element.props.className === 'sidebar-hover-zone') return zoneNode;
      if (element.props.className === 'sidebar-user-wrap') return accountWrapNode;
      if (element.props.role === 'menu' && element.props['aria-label'] === '账号菜单') return accountMenuNode;
      if (element.props['aria-label'] === '我的创作空间') return controls[2];
      if (element.props['aria-label'] === '显示导航') return desktopToggle;
      if (element.props['aria-label'] === '打开菜单') return mobileToggle;
      return null;
    }}); });
  };
  const unmount = async () => { await act(async () => renderer.unmount()); renderer = undefined; };
  await mount();
  assert.equal(isCollapsed(), true);
  assert.equal(sidebar().props.inert, false);
  assert.equal(sidebar().props['aria-hidden'], false, 'Desktop icon navigation remains accessible');
  for (const item of items) {
    const iconButton = sidebar().findByProps({'aria-label':item.label});
    assert.equal(iconButton.props.title, item.label);
  }
  assert.equal(sidebar().findByProps({'aria-label':'首页'}).props['aria-current'], 'page');
  await click('小说写作'); assert.equal(destination, 'novels'); assert.equal(isCollapsed(), true, 'Collapsed icons can navigate directly');
  assert.equal(button('显示导航').props['aria-expanded'], false);
  await act(async () => button('未提交灵感').props.onChange({target:{value:'尚未保存的故事构思'}}));
  await enter();
  assert.equal(isCollapsed(), false);
  assert.equal(zone().props['data-open'], true);
  await leave();
  assert.equal(isCollapsed(), false, 'A short exit delay prevents flicker');
  await settle();
  assert.equal(isCollapsed(), true);
  assert.equal(button('未提交灵感').props.value, '尚未保存的故事构思');
  await enter(); await leave();
  await act(async () => delay(60));
  await enter(); await settle();
  assert.equal(isCollapsed(), false, 'Re-entering cancels an outstanding hide');
  const novel = renderer.root.findAllByType('button').find(node => node.props.className?.includes('nav-item') && node.findAllByType('span').some(span => span.children.includes('小说写作')));
  await act(async () => novel.props.onClick());
  await act(async () => renderer.update(tree({route:'novels'})));
  assert.equal(destination, 'novels');
  assert.equal(isCollapsed(), false, 'Navigation stays visible while the pointer is inside');
  await leave(); await settle(); assert.equal(isCollapsed(), true);
  await unmount(); await mount();
  assert.equal(isCollapsed(), true, 'New visits start with the compact icon rail');
  assert.equal(preferenceReads, 0, 'Legacy pin/collapse preferences are ignored');
  console.log('PASS persistent accessible icon rail, direct navigation, hover expansion, delayed collapse and preserved draft');

  await enter('touch'); assert.equal(isCollapsed(), true);
  await click('显示导航'); await leave(); await settle();
  assert.equal(isCollapsed(), true, 'Pointer exit hides even a menu opened from the toolbar');
  await click('显示导航');
  assert.equal(isCollapsed(), false); assert.equal(focused, 'brand');
  await act(async () => zone().props.onBlurCapture({currentTarget:zoneNode, relatedTarget:controls[2]}));
  await settle(); assert.equal(isCollapsed(), false, 'Keyboard movement inside navigation stays open');
  await act(async () => emit('keydown', {key:'Escape'}));
  assert.equal(isCollapsed(), true); assert.equal(focused, 'desktop-toggle');
  await act(async () => {controls[0].focus(); zone().props.onKeyDownCapture(); zone().props.onFocusCapture();});
  assert.equal(isCollapsed(), false); assert.equal(focused, 'brand');
  document.activeElement = {};
  await act(async () => zone().props.onBlurCapture({currentTarget:zoneNode, relatedTarget:document.activeElement}));
  await settle(); assert.equal(isCollapsed(), true);
  await click('显示导航'); assert.equal(isCollapsed(), false);
  await act(async () => emit('pointerdown', {target:{}})); assert.equal(isCollapsed(), true);
  await enter(); await act(async () => emit('blur')); assert.equal(isCollapsed(), true);
  await enter();
  await act(async () => renderer.update(tree({dialogOpen:true})));
  assert.equal(isCollapsed(), true);
  await enter(); assert.equal(isCollapsed(), true, 'Open dialogs suppress hover navigation');
  await act(async () => renderer.update(tree()));
  await enter(); assert.equal(isCollapsed(), false);
  await leave(); await unmount();
  await act(async () => delay(190));
  assert.ok([...listeners.values()].every(set => set.size === 0), 'Unmount removes listeners and pending work');
  console.log('PASS keyboard access, focus exit, Escape, touch fallback, outside click, window blur and modal isolation');

  await mount();
  assertAccountClosed();
  assert.equal(button('我的创作空间').props['aria-haspopup'], 'menu');
  await click('会员与墨点');
  assert.equal(destination, 'membership');
  assert.equal(isCollapsed(), true, 'Membership is available directly from the icon rail');
  await click('我的创作空间');
  assert.equal(isCollapsed(), false, 'The account button expands the icon rail before opening its menu');
  assert.equal(button('我的创作空间').props['aria-expanded'], true);
  assert.deepEqual(accountItems().map(item => item.children.filter(child => typeof child === 'string').join('')), ['个人空间', '创作与数据设置', '帮助与反馈']);
  assert.equal(focused, 'personal-space', 'Opening the menu focuses its first action');
  await act(async () => emit('pointerdown', {target:menuControls[1]}));
  assert.equal(accountMenus().length, 1, 'Clicks within the account menu are not outside clicks');
  await act(async () => accountWrap().props.onBlurCapture({currentTarget:accountWrapNode, relatedTarget:menuControls[1]}));
  assert.equal(accountMenus().length, 1, 'Focus can move between account actions without closing the menu');
  await act(async () => emit('pointerdown', {target:controls[0]}));
  assertAccountClosed();
  assert.equal(isCollapsed(), false, 'A click elsewhere inside the sidebar closes only the account menu');
  await click('我的创作空间');
  let escapePrevented = false;
  await act(async () => emit('keydown', {key:'Escape', preventDefault(){escapePrevented = true;}}));
  assert.equal(escapePrevented, true);
  assertAccountClosed();
  assert.equal(isCollapsed(), false, 'The first Escape closes the account menu while leaving navigation available');
  assert.equal(focused, 'account');
  await act(async () => emit('keydown', {key:'Escape'}));
  assert.equal(isCollapsed(), true, 'The second Escape closes navigation');
  assert.equal(focused, 'desktop-toggle');

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
  assertAccountClosed(); assert.equal(isCollapsed(), true);
  await click('我的创作空间');
  await act(async () => emit('blur'));
  assertAccountClosed(); assert.equal(isCollapsed(), true);
  await click('我的创作空间');
  await act(async () => renderer.update(tree({dialogOpen:true})));
  assertAccountClosed();
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
  assert.equal(isCollapsed(), true, 'Desktop resumes its compact icon rail');
  assert.equal(document.body.style.overflow, 'auto');
  await enter(); assert.equal(isCollapsed(), false);
  await leave(); await settle(); assert.equal(isCollapsed(), true);
  console.log('PASS independent mobile drawer, focus containment, close controls and desktop/mobile resize');

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
