import React, { useState } from 'react';
import { ArrowRight, BookOpen, ChevronRight, Clock3, Ellipsis, Feather, LayoutGrid, List, ListTree, Plus, Sparkles, Upload, UsersRound, WandSparkles } from 'lucide-react';
import { useAccount } from './Account.jsx';
import { BookCover } from './Art.jsx';
import { tools, workWords } from './data.js';
import WorkspaceInsights from './WorkspaceInsights.jsx';
import './workspace-dashboard.css';

const kinds = ['全部', '长篇', '短篇', '剧本'];
const kindValues = { 长篇: '长篇小说', 短篇: '短篇故事', 剧本: '剧本' };
const quickActions = [
  { id: 'create', title: '新建小说', description: '开启你的下一部作品', Icon: Plus, tone: 'primary' },
  { id: 'outline', title: '生成大纲', description: '梳理主线与章节', Icon: ListTree, tone: 'blue' },
  { id: 'character', title: '人物设定', description: '塑造鲜活的故事角色', Icon: UsersRound, tone: 'purple' },
  { id: 'continue', title: '情节续写', description: '承接上文，推进故事', Icon: Feather, tone: 'amber' },
  { id: 'polish', title: '润色修改', description: '打磨文字与叙述节奏', Icon: WandSparkles, tone: 'green' },
];

function activeWorks(works) {
  return Array.isArray(works) ? works.filter(work => work && work.id && !work.deletedAt) : [];
}

export function dashboardWorkWords(work) {
  const chapters = Array.isArray(work?.chapters) ? work.chapters.map(chapter => ({ ...chapter, text: typeof chapter?.text === 'string' ? chapter.text : '' })) : [];
  return workWords({ ...work, chapters });
}

export function dashboardStats(works = []) {
  const list = activeWorks(works);
  return { workCount: list.length, totalWords: list.reduce((sum, work) => sum + dashboardWorkWords(work), 0), chapterCount: list.reduce((sum, work) => sum + (Array.isArray(work.chapters) ? work.chapters.length : 0), 0) };
}

export function dashboardEditedTime(work) {
  if (!work?.updatedAt) return null;
  const timestamp = Date.parse(work.updatedAt);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function getDashboardWorks(works = [], { kind = '全部', sort = 'recent' } = {}) {
  const list = activeWorks(works).filter(work => kind === '全部' || work.kind === kindValues[kind] || work.kind === kind);
  if (sort === 'words') return [...list].sort((a, b) => dashboardWorkWords(b) - dashboardWorkWords(a));
  if (sort === 'name') return [...list].sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'zh-CN'));
  // Imported and legacy works may have only a display label. Keep their existing
  // positions rather than turn labels such as “刚刚” into invented timestamps.
  const dated = list.filter(work => dashboardEditedTime(work) !== null).sort((a, b) => dashboardEditedTime(b) - dashboardEditedTime(a));
  let index = 0;
  return list.map(work => dashboardEditedTime(work) !== null ? dated[index++] : work);
}

export function dashboardProgress(work) {
  const target = Number(work?.targetWords);
  if (!Number.isFinite(target) || target <= 0) return null;
  const words = dashboardWorkWords(work);
  const percent = Math.min(100, words / target * 100);
  return { words, target, percent };
}

export function dashboardDisplayName(user) {
  const named = [user?.displayName, user?.nickname, user?.name].find(value => typeof value === 'string' && value.trim());
  if (named) return named.trim();
  const username = typeof user?.username === 'string' ? user.username.trim() : '';
  return username && !username.includes('@') && !/^\+?\d[\d\s-]{7,}$/.test(username) && !/^(手机|邮箱|微信)用户_/.test(username) ? username : '创作者';
}

export function dashboardGreeting(date = new Date()) {
  try {
    const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', hour: '2-digit', hourCycle: 'h23' }).format(date));
    if (!Number.isFinite(hour)) return '欢迎回来';
    return hour >= 5 && hour < 12 ? '早上好' : hour >= 12 && hour < 18 ? '下午好' : '晚上好';
  } catch { return '欢迎回来'; }
}

