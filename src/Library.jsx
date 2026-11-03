import React, { useState } from 'react';
import { ArrowRight, ArrowUpRight, BookOpen, ChevronRight, Clock3, Download, Ellipsis, FileText, Globe2, LayoutGrid, Lightbulb, List, ListTree, Plus, RotateCcw, Search, Settings2, Trash2, Type, Upload, UsersRound } from 'lucide-react';
import { BookCover } from './Art';
import { tools, workWords } from './data';
import { workStatus, workStatusLabel, workTargetProgress, workEditTime, workEditLabel, selectLibraryWorks, libraryCounts } from './workPresentation.mjs';
import './library.css';
import './works-library.css';

export function WorkCard({work,onOpen,onExport,onManage}) {
  return <article className={`work-card shelf-${work.cover||'plain'}`}>
    <div className="work-cover-stage"><button className="work-cover-open" onClick={onOpen} aria-label={`继续写作：${work.title}`}><span className="shelf-ring"/><BookCover work={work} large/><span className="work-cover-cta">打开作品<ArrowUpRight size={15}/></span></button><span className="work-cover-kind">{work.kind}</span>{onManage&&<button className="work-export work-manage-button icon-button" title="管理作品" aria-label={`管理${work.title}`} onClick={onManage}><Settings2 size={16}/></button>}{onExport&&<button className="work-export icon-button" title="导出作品" aria-label={`导出${work.title}`} onClick={onExport}><Download size={16}/></button>}</div>
    <div className="work-card-content"><div className="work-card-category"><span>{work.genre}</span><span><i/>创作中</span></div><button className="work-name" onClick={onOpen}>{work.title}</button><p>{work.description||'一个等待继续书写的故事。'}</p><div className="work-card-stats"><span><Type size={13}/>{workWords(work).toLocaleString()} 字</span><span><FileText size={13}/>{work.chapters.length} 章</span></div></div>
    <footer className="work-card-bottom"><span><Clock3 size={12}/>{work.updated}</span><button onClick={onOpen}>继续写作<ArrowRight size={15}/></button></footer>
  </article>;
}

const libraryKinds = [{ value: 'all', label: '全部作品' }, { value: '长篇小说', label: '长篇小说' }, { value: '短篇故事', label: '短篇故事' }, { value: '剧本', label: '剧本' }];
const libraryStatuses = [{ value: 'all', label: '全部状态' }, { value: 'draft', label: '草稿' }, { value: 'writing', label: '创作中' }, { value: 'serializing', label: '连载中' }, { value: 'completed', label: '已完结' }];
const libraryShortcuts = [
  { id: 'create', title: '新建小说', description: '写下新故事的第一章', Icon: Plus, tone: 'primary' },
  { id: 'outline', title: '生成大纲', description: '理清主线与章节脉络', Icon: ListTree, tone: 'blue' },
  { id: 'character', title: '人物设定', description: '塑造有血有肉的角色', Icon: UsersRound, tone: 'purple' },
  { id: 'world', title: '世界观设定', description: '搭建故事发生的世界', Icon: Globe2, tone: 'green' },
  { id: 'tools', title: '灵感广场', description: '发现更多创作工具', Icon: Lightbulb, tone: 'gold' },
];

function NovelWorkCard({ work, view, onOpen, onManage, onExport }) {
  const title = work.title || '未命名作品';
  const words = workWords({ ...work, chapters: Array.isArray(work.chapters) ? work.chapters : [] });
  const chapters = Array.isArray(work.chapters) ? work.chapters.length : 0;
  const progress = workTargetProgress(work);
  const edited = workEditTime(work);
  return <article className={`novel-work-card novel-work-card-${view}`} aria-label={`作品：${title}`}>
    <div className="novel-work-card-body">
      <button type="button" className="novel-work-cover" onClick={onOpen} aria-label={`继续写作：${title}`}><span aria-hidden="true"><BookCover work={work} large /></span></button>
      <div className="novel-work-content"><button type="button" className="novel-work-title" onClick={onOpen} title={title}>{title}</button><div className="novel-work-tags"><span>{work.kind || '作品'}</span>{work.genre && <span>{work.genre}</span>}<span className={`novel-work-status novel-work-status-${workStatus(work)}`}><i aria-hidden="true" />{workStatusLabel(work)}</span></div><p className="novel-work-description">{work.description || '尚未填写作品简介，可以在作品资料中补充。'}</p><div className="novel-work-size"><span><Type size={14} aria-hidden="true" />{words.toLocaleString('zh-CN')} 字</span><span><FileText size={14} aria-hidden="true" />{chapters} 章</span></div>{progress && <div className="novel-work-progress"><div><span>目标 {progress.target.toLocaleString('zh-CN')} 字</span><strong>{Math.round(progress.percent)}%</strong></div><span role="progressbar" aria-label={`${title}创作目标进度`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.percent)}><i style={{ width: `${progress.percent}%` }} /></span></div>}</div>
    </div>
    <footer className="novel-work-footer"><span className="novel-work-edited"><Clock3 size={13} aria-hidden="true" />{edited !== null ? <time dateTime={new Date(edited).toISOString()}>{workEditLabel(work)}</time> : <span>{workEditLabel(work)}</span>}</span><div className="novel-work-actions"><button type="button" className="novel-icon-button novel-work-manage" aria-label={`管理${title}`} title="管理作品资料与回收站" onClick={onManage}><Ellipsis size={20} aria-hidden="true" /></button><button type="button" className="novel-icon-button novel-work-export" onClick={onExport} aria-label={`导出${title}`} title="导出 TXT 文稿"><Download size={17} aria-hidden="true" /></button><button type="button" className="novel-continue-button" onClick={onOpen}>{words > 0 ? '继续写作' : '开始写作'}<ArrowRight size={15} aria-hidden="true" /></button></div></footer>
  </article>;
}

