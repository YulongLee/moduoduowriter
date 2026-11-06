import assert from 'node:assert/strict';
import React, { useState } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { createServer } from 'vite';
import {
  activeWorkspaceWorks, buildWorkspaceActivityDays, MAX_ACTIVITY_ENTRIES, MAX_TASK_TEXT_LENGTH,
  MAX_WORKSPACE_TASKS, normalizeWorkspaceTasks, recordWorkspaceActivity, shiftWorkspaceMonth,
  toActivityDate, workspaceCalendarCells, workspaceSnapshotStats,
} from '../src/workspaceActivity.mjs';

// Only authored fixtures and memory rendering. No account data, browser, disk
// workspace, model, billing, storage or other provider is used by this test.
assert.equal(toActivityDate('2026-11-03T15:59:59Z'), '2026-11-03');
assert.equal(toActivityDate('2026-11-03T16:00:00Z'), '2026-11-04');
assert.equal(toActivityDate('2026-11-04T01:00:00+08:00'), '2026-11-04');
assert.equal(toActivityDate('2024-02-29'), '2024-02-29');
for (const value of ['刚刚', '今天 10:42', '昨天', '11月4日', '2026-02-30', '2025-02-29', '2026-02-30T12:00:00Z', '2026-11-04T25:00:00Z', '2026-11-04T12:00:00', undefined, null, 123]) {
  assert.equal(toActivityDate(value), null, `Do not infer an editing date from ${String(value)}`);
}
const fixtureWorks = [
  { id: 'one', createdAt: '2026-11-01T01:00:00Z', updatedAt: '2026-11-03T18:00:00Z', updated: '昨天', outline: '大纲不计入正文', characters: '人物设定不计入正文', chapters: [{ text: '甲 乙\n丙' }, { text: '' }, { text: '已删除章节不计入', deletedAt: '2026-11-01' }] },
  { id: 'two', updated: '今天', chapters: [{ text: '丁戊' }] },
  { id: 'deleted', deletedAt: '2026-11-01', updatedAt: '2026-11-02T01:00:00Z', chapters: [{ text: '回收站正文不计入' }] },
];
const fixtureBefore = JSON.stringify(fixtureWorks);
assert.equal(activeWorkspaceWorks(fixtureWorks).length, 2);
assert.deepEqual(workspaceSnapshotStats(fixtureWorks), { works: 2, chapters: 3, words: 5 });
assert.deepEqual(workspaceSnapshotStats([]), { works: 0, chapters: 0, words: 0 });
assert.deepEqual(workspaceSnapshotStats([{ id: 'blank', chapters: [null, { text: null }] }]), { works: 1, chapters: 1, words: 0 });
assert.equal(JSON.stringify(fixtureWorks), fixtureBefore, 'Deriving statistics must not modify the works');

let activity = recordWorkspaceActivity([], { workId: 'one', at: '2026-11-03T18:00:00Z', type: 'create' });
const dayId = activity[0].id;
const beforeActivity = JSON.stringify(activity);
const edited = recordWorkspaceActivity(activity, { workId: 'one', at: '2026-11-04T10:00:00Z', type: 'edit' });
assert.equal(JSON.stringify(activity), beforeActivity, 'Recording an edit returns a new list without modifying the prior collection');
assert.equal(edited.length, 1, 'Two edits on the same Beijing natural day produce one marker');
assert.equal(edited[0].id, dayId);
assert.equal(edited[0].type, 'create');
assert.equal(edited[0].at, '2026-11-04T10:00:00.000Z');
activity = recordWorkspaceActivity(edited, { workId: 'one', at: '2026-11-04T09:00:00Z', type: 'import' });
assert.equal(activity.length, 1);
assert.equal(activity[0].type, 'import', 'Import/create classification survives later routine edits');
assert.equal(activity[0].id, dayId);
assert.equal(activity[0].at, '2026-11-04T10:00:00.000Z', 'An older imported event cannot move the last known timestamp backwards');
assert.equal(recordWorkspaceActivity(activity, { workId: 'one', at: '昨天' }), activity);
assert.equal(recordWorkspaceActivity(activity, { workId: 'one', at: '2026-11-04', type: 'opened' }), activity, 'Opening a work is not an editing event');
const nextDay = recordWorkspaceActivity(activity, { workId: 'one', at: '2026-11-04T16:00:00Z' });
assert.equal(nextDay.length, 2);
assert.notEqual(nextDay[0].id, dayId, 'A real edit after Beijing midnight has a new daily ID');
const fullActivity = Array.from({ length: MAX_ACTIVITY_ENTRIES + 10 }, (_, index) => ({ workId: `work-${index}`, at: '2026-11-04T01:00:00Z', type: 'edit' }));
const limited = recordWorkspaceActivity(fullActivity, { workId: 'newest', at: '2026-11-05T01:00:00Z' });
assert.equal(limited.length, MAX_ACTIVITY_ENTRIES);
assert.equal(limited[0].workId, 'newest');
console.log('PASS actual prose statistics, deleted-content exclusion and pure stable daily activity aggregation in Beijing time');

