import assert from 'node:assert/strict';
import React, { useState } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { createServer } from 'vite';

// Controlled draft props, explicit action callbacks and provider/storage traps.
// No browser, user account or real service is involved.
const names = ['fetch', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT'];
const originals = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
const requests = [], storageReads = [], storageWrites = [];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.fetch = async url => { requests.push(url); throw Error('The creation page cannot invoke a provider'); };
globalThis.localStorage = { getItem(key) { storageReads.push(key); return null; }, setItem(key) { storageWrites.push(key); } };
const vite = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
let renderer;
try {
  const { default: CreateWorkPage } = await vite.ssrLoadModule('/src/CreateWorkPage.jsx');
  const { createWorkDraft, creationTemplates, workStyles, workTypes } = await vite.ssrLoadModule('/src/createWork.mjs');
  let draft, draftChanges = 0, cancels = 0, behavior = 'success', resolveCreate;
  const created = [], aiRequests = [];
  const text = node => typeof node === 'string' ? node : (node?.children || []).map(text).join('');
  const byLabel = label => renderer.root.findByProps({ 'aria-label': label });
  const button = (scope, label) => scope.findAllByType('button').find(node => node.props['aria-label'] === label || text(node).trim() === label || node.findAllByType('strong').some(strong => text(strong) === label));
  const groupButton = (label, value) => byLabel(label).findAllByType('button').find(node => node.props['aria-label'] === value || text(node).trim().startsWith(value));
  const click = async node => { assert.ok(node, 'Expected a reachable creation control'); await act(async () => node.props.onClick()); };
  const change = async (node, value) => act(async () => node.props.onChange({ target: { value } }));
  const submit = async () => act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }));
  const unmount = async () => { if (renderer) await act(async () => renderer.unmount()); renderer = null; };
  function Harness({ initial = {}, seed }) {
    const [current, setCurrent] = useState(() => createWorkDraft(seed || initial));
    draft = current;
    return React.createElement(CreateWorkPage, {
      initial, draft: current,
      onDraftChange: next => { draftChanges++; setCurrent(next); },
      onCancel: () => { cancels++; },
      onAI: value => { aiRequests.push(value); },
      onCreate: async value => {
        created.push(value);
        if (behavior === 'error') throw Error('本次保存未完成，请重试');
        if (behavior === 'pending') await new Promise(resolve => { resolveCreate = resolve; });
      },
    });
  }
  const mount = async props => { await unmount(); await act(async () => { renderer = TestRenderer.create(React.createElement(Harness, props)); }); };

  await mount({});
  assert.equal(byLabel('作品名称').props.maxLength, 50); assert.equal(byLabel('作品简介').props.maxLength, 500);
  assert.equal(draftChanges, 0, 'Mounting the form must not change a parent draft or write a workspace');
  assert.equal(created.length, 0); assert.equal(aiRequests.length, 0);
  assert.equal(renderer.root.findByType('form').props.noValidate, true);
  await submit(); assert.equal(created.length, 0); assert.equal(byLabel('作品名称').props['aria-invalid'], true);
  await change(byLabel('作品名称'), '字'.repeat(51)); await submit(); assert.equal(created.length, 0, 'Overlength names are rejected even when a scripted input bypasses maxLength');
  await change(byLabel('作品名称'), '字'.repeat(50)); await change(byLabel('作品简介'), '介'.repeat(500));
  assert.ok(/500\s*\/\s*500/.test(text(renderer.root)), 'The description counter reflects the actual 500 characters');
  await submit(); assert.equal(created.length, 1); assert.equal(created.at(-1).title.length, 50); assert.equal(created.at(-1).description.length, 500); assert.equal(created.at(-1).text, '', 'Ordinary creation starts with an empty manuscript');
  await change(byLabel('作品简介'), '介'.repeat(501)); await submit(); assert.equal(created.length, 1); assert.equal(byLabel('作品简介').props['aria-invalid'], true);
  await change(byLabel('作品名称'), '  我自己的小说  '); await change(byLabel('作品简介'), '简介由作者自己填写。');
  const types = byLabel('作品类型'); assert.equal(types.findAllByType('button').length, 3, 'Only the three implemented work types are offered');
  for (const {label, value: kind} of workTypes) {
    await click(groupButton('作品类型', label)); assert.equal(draft.kind, kind); assert.equal(groupButton('作品类型', label).props['aria-pressed'], true); await submit(); assert.equal(created.at(-1).kind, kind); assert.equal(created.at(-1).title, '我自己的小说');
  }
  console.log('PASS accessible title/description limits and live counter, required validation, three real work types and empty-prose creation payload');

  const genres = byLabel('题材方向').findAllByType('button'); assert.ok(genres.length >= 4);
  const genre = text(genres[1]).trim(); await click(genres[1]); assert.equal(draft.genre, genre);
  const moreGenre = byLabel('更多题材'), genreOption = moreGenre.findAllByType('option').find(option => option.props.value && option.props.value !== draft.genre);
  assert.ok(genreOption); await change(moreGenre, genreOption.props.value); assert.equal(draft.genre, genreOption.props.value);
  const beforeEmptyGenre = draft.genre; await change(byLabel('更多题材'), ''); assert.equal(draft.genre, beforeEmptyGenre, 'The disabled placeholder must not become a blank genre');
  for (const style of workStyles.slice(0, 3)) await click(groupButton('写作风格', style));
  assert.equal(draft.styles.length, 3);
  const chosenStyles = [...draft.styles]; await click(groupButton('写作风格', workStyles[3])); assert.deepEqual(draft.styles, chosenStyles, 'A fourth style cannot silently replace the three user choices');
  await click(groupButton('写作风格', workStyles[0])); assert.equal(draft.styles.length, 2);
  const moreStyles = byLabel('更多写作风格'), styleOption = moreStyles.findAllByType('option').find(option => option.props.value && !draft.styles.includes(option.props.value));
  assert.ok(styleOption); await change(moreStyles, styleOption.props.value); assert.ok(draft.styles.includes(styleOption.props.value)); assert.equal(draft.styles.length, 3);
  const beforeEmptyStyle = [...draft.styles]; await change(byLabel('更多写作风格'), ''); assert.deepEqual(draft.styles, beforeEmptyStyle);
  await mount({ initial: { kind: '短篇故事', genre: '作者原有题材', idea: '旧入口传来的故事灵感' } });
  assert.equal(draft.kind, '短篇故事'); assert.equal(draft.genre, '作者原有题材'); assert.equal(byLabel('作品简介').props.value, '旧入口传来的故事灵感');
  assert.ok(renderer.root.findAllByType('option').some(option => option.props.value === '作者原有题材') || text(byLabel('题材方向')).includes('作者原有题材'), 'A legacy custom genre remains selectable instead of being discarded');
  console.log('PASS real genre selection, valid more-options, max-three styles and legacy kind/idea/custom-genre preservation');

  assert.equal(creationTemplates.length, 4);
  for (const template of creationTemplates) {
    await mount({});
    const templateGroup = byLabel('创作模板'); assert.equal(templateGroup.findAllByType('button').length, 4);
    await click(byLabel(`使用${template.name}`));
    assert.equal(byLabel(`使用${template.name}`).props['aria-pressed'], true);
    assert.equal(templateGroup.findAllByType('button').filter(node => node.props['aria-pressed']).length, 1);
    assert.equal(draft.templateId, template.id); assert.equal(draft.genre, template.genre); assert.deepEqual(draft.styles, template.styles);
    await change(byLabel('作品名称'), `模板作品-${template.id}`); await submit();
    const result = created.at(-1);
    assert.equal(result.templateId, template.id); assert.equal(result.genre, template.genre); assert.deepEqual(result.styles, template.styles);
    assert.equal(result.outline, template.outline); assert.equal(result.characters, template.characters); assert.equal(result.notes, template.notes); assert.equal(result.text, '');
  }
  const personal = { title: '不许覆盖我的书名', description: '不许覆盖我的简介', kind: '短篇故事', genre: '现实', styles: ['轻松'], outline: '我确认的大纲', characters: '我确认的人物', notes: '我自己的笔记' };
  await mount({ seed: personal }); await click(byLabel(`使用${creationTemplates[0].name}`));
  for (const key of ['title', 'description', 'kind', 'outline', 'characters', 'notes']) assert.equal(draft[key], personal[key], `Template selection cannot overwrite a user-authored ${key}`);
  const beforeAI = { ...draft, styles: [...draft.styles] }, beforeCreateCount = created.length;
  await click(button(renderer.root, 'AI 帮我构思')); assert.deepEqual(aiRequests.at(-1), beforeAI); assert.equal(created.length, beforeCreateCount); assert.deepEqual(draft, beforeAI);
  await click(button(renderer.root, '取消')); await click(button(renderer.root, '返回上一页')); assert.equal(cancels, 2); assert.equal(created.length, beforeCreateCount); assert.deepEqual(draft, beforeAI);
  console.log('PASS four real template payloads and selected state, preserved author input, and cancel/AI callbacks that neither create nor generate');

  behavior = 'error'; await submit(); assert.equal(created.length, beforeCreateCount + 1); assert.ok(renderer.root.findAllByProps({ role: 'alert' }).length); assert.deepEqual(draft, beforeAI); assert.equal(byLabel('作品名称').props.value, personal.title);
  behavior = 'pending'; let firstSubmit;
  const beforePending = created.length;
  await act(async () => {
    const form = renderer.root.findByType('form');
    firstSubmit = form.props.onSubmit({ preventDefault() {} });
    form.props.onSubmit({ preventDefault() {} });
    await Promise.resolve();
  });
  assert.equal(created.length, beforePending + 1, 'A synchronous double submit must be locked before a render can disable its button');
  assert.equal(byLabel('作品名称').props.disabled, true); assert.equal(byLabel('作品简介').props.disabled, true);
  assert.ok(renderer.root.findAllByType('button').some(node => node.props.type === 'submit' && node.props.disabled));
  await act(async () => { resolveCreate(); await firstSubmit; });
  assert.equal(byLabel('作品名称').props.disabled, false); assert.deepEqual(draft, beforeAI);
  assert.deepEqual(requests, []); assert.deepEqual(storageReads, []); assert.deepEqual(storageWrites, []);
  console.log('PASS failed creation retains the draft, pending creation prevents duplicate submits and the standalone page never reads storage or invokes a model');
} finally {
  if (renderer) await act(async () => renderer.unmount());
  await vite.close();
  for (const [name, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
}
