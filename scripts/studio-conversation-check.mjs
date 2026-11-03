import assert from 'node:assert/strict';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { createServer } from 'vite';

// Real conversation controller, memory-only author records and an intercepted
// provider response. No browser, production account, paid API or real ledger.
const names = ['fetch', 'window', 'document', 'location', 'localStorage', 'requestAnimationFrame', 'cancelAnimationFrame', 'IS_REACT_ACT_ENVIRONMENT'];
const originals = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
const values = new Map(), calls = [], generated = [], storageWrites = [], modals = [];
let renderer, behavior = 'success', held, taskReply = null, reply = '受控创作回复';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem(key, value) { storageWrites.push(key); values.set(key, value); }, removeItem: key => values.delete(key) };
globalThis.window = { innerWidth: 1440, addEventListener() {}, removeEventListener() {}, scrollTo() {}, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) };
globalThis.document = { activeElement: null, body: { style: {} }, querySelector() { return null; }, getElementById() { return null; }, addEventListener() {}, removeEventListener() {} };
globalThis.location = { hash: '#conversation' };
globalThis.requestAnimationFrame = callback => setTimeout(callback, 0); globalThis.cancelAnimationFrame = clearTimeout;
globalThis.fetch = async (url, options = {}) => {
  const body = options.body ? JSON.parse(options.body) : undefined; calls.push({ url, body, method: options.method || 'GET' });
  if (url === '/api/service/status') return Response.json({ configured: true, defaultMode: 'ai', model: 'PRIVATE_PROVIDER_NAME_DO_NOT_SHOW' });
  if (String(url).startsWith('/api/tasks/')) return taskReply ? Response.json(taskReply) : Response.json({ error: '测试任务不存在' }, { status: 404 });
  assert.equal(url, '/api/generate', 'No network or payment endpoint may be reached');
  generated.push(structuredClone(body));
  if (behavior === 'held') return new Promise((resolve, reject) => {
    held = { signal: options.signal, resolve: () => resolve(Response.json({ text: reply, source: 'ai', model: 'PRIVATE_PROVIDER_NAME_DO_NOT_SHOW', requestId: body.requestId })) };
    options.signal.addEventListener('abort', () => reject(new DOMException('Controlled cancellation', 'AbortError')), { once: true });
  });
  return Response.json({ text: reply, source: 'ai', model: 'PRIVATE_PROVIDER_NAME_DO_NOT_SHOW', usage: { totalTokens: 21 }, requestId: body.requestId });
};
const workA = { id: 'studio-work-a', title: '雾港灯塔', kind: '长篇小说', genre: '悬疑', styles: ['成长', '群像'], outline: 'A_ONLY_OUTLINE：调查灯塔。', characters: 'A_ONLY_CHARACTER：不会游泳的修船师。', chapters: [{ id: 'a1', title: '第一章', text: 'A_ONLY_PROSE：人物推开了门。' }] };
const workB = { id: 'studio-work-b', title: '春日归途', kind: '短篇故事', genre: '言情', styles: ['浪漫'], outline: 'B_ONLY_OUTLINE', characters: 'B_ONLY_CHARACTER', chapters: [{ id: 'b1', title: '第一章', text: 'B_ONLY_PROSE' }] };
const beforeWorks = JSON.stringify([workA, workB]);
const mockNode = element => ({ id: element.props.id, label: element.props['aria-label'], scrollHeight: 100, scrollTop: 0, clientHeight: 100, style: {}, focus() { document.activeElement = this; }, scrollIntoView() {}, scrollTo() {}, querySelector() { return null; }, querySelectorAll() { return []; } });
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const vite = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const { HomeConversation } = await vite.ssrLoadModule('/src/HomeConversation.jsx');
  const { default: StudioConversationView } = await vite.ssrLoadModule('/src/StudioConversationView.jsx');
  const { GenerationProvider } = await vite.ssrLoadModule('/src/Generation.jsx');
  const { tools } = await vite.ssrLoadModule('/src/data.js');
  const model = await vite.ssrLoadModule('/src/conversation.js');
  const text = node => typeof node === 'string' ? node : (node?.children || []).map(text).join('');
  const byLabel = label => renderer.root.findByProps({ 'aria-label': label });
  const input = () => byLabel('创作对话输入');
  const view = () => renderer.root.findByType(StudioConversationView);
  const records = () => JSON.parse(values.get('mdd-conversations-v1') || '[]');
  const current = () => records().find(record => record.id === byLabel('对话记录').props.value);
  const turn = () => current()?.turns.at(-1);
  const formFor = node => { if (node.props.form) return renderer.root.findByProps({ id: node.props.form }); let parent = node; while (parent && parent.type !== 'form') parent = parent.parent; return parent; };
  const click = async node => { assert.ok(node, 'Expected a reachable studio control'); await act(async () => { if (node.props.onClick) await node.props.onClick(); else await formFor(node).props.onSubmit({ preventDefault() {} }); }); };
  const button = label => renderer.root.findAllByType('button').find(node => text(node).trim() === label);
  const change = async (node, value) => act(async () => node.props.onChange({ target: { value } }));
  const key = async (key, extra = {}) => act(async () => input().props.onKeyDown({ key, shiftKey: false, isComposing: false, nativeEvent: { isComposing: false }, preventDefault() {}, ...extra }));
  const waitFor = async predicate => { for (let i = 0; i < 100 && !predicate(); i++) await act(async () => sleep(5)); assert.ok(predicate(), 'Expected studio state did not settle'); };
  const select = id => click(renderer.root.findByProps({ 'data-session-id': id }));
  const tree = (props = {}) => React.createElement(GenerationProvider, null, React.createElement(HomeConversation, { appearance: 'studio', works: [workA, workB], work: null, setModal: value => modals.push(value), ...props }));
  const unmount = async () => { if (renderer) await act(async () => renderer.unmount()); renderer = null; };
  const mount = async saved => { await unmount(); values.clear(); values.set('mdd-ai-mode', 'ai'); values.set('mdd-conversations-v1', JSON.stringify(saved)); await act(async () => { renderer = TestRenderer.create(tree(), { createNodeMock: mockNode }); await sleep(0); }); };
  const requestFor = (prompt, workId = '', id = crypto.randomUUID()) => ({ task: 'chat', requestId: id, prompt, context: { history: [], ...(workId ? { workId } : {}) }, mode: 'standard', target: 1000 });
  const now = Date.now(), dates = [now, now - 86400000, now - 4 * 86400000].map(at => new Date(at).toISOString());
  const base = (id, title, at, workId = '', draft = '') => ({ ...model.createConversation({ workId, draft }), id, title, createdAt: at, updatedAt: at });
  const today = base('studio-today', '今天保存的讨论', dates[0], '', '今日未发草稿');
  let yesterday = base('studio-yesterday', '昨天保存的讨论', dates[1], workA.id, '昨日未发草稿');
  const oldRequest = requestFor('昨日未完成的问题', workA.id);
  yesterday = model.beginConversationTurn(yesterday, { userText: oldRequest.prompt, request: oldRequest });
  yesterday = model.failConversationTurn(yesterday, yesterday.turns[0].id, { status: 'interrupted', error: '昨日的受控中断' });
  yesterday = { ...yesterday, title: '昨天保存的讨论', draft: '昨日未发草稿', createdAt: dates[1], updatedAt: dates[1], turns: yesterday.turns.map(item => ({ ...item, createdAt: dates[1], updatedAt: dates[1] })) };
  const earlier = base('studio-earlier', '更早保存的讨论', dates[2], '', '更早未发草稿');
  await mount([earlier, yesterday, today]);
  assert.equal(generated.length, 0, 'Mounting studio must never generate');
  assert.equal(storageWrites.filter(key => key === 'mdd-conversations-v1').length, 0, 'A plain history view must not manufacture sessions');
  assert.deepEqual(view().props.historyGroups.map(group => [group.label, group.items.map(item => item.id)]), [['今天', [today.id]], ['昨天', [yesterday.id]], ['更早', [earlier.id]]]);
  for (const label of ['今天', '昨天', '更早']) assert.ok(byLabel(label).findByType('h2'));
  assert.equal(input().props.value, today.draft); assert.equal(renderer.root.findByProps({ 'data-session-id': today.id }).props['aria-current'], 'page');
  await change(input(), '今日更新后未发送的草稿'); await select(yesterday.id);
  assert.equal(input().props.value, yesterday.draft); assert.equal(records().find(item => item.id === today.id).draft, '今日更新后未发送的草稿');
  const original = structuredClone(records().find(item => item.id === yesterday.id));
  await click(byLabel('重命名对话')); assert.equal(byLabel('对话名称').props.maxLength, 80);
  for (const invalid of [' ', '名'.repeat(81)]) { await change(byLabel('对话名称'), invalid); await click(byLabel('保存对话名称')); assert.equal(records().find(item => item.id === yesterday.id).title, original.title); }
  const renamedTitle = '名'.repeat(80); await change(byLabel('对话名称'), renamedTitle); await click(byLabel('保存对话名称'));
  const renamed = records().find(item => item.id === yesterday.id);
  assert.equal(renamed.title, renamedTitle); assert.equal(renamed.id, original.id); assert.equal(renamed.workId, original.workId); assert.deepEqual(renamed.turns, original.turns); assert.deepEqual(renamed.referenceIds, original.referenceIds); assert.equal(renamed.draft, original.draft); assert.ok(!Object.hasOwn(renamed, 'preview'), 'Derived history display fields must never enter persisted records');
  await click(byLabel('重命名对话')); await change(byLabel('对话名称'), '取消的名称'); await click(byLabel('取消重命名')); assert.equal(current().title, renamedTitle);
  console.log('PASS real today/yesterday/older grouping, history selection/draft isolation and bounded metadata-only persisted rename');

  await click(byLabel('新建对话')); assert.equal(input().props.value, ''); assert.equal(byLabel('对话关联作品').props.value, workA.id);
  await change(input(), '新会话自己的待发草稿'); await select(today.id);
  const scratch = records().find(item => item.draft === '新会话自己的待发草稿'); assert.ok(scratch); assert.notEqual(scratch.id, today.id); assert.equal(input().props.value, '今日更新后未发送的草稿');
  await select(scratch.id); assert.equal(input().props.value, '新会话自己的待发草稿');
  const namedScratch = '首轮前手动命名的讨论'; await click(byLabel('重命名对话')); await change(byLabel('对话名称'), namedScratch); await click(byLabel('保存对话名称'));
  const firstQuestion = '请先梳理灯塔悬疑故事的主角目标。'; await change(input(), firstQuestion);
  for (const event of [{ shiftKey: true }, { isComposing: true }, { nativeEvent: { isComposing: true } }, { keyCode: 229 }, { nativeEvent: { keyCode: 229 } }]) await key('Enter', event);
  assert.equal(generated.length, 0, 'IME and newline gestures do not send');
  reply = '## 故事方向\n\n先让**主角**采取行动。\n\n- 找到线索\n- 付出代价\n\n| 人物 | 目标 |\n| --- | --- |\n| 主角 | 查证 |\n\n`保留事实`\n\n<script>window.INJECTED=true</script>\n<img src=x onerror=alert(1)>\n[危险链接](javascript:alert(1))';
  await key('Enter'); await waitFor(() => turn()?.status === 'completed');
  assert.equal(generated.length, 1); assert.equal(generated[0].task, 'chat'); assert.equal(generated[0].prompt, firstQuestion); assert.equal(generated[0].context.workId, workA.id); assert.deepEqual(generated[0].context.history, []);
  assert.ok(JSON.stringify(generated[0].context).includes('A_ONLY_OUTLINE')); assert.ok(!JSON.stringify(generated[0].context).includes('B_ONLY_'));
  assert.equal(current().title, namedScratch, 'A manually named zero-turn scratch must keep its title after the first send');
  const rich = renderer.root.findAllByProps({ className: 'conversation-rich-text' }).at(-1); assert.ok(rich);
  assert.ok(rich.findAllByType('h2').length && rich.findAllByType('strong').length && rich.findAllByType('ul').length && rich.findAllByType('table').length && rich.findAllByType('code').length);
  for (const tag of ['script', 'img', 'iframe', 'a']) assert.equal(rich.findAllByType(tag).length, 0, `Reply content must not create ${tag} elements`);
  assert.ok(text(rich).includes('<script>window.INJECTED=true</script>')); assert.ok(text(rich).includes('javascript:alert(1)'));
  const firstReply = reply; reply = '第二轮受控回复，承接上一次讨论。'; await change(input(), '把这个目标变成一次有代价的选择。'); await click(byLabel('发送创作消息')); await waitFor(() => turn()?.status === 'completed');
  assert.equal(generated.length, 2); assert.deepEqual(generated.at(-1).context.history, [{ role: 'user', content: firstQuestion }, { role: 'assistant', content: firstReply }]);
  assert.ok(!text(renderer.root).includes('PRIVATE_PROVIDER_NAME_DO_NOT_SHOW')); assert.ok(!renderer.root.findAllByType('button').some(node => /联网|网络搜索|分享对话|分享会话/.test(text(node))));
  console.log('PASS studio IME/Enter behavior, one real mock-provider round plus follow-up history, retained scratch rename and safe rich reply elements without provider disclosure');

  const tabs = byLabel('创作工具分类'); assert.deepEqual(tabs.findAllByProps({ role: 'tab' }).map(text), ['创作辅助', '内容优化', '素材灵感']);
  await act(async()=>tabs.findAllByProps({role:'tab'})[0].props.onKeyDown({key:'ArrowRight',preventDefault(){}}));
  assert.equal(tabs.findAllByProps({role:'tab'})[1].props['aria-selected'],true);
  assert.equal(tabs.findAllByProps({role:'tab'}).filter(node=>node.props.tabIndex===0).length,1);
  await act(async()=>tabs.findAllByProps({role:'tab'})[1].props.onKeyDown({key:'Home',preventDefault(){}}));
  assert.equal(tabs.findAllByProps({role:'tab'})[0].props['aria-selected'],true);
  const unchangedCount = generated.length;
  await change(input(), '我正在写的输入不能被工具静默替换。');
  const groups = [
    ['创作辅助', [['生成小说大纲', 'outline'], ['人物设定', 'character'], ['情节续写', 'continue'], ['对白打磨', 'dialogue']]],
    ['内容优化', [['润色修改', 'polish'], ['章节审稿', 'review']]],
    ['素材灵感', [['故事灵感', 'ideas'], ['书名与简介', 'title']]],
  ];
  for (const [name, entries] of groups) {
    await click(button(name)); assert.equal(button(name).props['aria-selected'], true);
    for (const [label, id] of entries) { await click(byLabel(`打开${label}`)); const modal = modals.at(-1); assert.equal(modal.type, 'tool'); assert.deepEqual(modal.tool, tools.find(tool => tool.id === id)); assert.equal(modal.workId, workA.id); assert.equal(modal.chapterId, 'a1'); assert.equal(modal.prompt, input().props.value.trim()); assert.equal(modal.autoGenerate, undefined); }
  }
  await click(button('创作辅助')); const authoredDraft = input().props.value;
  await click(byLabel('打开世界观设定')); assert.equal(input().props.value, authoredDraft); assert.ok(button('替换当前输入')); await click(button('保留当前输入')); assert.equal(input().props.value, authoredDraft);
  await click(byLabel('打开世界观设定')); await click(button('替换当前输入')); assert.match(input().props.value, /世界观.*规则/); assert.equal(generated.length, unchangedCount);
  const beforeDisclosure = JSON.stringify(records()), writeCount = storageWrites.length;
  for (const label of ['展开或收起对话历史', '展开或收起创作工具']) { const details = byLabel(label).parent; await act(async () => details.props.onToggle({ currentTarget: { open: false } })); await act(async () => details.props.onToggle({ currentTarget: { open: true } })); }
  assert.equal(JSON.stringify(records()), beforeDisclosure); assert.equal(storageWrites.length, writeCount, 'Rail disclosure changes must remain local presentation state');
  console.log('PASS three toolbox tabs and eight real tool payloads, explicit world-prompt replacement confirmation, and disclosure changes without generation or persistence');

  behavior = 'held'; await change(input(), '需要显式停止的第三轮问题');
  await act(async () => { void formFor(byLabel('发送创作消息')).props.onSubmit({ preventDefault() {} }); await sleep(0); }); await waitFor(() => Boolean(held));
  const beforeStop = generated.length; await key('Enter'); assert.equal(generated.length, beforeStop);
  await click(byLabel('取消本次对话')); await waitFor(() => ['cancelled', 'interrupted'].includes(turn()?.status));
  const stopped = structuredClone(turn()); assert.equal(held.signal.aborted, true); behavior = 'success'; held = null;
  taskReply = { status: 'failed', task: 'chat', request: stopped.request, error: '已确认的受控失败' };
  await click(byLabel(`恢复创作回复 ${stopped.id}`)); assert.equal(generated.length, beforeStop, 'Checking the previous result does not resend it');
  reply = '确认失败后显式重试的回复。'; await click(byLabel(`重试创作消息 ${stopped.id}`)); await waitFor(() => turn()?.status === 'completed');
  assert.equal(generated.length, beforeStop + 1); assert.equal(turn().id, stopped.id); assert.notEqual(turn().requestId, stopped.requestId);

  behavior = 'held'; held = null; await change(input(), '关联作品被删除时必须停止');
  await act(async () => { void formFor(byLabel('发送创作消息')).props.onSubmit({ preventDefault() {} }); await sleep(0); }); await waitFor(() => Boolean(held));
  const pending = held, orphanCount = generated.length;
  await act(async () => renderer.update(tree({ works: [workB] }))); await waitFor(() => ['cancelled', 'interrupted'].includes(turn()?.status));
  assert.equal(pending.signal.aborted, true); assert.equal(input().props.disabled, true); assert.equal(byLabel('发送创作消息').props.disabled, true);
  const orphaned = turn(), callsBeforeOrphanAction = calls.length;
  const recovery = byLabel(`恢复创作回复 ${orphaned.id}`); assert.equal(recovery.props.disabled, true);
  await click(recovery); await act(async () => formFor(input()).props.onSubmit({ preventDefault() {} }));
  assert.equal(calls.length, callsBeforeOrphanAction, 'Orphaned scope cannot recover/retry or send even through a retained callback'); assert.equal(generated.length, orphanCount);
  for (const node of renderer.root.findAllByType('button').filter(node => /^(?:打开|用于故事规划 |交给写作工具 )/.test(node.props['aria-label'] || ''))) assert.equal(node.props.disabled, true);
  assert.equal(JSON.stringify([workA, workB]), beforeWorks);
  console.log('PASS stop/check/explicit retry through the unchanged controller and orphan-scope cancellation with send, recovery and tool guards');
} finally {
  if (renderer) await act(async () => renderer.unmount());
  await vite.close();
  for (const [name, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
}
