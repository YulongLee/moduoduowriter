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
const desktopToggle = {focus(){focused = 'desktop-toggle'; document.activeElement = this;}, contains:target => target === desktopToggle};
const mobileToggle = {focus(){focused = 'mobile-toggle'; document.activeElement = this;}};
const zoneNode = {contains:target => controls.includes(target)};
const server = await createServer({server:{middlewareMode:true, hmr:false}, appType:'custom'});
let renderer;
try {
  const {WorkbenchFrame} = await server.ssrLoadModule('/src/Navigation.jsx');
  const Icon = props => React.createElement('svg', props);
  const items = [{id:'home', label:'首页', icon:Icon}, {id:'novels', label:'小说写作', icon:Icon}];
  let destination;
  const props = {items, route:'home', navigate:value => destination = value, setModal(){}, onSearch(){}};
  function Draft() { const [text, setText] = useState(''); return React.createElement('textarea', {'aria-label':'未提交灵感', value:text, onChange:event => setText(event.target.value)}); }
  const tree = overrides => React.createElement(WorkbenchFrame, {...props, ...overrides}, React.createElement(Draft));
  const button = label => renderer.root.findByProps({'aria-label':label});
  const click = async label => { await act(async () => button(label).props.onClick()); };
  const sidebar = () => renderer.root.findByProps({id:'main-sidebar'});
  const zone = () => renderer.root.findByProps({className:'sidebar-hover-zone'});
  const isCollapsed = () => sidebar().props['data-collapsed'] || sidebar().props['aria-hidden'];
  const enter = async (pointerType = 'mouse') => { await act(async () => zone().props.onPointerEnter({pointerType})); };
  const leave = async () => { await act(async () => zone().props.onPointerLeave({pointerType:'mouse'})); };
  const settle = async () => { await act(async () => delay(190)); };
  const mount = async overrides => {
    document.activeElement = null;
    await act(async () => { renderer = TestRenderer.create(tree(overrides), {createNodeMock:element => {
      if (element.props.id === 'main-sidebar') return {querySelectorAll:() => controls, querySelector:() => controls[0]};
      if (element.props.className === 'sidebar-hover-zone') return zoneNode;
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
} finally {
  if (renderer) await act(async () => renderer.unmount());
  await server.close();
}
