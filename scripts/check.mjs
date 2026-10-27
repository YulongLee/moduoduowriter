import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createServer } from 'vite';

// In-memory component rendering. No browser, external service, or user data is used.
const startupStorageReads=[];
globalThis.localStorage = { getItem(key) { startupStorageReads.push(key);return null; } };
globalThis.location = { hash: '#home' };
const server = await createServer({ server: { middlewareMode: true, hmr:false }, appType: 'custom' });
try {
  const { App, WritingApp } = await server.ssrLoadModule('/src/main.jsx');
  const { BillingProvider } = await server.ssrLoadModule('/src/Billing.jsx');
  const startup=renderToString(React.createElement(App));assert.ok(startup.includes('aria-label="首页创作入口"'),'The public homepage must render before account/private-workspace loading');assert.ok(!startup.includes('搜索作品名称'));assert.equal(startupStorageReads.length,0,'Public app startup cannot read private local collections');
  const pages = [
    ['home', 'aria-label="首页创作入口"'], ['works', '搜索作品名称'],
    ['novels', '小说写作'], ['tools', '写作工具'], ['workflows', '从灵感到黄金三章'],
    ['dismantle', '点击上传 TXT 文稿'], ['scripts', '新建剧本'],
    ['video', '视频相关功能已暂缓'], ['submit', '保存投稿计划'],
    ['history', '生成记录'], ['learn', '写作手记'], ['membership', '会员与墨点'], ['service-admin','本机服务管理'], ['editor/fog', '章节正文'],
    ['editor/spring', '等风也等你'], ['editor/orbit', '第七次日落']
  ];
  for (const [route, expected] of pages) {
    globalThis.location.hash = `#${route}`;
    const html = renderToString(React.createElement(BillingProvider,null,React.createElement(WritingApp)));
    assert.ok(html.includes(expected), `${route}: page content missing`);
    assert.ok(!html.includes('漫剧工坊'), `${route}: deferred video navigation must be hidden`);
    assert.ok(!html.includes('当前章节转分镜'), `${route}: deferred editor action must be hidden`);
    assert.ok(!html.includes('NaN'), `${route}: invalid numeric content`);
    if(route !== 'service-admin')assert.ok(!html.includes('aria-label="模型名称"'),`${route}: technical configuration must stay out of product screens`);
    console.log(`PASS ${route}`);
  }
  const { initialWorks, tools, workflows, wordCount, workWords } = await server.ssrLoadModule('/src/data.js');
  assert.equal(wordCount('墨 多多\n写作'), 5);
  assert.equal(new Set(initialWorks.map(w=>w.id)).size, initialWorks.length);
  assert.equal(new Set(tools.map(t=>t.id)).size, tools.length);
  assert.ok(initialWorks.every(w=>w.chapters.length>0&&workWords(w)>0));
  assert.ok(workflows.every(w=>w.steps.length>=4));
  console.log('PASS demo data, identifiers, word counts and workflow structure');
  const { sampleReadingText, textFacts, buildReadingReport, reportText, applyDraft } = await server.ssrLoadModule('/src/research.js');
  assert.equal(textFacts(sampleReadingText).chapters, 3);
  const sampleReport = buildReadingReport({ title: '示例拆书', text: sampleReadingText, dimensions: ['structure', 'characters'] });
  assert.equal(sampleReport.isSample, true);
  assert.equal(sampleReport.sections.length, 2);
  assert.ok(sampleReport.sections[0].items[0].body.includes('林深'));
  const importedReport = buildReadingReport({ title: '用户文稿', text: '这是用户自己的原创文字。', dimensions: ['style'] });
  assert.equal(importedReport.isSample, false);
  assert.ok(importedReport.overview.includes('尚未调用 AI'));
  importedReport.note = '我的实际阅读笔记';
  assert.ok(reportText(importedReport).includes('我的实际阅读笔记'));
  assert.equal(applyDraft('原文', '候选', 'append'), '原文\n\n候选');
  assert.equal(applyDraft('原文', '候选', 'replace'), '候选');
  assert.equal(applyDraft('', '候选', 'append'), '候选');
  const { DraftReviewDialog } = await server.ssrLoadModule('/src/ProductDesk.jsx');
  const reviewHtml = renderToString(React.createElement(DraftReviewDialog, { before:'实际原文', candidate:'生成候选', task:'润色', onApply() {} }));
  assert.ok(reviewHtml.includes('实际原文') && reviewHtml.includes('生成候选'));
  console.log('PASS reading provenance, actual statistics, note export and draft adoption modes');
  const { Editor } = await server.ssrLoadModule('/src/main.jsx');
  const failedSaveHtml = renderToString(React.createElement(Editor, { work:initialWorks[0], saveError:true, onChange(){}, onBack(){}, notify(){}, setModal(){} }));
  assert.ok(failedSaveHtml.includes('保存未完成'));
  assert.ok(failedSaveHtml.includes('本地保存失败，请导出备份'));
  assert.ok(!failedSaveHtml.includes('已自动保存'));
  const { placeRecentlyEdited } = await server.ssrLoadModule('/src/works.js');
  const recent = placeRecentlyEdited(initialWorks, {...initialWorks[2], title:'修改后的作品'});
  assert.equal(recent[0].id,initialWorks[2].id);
  assert.equal(recent[0].title,'修改后的作品');
  assert.equal(recent.length,initialWorks.length);
  assert.equal(initialWorks[0].id,'fog');
  assert.equal(initialWorks[2].title,'第七次日落');
  assert.equal(placeRecentlyEdited(initialWorks,{id:'not-found'}),initialWorks);
  console.log('PASS honest save status and recent-work ordering without data mutation');


} finally {
  await server.close();
}
