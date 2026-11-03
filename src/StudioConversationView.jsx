import React, { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, Check, ChevronDown, Crown, Download, Feather, Globe2, Lightbulb, ListTree, LoaderCircle, MessageCircle, PanelLeft, Pencil, Plus, Send, Settings2, Sparkles, Square, Trash2, UsersRound, X } from 'lucide-react';
import { Brand } from './Art.jsx';
import './studio-conversation.css';

const exampleIcons = { idea: Lightbulb, plot: ListTree, character: UsersRound, world: Globe2, outline: ListTree, polish: Feather };

function useRailDisclosure(breakpoint) {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth <= breakpoint);
  const [open, setOpen] = useState(() => typeof window === 'undefined' || window.innerWidth > breakpoint);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const update = event => { setNarrow(event.matches); setOpen(!event.matches); };
    update(media);
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, [breakpoint]);
  return { narrow, open, setOpen };
}

export default function StudioConversationView({ session, historyGroups = [], available = [], scopeId = '', associated, orphan = false, input = '', busy = false, cancelling = false, mode = 'demo', saveError, error, notice, deleteConfirm = false, renameOpen = false, renameTitle = '', onRenameTitle, onRenameStart, onRenameSave, onRenameCancel, onNew, onHistory, onScope, onExport, onDeleteToggle, onDeleteConfirm, onDeleteCancel, onInput, onKeyDown, onSend, onStop, onExample, examples = [], messageLog, inputRef, contextId, meterId, referencePanel, settingsPanel, historyNotice, referenceNotice, pendingNotice, draftPromptConfirmation, toolbox, onNavigate }) {
  const historyRail = useRailDisclosure(1050);
  const toolsRail = useRailDisclosure(1250);
  const historyItems = historyGroups.flatMap(group => Array.isArray(group.items) ? group.items : []);
  const savedSession = historyItems.some(item => item.id === session?.id);
  const hasMessages = Array.isArray(session?.turns) && session.turns.length > 0;
  const title = session?.title || '新的创作对话';
  const scopeLabel = associated ? `关联《${associated.title}》` : orphan ? '原关联作品已移除' : '独立讨论';
  const closeDisclosure = event => {
    if (event.key !== 'Escape') return;
    const details = event.target.closest?.('details[open]');
    if (!details) return;
    event.preventDefault();
    event.stopPropagation();
    details.open = false;
    details.querySelector('summary')?.focus();
  };

  return <section className="studio-conversation" aria-label="创作对话工作台" onKeyDown={closeDisclosure}>
    <aside className="studio-conversation-history" aria-label="对话历史">
      <details className="studio-conversation-history-disclosure" open={historyRail.open} onToggle={event => historyRail.setOpen(event.currentTarget.open)} name={historyRail.narrow && toolsRail.narrow ? `${contextId}-studio-rails` : undefined}>
        <summary className="studio-conversation-rail-summary" aria-label="展开或收起对话历史"><PanelLeft size={16} aria-hidden="true" />对话历史<ChevronDown size={13} aria-hidden="true" /></summary>
        <div className="studio-conversation-history-body">
          <div className="studio-conversation-history-heading"><span><MessageCircle size={17} aria-hidden="true" />我的对话</span><small>{historyItems.length}</small></div>
          <button type="button" className="studio-conversation-new" aria-label="新建对话" disabled={busy || typeof onNew !== 'function'} onClick={() => onNew?.()}><Plus size={17} aria-hidden="true" />新建对话</button>
          <div className="studio-conversation-history-list">
            {historyGroups.some(group => group.items?.length) ? historyGroups.map(group => group.items?.length ? <section className="studio-conversation-history-group" key={group.label} aria-label={group.label}><h2>{group.label}</h2>{group.items.map(item => <button type="button" key={item.id} className={item.id === session?.id ? 'studio-conversation-history-item studio-conversation-history-active' : 'studio-conversation-history-item'} aria-label={`选择对话：${item.title || '未命名讨论'}`} aria-current={item.id === session?.id ? 'page' : undefined} data-session-id={item.id} disabled={busy || typeof onHistory !== 'function'} onClick={() => { onHistory?.(item.id); if (historyRail.narrow) historyRail.setOpen(false); }}><MessageCircle size={14} aria-hidden="true" /><span><strong>{item.title || '未命名讨论'}</strong><small title={item.workId ? available.find(work => work.id === item.workId)?.title || '原作品已移除' : '独立讨论'}>{item.preview || '尚未发送消息'}</small></span></button>)}</section> : null) : <div className="studio-conversation-history-empty"><MessageCircle size={26} aria-hidden="true" /><p>还没有保存的对话</p><span>从一个故事问题开始，慢慢聊清楚。</span></div>}
          </div>
          <details className="studio-conversation-switcher"><summary>关联作品与快捷切换<ChevronDown size={13} aria-hidden="true" /></summary><div><label><span>关联作品</span><select aria-label="对话关联作品" value={scopeId} disabled={busy || typeof onScope !== 'function'} onChange={event => onScope?.(event.target.value)}><option value="">独立讨论</option>{available.map(work => <option key={work.id} value={work.id}>{work.title}</option>)}{scopeId && !available.some(work => work.id === scopeId) && <option value={scopeId} disabled>原关联作品已移除</option>}</select></label><label><span>对话记录</span><select aria-label="对话记录" value={savedSession ? session.id : ''} disabled={busy || typeof onHistory !== 'function'} onChange={event => { if (event.target.value) onHistory?.(event.target.value); }}><option value="" disabled>新的讨论</option>{historyItems.map(item => <option key={item.id} value={item.id}>{item.title || '未命名讨论'}</option>)}</select></label></div></details>
        </div>
      </details>
    </aside>

    <div className="studio-conversation-center">
      <header className="studio-conversation-header"><div className="studio-conversation-heading"><p><Sparkles size={13} aria-hidden="true" />创作对话</p>{renameOpen ? <form className="studio-conversation-rename" onSubmit={event => { event.preventDefault(); onRenameSave?.(); }}><input autoFocus aria-label="对话名称" maxLength={80} value={renameTitle} disabled={busy} onChange={event => onRenameTitle?.(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onRenameCancel?.(); } }} /><button type="submit" className="studio-conversation-icon-button" aria-label="保存对话名称" disabled={busy || !renameTitle.trim() || typeof onRenameSave !== 'function'}><Check size={17} aria-hidden="true" /></button><button type="button" className="studio-conversation-icon-button" aria-label="取消重命名" disabled={busy} onClick={() => onRenameCancel?.()}><X size={16} aria-hidden="true" /></button></form> : <div className="studio-conversation-title"><h1 title={title}>{title}</h1>{typeof onRenameStart === 'function' && <button type="button" className="studio-conversation-icon-button" aria-label="重命名对话" title="重命名对话" disabled={busy} onClick={() => onRenameStart()}><Pencil size={14} aria-hidden="true" /></button>}</div>}<span className="studio-conversation-scope"><BookOpen size={12} aria-hidden="true" />{scopeLabel}</span></div><div className="studio-conversation-header-actions"><button type="button" className="studio-conversation-icon-button" aria-label="导出当前对话" title="导出当前对话" disabled={busy || (!hasMessages && !input.trim()) || typeof onExport !== 'function'} onClick={() => onExport?.()}><Download size={17} aria-hidden="true" /></button><button type="button" className="studio-conversation-icon-button" aria-label="删除当前对话" title="删除当前对话" disabled={busy || (!savedSession && !hasMessages && !input.trim()) || typeof onDeleteToggle !== 'function'} onClick={() => onDeleteToggle?.()}><Trash2 size={16} aria-hidden="true" /></button></div></header>

      {deleteConfirm && <div className="studio-conversation-delete-confirm" role="alert"><p>删除这段对话及其草稿？作品正文和生成记录会保留。</p><div><button type="button" aria-label="取消删除" disabled={busy} onClick={() => onDeleteCancel?.()}>取消</button><button type="button" className="studio-conversation-delete-action" aria-label="确认删除对话" disabled={busy} onClick={() => onDeleteConfirm?.()}>确认删除</button></div></div>}

      {hasMessages ? <div className="studio-conversation-message-slot">{messageLog}</div> : <div className="studio-conversation-empty"><div className="studio-conversation-empty-heading"><Brand /><p>墨多多，陪你把故事聊清楚</p><h2>今天，想聊一个什么故事？</h2><span>从灵感、情节到人物，一起找到下一步的方向。</span></div><div className="studio-conversation-examples" aria-label="创作讨论示例">{examples.map(example => { const Icon = exampleIcons[example.id] || Sparkles; return <button type="button" key={example.id} aria-label={example.aria || `填入${example.label}`} disabled={busy || orphan || typeof onExample !== 'function'} onClick={() => onExample?.(example)}><span className={`studio-conversation-example-icon studio-conversation-example-${example.id}`}><Icon size={20} aria-hidden="true" /></span><strong>{example.label}</strong><span>{example.description}</span><ArrowRight className="studio-conversation-example-arrow" size={15} aria-hidden="true" /></button>; })}</div></div>}

      <div className="studio-conversation-feedback" aria-label="对话状态提示">
        {saveError && <p className="studio-conversation-error" role="alert">{typeof saveError === 'string' ? saveError : '对话暂未完整保存，请保持页面打开并导出重要内容。'}</p>}
        {orphan && <p className="studio-conversation-error" role="status">原关联作品已移除。可以查看和导出历史；请选择其他作品或独立讨论开启新对话。</p>}
        {error && <p className="studio-conversation-error" role="alert">{error}</p>}
        {notice && <p className="studio-conversation-notice" role="status">{notice}</p>}
        {historyNotice && <p className="studio-conversation-notice">{historyNotice}</p>}
        {referenceNotice && <p className="studio-conversation-notice">{referenceNotice}</p>}
        {pendingNotice && <p className="studio-conversation-notice">{pendingNotice}</p>}
      </div>

      <div className="studio-conversation-composer-shell">
        {draftPromptConfirmation && <div className="studio-conversation-draft-confirmation">{draftPromptConfirmation}</div>}
        <form className="studio-conversation-composer" aria-label="创作对话输入区" onSubmit={onSend}>
          <textarea ref={inputRef} aria-label="创作对话输入" maxLength={4000} rows={3} value={input} disabled={busy || orphan} onChange={event => onInput?.(event.target.value)} onKeyDown={onKeyDown} placeholder={hasMessages ? '继续聊聊你的想法，或说说接下来想怎样调整…' : '输入你的故事想法、人物困惑，或需要一起推敲的情节…'} />
          <div className="studio-conversation-composer-footer"><div className="studio-conversation-composer-options">{referencePanel && <details className="studio-conversation-composer-option" name={`${contextId}-studio-composer-panels`}><summary aria-controls={contextId}><Plus size={14} aria-hidden="true" />添加参考资料<ChevronDown size={12} aria-hidden="true" /></summary><div className="studio-conversation-option-popover">{referencePanel}</div></details>}{settingsPanel && <details className="studio-conversation-composer-option" name={`${contextId}-studio-composer-panels`}><summary aria-controls={meterId}><Settings2 size={14} aria-hidden="true" />创作设置 / 用量<ChevronDown size={12} aria-hidden="true" /></summary><div className="studio-conversation-option-popover">{settingsPanel}</div></details>}</div><div className="studio-conversation-send-controls"><span>{input.length} / 4,000</span>{busy ? <button type="button" className="studio-conversation-stop" aria-label="取消本次对话" disabled={cancelling || typeof onStop !== 'function'} onClick={() => onStop?.()}>{cancelling ? <LoaderCircle className="studio-conversation-spinner" size={15} aria-hidden="true" /> : <Square size={13} aria-hidden="true" />}{cancelling ? '正在停止…' : '停止生成'}</button> : <button type="submit" className="studio-conversation-send" aria-label="发送创作消息" disabled={!input.trim() || orphan || typeof onSend !== 'function'}>发送<Send size={16} aria-hidden="true" /></button>}</div></div>
        </form>
        <div className="studio-conversation-footnote"><span>Enter 发送 · Shift+Enter 换行</span><span>讨论不会自动改写作品</span></div>
        {mode !== 'ai' && <p className="studio-conversation-demo-note">当前为预置示例体验，回复不是针对任意输入的实时创作。</p>}
      </div>
    </div>

    <aside className="studio-conversation-tools" aria-label="创作工具与服务"><details className="studio-conversation-tools-disclosure" open={toolsRail.open} onToggle={event => toolsRail.setOpen(event.currentTarget.open)} name={historyRail.narrow && toolsRail.narrow ? `${contextId}-studio-rails` : undefined}><summary className="studio-conversation-rail-summary" aria-label="展开或收起创作工具"><Sparkles size={15} aria-hidden="true" />创作工具<ChevronDown size={13} aria-hidden="true" /></summary><div className="studio-conversation-tools-body"><div className="studio-conversation-tools-heading"><h2><Sparkles size={17} aria-hidden="true" />创作工具</h2><p>在讨论之外，把想法继续展开。</p></div><div className="studio-conversation-toolbox-node">{toolbox}</div>{typeof onNavigate === 'function' && <div className="studio-conversation-membership"><Crown size={20} aria-hidden="true" /><div><h3>了解创作方案</h3><p>查看会员与墨点说明。</p></div><button type="button" disabled={busy} onClick={() => onNavigate('membership')}>查看方案<ArrowRight size={14} aria-hidden="true" /></button></div>}</div></details></aside>
  </section>;
}
