import assert from 'node:assert/strict';
import React, { useState } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { createServer } from 'vite';

// Authored fixtures, a memory renderer and a captured TXT download only.
// No user workspace, browser automation, filesystem documents or providers.
const globals = ['fetch', 'localStorage', 'document', 'IS_REACT_ACT_ENVIRONMENT'];
const originals = new Map(globals.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
const originalCreateUrl = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
const originalRevokeUrl = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
const requests = [], reads = [], writes = [], blobs = new Map(), downloads = [], revoked = [];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.fetch = async url => { requests.push(url); throw Error('A work library action cannot generate or call a provider'); };
globalThis.localStorage = { getItem(key) { reads.push(key); return null; }, setItem(key) { writes.push(key); } };
globalThis.document = { body: { appendChild() {} }, createElement(tag) { assert.equal(tag, 'a'); return { style: {}, remove() {}, click() { downloads.push({ href: this.href, name: this.download }); } }; } };
Object.defineProperty(URL, 'createObjectURL', { configurable: true, value(blob) { const url = `blob:fixture-work-${blobs.size + 1}`; blobs.set(url, blob); return url; } });
Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: url => revoked.push(url) });
const makeWork = (id, title, kind, status, words, updatedAt, extra = {}) => ({
  id, title, kind, genre: '现实', status, description: `独立简介 ${id}`, cover: 'plain',
  chapters: [{ id: `${id}-1`, title: `第一章 ${title}`, text: '字'.repeat(words) }],
  ...(updatedAt ? { updatedAt } : {}), ...extra,
});
const main = makeWork('long-main', '一叶书', '长篇小说', 'writing', 10, '2026-11-02T01:00:00Z', { genre: '悬疑', description: 'ALPHA 独有简介', targetWords: 20, progress: 97 });
const short = makeWork('short-draft', '归途', '短篇故事', 'draft', 4, '2026-11-04T01:00:00Z', { genre: '言情', progress: 88 });
const script = makeWork('script-complete', '沉默场', '剧本', 'completed', 6, '2026-11-03T01:00:00Z');
const serial = makeWork('long-serial', '山海未归', '长篇小说', 'serializing', 8, '2026-11-01T01:00:00Z', { genre: '玄幻', description: '青色山川', targetWords: 4 });
const undated = makeWork('legacy-undated', '无日期旧作', '长篇小说', undefined, 3, undefined, { updated: '今天 10:42', progress: 89 });
const trashed = makeWork('trashed', '回收站真实稿', '短篇故事', 'draft', 7, '2026-11-05T01:00:00Z', { deletedAt: '2026-11-05T01:00:00Z' });
const fixtures = [main, undated, short, serial, script, trashed];
const snapshot = JSON.stringify(fixtures);
const vite = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
let renderer;
try {
  const { WorksPage } = await vite.ssrLoadModule('/src/Library.jsx');
  const { WorkDetailsDialog } = await vite.ssrLoadModule('/src/WorkManagement.jsx');
  const { tools } = await vite.ssrLoadModule('/src/data.js');
  let modal, destination, imports = 0, saved, saveCalls = 0, trashedByForm;
  const restored = [], notices = [];
  const text = node => typeof node === 'string' ? node : (node?.children || []).map(text).join('');
  const byLabel = label => renderer.root.findByProps({ 'aria-label': label });
  const button = (scope, label) => scope.findAllByType('button').find(node => node.props['aria-label'] === label || text(node).trim() === label || node.findAllByType('strong').some(strong => text(strong) === label));
  const groupButton = (group, label) => group.findAllByType('button').find(node => node.props['aria-label'] === label || text(node).trim().startsWith(label));
  const click = async node => { assert.ok(node, 'Expected a reachable work-library control'); await act(async () => node.props.onClick()); };
  const change = async (node, value) => act(async () => node.props.onChange({ target: { value } }));
  const submit = async () => act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }));
  const unmount = async () => { if (renderer) await act(async () => renderer.unmount()); renderer = null; };
  const mount = async element => { await unmount(); await act(async () => { renderer = TestRenderer.create(element); }); };
  const callbacks = { navigate: value => { destination = value; }, setModal: value => { modal = value; }, onImport: () => { imports++; }, notify: value => notices.push(value) };
  function LibraryHarness() {
    const [works, setWorks] = useState(fixtures), [trash, setTrash] = useState([trashed]);
    return React.createElement(WorksPage, { ...callbacks, works, trashWorks: trash, onRestoreWork: work => { restored.push(work); setTrash(previous => previous.filter(item => item.id !== work.id)); setWorks(previous => [...previous, { ...work, deletedAt: undefined }]); } });
  }
  const workOrder = () => renderer.root.findAllByType('button').map(node => node.props['aria-label']).filter(label => fixtures.some(work => label === `管理${work.title}`)).map(label => fixtures.find(work => label === `管理${work.title}`).id);
  const workArticle = work => { let node = byLabel(`管理${work.title}`); while (node && node.type !== 'article') node = node.parent; assert.ok(node); return node; };
  const count = (group, label) => {
    const control = groupButton(group, label); assert.ok(control, `Missing counted category ${label}`);
    const number = text(control).match(/(\d+)\s*$/); assert.ok(number, `${label} needs its actual category count`); return Number(number[1]);
  };

  await mount(React.createElement(LibraryHarness));
  const pageRoot = renderer.root.findByProps({ className: 'works-library-view' });
  assert.ok(pageRoot.findAllByProps({ className: 'novel-library-hero' }).length === 1);
  assert.ok(pageRoot.findAllByProps({ className: 'novel-library-shortcuts', 'aria-label': '创作快捷入口' }).length === 1);
  assert.equal(renderer.root.findAllByProps({ className: 'novel-library' }).length, 0, 'The page must not inherit the legacy novel-card grid layout');
  assert.equal(text(renderer.root.findByType('h1')), '我的作品');
  assert.deepEqual(workOrder(), [short.id, script.id, main.id, serial.id, undated.id], 'Recent sorting uses real ISO dates and leaves unknown dates at the end');
  const kinds = () => byLabel('作品类型'), statuses = () => byLabel('作品状态');
  assert.deepEqual(['全部作品', '长篇小说', '短篇故事', '剧本'].map(label => count(kinds(), label)), [5, 3, 1, 1]);
  assert.deepEqual(['全部状态', '草稿', '创作中', '连载中', '已完结'].map(label => count(statuses(), label)), [5, 1, 2, 1, 1]);
  assert.equal(renderer.root.findAllByProps({ role: 'progressbar' }).length, 2, 'Only genuine targetWords produces a progress bar');
  assert.equal(workArticle(main).findByProps({ role: 'progressbar' }).props['aria-valuenow'], 50);
  assert.equal(workArticle(serial).findByProps({ role: 'progressbar' }).props['aria-valuenow'], 100, 'Actual progress is capped at completion');
  for (const work of [short, undated]) assert.equal(workArticle(work).findAllByProps({ role: 'progressbar' }).length, 0);
  assert.ok(!/97\s*%|88\s*%|89\s*%/.test(text(renderer.root)), 'Stored sample progress must never masquerade as writing data');
  assert.match(text(workArticle(undated)), /编辑时间未记录/);
  assert.ok(!text(workArticle(undated)).includes('今天 10:42'), 'Human display labels cannot invent a sortable date');
  assert.ok(!text(renderer.root).includes(trashed.title), 'Deleted work is absent from the active shelf');
  assert.deepEqual(requests, []); assert.deepEqual(reads, []); assert.deepEqual(writes, []); assert.equal(modal, undefined); assert.equal(destination, undefined); assert.equal(imports, 0);
  console.log('PASS real type/status totals, explicit author states, prose/target progress, actual recent order and no invented legacy dates or initial effects');

  await click(groupButton(kinds(), '长篇小说'));
  assert.deepEqual(workOrder(), [main.id, serial.id, undated.id]);
  assert.deepEqual(['全部状态', '草稿', '创作中', '连载中', '已完结'].map(label => count(statuses(), label)), [3, 0, 2, 1, 0]);
  await click(groupButton(statuses(), '创作中')); assert.deepEqual(workOrder(), [main.id, undated.id]);
  await change(byLabel('搜索作品'), ' alpha '); assert.deepEqual(workOrder(), [main.id], 'Query searches actual descriptions, case-insensitively, within both filters');
  await change(byLabel('搜索作品'), '言情'); assert.deepEqual(workOrder(), [], 'Kind, status and query compose rather than replacing one another');
  await click(button(renderer.root, '清空筛选')); assert.equal(workOrder().length, 5); assert.equal(byLabel('搜索作品').props.value, '');
  assert.equal(groupButton(kinds(), '全部作品').props['aria-pressed'], true); assert.equal(groupButton(statuses(), '全部状态').props['aria-pressed'], true);
  await click(groupButton(kinds(), '剧本')); await click(groupButton(statuses(), '已完结')); assert.deepEqual(workOrder(), [script.id]);
  await click(groupButton(kinds(), '长篇小说')); assert.deepEqual(workOrder(), []);
  assert.equal(groupButton(statuses(), '已完结').props['aria-pressed'], true, 'Changing type preserves the independently selected status');
  await click(groupButton(kinds(), '剧本')); assert.deepEqual(workOrder(), [script.id]);
  await click(groupButton(statuses(), '草稿')); assert.deepEqual(workOrder(), []); await click(button(renderer.root, '清空筛选'));
  await change(byLabel('排序方式'), 'words'); assert.deepEqual(workOrder(), [main.id, serial.id, script.id, short.id, undated.id]);
  await change(byLabel('排序方式'), 'name'); assert.deepEqual(workOrder(), [script.id, short.id, serial.id, undated.id, main.id]);
  await change(byLabel('排序方式'), 'recent');
  await click(byLabel('列表视图')); assert.equal(byLabel('列表视图').props['aria-pressed'], true); assert.equal(byLabel('卡片视图').props['aria-pressed'], false);
  assert.deepEqual(workOrder(), [short.id, script.id, main.id, serial.id, undated.id]);
  await click(byLabel('卡片视图')); assert.equal(byLabel('卡片视图').props['aria-pressed'], true); assert.equal(workOrder().length, 5);
  assert.equal(JSON.stringify(fixtures), snapshot, 'Filtering and sorting cannot mutate the input works');
  console.log('PASS crossing kind/status/search filters, actual facet counts, empty-filter reset, all three orders and grid/list controls');

  const shortcuts = byLabel('创作快捷入口'); assert.equal(shortcuts.findAllByType('button').length, 5);
  modal = undefined; await click(button(shortcuts, '新建小说')); assert.equal(modal.type, 'create'); assert.equal(modal.kind, '长篇小说'); assert.notEqual(modal.autoGenerate, true);
  for (const [label, id] of [['生成大纲', 'outline'], ['人物设定', 'character']]) { modal = undefined; await click(button(shortcuts, label)); assert.deepEqual(modal, { type: 'tool', tool: tools.find(tool => tool.id === id) }); }
  await click(button(shortcuts, '世界观设定')); assert.equal(modal.type, 'home-conversation'); assert.match(modal.initialPrompt, /世界观/); assert.match(modal.initialPrompt, /规则/); assert.equal(modal.workId, undefined); assert.notEqual(modal.autoGenerate, true);
  await click(button(shortcuts, '灵感广场')); assert.equal(destination, 'tools');
  await click(button(renderer.root, '导入文稿')); assert.equal(imports, 1);
  await click(byLabel(`继续写作：${main.title}`)); assert.equal(destination, `editor/${main.id}`);
  for (const work of [main, script]) {
    await click(byLabel(`管理${work.title}`)); assert.deepEqual(modal, { type: 'work-details', work });
    await click(byLabel(`导出${work.title}`)); const download = downloads.at(-1), blob = blobs.get(download.href);
    assert.equal(download.name, `${work.title}.txt`); assert.ok(blob instanceof Blob);
    assert.deepEqual([...new Uint8Array(await blob.arrayBuffer()).slice(0, 3)], [239, 187, 191], 'Export keeps a UTF-8 BOM');
    const expected = `${work.title}\n\n${work.chapters.map(chapter => `${chapter.title}\n\n${chapter.text}`).join('\n\n')}`;
    assert.equal((await blob.text()).replace(/^\uFEFF/, ''), expected, 'Export must contain the exact selected work, not the first or currently filtered work');
  }
  await click(byLabel('列表视图')); await click(byLabel(`管理${short.title}`)); assert.equal(modal.work, short); await click(byLabel(`导出${short.title}`)); assert.equal(downloads.at(-1).name, `${short.title}.txt`);
  assert.deepEqual(requests, []); assert.deepEqual(reads, []); assert.deepEqual(writes, []);
  console.log('PASS five real quick actions, explicit creation/import, exact editor/manage targets and selected-work BOM TXT exports without auto-generation');

  await click(button(renderer.root, '回收站（1）')); assert.ok(text(renderer.root).includes(trashed.title));
  await click(byLabel(`恢复${trashed.title}`)); assert.equal(restored.length, 1); assert.equal(restored[0], trashed); assert.match(text(renderer.root), /回收站是空的/);
  await click(button(renderer.root, '返回作品书架')); assert.equal(workOrder().length, 6); assert.ok(workOrder().includes(trashed.id));
  await change(byLabel('搜索作品'), 'UNMATCHED_NO_SUCH_WORK'); assert.equal(workOrder().length, 0); assert.ok(button(renderer.root, '清空筛选')); await click(button(renderer.root, '清空筛选')); assert.equal(workOrder().length, 6);
  await mount(React.createElement(WorksPage, { ...callbacks, works: [], trashWorks: [], onRestoreWork() {} }));
  assert.equal(workOrder().length, 0); assert.match(text(renderer.root), /还没有作品|第一.*(?:故事|作品)/);
  modal = undefined; await click(button(renderer.root, '新建作品')); assert.equal(modal.type, 'create'); assert.notEqual(modal.autoGenerate, true);
  await click(button(renderer.root, '回收站（0）')); assert.match(text(renderer.root), /回收站是空的/);
  console.log('PASS real trash restoration, post-restore counts, search-empty reset and empty-library creation');

  const detailsWork = { ...main, notes: '作者自己的笔记', memory: { version: 1, entries: [] }, versions: [{ id: 'version-one', chapterId: main.chapters[0].id, title: main.chapters[0].title, text: main.chapters[0].text, savedAt: '2026-11-01T01:00:00Z' }] };
  await mount(React.createElement(WorkDetailsDialog, { work: detailsWork, onSave: value => { saved = value; saveCalls++; }, onTrash: value => { trashedByForm = value; } }));
  assert.deepEqual(byLabel('作品状态').findAllByType('option').map(option => option.props.value), ['draft', 'writing', 'serializing', 'completed']);
  assert.equal(byLabel('作品状态').props.value, 'writing'); assert.equal(byLabel('目标字数').props.value, 20); assert.equal(Number(byLabel('目标字数').props.min), 1); assert.equal(Number(byLabel('目标字数').props.max), 100000000); assert.equal(Number(byLabel('目标字数').props.step), 1);
  for (const status of ['draft', 'writing', 'serializing', 'completed']) { await change(byLabel('作品状态'), status); await submit(); assert.equal(saved.status, status); assert.deepEqual(saved.chapters, detailsWork.chapters); assert.deepEqual(saved.memory, detailsWork.memory); assert.deepEqual(saved.versions, detailsWork.versions); assert.equal(saved.notes, detailsWork.notes); }
  for (const target of ['1', '25000', '100000000']) { await change(byLabel('目标字数'), target); await submit(); assert.equal(saved.targetWords, Number(target)); }
  await change(byLabel('目标字数'), ''); await submit(); assert.equal(saved.targetWords, undefined, 'Clearing a target removes the displayed percentage contract');
  for (const target of ['0', '-1', '1.5', '100000001', 'Infinity', 'abc']) { const before = saveCalls; await change(byLabel('目标字数'), target); await submit(); assert.equal(saveCalls, before); assert.ok(renderer.root.findAllByProps({ role: 'alert' }).length); assert.equal(byLabel('目标字数').props.value, target, 'Invalid target remains editable for correction'); }
  await change(byLabel('目标字数'), '30000'); await submit(); assert.equal(saved.targetWords, 30000); assert.equal(renderer.root.findAllByProps({ role: 'alert' }).length, 0);
  await click(button(renderer.root, '移入回收站')); assert.equal(trashedByForm, undefined, 'Trash action keeps the existing confirmation step'); await click(button(renderer.root, '确认移入回收站')); assert.equal(trashedByForm, detailsWork);
  assert.deepEqual(requests, []); assert.deepEqual(reads, []); assert.deepEqual(writes, []); assert.equal(JSON.stringify(fixtures), snapshot);
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 1100)); });
  for (const download of downloads) assert.ok(revoked.includes(download.href), 'Temporary export URLs are revoked');
  console.log('PASS author-set statuses, valid/cleared/bounded target input, preserved manuscript metadata and confirmation without storage or provider side effects');
} finally {
  if (renderer) await act(async () => renderer.unmount());
  await vite.close();
  if (originalCreateUrl) Object.defineProperty(URL, 'createObjectURL', originalCreateUrl); else delete URL.createObjectURL;
  if (originalRevokeUrl) Object.defineProperty(URL, 'revokeObjectURL', originalRevokeUrl); else delete URL.revokeObjectURL;
  for (const [name, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
}
