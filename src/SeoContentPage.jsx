import React from 'react';
import { getSeoPage } from './seo-content.mjs';
import './seo-content.css';

const startHref = '/#home';

function BrandLink() {
  return <a className="seo-brand" href="/" aria-label="墨多多写作首页">
    <img src="/brand-mark.svg?v=3" width="36" height="36" alt="" aria-hidden="true" />
    <strong>墨多多</strong><span>写作</span>
  </a>;
}

export default function SeoContentPage({ path }) {
  const page = getSeoPage(path);
  if (!page) return null;
  const relatedPages = page.related.map(getSeoPage).filter(Boolean);
  const updated=page.updated||'2026-11-03';

  return <div className="seo-page">
    <a className="seo-skip" href="#seo-content">跳到正文</a>
    <header className="seo-header">
      <div className="seo-header-inner">
        <BrandLink />
        <nav className="seo-top-nav" aria-label="主导航">
          <a href="/">首页</a>
          <a href="/features/ai-novel-writing/" aria-current={page.path === '/features/ai-novel-writing/' ? 'page' : undefined}>AI 小说写作</a>
          <a href="/guides/getting-started/" aria-current={page.path === '/guides/getting-started/' ? 'page' : undefined}>使用指南</a>
          <a className="seo-start-link" href={startHref}>开始创作 <span aria-hidden="true">↗</span></a>
        </nav>
      </div>
    </header>

    <main id="seo-content" className="seo-main">
      <nav className="seo-breadcrumb" aria-label="面包屑">
        <a href="/">首页</a><span aria-hidden="true">/</span><span aria-current="page">{page.eyebrow}</span>
      </nav>
      <div className="seo-intro">
        <p className="seo-eyebrow"><span aria-hidden="true" />{page.eyebrow}</p>
        <h1>{page.h1}</h1>
        <p className="seo-lead">{page.lead}</p>
        <p className="seo-publication">墨多多{page.path.startsWith('/guides/')?'使用指南':'产品说明'} · 更新于 <time dateTime={updated}>{updated}</time></p>
        <div className="seo-intro-actions">
          <a className="seo-button" href={startHref}>进入墨多多 <span aria-hidden="true">→</span></a>
          <span>阅读说明无需登录 · 创作内容由你确认</span>
        </div>
      </div>

      <div className="seo-reading-layout">
        <article className="seo-article" aria-label={page.h1}>
          {page.sections.map((section, index) => <section className="seo-section" id={section.id} key={section.id} aria-labelledby={`${section.id}-title`}>
            <div className="seo-section-heading"><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><h2 id={`${section.id}-title`}>{section.title}</h2></div>
            {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            {section.list && (section.ordered ? <ol>{section.list.map((item) => <li key={item}>{item}</li>)}</ol> : <ul>{section.list.map((item) => <li key={item}>{item}</li>)}</ul>)}
            {section.example && <div className="seo-example"><p className="seo-block-label">写作示例</p><p>{section.example}</p></div>}
            {section.prompt && <figure className="seo-prompt"><figcaption><strong>提示词示例</strong><span>可复制文字，按你的故事修改</span></figcaption><pre><code>{section.prompt}</code></pre></figure>}
          </section>)}

          <section className="seo-faq seo-section" id="questions" aria-labelledby="questions-title">
            <p className="seo-eyebrow">把问题说清楚</p>
            <h2 id="questions-title">常见问题</h2>
            {page.faq.map((item) => <details key={item.question} open><summary>{item.question}</summary><p>{item.answer}</p></details>)}
          </section>
        </article>

        <aside className="seo-side" aria-label="阅读导航">
          <div className="seo-side-inner">
            <p className="seo-side-title">这篇内容里</p>
            <nav aria-label="本页目录">
              {page.sections.map((section, index) => <a href={`#${section.id}`} key={section.id}><span>{String(index + 1).padStart(2, '0')}</span>{section.title}</a>)}
              <a href="#questions"><span>Q</span>常见问题</a>
            </nav>
            <div className="seo-side-note"><span className="seo-note-mark" aria-hidden="true">“</span><p>一个好故事，<br />从你的选择开始。</p><a href={startHref}>带着想法开始 <span aria-hidden="true">→</span></a></div>
          </div>
        </aside>
      </div>

      <section className="seo-related" aria-labelledby="related-title">
        <div className="seo-related-title"><p className="seo-eyebrow">继续了解墨多多</p><h2 id="related-title">把下一个写作问题，也理清楚</h2></div>
        <div className="seo-related-grid">{relatedPages.map((related) => <a className="seo-related-card" href={related.path} key={related.path}><span>{related.eyebrow}</span><h3>{related.h1}</h3><p>{related.description}</p><span className="seo-related-arrow" aria-hidden="true">→</span></a>)}</div>
      </section>

      <section className="seo-final-cta" aria-label="开始创作">
        <div><p className="seo-eyebrow">让好故事发生</p><h2>下一段故事，交给你的想象。</h2><p>先整理一个想法，再决定它会走向哪里。</p></div>
        <a className="seo-button" href={startHref}>开始创作 <span aria-hidden="true">→</span></a>
      </section>
    </main>

    <footer className="seo-footer"><div className="seo-footer-inner"><BrandLink /><nav aria-label="页脚导航"><a href="/about/">关于墨多多</a><a href="/guides/getting-started/">使用指南</a><a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">浙ICP备2026052190号-6</a></nav><p>AI 辅助写作，作品由作者审阅与定稿。</p></div></footer>
  </div>;
}