export function WorksPage({ works = [], navigate, setModal, onImport, notify, trashWorks = [], onRestoreWork }) {
  const [kind, setKind] = useState('all');
  const [status, setStatus] = useState('all');
  const [showTrash, setShowTrash] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('recent');
  const [view, setView] = useState('grid');
  const list = selectLibraryWorks(works, { kind, status, query, sort });
  const counts = libraryCounts(works, { kind, query });
  const statusTotal = Object.values(counts.statuses).reduce((sum, value) => sum + value, 0);
  const kindCounts = libraryCounts(works, { kind: 'all', query });
  const total = libraryCounts(works, { kind: 'all', query: '' }).total;
  const trashList = Array.isArray(trashWorks) ? trashWorks.filter(Boolean) : [];
  const hasFilters = kind !== 'all' || status !== 'all' || query.trim();
  const clearFilters = () => { setKind('all'); setStatus('all'); setQuery(''); };
  const createWork = () => setModal({ type: 'create', kind: '长篇小说' });
  const shortcut = id => {
    if (id === 'create') return createWork();
    if (id === 'tools') return navigate('tools');
    if (id === 'world') return setModal({ type: 'home-conversation', initialPrompt: '我想构思小说世界观，请帮我梳理时代背景、地点、规则与势力关系。' });
    const tool = tools.find(item => item.id === id);
    if (tool) setModal({ type: 'tool', tool });
  };
  const exportWork = work => {
    try {
      const chapters = Array.isArray(work.chapters) ? work.chapters : [];
      const text = `${work.title || '未命名作品'}\n\n${chapters.map(chapter => `${chapter.title || '未命名章节'}\n\n${chapter.text || ''}`).join('\n\n')}`;
      const url = URL.createObjectURL(new Blob(['\ufeff' + text], { type: 'text/plain;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${work.title || '未命名作品'}.txt`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify?.('完整作品已导出为 TXT');
    } catch { notify?.('导出未完成，请稍后重试。'); }
  };

  return <div className="novel-library">
    <header className="novel-library-hero"><div><h1>我的作品</h1><p>管理你的小说作品，继续创作、编辑与完善。</p></div><div className="novel-library-hero-actions">{typeof onImport === 'function' && <button type="button" className="novel-secondary-button novel-import-button" onClick={onImport}><Upload size={17} aria-hidden="true" />导入文稿</button>}<button type="button" className="novel-trash-toggle" onClick={() => setShowTrash(value => !value)}><Trash2 size={17} aria-hidden="true" />{showTrash ? '返回作品书架' : `回收站（${trashList.length}）`}</button></div></header>

    <section className="novel-library-shortcuts" aria-label="创作快捷入口">{libraryShortcuts.map(({ id, title, description, Icon, tone }) => <button type="button" key={id} className={`novel-shortcut novel-shortcut-${tone}`} onClick={() => shortcut(id)}><span className="novel-shortcut-icon"><Icon size={25} aria-hidden="true" /></span><span className="novel-shortcut-copy"><strong>{title}</strong><span>{description}</span></span><ChevronRight className="novel-shortcut-arrow" size={17} aria-hidden="true" /></button>)}</section>

    <section className="novel-library-shelf" aria-labelledby="novel-library-shelf-title">
      <div className={`novel-library-section-heading${showTrash ? '' : ' novel-library-section-quiet'}`}><h2 id="novel-library-shelf-title">{showTrash ? '回收站' : '作品书架'}<span>{showTrash ? trashList.length : total}</span></h2></div>

      {!showTrash && <div className="novel-library-filters">
        <div className="novel-library-filter-top"><div className="novel-kind-tabs" role="group" aria-label="作品类型">{libraryKinds.map(item => <button type="button" key={item.value} className={kind === item.value ? 'novel-tab-selected' : ''} aria-pressed={kind === item.value} onClick={() => setKind(item.value)}><span>{item.label}</span><small>{item.value === 'all' ? kindCounts.total : kindCounts.kinds[item.value] || 0}</small></button>)}</div><label className="novel-library-search"><Search size={17} aria-hidden="true" /><input aria-label="搜索作品" placeholder="搜索作品名称、题材…" value={query} onChange={event => setQuery(event.target.value)} /></label></div>
        <div className="novel-library-filter-bottom"><div className="novel-status-tabs" role="group" aria-label="作品状态">{libraryStatuses.map(item => <button type="button" key={item.value} className={status === item.value ? 'novel-status-selected' : ''} aria-pressed={status === item.value} onClick={() => setStatus(item.value)}>{item.label}<span>{item.value === 'all' ? statusTotal : counts.statuses[item.value] || 0}</span></button>)}</div><div className="novel-library-view-controls"><select aria-label="排序方式" value={sort} onChange={event => setSort(event.target.value)}><option value="recent">最近编辑</option><option value="words">字数最多</option><option value="name">名称排序</option></select><div className="novel-view-toggle" role="group" aria-label="作品显示方式"><button type="button" aria-label="卡片视图" aria-pressed={view === 'grid'} onClick={() => setView('grid')}><LayoutGrid size={18} aria-hidden="true" /></button><button type="button" aria-label="列表视图" aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={19} aria-hidden="true" /></button></div></div></div>
      </div>}

      {showTrash ? trashList.length > 0 ? <>
        <p className="novel-trash-description">移入回收站的作品会保留在这里，可以随时恢复到作品书架。</p>
        <div className="novel-trash-list">{trashList.map(work => <article className="novel-trash-card" key={work.id}><span className="novel-trash-cover" aria-hidden="true"><BookCover work={work} /></span><div><h3>{work.title || '未命名作品'}</h3><p>{work.kind || '作品'}{work.genre && ` · ${work.genre}`}</p><span>{workWords({ ...work, chapters: Array.isArray(work.chapters) ? work.chapters : [] }).toLocaleString('zh-CN')} 字</span></div><button type="button" className="novel-secondary-button" aria-label={`恢复${work.title || '未命名作品'}`} disabled={typeof onRestoreWork !== 'function'} onClick={() => onRestoreWork(work)}><RotateCcw size={16} aria-hidden="true" />恢复作品</button></article>)}</div>
      </> : <div className="novel-library-empty"><span className="novel-empty-symbol"><Trash2 size={34} aria-hidden="true" /></span><h3>回收站是空的</h3><p>移入回收站的作品会保留在这里，方便你恢复。</p><button type="button" className="novel-secondary-button" onClick={() => setShowTrash(false)}>返回作品书架<ArrowRight size={16} aria-hidden="true" /></button></div> : list.length > 0 ? <>{hasFilters && <p className="novel-library-results" role="status">共 {list.length} 部作品<button type="button" onClick={clearFilters}>清空筛选</button></p>}<div className={`novel-library-collection novel-library-collection-${view}`}>{list.map(work => <NovelWorkCard key={work.id} work={work} view={view} onOpen={() => navigate(`editor/${work.id}`)} onManage={() => setModal({ type: 'work-details', work })} onExport={() => exportWork(work)} />)}</div></> : <div className="novel-library-empty"><span className="novel-empty-symbol">{hasFilters ? <Search size={34} aria-hidden="true" /> : <BookOpen size={34} aria-hidden="true" />}</span><h3>{hasFilters ? '没有找到符合条件的作品' : '为你的第一个故事，留一个位置'}</h3><p>{hasFilters ? '试试其他分类或关键词，也可以清空筛选重新查看。' : '新建一部小说，或导入已经写好的 TXT 文稿。'}</p><div>{hasFilters ? <button type="button" className="novel-secondary-button" onClick={clearFilters}>清空筛选<ArrowRight size={16} aria-hidden="true" /></button> : <><button type="button" className="novel-primary-button" onClick={createWork}><Plus size={17} aria-hidden="true" />新建作品</button>{typeof onImport === 'function' && <button type="button" className="novel-secondary-button" onClick={onImport}><Upload size={16} aria-hidden="true" />导入文稿</button>}</>}</div></div>}
    </section>
  </div>;
}