assert.deepEqual(buildWorkspaceActivityDays(fixtureWorks, activity), [
  { date: '2026-11-01', recordedWorks: 0, knownWorks: 1, totalWorks: 1 },
  { date: '2026-11-04', recordedWorks: 1, knownWorks: 0, totalWorks: 1 },
]);
const humanDateWork = { id: 'human-date', updated: '今天 10:42', chapters: [{ text: '甲 乙' }] };
assert.deepEqual(buildWorkspaceActivityDays([humanDateWork], []), [], 'Human-readable snapshot labels must never fabricate a writing history');
assert.deepEqual(buildWorkspaceActivityDays(fixtureWorks, [{ workId: 'deleted', at: '2026-11-02' }, { workId: 'not-in-this-space', at: '2026-11-03' }]), [
  { date: '2026-11-01', recordedWorks: 0, knownWorks: 1, totalWorks: 1 },
  { date: '2026-11-04', recordedWorks: 0, knownWorks: 1, totalWorks: 1 },
], 'Only the active works supplied by the current workspace contribute activity');
const grid = workspaceCalendarCells('2026-11', buildWorkspaceActivityDays(fixtureWorks, activity));
assert.equal(grid.length, 42);
assert.equal(grid.filter(Boolean).length, 30);
assert.equal(grid[6].date, '2026-11-01', 'Calendar weeks start on Monday');
assert.equal(grid.filter(day => day?.recordedWorks).length, 1);
assert.equal(grid.filter(day => day?.knownWorks).length, 1);
assert.ok(grid.filter(day => day && !['2026-11-01', '2026-11-04'].includes(day.date)).every(day => day.recordedWorks === 0 && day.knownWorks === 0));
assert.equal(workspaceCalendarCells('2024-02').filter(Boolean).length, 29);
assert.equal(workspaceCalendarCells('2025-02').filter(Boolean).length, 28);
assert.equal(shiftWorkspaceMonth('2026-12', 1), '2027-01');
assert.equal(shiftWorkspaceMonth('2026-01', -1), '2025-12');
assert.throws(() => shiftWorkspaceMonth('今天', 1), TypeError);
assert.throws(() => shiftWorkspaceMonth('2026-11', 0.5), TypeError);
assert.throws(() => workspaceCalendarCells('2026-13'), TypeError);
console.log('PASS evidence-only calendar distinguishes fallback work dates from records, leaves unknown dates empty and navigates months/leap years');

assert.equal(MAX_WORKSPACE_TASKS, 100);
assert.equal(MAX_TASK_TEXT_LENGTH, 120);
assert.deepEqual(normalizeWorkspaceTasks([{ id: 'one', text: '  完成对白  ', done: true }, { id: 'one', text: 'duplicate' }, { id: 'two', text: '审稿', done: 'yes' }, { id: 'empty', text: ' ' }, { id: 'long', text: '字'.repeat(121) }]), [
  { id: 'one', text: '完成对白', done: true }, { id: 'two', text: '审稿', done: false },
]);
assert.equal(normalizeWorkspaceTasks(Array.from({ length: 105 }, (_, index) => ({ id: String(index), text: `任务${index}` }))).length, 100);

