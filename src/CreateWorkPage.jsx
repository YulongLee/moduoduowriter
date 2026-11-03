import React, { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, ChevronDown, Clapperboard, Feather, Lightbulb, LoaderCircle, Sparkles, X } from 'lucide-react';
import { createWorkDraft, workTypes, workGenres, workStyles, creationTemplates, validateCreateWorkDraft, creationPayload, applyCreationTemplate } from './createWork.mjs';
import './create-work-page.css';

const typeIcons = { 长篇小说: BookOpen, 短篇故事: Feather, 剧本: Clapperboard };

export default function CreateWorkPage({ initial = {}, draft, onDraftChange, onCreate, onCancel, onAI }) {
  const controlled = draft !== undefined && draft !== null;
  const [localDraft, setLocalDraft] = useState(() => controlled ? null : createWorkDraft(initial));
  const form = controlled ? draft : (localDraft ?? createWorkDraft(initial));
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [busy, setBusy] = useState(false);
  const submitLock = useRef(false);
  const titleRef = useRef(null);
  const title = typeof form.title === 'string' ? form.title : '';
  const description = typeof form.description === 'string' ? form.description : '';
  const selectedStyles = Array.isArray(form.styles) ? form.styles : [];
  const commonGenres = workGenres.slice(0, 8);
  const moreGenres = workGenres.slice(8);
  const customGenre = typeof form.genre === 'string' && form.genre.trim() && !workGenres.includes(form.genre) ? form.genre : '';
  const commonStyles = workStyles.slice(0, 6);
  const moreStyles = workStyles.slice(6);
  const extraSelectedStyles = selectedStyles.filter(style => !commonStyles.includes(style));
  const hasPlanning = ['outline','characters','notes'].some(field=>typeof form[field]==='string'&&form[field].trim());

  const changeDraft = next => {
    if (submitLock.current) return;
    if (!controlled) setLocalDraft(next);
    onDraftChange?.(next);
    setSubmitError('');
  };
  const changeField = (field, value) => {
    changeDraft({ ...form, [field]: value });
    setErrors(previous => ({ ...previous, [field]: undefined }));
  };
  const toggleStyle = style => {
    if (selectedStyles.includes(style)) changeField('styles', selectedStyles.filter(value => value !== style));
    else if (selectedStyles.length < 3 && workStyles.includes(style)) changeField('styles', [...selectedStyles, style]);
  };
  const selectTemplate = id => {
    if (submitLock.current) return;
    changeDraft(applyCreationTemplate(form, id));
    setErrors({});
  };
  const submit = async event => {
    event.preventDefault();
    if (submitLock.current) return;
    const validation = validateCreateWorkDraft(form);
    setErrors(validation);
    setSubmitError('');
    if (Object.keys(validation).length) {
      if (validation.title) titleRef.current?.focus?.();
      return;
    }
    if (typeof onCreate !== 'function') {
      setSubmitError('创建入口暂时不可用，请稍后重试。');
      return;
    }
    submitLock.current = true;
    setBusy(true);
    try {
      await onCreate(creationPayload(form));
    } catch (error) {
      if (error?.errors && typeof error.errors === 'object') setErrors(error.errors);
      setSubmitError(error instanceof Error && error.message ? error.message : '作品创建未完成，请稍后重试。');
    } finally {
      submitLock.current = false;
      setBusy(false);
    }
  };

  return <div className="create-work-page">
    <header className="create-work-page-header"><button type="button" className="create-work-back" onClick={onCancel} disabled={busy} aria-label="返回上一页"><ArrowLeft size={18} aria-hidden="true" />返回</button><div className="create-work-heading"><h1>新建作品</h1><span>从一个想法出发，写下属于你的故事。</span></div></header>

    <div className="create-work-page-layout">
      <form className="create-work-form" onSubmit={submit} noValidate aria-label="新建作品信息" aria-busy={busy}>
        <div className="create-work-section-title"><h2>作品基本信息</h2></div>

        <div className="create-work-field"><div className="create-work-label-row"><label htmlFor="create-work-title">作品名称<span className="create-work-required" aria-hidden="true">*</span></label><span id="create-work-title-count">{title.length} / 50</span></div><input ref={titleRef} id="create-work-title" aria-label="作品名称" required maxLength={50} value={title} disabled={busy} aria-invalid={Boolean(errors.title)} aria-describedby={`create-work-title-count${errors.title ? ' create-work-title-error' : ''}`} onChange={event => changeField('title', event.target.value)} placeholder="为你的故事起一个名字" autoComplete="off" />{errors.title && <p className="create-work-error" id="create-work-title-error" role="alert">{errors.title}</p>}</div>

        <div className="create-work-field"><div className="create-work-label-row"><label htmlFor="create-work-description">作品简介<span className="create-work-optional">可选</span></label><span id="create-work-description-count">{description.length} / 500</span></div><textarea id="create-work-description" aria-label="作品简介" maxLength={500} rows={3} value={description} disabled={busy} aria-invalid={Boolean(errors.description)} aria-describedby={`create-work-description-count${errors.description ? ' create-work-description-error' : ''}`} onChange={event => changeField('description', event.target.value)} placeholder="描述故事背景、主角或核心冲突，让灵感先有一个轮廓…" />{errors.description && <p className="create-work-error" id="create-work-description-error" role="alert">{errors.description}</p>}</div>

        <fieldset className="create-work-field create-work-fieldset" disabled={busy}><legend>作品类型<span className="create-work-required" aria-hidden="true">*</span></legend><div className="create-work-types" role="group" aria-label="作品类型">{workTypes.map(type => { const Icon = typeIcons[type.value] || BookOpen; const selected = form.kind === type.value; return <button type="button" key={type.value} className={selected ? 'create-work-type create-work-selected' : 'create-work-type'} aria-pressed={selected} onClick={() => changeField('kind', type.value)}><span className="create-work-type-icon"><Icon size={22} aria-hidden="true" /></span><strong>{type.label}</strong><span>{type.description}</span>{selected && <Check className="create-work-type-check" size={14} aria-hidden="true" />}</button>; })}</div>{errors.kind && <p className="create-work-error" role="alert">{errors.kind}</p>}</fieldset>

        <fieldset className="create-work-field create-work-fieldset" disabled={busy}><legend>题材方向<span className="create-work-required" aria-hidden="true">*</span></legend><div className="create-work-chips" role="group" aria-label="题材方向">{commonGenres.map(genre => <button type="button" key={genre} className={form.genre === genre ? 'create-work-chip create-work-chip-selected' : 'create-work-chip'} aria-pressed={form.genre === genre} onClick={() => changeField('genre', genre)}>{genre}{form.genre === genre && <Check size={13} aria-hidden="true" />}</button>)}{(moreGenres.includes(form.genre) || customGenre) && <button type="button" className="create-work-chip create-work-chip-selected" aria-pressed="true" onClick={() => changeField('genre', form.genre)}>{form.genre}<Check size={13} aria-hidden="true" /></button>}<span className="create-work-more-select"><select aria-label="更多题材" value={moreGenres.includes(form.genre) || customGenre ? form.genre : ''} onChange={event => { if (event.target.value) changeField('genre', event.target.value); }}><option value="" disabled>更多题材</option>{moreGenres.map(genre => <option value={genre} key={genre}>{genre}</option>)}{customGenre && <option value={customGenre}>{customGenre}</option>}</select><ChevronDown size={13} aria-hidden="true" /></span></div>{errors.genre && <p className="create-work-error" role="alert">{errors.genre}</p>}</fieldset>

        <fieldset className="create-work-field create-work-fieldset create-work-style-field" disabled={busy}><legend>写作风格<span className="create-work-optional">可选</span></legend><p className="create-work-field-description" id="create-work-style-help">选择你想呈现的阅读感受，最多选择 3 项。<span>{selectedStyles.length} / 3</span></p><div className="create-work-chips" role="group" aria-label="写作风格" aria-describedby="create-work-style-help">{commonStyles.map(style => <button type="button" key={style} className={selectedStyles.includes(style) ? 'create-work-chip create-work-chip-selected' : 'create-work-chip'} aria-pressed={selectedStyles.includes(style)} disabled={!selectedStyles.includes(style) && selectedStyles.length >= 3} onClick={() => toggleStyle(style)}>{style}{selectedStyles.includes(style) && <Check size={13} aria-hidden="true" />}</button>)}{extraSelectedStyles.map(style => <button type="button" key={style} className="create-work-chip create-work-chip-selected" aria-label={`移除风格：${style}`} aria-pressed="true" onClick={() => toggleStyle(style)}>{style}<X size={12} aria-hidden="true" /></button>)}<span className="create-work-more-select"><select aria-label="更多写作风格" value="" disabled={selectedStyles.length >= 3} onChange={event => { if (event.target.value && !selectedStyles.includes(event.target.value)) toggleStyle(event.target.value); }}><option value="" disabled>更多风格</option>{moreStyles.map(style => <option value={style} disabled={selectedStyles.includes(style)} key={style}>{style}</option>)}</select><ChevronDown size={13} aria-hidden="true" /></span></div>{errors.styles && <p className="create-work-error" role="alert">{errors.styles}</p>}</fieldset>

        {hasPlanning && <details className="create-work-planning" open={errors.description?.startsWith('故事资料') || undefined}><summary>查看与编辑创作框架<span>大纲、人物与备注</span></summary><div>{[['outline','作品大纲'],['characters','人物设定'],['notes','创作备注']].map(([field,label])=><label className="create-work-planning-field" key={field}>{label}<textarea aria-label={`创建页${label}`} value={form[field]||''} rows={3} maxLength={100000} disabled={busy} onChange={event=>changeField(field,event.target.value)}/></label>)}<p>这些资料会随作品保存，之后仍可继续完善。</p></div></details>}
        {submitError && <p className="create-work-submit-error" role="alert">{submitError}</p>}
        <footer className="create-work-form-footer"><p>创建后，你仍可以继续完善作品资料。</p><div><button type="button" className="create-work-cancel" onClick={onCancel} disabled={busy}>取消</button><button type="submit" className="create-work-submit" disabled={busy} aria-busy={busy}>{busy ? <><LoaderCircle className="create-work-spinner" size={17} aria-hidden="true" />正在创建…</> : <>创建并开始写作<ArrowRight size={17} aria-hidden="true" /></>}</button></div></footer>
      </form>

      <aside className="create-work-sidebar" aria-label="创作模板与构思助手">
        <section className="create-work-template-panel" aria-labelledby="create-work-template-title"><div className="create-work-section-title"><h2 id="create-work-template-title">从一个模板开始<span>可选</span></h2><p>选一个喜欢的方向，再写成你自己的故事。</p></div><div className="create-work-templates" role="group" aria-label="创作模板">{creationTemplates.map(template => { const selected = form.templateId === template.id; return <button type="button" key={template.id} aria-label={`使用${template.name}`} aria-pressed={selected} disabled={busy} className={`create-work-template create-work-template-${template.id}${selected ? ' create-work-template-selected' : ''}`} onClick={() => selectTemplate(template.id)}><span className="create-work-template-image" aria-hidden="true"><img src={template.image} alt="" loading="lazy" /></span><span className="create-work-template-copy"><strong>{template.name}</strong><span className="create-work-template-description">{template.summary}</span><span className="create-work-template-tags">{template.tags.map(tag => <span key={tag}>{tag}</span>)}</span></span><span className="create-work-template-state">{selected ? <CheckCircle2 size={19} aria-hidden="true" /> : <span aria-hidden="true" />}{selected && <small>已选</small>}</span></button>; })}</div><p className="create-work-template-note"><BookOpen size={16} aria-hidden="true" /><span>仅填入可编辑的创作框架，创建后仍可修改。</span></p></section>

        <section className="create-work-ai-panel" aria-labelledby="create-work-ai-title"><span className="create-work-ai-symbol"><Lightbulb size={25} aria-hidden="true" /></span><div><h2 id="create-work-ai-title">还没有想好怎么开始？</h2><p>聊聊你的一个念头，一起推敲故事背景、人物与冲突。</p></div><button type="button" onClick={() => onAI?.(form)} disabled={busy || typeof onAI !== 'function'}><Sparkles size={16} aria-hidden="true" />AI 帮我构思<ArrowRight size={16} aria-hidden="true" /></button></section>
      </aside>
    </div>
  </div>;
}