function editedLabel(work) {
  const timestamp = dashboardEditedTime(work);
  if (timestamp !== null) return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(timestamp));
  return typeof work.updated === 'string' && work.updated.trim() ? work.updated.trim() : '尚未记录编辑时间';
}

function DashboardWork({ work, view, onOpen, onManage }) {
  const words = dashboardWorkWords(work);
  const chapterCount = Array.isArray(work.chapters) ? work.chapters.length : 0;
  const progress = dashboardProgress(work);
  const title = work.title || '未命名作品';
  return <article className={`workspace-dashboard-work workspace-dashboard-work-${view}`}>
    <div className="workspace-dashboard-work-top"><span>{work.kind || '作品'}{work.genre && <><i aria-hidden="true" />{work.genre}</>}</span><button type="button" className="workspace-dashboard-manage" aria-label={`管理作品：${title}`} title="管理作品资料与回收站" onClick={onManage}><Ellipsis size={18} aria-hidden="true" /></button></div>
    <button type="button" className="workspace-dashboard-work-main" onClick={onOpen} aria-label={`打开作品：${title}`}>
      <span className="workspace-dashboard-cover" aria-hidden="true"><BookCover work={work} /></span>
      <span className="workspace-dashboard-work-copy"><strong>{title}</strong><span className="workspace-dashboard-work-description">{work.description || '还没有填写简介，可以在作品资料中补充。'}</span><span className="workspace-dashboard-work-numbers">{words.toLocaleString('zh-CN')} 字<span aria-hidden="true">·</span>{chapterCount} 章</span></span>
    </button>
    {progress && <div className="workspace-dashboard-progress"><div><span>{progress.words.toLocaleString('zh-CN')} / {progress.target.toLocaleString('zh-CN')} 字</span><span>{Math.round(progress.percent)}%</span></div><span role="progressbar" aria-label={`${title}的创作目标进度`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.percent)}><i style={{ width: `${progress.percent}%` }} /></span></div>}
    <footer className="workspace-dashboard-work-bottom"><span><Clock3 size={12} aria-hidden="true" />{editedLabel(work)}</span><button type="button" onClick={onOpen}>继续写作<ArrowRight size={13} aria-hidden="true" /></button></footer>
  </article>;
}

