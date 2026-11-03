import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { createServer } from 'vite';

// Controlled documents and account context only. No real account, storage, API,
// paid model, or manuscript is read or changed by this check.
const globals = ['fetch', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT'];
const originals = Object.fromEntries(globals.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const network = [], storage = [], taskWrites = [], activity = [];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.fetch = async (...args) => { network.push(args); throw new Error('Unexpected dashboard request'); };
globalThis.localStorage = { getItem(key) { storage.push(['read', key]); return null; }, setItem(key) { storage.push(['write', key]); }, removeItem(key) { storage.push(['remove', key]); } };
const text = node => typeof node === 'string' ? node : (node?.children || []).map(text).join('');
const main = { id: 'fixture-long', title: '春山', kind: '长篇小说', genre: '玄幻', updatedAt: '2026-11-01T02:00:00.000Z', progress: 95, chapters: [{ id: 'c1', title: '第一章', text: '山 雨\n归来' }, { id: 'c2', title: '第二章', text: '后来' }] };
const imported = { id: 'fixture-import', title: '旧稿', kind: '长篇小说', updated: '刚刚', chapters: [{ id: 'i1', title: '序章', text: '旧稿' }] };
const short = { id: 'fixture-short', title: '海风', kind: '短篇故事', genre: '日常', updatedAt: '2026-11-04T03:00:00.000Z', chapters: [{ id: 's1', title: '第一章', text: '海 风' }] };
const script = { id: 'fixture-script', title: '夜行', kind: '剧本', genre: '悬疑', updatedAt: '2026-10-31T03:00:00.000Z', chapters: [{ id: 'p1', title: '第一场', text: '你好，远方。' }] };
const deleted = { ...main, id: 'fixture-deleted', title: '已回收作品', deletedAt: '2026-11-04T05:00:00.000Z' };
const works = [main, imported, short, script, deleted];
const snapshot = JSON.stringify(works);
const modals = [], routes = [], opened = [], notices = [];
let importCount = 0, renderer;
const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });

