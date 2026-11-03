import React from 'react';

const labels={outline:'故事大纲',character:'人物设定',ideas:'灵感构思',continue:'剧情续写',polish:'文字润色'};

// Authored, static product examples. These previews never request generation.
export function LandingFeaturePreview({feature}) {
 const kind=Object.hasOwn(labels,feature)?feature:'ideas';
 return <div className={`mdd-feature-preview mdd-preview-${kind}`}>
  <div className="mdd-preview-toolbar"><span>雨夜来信<span className="mdd-preview-toolbar-divider"> / </span>{labels[kind]}</span><span className="mdd-preview-label">功能示意</span></div>
  {kind==='outline'&&<ol className="mdd-preview-steps">
   <li className="mdd-preview-step"><span className="mdd-preview-step-index">01</span><div><strong>一封明日来信</strong><p>修复师收到一封落款是明天的信。</p></div></li>
   <li className="mdd-preview-step"><span className="mdd-preview-step-index">02</span><div><strong>沿着旧物追寻</strong><p>她循着旧物中的记忆，寻找寄信人。</p></div></li>
   <li className="mdd-preview-step"><span className="mdd-preview-step-index">03</span><div><strong>线索指向父亲</strong><p>最后一件旧物，牵出她回避的秘密。</p></div></li>
  </ol>}
  {kind==='character'&&<>
   <div className="mdd-preview-character"><span className="mdd-preview-avatar" aria-hidden="true">沈</span><div><strong>沈听澜</strong><span className="mdd-preview-tag">旧物修复师</span></div></div>
   <dl className="mdd-preview-profile"><div><dt>目标</dt><dd>寻找明日来信的寄信人</dd></div><div><dt>能力</dt><dd>听见旧物中留下的记忆</dd></div><div><dt>内在冲突</dt><dd>擅长修复旧物，却不敢面对父亲的秘密</dd></div></dl>
  </>}
  {kind==='ideas'&&<>
   <blockquote className="mdd-preview-quote">一位能听见旧物记忆的修复师，收到了一封来自明天的信。</blockquote>
   <div className="mdd-preview-questions"><p>信为什么来自明天？</p><p>谁在借旧物向她求助？</p></div>
  </>}
  {kind==='continue'&&<div className="mdd-preview-prose"><p>雨落在旧书店的玻璃上。</p><p>她拆开信封，看见落款处写着明天的日期。<span className="mdd-preview-cursor" aria-hidden="true">▍</span></p></div>}
  {kind==='polish'&&<div className="mdd-preview-revisions"><div className="mdd-preview-revision"><span className="mdd-preview-label">修改前</span><p>她打开信，发现日期是明天。</p></div><div className="mdd-preview-revision is-refined"><span className="mdd-preview-label">润色后 · 示意</span><p>她拆开信封，看见落款处写着明天的日期。</p></div></div>}
 </div>;
}