export default function WorkspaceDashboard({ works = [], navigate, setModal, notify, onImport, openWork, tasks = [], onTasksChange, activity = [], rightRail }) {
  const account = useAccount();
  const [kind, setKind] = useState('全部');
  const [sort, setSort] = useState('recent');
  const [view, setView] = useState('grid');
  const list = getDashboardWorks(works, { kind, sort });
  const stats = dashboardStats(works);
  const shownWorks = list.slice(0, 6);
  const displayName = dashboardDisplayName(account?.user);
  const open = work => typeof openWork === 'function' ? openWork(work) : navigate(`editor/${work.id}`);
  const create = () => setModal({ type: 'create', kind: '长篇小说' });
  const useTool = id => {
    if (id === 'create') return create();
    const tool = tools.find(item => item.id === id);
    if (tool) setModal({ type: 'tool', tool });
    else notify?.('这个工具暂时不可用，请稍后重试。');
  };

  return <div className="workspace-dashboard">
    <div className="workspace-dashboard-layout">
      <div className="workspace-dashboard-main-column">
    <header className="workspace-dashboard-welcome">
      <div className="workspace-dashboard-welcome-copy"><p className="workspace-dashboard-eyebrow"><Feather size={14} aria-hidden="true" />我的创作空间</p><h1>{dashboardGreeting()}，{displayName}</h1><p className="workspace-dashboard-welcome-description">今天，想写一个什么故事？让每一次灵感，都有下文。</p></div>
      {typeof onImport === 'function' && <button type="button" className="workspace-dashboard-import" onClick={onImport}><Upload size={15} aria-hidden="true" />导入文稿</button>}
    </header>

    <section className="workspace-dashboard-quick-actions" aria-label="开始创作">{quickActions.map(({ id, title, description, Icon, tone }) => <button type="button" className={`workspace-dashboard-quick-card workspace-dashboard-tone-${tone}`} key={id} onClick={() => useTool(id)}><span className="workspace-dashboard-quick-icon"><Icon size={23} aria-hidden="true" /></span><span className="workspace-dashboard-quick-copy"><strong>{title}</strong><span>{description}</span></span><ChevronRight className="workspace-dashboard-quick-arrow" size={16} aria-hidden="true" /></button>)}</section>

        <section className="workspace-dashboard-library" aria-labelledby="workspace-dashboard-works-title">
          <div className="workspace-dashboard-section-heading"><h2 id="workspace-dashboard-works-title">我的作品<span>{stats.workCount}</span></h2><button type="button" className="workspace-dashboard-text-link" onClick={() => navigate('works')}>管理全部作品<ArrowRight size={14} aria-hidden="true" /></button></div>
          <div className="workspace-dashboard-library-toolbar"><div className="workspace-dashboard-kind-tabs" role="group" aria-label="作品类型">{kinds.map(value => <button type="button" key={value} aria-pressed={kind === value} className={kind === value ? 'workspace-dashboard-kind-active' : ''} onClick={() => setKind(value)}>{value}</button>)}</div><div className="workspace-dashboard-library-controls"><label className="workspace-dashboard-sort"><span className="workspace-dashboard-sr-only">作品排序</span><select aria-label="作品排序" value={sort} onChange={event => setSort(event.target.value)}><option value="recent">最近编辑</option><option value="words">字数最多</option><option value="name">作品名称</option></select></label><div className="workspace-dashboard-view-toggle" role="group" aria-label="作品展示方式"><button type="button" aria-label="卡片视图" aria-pressed={view === 'grid'} onClick={() => setView('grid')}><LayoutGrid size={16} aria-hidden="true" /></button><button type="button" aria-label="列表视图" aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={17} aria-hidden="true" /></button></div></div></div>

          {shownWorks.length > 0 ? <>
            <div className={`workspace-dashboard-works workspace-dashboard-works-${view}`}>
              {shownWorks.map(work => <DashboardWork key={work.id} work={work} view={view} onOpen={() => open(work)} onManage={() => setModal({ type: 'work-details', work })} />)}
            </div>
            {list.length > shownWorks.length && <div className="workspace-dashboard-more-works"><span>显示 {shownWorks.length} 部，共 {list.length} 部作品</span><button type="button" className="workspace-dashboard-text-link" onClick={() => navigate('works')}>查看全部作品<ArrowRight size={14} aria-hidden="true" /></button></div>}
          </> : <div className="workspace-dashboard-empty">
            <span className="workspace-dashboard-empty-icon"><BookOpen size={31} aria-hidden="true" /></span>
            <h3>{stats.workCount === 0 ? '你的第一部作品，从这里开始' : `还没有${kind}作品`}</h3>
            <p>{stats.workCount === 0 ? '新建小说，或导入已有的 TXT 文稿，把想法写成故事。' : '换一个分类，接着上一次的灵感继续写。'}</p>
            <div>{stats.workCount === 0 ? <>
              <button type="button" className="workspace-dashboard-primary-button" onClick={create}><Plus size={15} aria-hidden="true" />新建小说</button>
              {typeof onImport === 'function' && <button type="button" className="workspace-dashboard-secondary-button" onClick={onImport}><Upload size={15} aria-hidden="true" />导入文稿</button>}
            </> : <button type="button" className="workspace-dashboard-secondary-button" onClick={() => setKind('全部')}>查看全部作品<ArrowRight size={14} aria-hidden="true" /></button>}</div>
          </div>}
        </section>

        <section className="workspace-dashboard-inspiration" aria-label="AI创作助手"><div><span className="workspace-dashboard-inspiration-label"><Sparkles size={14} aria-hidden="true" />随时接住你的灵感</span><h2>灵感枯竭？试试 AI 创作助手</h2><p>聊聊故事走向，推敲人物动机，一起找到落笔的方向。</p><button type="button" onClick={() => navigate('conversation')}>开启创作对话<ArrowRight size={15} aria-hidden="true" /></button></div></section>
      </div>
      <aside className="workspace-dashboard-right-rail" aria-label="创作概览与计划">{rightRail ?? <WorkspaceInsights works={works} activity={activity} tasks={tasks} onTasksChange={onTasksChange} navigate={navigate} setModal={setModal} notify={notify} />}</aside>
    </div>
  </div>;
}
