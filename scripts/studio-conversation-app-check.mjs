import assert from 'node:assert/strict';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { createServer } from 'vite';
import { collectionKeys } from '../src/workspace.js';
import { newBillingAccount } from '../src/billing.js';

// Actual App routing/authentication handoff, isolated synthetic users and memory
// collections. No real accounts, verification messages, provider or payment.
const names = ['fetch', 'window', 'document', 'location', 'localStorage', 'requestAnimationFrame', 'cancelAnimationFrame', 'IS_REACT_ACT_ENVIRONMENT'];
const originals = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
const cache = new Map(), reads = [], calls = [], listeners = new Map(), failures = [], spaces = new Map();
const clone = value => JSON.parse(JSON.stringify(value));
const guest = () => ({ configured: true, user: null, spaceId: null, canRegister: true });
const member = id => ({ configured: true, user: { id, username: `fixture-${id}`, role: 'author', createdAt: '2026-11-01T00:00:00Z' }, spaceId: id, canRegister: true });
let renderer, auth = guest(), hash = '#home';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.localStorage = { getItem(key) { reads.push(key); return cache.get(key) ?? null; }, setItem: (key, value) => cache.set(key, value), removeItem: key => cache.delete(key) };
globalThis.location = { get hash() { return hash; }, set hash(value) { const next = String(value).startsWith('#') ? String(value) : `#${value}`; if (next !== hash) { hash = next; queueMicrotask(() => { for (const listener of listeners.get('hashchange') || []) listener(); }); } } };
globalThis.window = { innerWidth: 1440, addEventListener(type, listener) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(listener); }, removeEventListener(type, listener) { listeners.get(type)?.delete(listener); }, scrollTo() {}, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) };
globalThis.document = { activeElement: null, body: { style: {} }, querySelector() { return null; }, querySelectorAll() { return []; }, getElementById() { return null; }, addEventListener() {}, removeEventListener() {}, createElement() { return { style: {}, click() {}, remove() {} }; } };
globalThis.requestAnimationFrame = callback => setTimeout(callback, 0); globalThis.cancelAnimationFrame = clearTimeout;
globalThis.fetch = async (url, options = {}) => {
  const call = { url: String(url), method: options.method || 'GET', headers: options.headers || {}, body: options.body ? JSON.parse(options.body) : undefined }; calls.push(call);
  try {
    if (url === '/api/auth/status') return Response.json(auth);
    if (url === '/api/auth/methods') return Response.json({ ownerConfigured: true, ...Object.fromEntries(['phone', 'email', 'wechat'].map(name => [name, { enabled: false, configured: false, available: false, reason: '测试未开通' }])) });
    if (url === '/api/auth/login') { auth = member('alice'); return Response.json({ user: auth.user }); }
    assert.ok(auth.user, 'A guest must not initialize private providers'); assert.equal(call.headers['X-Mdd-Space'], auth.spaceId);
    if (url === '/api/data') return Response.json({ spaceId: auth.spaceId, collections: clone(spaces.get(auth.spaceId)) });
    if (String(url).startsWith('/api/data/') && call.method === 'PUT') {
      const row = spaces.get(auth.spaceId)[String(url).slice('/api/data/'.length)]; assert.ok(row); assert.equal(call.body.revision, row.revision); row.data = clone(call.body.data); row.revision++; return Response.json({ spaceId: auth.spaceId, revision: row.revision });
    }
    if (url === '/api/service/status') return Response.json({ configured: true, defaultMode: 'ai', model: 'PRIVATE_MODEL_NAME' });
    if (url === '/api/billing') return Response.json({ account: newBillingAccount(), revision: 1, mode: 'server-demo', paymentConfigured: false });
    throw Error(`Unexpected provider/payment request during an explicit prefill: ${url}`);
  } catch (error) { failures.push(error); throw error; }
};
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const mockNode = element => ({ id: element.props.id, isConnected: true, style: {}, scrollHeight: 100, clientHeight: 100, scrollTop: 0, focus() { document.activeElement = this; }, contains() { return false; }, querySelector() { return null; }, querySelectorAll() { return []; }, addEventListener() {}, removeEventListener() {}, scrollIntoView() {}, scrollTo() {}, getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 800 }; } });
const vite = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const { App } = await vite.ssrLoadModule('/src/main.jsx');
  const { HomeConversation } = await vite.ssrLoadModule('/src/HomeConversation.jsx');
  const { default: StudioConversationView } = await vite.ssrLoadModule('/src/StudioConversationView.jsx');
  const { createConversation } = await vite.ssrLoadModule('/src/conversation.js');
  const saved = { ...createConversation({ draft: 'ALICE_SAVED_PRIVATE_DRAFT' }), id: 'alice-saved-conversation', title: 'ALICE_SCOPED_DISCUSSION' };
  for (const id of ['alice', 'bob']) spaces.set(id, Object.fromEntries(Object.keys(collectionKeys).map(name => [name, { revision: 1, data: name === 'conversations' && id === 'alice' ? [saved] : [] }])));
  const text = node => typeof node === 'string' ? node : (node?.children || []).map(text).join('');
  const byLabel = label => renderer.root.findByProps({ 'aria-label': label });
  const change = async (node, value) => act(async () => node.props.onChange({ target: { value } }));
  const click = async node => { assert.ok(node); await act(async () => { await node.props.onClick(); await sleep(15); }); };
  const unmount = async () => { if (renderer) await act(async () => renderer.unmount()); renderer = null; };
  const mount = async (state, route) => {
    await unmount(); auth = state; location.hash = `#${route}`; calls.length = 0; reads.length = 0; failures.length = 0;
    await act(async () => { renderer = TestRenderer.create(React.createElement(App), { createNodeMock: mockNode }); await sleep(30); });
  };
  const privateReads = () => reads.filter(key => /mdd-(?:works|conversations|planningDrafts|workspaceTasks|workspaceActivity)/.test(key));
  const providerCalls = () => calls.filter(call => /\/api\/(?:generate|billing\/(?:reserv|commit|checkout|purchase))/.test(call.url));

  cache.set(collectionKeys.conversations, JSON.stringify([{ ...saved, id: 'legacy-secret', title: 'LEGACY_PRIVATE_CHAT', draft: 'LEGACY_PRIVATE_DRAFT' }]));
  await mount(guest(), 'conversation');
  assert.equal(renderer.root.findAllByType(HomeConversation).length, 0); assert.equal(renderer.root.findAllByType(StudioConversationView).length, 0);
  assert.ok(renderer.root.findAllByProps({ className: 'account-gate' }).length);
  assert.ok(calls.every(call => ['/api/auth/status', '/api/auth/methods'].includes(call.url))); assert.deepEqual(privateReads(), []); assert.ok(!text(renderer.root).includes('LEGACY_PRIVATE_CHAT'));
  console.log('PASS guest #conversation refresh mounts only the login gate, with no conversation cache reads or private/provider APIs');

  await mount(member('alice'), 'conversation');
  assert.equal(renderer.root.findAllByType(HomeConversation).length, 1); assert.equal(renderer.root.findByType(HomeConversation).props.appearance, 'studio'); assert.equal(renderer.root.findAllByType(StudioConversationView).length, 1);
  assert.ok(byLabel('创作对话工作台')); assert.equal(byLabel('创作对话输入').props.value, saved.draft); assert.ok(text(byLabel('对话历史')).includes(saved.title));
  assert.ok(!text(renderer.root).includes('LEGACY_PRIVATE_CHAT')); assert.ok(!text(renderer.root).includes('PRIVATE_MODEL_NAME')); assert.deepEqual(providerCalls(), []);
  assert.equal(renderer.root.findAllByProps({ id: 'main-sidebar' }).length, 1, 'Studio rails must not duplicate the application navigation');
  assert.ok(calls.filter(call => ['/api/data', '/api/billing', '/api/service/status'].includes(call.url)).every(call => call.headers['X-Mdd-Space'] === 'alice'));
  console.log('PASS the actual private route renders exactly one studio controller/view with its scoped saved history and no automatic generation');

  await mount(guest(), 'home');
  const idea = 'PUBLIC_LOGIN_INTENT：请先陪我确定一个守塔人的主角目标。';
  const publicMain = () => byLabel('公共首页');
  await change(publicMain().findByProps({ 'aria-label': '故事灵感输入' }), idea);
  await act(async () => { publicMain().findByProps({ 'aria-label': '公开创作入口' }).findByType('form').props.onSubmit({ preventDefault() {} }); await sleep(15); });
  assert.ok(calls.every(call => ['/api/auth/status', '/api/auth/methods'].includes(call.url))); assert.deepEqual(privateReads(), []);
  const passwordMode = renderer.root.findAllByProps({ 'aria-label': '账号密码登录' })[0]; if (passwordMode) await click(passwordMode);
  await change(byLabel('创作账号'), 'fixture_alice'); await change(byLabel('创作密码'), 'fixture-only-password');
  const login = renderer.root.findAllByType('form').find(form => form.findAllByProps({ 'aria-label': '创作账号' }).length);
  await act(async () => { await login.props.onSubmit({ preventDefault() {} }); await sleep(30); });
  assert.equal(location.hash, '#conversation'); assert.equal(renderer.root.findAllByType(StudioConversationView).length, 1); assert.equal(byLabel('创作对话输入').props.value, idea);
  assert.equal(renderer.root.findByType(StudioConversationView).props.session.turns.length, 0, 'A public idea becomes an editable scratch, not an automatically sent turn');
  assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 0);
  assert.equal(calls.filter(call => call.url === '/api/data').length, 1, 'Login intent must initialize its private workspace only once');
  assert.deepEqual(providerCalls(), []); assert.equal(publicMain().findByProps({ 'aria-label': '故事灵感输入' }).props.value, idea);
  await click(renderer.root.findByProps({ 'data-nav': 'home' }));
  assert.equal(location.hash, '#home'); assert.equal(renderer.root.findAllByType(StudioConversationView).length, 0); assert.equal(publicMain().findByProps({ 'aria-label': '故事灵感输入' }).props.value, idea); assert.deepEqual(providerCalls(), []);
  await mount(member('bob'), 'conversation');
  assert.equal(byLabel('创作对话输入').props.value, ''); assert.ok(!text(byLabel('对话历史')).includes(saved.title)); assert.ok(!text(renderer.root).includes('ALICE_SAVED_PRIVATE_DRAFT'));
  assert.deepEqual(providerCalls(), []); assert.deepEqual(failures, []);
  console.log('PASS public login intent only prefills studio, preserves the public input on return and never leaks another account’s conversation history');
} finally {
  if (renderer) await act(async () => renderer.unmount());
  await vite.close();
  for (const [name, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
}
