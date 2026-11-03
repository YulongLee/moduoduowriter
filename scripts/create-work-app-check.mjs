import assert from 'node:assert/strict';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { createServer } from 'vite';
import { newBillingAccount } from '../src/billing.js';
import { collectionKeys } from '../src/workspace.js';

// Full application with synthetic account-scoped collections and cache only.
// Real files, production accounts, SMS/email, models and payments are prohibited.
const names = ['fetch', 'window', 'document', 'location', 'localStorage', 'requestAnimationFrame', 'cancelAnimationFrame', 'IS_REACT_ACT_ENVIRONMENT'];
const originals = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
const listeners = new Map(), cache = new Map(), reads = [], writes = [], calls = [], failures = [], spaces = new Map();
const clone = value => JSON.parse(JSON.stringify(value));
const member = id => ({ configured: true, user: { id, username: `fixture-${id}`, role: 'author', createdAt: '2026-11-01T00:00:00Z' }, spaceId: id, canRegister: true });
const guest = () => ({ configured: true, user: null, spaceId: null, canRegister: true });
let auth = member('alice'), hash = '#workspace', renderer;
const space = id => { if (!spaces.has(id)) spaces.set(id, Object.fromEntries(Object.keys(collectionKeys).map(name => [name, { revision: 0, data: null }]))); return spaces.get(id); };
const data = (name, id = auth.spaceId) => space(id)[name].data ?? [];
const puts = name => calls.filter(call => call.url === `/api/data/${name}` && call.method === 'PUT').length;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.localStorage = { getItem(key) { reads.push(key); return cache.get(key) ?? null; }, setItem(key, value) { writes.push(key); cache.set(key, value); }, removeItem(key) { cache.delete(key); } };
globalThis.location = { get hash() { return hash; }, set hash(value) { const next = String(value).startsWith('#') ? String(value) : `#${value}`; if (next !== hash) { hash = next; queueMicrotask(() => { for (const listener of listeners.get('hashchange') || []) listener(); }); } } };
globalThis.window = { innerWidth: 1440, addEventListener(type, listener) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(listener); }, removeEventListener(type, listener) { listeners.get(type)?.delete(listener); }, scrollTo() {}, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) };
globalThis.document = { activeElement: null, body: { style: {} }, querySelector() { return null; }, querySelectorAll() { return []; }, getElementById() { return null; }, addEventListener() {}, removeEventListener() {}, createElement() { return { style: {}, click() {}, remove() {} }; } };
globalThis.requestAnimationFrame = listener => setTimeout(listener, 0); globalThis.cancelAnimationFrame = clearTimeout;
globalThis.fetch = async (url, options = {}) => {
  const call = { url: String(url), method: options.method || 'GET', headers: options.headers || {}, body: options.body ? JSON.parse(options.body) : undefined };
  calls.push(call);
  try {
    if (url === '/api/auth/status') return Response.json(auth);
    if (url === '/api/auth/methods') return Response.json({ ownerConfigured: true, ...Object.fromEntries(['phone', 'email', 'wechat'].map(name => [name, { enabled: false, configured: false, available: false, reason: '测试未开通' }])) });
    assert.ok(auth.user, 'A guest cannot reach private collection/provider APIs');
    assert.equal(call.headers['X-Mdd-Space'], auth.spaceId);
    if (url === '/api/data') return Response.json({ spaceId: auth.spaceId, collections: clone(space(auth.spaceId)) });
    if (String(url).startsWith('/api/data/') && call.method === 'PUT') {
      const row = space(auth.spaceId)[String(url).slice('/api/data/'.length)]; assert.ok(row); assert.equal(call.body.revision, row.revision);
      row.data = clone(call.body.data); row.revision++; return Response.json({ spaceId: auth.spaceId, revision: row.revision });
    }
    if (url === '/api/service/status') return Response.json({ configured: false, defaultMode: 'demo' });
    if (url === '/api/billing') return Response.json({ account: newBillingAccount(), revision: 1, mode: 'server-demo', paymentConfigured: false });
    throw Error(`Unexpected request during explicit create-page checks: ${url}`);
  } catch (error) { failures.push(error); throw error; }
};
const mockNode = element => ({ id: element.props.id, isConnected: true, style: {}, scrollHeight: 550, focus() { document.activeElement = this; }, contains() { return false; }, querySelector() { return null; }, querySelectorAll() { return []; }, addEventListener() {}, removeEventListener() {}, scrollIntoView() {}, scrollTo() {}, click() {}, getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 800 }; } });
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const vite = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const { App } = await vite.ssrLoadModule('/src/main.jsx');
  const { default: WorkspaceDashboard } = await vite.ssrLoadModule('/src/WorkspaceDashboard.jsx');
  const { WorksPage } = await vite.ssrLoadModule('/src/Library.jsx');
  const { NovelDesk } = await vite.ssrLoadModule('/src/ProductDesk.jsx');
  const { ScriptDesk } = await vite.ssrLoadModule('/src/ScriptDesk.jsx');
  const { default: CreateWorkPage } = await vite.ssrLoadModule('/src/CreateWorkPage.jsx');
  const { creationTemplates } = await vite.ssrLoadModule('/src/createWork.mjs');
  const { initialWorks, inspirations } = await vite.ssrLoadModule('/src/data.js');
  const text = node => typeof node === 'string' ? node : (node?.children || []).map(text).join('');
  const byLabel = label => renderer.root.findByProps({ 'aria-label': label });
  const button = (scope, label) => scope.findAllByType('button').find(node => node.props['aria-label'] === label || text(node).trim() === label || node.findAllByType('strong').some(strong => text(strong) === label));
  const click = async node => { assert.ok(node, 'Expected a real entry/action'); await act(async () => { await node.props.onClick({ currentTarget: { closest: () => null } }); await sleep(20); }); };
  const change = async (node, value) => act(async () => node.props.onChange({ target: { value } }));
  const settled = async () => { await act(async () => { await sleep(450); }); assert.deepEqual(failures, []); };
  const go = async route => act(async () => { location.hash = `#${route}`; await sleep(20); });
  const unmount = async () => { if (renderer) await act(async () => renderer.unmount()); renderer = null; };
  const mount = async (state = member('alice'), route = 'workspace') => { await unmount(); auth = state; location.hash = `#${route}`; await act(async () => { renderer = TestRenderer.create(React.createElement(App), { createNodeMock: mockNode }); await sleep(30); }); await settled(); };
  const creation = () => renderer.root.findByType(CreateWorkPage);
  const noGeneration = () => assert.ok(!calls.some(call => /\/api\/(?:generate|billing\/(?:reserv|commit|purchase|checkout))/.test(call.url)), 'Opening/canceling/creating or preparing AI must not generate or charge');
  const chooseType = label => click(button(byLabel('作品类型'), label));

  cache.set(collectionKeys.works, JSON.stringify([{ id: 'legacy-private', title: 'LEGACY_MUST_NOT_LEAK', chapters: [] }]));
  await mount(); assert.deepEqual(data('works'), []); assert.deepEqual(data('workspaceActivity'), []);
  const origins = [
    { route: 'workspace', Component: WorkspaceDashboard, label: '新建小说', kind: '长篇小说' },
    { route: 'works', Component: WorksPage, label: '新建小说', kind: '长篇小说' },
    { route: 'novels', Component: NovelDesk, label: '新建小说', kind: '长篇小说' },
    { route: 'novels', Component: NovelDesk, short: true, kind: '短篇故事' },
    { route: 'scripts', Component: ScriptDesk, label: '新建剧本', kind: '剧本' },
  ];
  for (const [index, source] of origins.entries()) {
    await go(source.route);
    const scope = renderer.root.findByType(source.Component);
    const entry = source.short ? scope.findAllByType('button').find(node => node.findAllByType('h2').some(heading => text(heading) === '短篇故事创作')) : button(scope, source.label);
    const beforeWorks = clone(data('works')), beforeActivity = clone(data('workspaceActivity')), activityPuts = puts('workspaceActivity');
    await click(entry); assert.equal(location.hash, '#create'); assert.equal(renderer.root.findAllByType(CreateWorkPage).length, 1);
    assert.equal(creation().props.draft.kind, source.kind, `${source.route} preserves its requested work type`);
    assert.equal(renderer.root.findAllByProps({ role: 'dialog', 'aria-label': '新建作品' }).length, 0, 'Creation now occupies an actual page');
    const title = `未提交草稿-${index}`, description = `来自${source.route}的未提交简介`;
    await change(byLabel('作品名称'), title); await change(byLabel('作品简介'), description);
    await click(button(creation(), '取消')); assert.equal(location.hash, `#${source.route}`); await settled();
    assert.deepEqual(data('works'), beforeWorks); assert.deepEqual(data('workspaceActivity'), beforeActivity); assert.equal(puts('workspaceActivity'), activityPuts);
    await click(source.short ? renderer.root.findByType(source.Component).findAllByType('button').find(node => node.findAllByType('h2').some(heading => text(heading) === '短篇故事创作')) : button(renderer.root.findByType(source.Component), source.label));
    assert.equal(byLabel('作品名称').props.value, title); assert.equal(byLabel('作品简介').props.value, description, 'Cancel/re-enter retains the current account’s in-memory draft');
    await click(button(creation(), '取消')); assert.equal(location.hash, `#${source.route}`);
    noGeneration();
  }
  console.log('PASS existing workspace/library/novel/script controls navigate to a type-correct create page, cancel safely and retain the same-account draft without creating records');

  await go('works'); await click(button(renderer.root.findByType(WorksPage), '新建小说'));
  await chooseType('短篇故事');
  const title = 'CREATE_APP作者自己的新故事', description = '作者亲自填写的简介，不能被模板替换。', template = creationTemplates.find(item => item.id === 'urban');
  await change(byLabel('作品名称'), title); await change(byLabel('作品简介'), description); await click(byLabel(`使用${template.name}`));
  assert.equal(byLabel('作品名称').props.value, title); assert.equal(byLabel('作品简介').props.value, description);
  const beforeAI = clone(creation().props.draft), activityBeforeAI = clone(data('workspaceActivity')), worksBeforeAI = clone(data('works'));
  await click(button(creation(), 'AI 帮我构思'));
  const planning = renderer.root.findByProps({ role: 'dialog' });
  assert.ok(text(planning).includes('灵感') || text(planning).includes('规划'));
  const planNode = renderer.root.findAll(node => typeof node.type === 'function' && node.props.initial?.autoGenerate === false)[0];
  assert.ok(planNode, 'The AI action must explicitly disable automatic generation');
  assert.ok(planNode.props.initial.idea.includes(description)); assert.ok(planNode.props.initial.idea.includes(title)); assert.equal(planNode.props.initial.genre, template.genre); assert.equal(planNode.props.initial.kind, '短篇故事');
  assert.equal(planNode.props.initial.audience,'全频'); assert.equal(planNode.props.initial.perspective,'第三人称');
  assert.deepEqual(planNode.props.initialPlanning,{title,outline:template.outline,characters:template.characters,text:''});
  assert.ok(planNode.findAllByType('input').some(node=>node.props.value===title),'The planning UI must actually display the author’s current title');
  await settled(); assert.deepEqual(data('works'), worksBeforeAI); assert.deepEqual(data('workspaceActivity'), activityBeforeAI); noGeneration();
  await click(byLabel('关闭')); assert.equal(location.hash, '#create'); assert.deepEqual(creation().props.draft, beforeAI);

  const beforeCreate = Date.now(), priorCreatePuts = puts('workspaceActivity'), form = creation().findByType('form');
  await act(async () => { const first = form.props.onSubmit({ preventDefault() {} }); form.props.onSubmit({ preventDefault() {} }); await first; }); await settled();
  assert.ok(location.hash.startsWith('#editor/')); assert.equal(data('works').length, 1);
  const work = data('works')[0];
  assert.equal(work.title, title); assert.equal(work.description, description); assert.equal(work.kind, '短篇故事'); assert.equal(work.genre, template.genre); assert.equal(work.templateId, template.id);
  assert.deepEqual(work.styles, template.styles); assert.equal(work.outline, template.outline); assert.equal(work.characters, template.characters); assert.equal(work.notes, template.notes);
  assert.equal(work.chapters.length, 1); assert.equal(work.chapters[0].text, ''); assert.equal(byLabel('章节正文').props.value, '');
  for (const at of [work.createdAt, work.updatedAt]) { assert.match(at, /^\d{4}-\d{2}-\d{2}T/); assert.ok(Date.parse(at) >= beforeCreate && Date.parse(at) <= Date.now()); }
  assert.equal(data('workspaceActivity').length, 1); assert.equal(data('workspaceActivity')[0].workId, work.id); assert.equal(data('workspaceActivity')[0].type, 'create'); assert.equal(puts('workspaceActivity'), priorCreatePuts + 1);
  for (const seed of initialWorks) assert.ok(!data('works').some(item => item.title === seed.title));
  noGeneration();
  console.log('PASS AI planning opens explicitly without generation, preserves the draft, and one actual submission stores all author/template fields with an empty timestamped chapter and one activity');

  await go('works');await click(button(renderer.root.findByType(WorksPage),'新建小说'));
  const aiTitle='AI规划中的作者手写作品',aiDescription='规划保存也要保留的作者简介',aiTemplate=creationTemplates.find(item=>item.id==='future');
  await change(byLabel('作品名称'),aiTitle);await change(byLabel('作品简介'),aiDescription);await chooseType('剧本');await click(byLabel(`使用${aiTemplate.name}`));
  await click(button(creation(),'AI 帮我构思'));
  const manualOutline=aiTemplate.outline+'\n作者补充：主角在返航前主动公开一项证据。',manualProse='作者在规划窗口手写的开场，不来自模型。';
  await change(byLabel('初始创作规划'),manualOutline);await change(byLabel('开篇正文'),manualProse);
  await click(button(renderer.root.findByProps({role:'dialog'}),'保存规划，进入编辑器'));await settled();
  const plannedWork=data('works').find(item=>item.title===aiTitle);assert.ok(plannedWork);assert.equal(data('works').length,2);
  assert.equal(plannedWork.description,aiDescription);assert.equal(plannedWork.templateId,aiTemplate.id);assert.deepEqual(plannedWork.styles,aiTemplate.styles);assert.equal(plannedWork.notes,aiTemplate.notes);assert.equal(plannedWork.outline,manualOutline);assert.equal(plannedWork.characters,aiTemplate.characters);assert.equal(plannedWork.kind,'剧本');assert.equal(plannedWork.chapters[0].text,manualProse);
  assert.equal(data('workspaceActivity').filter(entry=>entry.workId===plannedWork.id).length,1);noGeneration();
  console.log('PASS saving manually edited planning retains description/styles/template/notes and authored prose without any model invocation');

  await go('home');
  const daily = byLabel('公共首页').findByProps({ className: 'home-daily-inspiration' });
  const idea = inspirations[0].prompt, beforePublicCreate = clone(data('works')), beforePublicActivity = clone(data('workspaceActivity'));
  await click(button(daily, '用这个灵感')); assert.equal(location.hash, '#create'); assert.equal(byLabel('作品简介').props.value, idea, 'A legacy create intent passed through public onLaunch/initialModal preserves its idea');
  assert.equal(renderer.root.findAllByProps({ role: 'dialog', 'aria-label': '新建作品' }).length, 0);
  await click(button(creation(), '取消')); assert.equal(location.hash, '#works', 'A public/direct entry returns to the safe works fallback'); await settled();
  assert.deepEqual(data('works'), beforePublicCreate); assert.deepEqual(data('workspaceActivity'), beforePublicActivity); noGeneration();

  await click(button(renderer.root.findByType(WorksPage), '新建小说'));
  const privateDraft = 'UNSUBMITTED_ALICE_DRAFT'; await change(byLabel('作品名称'), privateDraft); await click(button(creation(), '取消'));
  await click(button(renderer.root.findByType(WorksPage), '新建小说')); assert.equal(byLabel('作品名称').props.value, privateDraft);
  assert.ok(![...cache.values()].some(value => value.includes(privateDraft)), 'The incomplete form remains memory-only, not an unscoped browser draft');
  const aliceWorks = clone(data('works')), aliceActivity = clone(data('workspaceActivity'));
  await mount(member('bob'), 'create'); assert.equal(byLabel('作品名称').props.value, ''); assert.equal(byLabel('作品简介').props.value, '');
  assert.deepEqual(data('works'), []); assert.deepEqual(data('workspaceActivity'), []); assert.deepEqual(data('works', 'alice'), aliceWorks); assert.deepEqual(data('workspaceActivity', 'alice'), aliceActivity);
  await click(button(creation(), '取消')); assert.equal(location.hash, '#works');
  const callStart = calls.length, readStart = reads.length;
  await mount(guest(), 'create');
  assert.equal(renderer.root.findAllByType(CreateWorkPage).length, 0); assert.ok(renderer.root.findAllByProps({ className: 'account-gate' }).length);
  assert.ok(calls.slice(callStart).every(call => ['/api/auth/status', '/api/auth/methods'].includes(call.url)), 'Refreshing #create as a guest must not initialize private APIs');
  assert.ok(!reads.slice(readStart).some(key => /mdd-(works|workspaceActivity|workspaceTasks|planningDrafts)/.test(key)), 'The guest create route must not read any existing account manuscript/draft cache');
  assert.deepEqual(failures, []); noGeneration();
  console.log('PASS inherited public idea/fallback cancel, memory-only per-account draft isolation and refreshed guest #create login boundary without private calls');
} finally {
  if (renderer) await act(async () => renderer.unmount());
  await vite.close();
  for (const [name, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
}