try {
  const { default: Dashboard, dashboardStats, dashboardWorkWords, dashboardEditedTime, getDashboardWorks, dashboardProgress, dashboardGreeting, dashboardDisplayName } = await server.ssrLoadModule('/src/WorkspaceDashboard.jsx');
  const { AccountContext } = await server.ssrLoadModule('/src/Account.jsx');
  const { tools } = await server.ssrLoadModule('/src/data.js');
  assert.deepEqual(dashboardStats(works), { workCount: 4, totalWords: 16, chapterCount: 5 });
  assert.deepEqual(dashboardStats([]), { workCount: 0, totalWords: 0, chapterCount: 0 });
  assert.equal(dashboardWorkWords(main), 6, 'Word counts must use actual chapter text and exclude whitespace');
  assert.equal(dashboardEditedTime(imported), null, 'A display label is not a recorded edit timestamp');
  assert.deepEqual(getDashboardWorks(works).map(work => work.id), [short.id, imported.id, main.id, script.id], 'Sort real timestamps while preserving imported/legacy fallback positions');
  assert.deepEqual(getDashboardWorks(works, { kind: '长篇' }).map(work => work.id), [main.id, imported.id]);
  assert.deepEqual(getDashboardWorks(works, { kind: '短篇' }).map(work => work.id), [short.id]);
  assert.deepEqual(getDashboardWorks(works, { kind: '剧本' }).map(work => work.id), [script.id]);
  assert.deepEqual(getDashboardWorks(works, { sort: 'words' }).map(work => work.id), [main.id, script.id, imported.id, short.id]);
  assert.equal(JSON.stringify(works), snapshot, 'Filtering and sorting must not mutate props');
  assert.equal(dashboardProgress(main), null, 'Stored seed progress without a real target must not be displayed');
  assert.deepEqual(dashboardProgress({ ...main, targetWords: 20 }), { words: 6, target: 20, percent: 30 }, 'Progress must come from real words and target, never stored sample percentages');
  assert.equal(dashboardProgress({ ...main, targetWords: 0 }), null);
  assert.equal(dashboardProgress({ ...main, targetWords: 5 }).percent, 100);
  assert.equal(dashboardDisplayName({ username: '真实笔名' }), '真实笔名');
  assert.equal(dashboardDisplayName({ username: 'fixture@example.invalid' }), '创作者');
  assert.equal(dashboardDisplayName({ username: '13800000000' }), '创作者');
  assert.equal(dashboardDisplayName({ username: '手机用户_fixture' }), '创作者');
  assert.equal(dashboardGreeting(new Date('2026-11-04T00:00:00Z')), '早上好');
  assert.equal(dashboardGreeting(new Date('2026-11-04T06:00:00Z')), '下午好');
  assert.equal(dashboardGreeting(new Date('2026-11-04T12:00:00Z')), '晚上好');
  assert.equal(dashboardGreeting(new Date('invalid')), '欢迎回来');

  const mount = async (list = works, extra = {}) => {
    if (renderer) await act(async () => renderer.unmount());
    await act(async () => {
      renderer = TestRenderer.create(React.createElement(AccountContext.Provider, { value: { ready: true, configured: true, user: { id: 'fixture-author', username: '测试作者' }, spaceId: 'fixture-author' } }, React.createElement(Dashboard, {
        works: list, navigate: route => routes.push(route), setModal: modal => modals.push(modal), notify: message => notices.push(message), onImport: () => importCount++, openWork: work => opened.push(work), tasks: [], onTasksChange: value => taskWrites.push(value), activity,
        rightRail: React.createElement('div', { 'aria-label': 'Controlled insights slot' }, '创作概览'), ...extra,
      })));
    });
  };
  const click = async node => act(async () => node.props.onClick());
  const buttonByText = (scope, label) => scope.findAllByType('button').find(node => text(node) === label);
  const cards = () => renderer.root.findAll(node => node.type === 'article' && node.props.className?.startsWith('workspace-dashboard-work '));
  const tabs = () => renderer.root.findByProps({ 'aria-label': '作品类型' });
  await mount();
  assert.equal(cards().length, 4);
  assert(!text(renderer.toJSON()).includes(deleted.title));
  assert(text(renderer.toJSON()).includes('测试作者'));
  const layout = renderer.root.findByProps({ className: 'workspace-dashboard-layout' });
  const mainColumn = renderer.root.findByProps({ className: 'workspace-dashboard-main-column' });
  assert.equal(mainColumn.parent, layout);
  assert.equal(renderer.root.findByProps({ className: 'workspace-dashboard-welcome' }).parent, mainColumn, 'The right rail starts beside the welcome, not underneath quick actions');
  assert.equal(renderer.root.findByProps({ className: 'workspace-dashboard-quick-actions', 'aria-label': '开始创作' }).parent, mainColumn);
  assert.equal(renderer.root.findByProps({ className: 'workspace-dashboard-right-rail', 'aria-label': '创作概览与计划' }).parent, layout);

  const actions = renderer.root.findByProps({ 'aria-label': '开始创作' }).findAllByType('button');
  assert.equal(actions.length, 5);
  await click(actions[0]);
  assert.deepEqual(modals.at(-1), { type: 'create', kind: '长篇小说' });
  for (const [index, id] of [[1, 'outline'], [2, 'character'], [3, 'continue'], [4, 'polish']]) {
    await click(actions[index]);
    assert.equal(modals.at(-1).type, 'tool');
    assert.equal(modals.at(-1).tool, tools.find(tool => tool.id === id), 'Quick actions must open the real tool object without running it');
  }
  await click(buttonByText(tabs(), '短篇'));
  assert.equal(cards().length, 1);
  assert(text(cards()[0]).includes(short.title));
  await click(buttonByText(tabs(), '剧本'));
  assert.equal(cards().length, 1);
  assert(text(cards()[0]).includes(script.title));
  await click(renderer.root.findByProps({ 'aria-label': '列表视图' }));
  assert.equal(renderer.root.findByProps({ 'aria-label': '列表视图' }).props['aria-pressed'], true);
  assert(renderer.root.findByProps({ className: 'workspace-dashboard-works workspace-dashboard-works-list' }));
  await click(renderer.root.findByProps({ 'aria-label': `管理作品：${script.title}` }));
  assert.deepEqual(modals.at(-1), { type: 'work-details', work: script }, 'Management must use the existing dialog with its confirmation flow');
  await click(renderer.root.findByProps({ 'aria-label': `打开作品：${script.title}` }));
  assert.equal(opened.at(-1), script);
  await click(buttonByText(tabs(), '全部'));
  await act(async () => renderer.root.findByProps({ 'aria-label': '作品排序' }).props.onChange({ target: { value: 'words' } }));
  assert(text(cards()[0]).includes(main.title));
  await click(renderer.root.findByProps({ 'aria-label': '卡片视图' }));
  assert(renderer.root.findByProps({ className: 'workspace-dashboard-works workspace-dashboard-works-grid' }));
  await click(renderer.root.findByProps({ className: 'workspace-dashboard-import' }));
  assert.equal(importCount, 1);
  await click(buttonByText(renderer.root, '管理全部作品'));
  assert.equal(routes.at(-1), 'works');
  await click(buttonByText(renderer.root, '开启创作对话'));
  assert.equal(routes.at(-1), 'conversation');

  await mount([main], { openWork: undefined });
  await click(renderer.root.findByProps({ 'aria-label': `打开作品：${main.title}` }));
  assert.equal(routes.at(-1), `editor/${main.id}`);
  await click(buttonByText(tabs(), '短篇'));
  assert.equal(cards().length, 0);
  const filteredEmpty = renderer.root.findByProps({ className: 'workspace-dashboard-empty' });
  assert(text(filteredEmpty).includes('还没有短篇作品'));
  await click(buttonByText(filteredEmpty, '查看全部作品'));
  assert.equal(cards().length, 1);

  await mount([]);
  assert.equal(cards().length, 0);
  assert(text(renderer.toJSON()).includes('你的第一部作品，从这里开始'));
  assert(!text(renderer.toJSON()).includes('长街雾未散'), 'An empty account must not be filled with seed manuscripts');
  assert(!text(renderer.toJSON()).includes(main.title), 'Switching to an empty account must not retain another account’s manuscripts');
  assert.deepEqual(network, []);
  assert.deepEqual(storage, []);
  assert.deepEqual(taskWrites, []);
  assert.deepEqual(activity, []);
  assert.equal(JSON.stringify(works), snapshot);
  console.log('PASS dashboard real statistics, stable recency, type/word sorting, grid/list views, five quick actions, existing management/editor routes, top-aligned sidebar, account empty states and no automatic data/API writes');
} finally {
  if (renderer) await act(async () => renderer.unmount());
  await server.close();
  for (const [key, descriptor] of Object.entries(originals)) descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key];
}
