import assert from 'node:assert/strict';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { createServer } from 'vite';
import { newBillingAccount } from '../src/billing.js';
import { collectionKeys } from '../src/workspace.js';
import { toActivityDate } from '../src/workspaceActivity.mjs';

// Full App, actual collection client and UI handlers with memory-only accounts,
// remote collections and browser caches. No real account, file or provider.
const names = ['fetch', 'window', 'document', 'location', 'localStorage', 'requestAnimationFrame', 'cancelAnimationFrame', 'IS_REACT_ACT_ENVIRONMENT'];
const originals = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
const listeners = new Map(), cache = new Map(), reads = [], writes = [], calls = [], failures = [], spaces = new Map();
const clone = value => JSON.parse(JSON.stringify(value));
const member = id => ({ configured: true, user: { id, username: `fixture-${id}`, role: 'author', createdAt: '2026-11-01T00:00:00.000Z' }, spaceId: id, canRegister: true });
let auth = member('alice'), hash = '#workspace', renderer;
function space(id) {
  if (!spaces.has(id)) spaces.set(id, Object.fromEntries(Object.keys(collectionKeys).map(name => [name, { revision: 0, data: null }])));
  return spaces.get(id);
}
const data = (name, id = auth.spaceId) => space(id)[name].data ?? [];
const putCount = name => calls.filter(call => call.url === `/api/data/${name}` && call.method === 'PUT').length;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.localStorage = {
  getItem(key) { reads.push(key); return cache.get(key) ?? null; },
  setItem(key, value) { writes.push(key); cache.set(key, value); },
  removeItem(key) { cache.delete(key); },
};
globalThis.location = {
  get hash() { return hash; },
  set hash(value) {
    const next = String(value).startsWith('#') ? String(value) : `#${value}`;
    if (next === hash) return;
    hash = next;
    queueMicrotask(() => { for (const listener of listeners.get('hashchange') || []) listener(); });
  },
};
globalThis.window = {
  innerWidth: 1440,
  addEventListener(type, listener) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(listener); },
  removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
  scrollTo() {},
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
};
globalThis.document = { activeElement: null, body: { style: {} }, querySelector() { return null; }, querySelectorAll() { return []; }, getElementById() { return null; }, addEventListener() {}, removeEventListener() {}, createElement() { return { style: {}, click() {}, remove() {} }; } };
globalThis.requestAnimationFrame = listener => setTimeout(listener, 0);
globalThis.cancelAnimationFrame = clearTimeout;
globalThis.fetch = async (url, options = {}) => {
  const request = { url: String(url), method: options.method || 'GET', headers: options.headers || {}, body: options.body ? JSON.parse(options.body) : undefined };
  calls.push(request);
  try {
    if (url === '/api/auth/status') return Response.json(auth);
    if (url === '/api/auth/methods') return Response.json({ ownerConfigured: true, phone: { enabled: false }, email: { enabled: false }, wechat: { enabled: false } });
    assert.equal(request.headers['X-Mdd-Space'], auth.spaceId, 'Every private request must carry the currently confirmed account scope');
    if (url === '/api/data') return Response.json({ spaceId: auth.spaceId, collections: clone(space(auth.spaceId)) });
    if (String(url).startsWith('/api/data/') && request.method === 'PUT') {
      const name = String(url).slice('/api/data/'.length), row = space(auth.spaceId)[name];
      assert.ok(row, `Only a known collection can be saved: ${name}`);
      assert.equal(request.body.revision, row.revision);
      assert.ok(Array.isArray(request.body.data));
      row.data = clone(request.body.data); row.revision++;
      return Response.json({ spaceId: auth.spaceId, revision: row.revision });
    }
    if (url === '/api/service/status') return Response.json({ configured: false, defaultMode: 'demo' });
    if (url === '/api/billing') return Response.json({ account: newBillingAccount(), revision: 1, mode: 'server-demo', paymentConfigured: false });
    throw Error(`Unexpected request in dashboard app fixture: ${url}`);
  } catch (error) { failures.push(error); throw error; }
};
const mockNode = element => ({
  id: element.props.id, isConnected: true, style: {}, scrollHeight: 550,
  focus() { document.activeElement = this; }, contains() { return false; }, querySelector() { return null; }, querySelectorAll() { return []; },
  addEventListener() {}, removeEventListener() {}, scrollTo() {}, scrollIntoView() {}, click() {},
  getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 800 }; },
});
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const vite = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const { App } = await vite.ssrLoadModule('/src/main.jsx');
  const { default: WorkspaceDashboard } = await vite.ssrLoadModule('/src/WorkspaceDashboard.jsx');
  const { initialWorks } = await vite.ssrLoadModule('/src/data.js');
  const text = node => typeof node === 'string' ? node : (node?.children || []).map(text).join('');
  const byLabel = label => renderer.root.findByProps({ 'aria-label': label });
  const dashboard = () => renderer.root.findByType(WorkspaceDashboard);
  const button = (scope, label) => scope.findAllByType('button').find(node => text(node).trim() === label);
  const click = async node => { assert.ok(node, 'Expected a reachable application control'); await act(async () => { node.props.onClick({ currentTarget: { closest: () => null } }); await sleep(15); }); };
  const change = async (node, value) => act(async () => node.props.onChange({ target: { value } }));
  const submit = async form => act(async () => form.props.onSubmit({ preventDefault() {} }));
  const field = (scope, label, type) => scope.findAllByType('label').find(node => text(node).startsWith(label)).findByType(type);
  const settled = async () => { await act(async () => { await sleep(450); }); assert.deepEqual(failures, [], 'All requests must be recognized and correctly scoped'); };
  const go = async route => act(async () => { location.hash = `#${route}`; await sleep(20); });
  const unmount = async () => { if (renderer) await act(async () => renderer.unmount()); renderer = null; };
  const mount = async id => {
    await unmount(); auth = member(id); location.hash = '#workspace';
    await act(async () => { renderer = TestRenderer.create(React.createElement(App), { createNodeMock: mockNode }); await sleep(30); });
    await settled();
  };
  const noGeneration = () => assert.ok(!calls.some(call => /\/api\/(?:generate|billing\/(?:reserve|commit|purchase|checkout))/.test(call.url)), 'Creation/editing/import/task bookkeeping must never generate or charge');
  const timestampInWindow = (value, before, after = Date.now()) => {
    assert.match(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.ok(Date.parse(value) >= before && Date.parse(value) <= after, 'Timestamps must come from the actual explicit mutation');
  };

  cache.set(collectionKeys.works, JSON.stringify([{ id: 'unscoped-legacy-secret', title: 'LEGACY_PRIVATE_MANUSCRIPT', chapters: [{ id: 'secret', title: 'secret', text: '必须留在旧命名空间' }] }]));
  await mount('alice');
  assert.ok(text(dashboard()).includes('你的第一部作品，从这里开始'));
  for (const work of initialWorks) assert.ok(!text(dashboard()).includes(work.title), 'A newly registered account must not inherit authored starter works');
  assert.ok(!text(dashboard()).includes('LEGACY_PRIVATE_MANUSCRIPT'));
  assert.deepEqual(data('works'), []); assert.deepEqual(data('workspaceActivity'), []); assert.deepEqual(data('workspaceTasks'), []);
  assert.deepEqual(JSON.parse(cache.get(`mdd-space:alice:${collectionKeys.works}`)), []);
  assert.ok(!reads.includes(collectionKeys.works), 'An account workspace must not read the unscoped legacy manuscript cache');
  const initialWorkPut = calls.find(call => call.url === '/api/data/works' && call.method === 'PUT');
  assert.deepEqual(initialWorkPut.body.data, [], 'A server-null collection bootstraps as genuinely empty for an authenticated account');
  noGeneration();
  console.log('PASS full authenticated App bootstraps a server-null space without starter works or another namespace’s manuscripts, activity or tasks');

  const createdTitle = 'APP真实新建作品';
  await click(button(dashboard(), '新建小说'));
  assert.equal(location.hash,'#create');
  const createForm = renderer.root.findByProps({ 'aria-label': '新建作品信息' });
  await change(byLabel('作品名称'), createdTitle);
  await change(byLabel('作品简介'), '这段是灵感与简介，不能当作正文字数');
  const beforeCreate = Date.now(), createActivityPuts = putCount('workspaceActivity');
  await submit(createForm); await settled();
  assert.equal(data('works').length, 1);
  let created = data('works')[0];
  assert.equal(created.title, createdTitle); assert.equal(created.chapters[0].text, '');
  assert.ok(location.hash.startsWith('#editor/')); assert.equal(byLabel('章节正文').props.value, '');
  timestampInWindow(created.createdAt, beforeCreate); timestampInWindow(created.updatedAt, beforeCreate);
  assert.equal(data('workspaceActivity').length, 1); assert.equal(data('workspaceActivity')[0].workId, created.id); assert.equal(data('workspaceActivity')[0].type, 'create');
  assert.equal(toActivityDate(data('workspaceActivity')[0].at), toActivityDate(created.createdAt));
  assert.equal(putCount('workspaceActivity'), createActivityPuts + 1, 'One create action persists one daily activity update, not render-derived duplicates');
  const originalEventId = data('workspaceActivity')[0].id;
  noGeneration();
  console.log('PASS actual creation form writes real timestamps and one create marker while the initial chapter stays empty and no model runs');

  await go('workspace');
  const readOnlyActivity = clone(data('workspaceActivity')), readOnlyUpdatedAt = data('works')[0].updatedAt, beforeOpenPuts = putCount('workspaceActivity');
  await click(byLabel(`打开作品：${createdTitle}`)); await settled();
  assert.equal(byLabel('章节正文').props.value, '');
  assert.deepEqual(data('workspaceActivity'), readOnlyActivity, 'Opening an editor must not count as editing');
  assert.equal(data('works')[0].updatedAt, readOnlyUpdatedAt);
  assert.equal(putCount('workspaceActivity'), beforeOpenPuts);

  const beforeProse = Date.now();
  await change(byLabel('章节正文'), '这是第一段实际正文。'); await change(byLabel('章节正文'), '这是第一段实际正文。\n\n人物作出了新的选择。'); await settled();
  created = data('works').find(work => work.id === created.id);
  assert.equal(created.chapters[0].text, '这是第一段实际正文。\n\n人物作出了新的选择。');
  timestampInWindow(created.updatedAt, beforeProse);
  assert.equal(data('workspaceActivity').length, 1); assert.equal(data('workspaceActivity')[0].id, originalEventId); timestampInWindow(data('workspaceActivity')[0].at, beforeProse);
  assert.equal(data('workspaceActivity')[0].type, 'create', 'Routine edits preserve creation’s daily classification');
  const unchangedActivity = clone(data('workspaceActivity')), beforeNoopPuts = putCount('workspaceActivity');
  await change(byLabel('章节正文'), created.chapters[0].text); await settled();
  assert.deepEqual(data('workspaceActivity'), unchangedActivity, 'A no-op value must not refresh or create an activity record');
  assert.equal(putCount('workspaceActivity'), beforeNoopPuts);
  const beforeChapterTitle = Date.now();
  await change(byLabel('章节标题'), '第一章 · 真正开始'); await settled();
  assert.equal(data('works')[0].chapters[0].title, '第一章 · 真正开始'); timestampInWindow(data('workspaceActivity')[0].at, beforeChapterTitle); assert.equal(data('workspaceActivity')[0].id, originalEventId);
  await click(renderer.root.findByProps({ className: 'editor-book-name' }));
  const detailsForm = renderer.root.findByProps({ role: 'dialog' }).findByType('form');
  const renamedTitle = 'APP修改后的作品标题';
  await change(field(detailsForm, '作品名称', 'input'), renamedTitle);
  const beforeRename = Date.now(); await submit(detailsForm); await settled();
  assert.equal(data('works')[0].title, renamedTitle); timestampInWindow(data('workspaceActivity')[0].at, beforeRename); assert.equal(data('workspaceActivity')[0].id, originalEventId);
  noGeneration();
  console.log('PASS opening a work is read-only, actual prose/chapter-title/work-title mutations refresh a daily marker, and no-op input does not write activity');

  const importInput = renderer.root.findAllByType('input').find(node => node.props.type === 'file' && node.props.accept === '.txt,text/plain');
  assert.ok(importInput);
  const importedTitle = 'APP导入文稿', importTarget = { files: [{ name: `${importedTitle}.txt`, text: async () => '第一章 归来\n甲乙\n\n第二章 来信\n丙丁' }], value: 'fixture-selected-file' };
  const beforeImport = Date.now(), beforeImportPuts = putCount('workspaceActivity');
  await act(async () => importInput.props.onChange({ target: importTarget })); await settled();
  assert.equal(importTarget.value, '');
  assert.equal(data('works').length, 2);
  const imported = data('works').find(work => work.title === importedTitle);
  assert.ok(imported); timestampInWindow(imported.createdAt, beforeImport); assert.equal(imported.updatedAt, imported.createdAt);
  assert.equal(imported.chapters.length, 2); assert.deepEqual(imported.chapters.map(chapter => chapter.text), ['甲乙', '丙丁']);
  assert.equal(data('workspaceActivity').length, 2);
  const importedEvent = data('workspaceActivity').find(entry => entry.workId === imported.id);
  assert.equal(importedEvent.type, 'import'); assert.equal(toActivityDate(importedEvent.at), toActivityDate(imported.createdAt));
  assert.equal(putCount('workspaceActivity'), beforeImportPuts + 1);
  noGeneration();
  console.log('PASS actual TXT input handler creates a timestamped work, splits its real chapters and persists exactly one import activity marker');

  await go('workspace');
  await change(byLabel('新增写作任务'), 'ALICE_ONLY_TASK');
  await submit(renderer.root.findByProps({ className: 'wi-task-form' })); await settled();
  assert.equal(data('workspaceTasks').length, 1); assert.equal(data('workspaceTasks')[0].text, 'ALICE_ONLY_TASK'); assert.equal(data('workspaceTasks')[0].done, false);
  await act(async () => byLabel('完成任务：ALICE_ONLY_TASK').props.onChange({ target: { checked: true } })); await settled();
  assert.equal(data('workspaceTasks')[0].done, true);
  assert.ok(writes.includes(`mdd-space:alice:${collectionKeys.workspaceTasks}`));
  assert.deepEqual(JSON.parse(cache.get(`mdd-space:alice:${collectionKeys.workspaceTasks}`)), data('workspaceTasks'));
  const aliceActivity = clone(data('workspaceActivity')), aliceWorks = clone(data('works')), aliceTasks = clone(data('workspaceTasks'));
  const aliceTaskPuts = calls.filter(call => call.url === '/api/data/workspaceTasks' && call.method === 'PUT' && call.headers['X-Mdd-Space'] === 'alice');
  assert.ok(aliceTaskPuts.some(call => call.body.data.some(task => task.text === 'ALICE_ONLY_TASK' && task.done)));

  await mount('bob');
  assert.deepEqual(data('works'), []); assert.deepEqual(data('workspaceTasks'), []); assert.deepEqual(data('workspaceActivity'), []);
  assert.ok(!text(dashboard()).includes(renamedTitle)); assert.ok(!text(dashboard()).includes('ALICE_ONLY_TASK'));
  await change(byLabel('新增写作任务'), 'BOB_ONLY_TASK'); await submit(renderer.root.findByProps({ className: 'wi-task-form' })); await settled();
  assert.equal(data('workspaceTasks')[0].text, 'BOB_ONLY_TASK');
  assert.ok(writes.includes(`mdd-space:bob:${collectionKeys.workspaceTasks}`));
  assert.deepEqual(data('workspaceTasks', 'alice'), aliceTasks); assert.deepEqual(data('works', 'alice'), aliceWorks); assert.deepEqual(data('workspaceActivity', 'alice'), aliceActivity);
  await mount('alice');
  assert.equal(data('works').length, 2); assert.ok(text(dashboard()).includes(renamedTitle));
  assert.equal(byLabel('完成任务：ALICE_ONLY_TASK').props.checked, true); assert.ok(!text(dashboard()).includes('BOB_ONLY_TASK'));
  assert.deepEqual(data('workspaceActivity'), aliceActivity, 'Reloading an existing dashboard must not invent new editing days');
  assert.ok(!reads.includes(collectionKeys.works)); assert.ok(!reads.includes(collectionKeys.workspaceTasks));
  assert.deepEqual(failures, []); noGeneration();
  console.log('PASS actual task components persist through scoped collection APIs/caches, survive reload and stay isolated between Alice and Bob');
} finally {
  if (renderer) await act(async () => renderer.unmount());
  await vite.close();
  for (const [name, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
}
