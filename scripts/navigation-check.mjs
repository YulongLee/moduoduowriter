import assert from 'node:assert/strict';
import React, {useState} from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import {createServer} from 'vite';

// In-memory component behavior only; no browser or user workspace access.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const stored = new Map(), listeners = new Map();
let failRead = false, failWrite = false, focused = '';
globalThis.localStorage = {
  getItem(key) { if (failRead) throw Error('unavailable'); return stored.get(key) ?? null; },
  setItem(key, value) { if (failWrite) throw Error('full'); stored.set(key, value); }
};
globalThis.window = {
  innerWidth:1440,
  addEventListener(type, listener) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(listener); },
  removeEventListener(type, listener) { listeners.get(type)?.delete(listener); }
};
globalThis.document = {body:{style:{overflow:'auto'}}, activeElement:null};
const emit = (type, event = {}) => { for (const listener of listeners.get(type) || []) listener(event); };
const controls = ['brand', 'close', 'account'].map(name => ({
  classList:{contains:className => name === 'close' && className === 'mobile-nav-close'},
  focus() { focused = name; document.activeElement = this; }
}));
const server = await createServer({server:{middlewareMode:true, hmr:false}, appType:'custom'});
let renderer;
try {
  const {WorkbenchFrame, SIDEBAR_PREFERENCE_KEY} = await server.ssrLoadModule('/src/Navigation.jsx');
  const Icon = props => React.createElement('svg', props);
  const items = [{id:'home', label:'首页', icon:Icon}, {id:'novels', label:'小说写作', icon:Icon}];
  let destination;
  const props = {items, route:'home', navigate:value => destination = value, setModal(){}, onSearch(){}};
  function Draft() { const [text, setText] = useState(''); return React.createElement('textarea', {'aria-label':'未提交灵感', value:text, onChange:event => setText(event.target.value)}); }
  const tree = overrides => React.createElement(WorkbenchFrame, {...props, ...overrides}, React.createElement(Draft));
  const button = label => renderer.root.findByProps({'aria-label':label});
  const click = async label => { await act(async () => button(label).props.onClick()); };
  const sidebar = () => renderer.root.findByProps({id:'main-sidebar'});
  const mount = async overrides => {
    await act(async () => { renderer = TestRenderer.create(tree(overrides), {createNodeMock:element => {
      if (element.props.id === 'main-sidebar') return {querySelectorAll:() => controls};
      if (element.props['aria-label'] === '打开菜单') return {focus(){focused = 'toggle';}};
      return null;
    }}); });
  };
  await mount();
  assert.equal(button('收起侧栏').props['aria-expanded'], true);
  await act(async () => button('未提交灵感').props.onChange({target:{value:'尚未保存的故事构思'}}));
  await click('收起侧栏');
  assert.equal(sidebar().props['aria-hidden'], true);
  assert.equal(sidebar().props.inert, true);
  assert.equal(stored.get(SIDEBAR_PREFERENCE_KEY), 'true');
  assert.ok(renderer.root.findByProps({className:'app-shell commercial sidebar-collapsed'}));
  assert.equal(button('未提交灵感').props.value, '尚未保存的故事构思');
  await act(async () => renderer.unmount());
  await mount();
  assert.equal(button('展开侧栏').props['aria-expanded'], false);
  await click('展开侧栏');
  assert.equal(sidebar().props['aria-hidden'], false);
  assert.equal(stored.get(SIDEBAR_PREFERENCE_KEY), 'false');
  await act(async () => renderer.unmount());
  console.log('PASS desktop collapse, expansion, preference restore and uninterrupted draft editing');

  stored.set(SIDEBAR_PREFERENCE_KEY, 'broken');
  await mount(); assert.equal(sidebar().props['aria-hidden'], false);
  await act(async () => renderer.unmount());
  failRead = true; failWrite = true;
  await mount(); await click('收起侧栏'); assert.equal(sidebar().props['aria-hidden'], true);
  await click('展开侧栏'); assert.equal(sidebar().props['aria-hidden'], false);
  await act(async () => renderer.unmount());
  failRead = false; failWrite = false;
  console.log('PASS corrupt or unavailable preference storage does not block navigation');

  stored.set(SIDEBAR_PREFERENCE_KEY, 'true');
  window.innerWidth = 375;
  await mount();
  assert.equal(sidebar().props['aria-hidden'], true);
  await click('打开菜单');
  assert.equal(sidebar().props['aria-hidden'], false);
  assert.equal(button('打开菜单').props['aria-expanded'], true);
  assert.equal(document.body.style.overflow, 'hidden');
  assert.equal(focused, 'close');
  document.activeElement = controls[0];
  let prevented = false;
  await act(async () => emit('keydown', {key:'Tab', shiftKey:true, preventDefault(){prevented = true;}}));
  assert.equal(prevented, true); assert.equal(focused, 'account');
  await click('关闭菜单');
  assert.equal(sidebar().props.inert, true); assert.equal(focused, 'toggle');
  assert.equal(document.body.style.overflow, 'auto');
  await click('打开菜单'); await click('关闭导航'); assert.equal(sidebar().props['aria-hidden'], true);
  await click('打开菜单');
  await act(async () => emit('keydown', {key:'Escape', preventDefault(){}}));
  assert.equal(sidebar().props['aria-hidden'], true);
  await click('打开菜单');
  const novel = renderer.root.findAllByType('button').find(node => node.props.className?.includes('nav-item') && node.findAllByType('span').some(span => span.children.includes('小说写作')));
  await act(async () => novel.props.onClick());
  assert.equal(destination, 'novels'); assert.equal(sidebar().props['aria-hidden'], true);
  await click('打开菜单');
  await act(async () => renderer.update(tree({route:'novels'})));
  assert.equal(sidebar().props['aria-hidden'], true);
  await click('打开菜单');
  await act(async () => renderer.update(tree({route:'novels', dialogOpen:true})));
  assert.equal(sidebar().props['aria-hidden'], true);
  await click('打开菜单');
  await act(async () => {window.innerWidth = 1440; emit('resize');});
  assert.equal(sidebar().props['aria-hidden'], true, 'Desktop restores its own saved collapsed preference');
  assert.equal(stored.get(SIDEBAR_PREFERENCE_KEY), 'true', 'Mobile drawer never overwrites desktop preference');
  assert.equal(document.body.style.overflow, 'auto');
  await click('展开侧栏'); assert.equal(sidebar().props['aria-hidden'], false);
  console.log('PASS mobile drawer, focus containment, backdrop, close, Escape, navigation and responsive independence');
} finally {
  if (renderer) await act(async () => renderer.unmount());
  await server.close();
}