const globalNames = ['IS_REACT_ACT_ENVIRONMENT', 'fetch', 'localStorage'];
const originals = new Map(globalNames.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
let networkCalls = 0, browserReads = 0, browserWrites = 0;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.fetch = async () => { networkCalls++; throw Error('No network/provider is allowed in workspace insight checks'); };
globalThis.localStorage = { getItem() { browserReads++; throw Error('No browser storage is allowed'); }, setItem() { browserWrites++; throw Error('No browser storage is allowed'); } };
const vite = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
let renderer;
try {
  const { default: WorkspaceInsights } = await vite.ssrLoadModule('/src/WorkspaceInsights.jsx');
  const { tools } = await vite.ssrLoadModule('/src/data.js');
  let taskWrites = 0, taskSnapshot = [], modal, route;
  const updaters = [];
  const text = node => typeof node === 'string' ? node : (node?.children || []).map(text).join('');
  const label = value => renderer.root.findByProps({ 'aria-label': value });
  const click = async node => act(async () => node.props.onClick());
  const change = async (node, value) => act(async () => node.props.onChange({ target: { value } }));
  const submitTask = async () => act(async () => renderer.root.findByProps({ className: 'wi-task-form' }).props.onSubmit({ preventDefault() {} }));
  const unmount = async () => { if (renderer) await act(async () => renderer.unmount()); renderer = null; };
  const mount = async element => { await unmount(); await act(async () => { renderer = TestRenderer.create(element); }); };
  function Harness({ initialTasks = [] }) {
    const [tasks, setTasks] = useState(initialTasks);
    taskSnapshot = tasks;
    return React.createElement(WorkspaceInsights, { works: [humanDateWork], tasks, activity: [], onTasksChange: updater => { assert.equal(typeof updater, 'function'); taskWrites++; updaters.push(updater); setTasks(updater); }, setModal: value => { modal = value; }, navigate: value => { route = value; } });
  }

  await mount(React.createElement(Harness));
  assert.equal(taskWrites, 0, 'Mounting a dashboard must not create default tasks or records');
  assert.match(text(renderer.root), /0 \/ 0 已完成/);
  assert.equal(renderer.root.findAllByType('input').filter(node => node.props.type === 'checkbox').length, 0);
  assert.equal(renderer.root.findAllByProps({ 'data-known-date': 'true' }).length, 0);
  const activeCells = () => renderer.root.findAll(node => node.type === 'button' && Number(node.props['data-activity-level']) > 0);
  assert.equal(activeCells().length, 0, 'An undated work cannot produce any active heatmap cells');
  assert.match(text(renderer.root), /不代表完整历史/);
  for (const day of renderer.root.findAll(node => node.type === 'button' && node.props.className?.startsWith('wi-day'))) {
    assert.equal(day.props.title, day.props['aria-label']);
    assert.match(day.props.title, /无已记录活动或已知作品日期/);
    assert.match(day.findByType('time').props.dateTime, /^\d{4}-\d{2}-\d{2}$/);
  }
  const beforeMonth = text(renderer.root.findByProps({ className: 'wi-month-controls' }).findByType('strong'));
  await click(label('查看上个月的创作记录'));
  assert.notEqual(text(renderer.root.findByProps({ className: 'wi-month-controls' }).findByType('strong')), beforeMonth);
  await click(label('查看下个月的创作记录'));
  assert.equal(text(renderer.root.findByProps({ className: 'wi-month-controls' }).findByType('strong')), beforeMonth);
  await click(label('查看上个月的创作记录')); await click(label('回到本月创作记录'));
  assert.equal(text(renderer.root.findByProps({ className: 'wi-month-controls' }).findByType('strong')), beforeMonth);
  const dateButton = renderer.root.findAll(node => node.type === 'button' && node.props.className?.startsWith('wi-day'))[0];
  await click(dateButton);
  assert.equal(renderer.root.findByProps({ className: 'wi-day-detail', role: 'status' }).children.join(''), dateButton.props['aria-label']);
  assert.equal(taskWrites, 0, 'Month/date navigation must not persist tasks or fabricate activity');
  assert.equal(modal, undefined); assert.equal(route, undefined);
  console.log('PASS memory widget mounts with no fake tasks or activity; accessible month/date navigation changes no stored data');

  await submitTask(); assert.equal(taskWrites, 0); assert.ok(renderer.root.findAllByProps({ role: 'alert' }).length);
  await change(label('新增写作任务'), '字'.repeat(121)); await submitTask(); assert.equal(taskWrites, 0); assert.match(text(renderer.root.findByProps({ role: 'alert' })), /120/);
  await change(label('新增写作任务'), '  写好第一场对白  '); await submitTask();
  assert.equal(taskWrites, 1); assert.equal(taskSnapshot.length, 1); assert.equal(taskSnapshot[0].text, '写好第一场对白'); assert.equal(taskSnapshot[0].done, false); assert.ok(taskSnapshot[0].id); assert.ok(toActivityDate(taskSnapshot[0].createdAt));
  assert.equal(label('新增写作任务').props.value, '');
  const twiceA = updaters[0]([]), twiceB = updaters[0]([]);
  assert.equal(twiceA[0].id, twiceB[0].id, 'React may repeat the function updater: its task ID must remain stable');
  const fullTasks = Array.from({ length: 100 }, (_, index) => ({ id: String(index), text: `任务${index}`, done: false }));
  assert.equal(updaters[0](fullTasks), fullTasks, 'Concurrent additions cannot exceed the one-hundred-task bound');
  await act(async () => label('完成任务：写好第一场对白').props.onChange({ target: { checked: true } }));
  assert.equal(taskSnapshot[0].done, true); assert.match(text(renderer.root), /1 \/ 1 已完成/);
  assert.equal(label('写作任务完成进度').props['aria-valuenow'], 1, 'Task progress reflects checked tasks');
  await act(async () => label('完成任务：写好第一场对白').props.onChange({ target: { checked: false } })); assert.equal(taskSnapshot[0].done, false);
  await click(label('删除任务：写好第一场对白')); assert.equal(taskSnapshot.length, 0); assert.match(text(renderer.root), /0 \/ 0 已完成/);
  for (const [name, id] of [['灵感生成', 'ideas'], ['书名与简介', 'title'], ['对白打磨', 'dialogue'], ['章节审稿', 'review']]) {
    await click(label(`打开${name}`));
    assert.deepEqual(modal, { type: 'tool', tool: tools.find(tool => tool.id === id) }, 'A shortcut must open an existing tool without autoGenerate or private implicit context');
  }
  await click(renderer.root.findByProps({ className: 'wi-all-tools' })); assert.equal(route, 'tools');
  await click(label('查看写作课堂')); assert.equal(route, 'learn', 'Growth card opens the existing writing classroom');
  console.log('PASS task add/check/uncheck/remove, text validation, stable single-action IDs and four exact existing-tool payloads without generation');

  const beforeLimitWrites = taskWrites;
  await mount(React.createElement(Harness, { initialTasks: fullTasks }));
  assert.equal(label('添加写作任务').props.disabled, true); assert.equal(label('新增写作任务').props.disabled, true); assert.equal(label('新增写作任务').props.maxLength, 120);
  await change(label('新增写作任务'), '第101个任务'); await submitTask();
  assert.equal(taskWrites, beforeLimitWrites); assert.equal(taskSnapshot.length, 100); assert.match(text(renderer.root.findByProps({ role: 'alert' })), /100/);
  await mount(React.createElement(WorkspaceInsights, { works: [], tasks: [] }));
  assert.equal(label('添加写作任务').props.disabled, true); assert.equal(label('新增写作任务').props.disabled, true, 'No task storage callback means no pretend-save interaction');
  await mount(React.createElement(WorkspaceInsights, { works: [], tasks: [], onTasksChange() { throw Error('fixture-internal-storage-error'); } }));
  await change(label('新增写作任务'), '保存失败时保留的任务'); await submitTask();
  assert.equal(label('新增写作任务').props.value, '保存失败时保留的任务'); assert.match(text(renderer.root.findByProps({ role: 'alert' })), /暂未保存/); assert.ok(!text(renderer.root).includes('fixture-internal-storage-error'));
  console.log('PASS task count limit, unavailable storage and write-error draft preservation without exposing internal errors');

  const now = new Date().toISOString();
  await mount(React.createElement(WorkspaceInsights, { works: [{ ...humanDateWork, createdAt: now }], activity: [], tasks: [] }));
  assert.ok(renderer.root.findAllByProps({ 'data-known-date': 'true' }).length > 0);
  assert.equal(activeCells().length, 0, 'Fallback dates use a separate visual state, never recorded-activity fill');
  assert.match(text(renderer.root.findByProps({ className: 'wi-record-count' })), /0/);
  assert.equal(renderer.root.findAllByProps({ 'data-active': true }).length, 0, 'Known creation dates must not become recorded chart activity');
  const realActivity = recordWorkspaceActivity([], { workId: humanDateWork.id, at: now });
  await mount(React.createElement(WorkspaceInsights, { works: [{ ...humanDateWork, createdAt: now }], activity: realActivity, tasks: [] }));
  assert.equal(activeCells().length, 1); assert.equal(renderer.root.findAllByProps({ 'data-known-date': 'true' }).length, 0); assert.match(activeCells()[0].props['aria-label'], /已记录 1 部作品的活动/);
  assert.equal(renderer.root.findAllByProps({ 'data-active': true }).length, 1, 'Only real recorded activity appears in the recent chart');
  assert.equal(networkCalls, 0); assert.equal(browserReads, 0); assert.equal(browserWrites, 0);
  console.log('PASS known-date versus recorded-activity presentation and zero model/network/browser-storage access throughout');
} finally {
  if (renderer) await act(async () => renderer.unmount());
  await vite.close();
  for (const [name, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
}
