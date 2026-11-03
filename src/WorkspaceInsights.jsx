import React, { useId, useMemo, useState } from 'react';
import { ArrowUpRight, BookOpen, CalendarDays, Check, ChevronLeft, ChevronRight, FileText, Lightbulb, ListChecks, MessagesSquare, Plus, ScanText, Type, X } from 'lucide-react';
import { tools } from './data.js';
import { newId } from './works.js';
import { buildWorkspaceActivityDays, MAX_TASK_TEXT_LENGTH, MAX_WORKSPACE_TASKS, normalizeWorkspaceTasks, shiftWorkspaceMonth, toActivityDate, workspaceCalendarCells, workspaceSnapshotStats } from './workspaceActivity.mjs';
import './workspace-insights.css';

const shortcuts = [
  { id: 'ideas', label: '灵感生成', Icon: Lightbulb, tone: 'amber' },
  { id: 'title', label: '书名与简介', Icon: Type, tone: 'green' },
  { id: 'dialogue', label: '对白打磨', Icon: MessagesSquare, tone: 'purple' },
  { id: 'review', label: '章节审稿', Icon: ScanText, tone: 'blue' },
];
const monthLabel = month => `${Number(month.slice(0, 4))} 年 ${Number(month.slice(5))} 月`;
const dayLabel = cell => {
  const date = cell.date.replace(/^(\d+)-(\d+)-(\d+)$/, (_, year, month, day) => `${Number(year)}年${Number(month)}月${Number(day)}日`);
  const sources = [cell.recordedWorks ? `已记录 ${cell.recordedWorks} 部作品的活动` : '', cell.knownWorks ? `${cell.knownWorks} 部作品的已知创建或编辑日期` : ''].filter(Boolean);
  return `${date}：${sources.length ? sources.join('；') : '无已记录活动或已知作品日期'}`;
};

export default function WorkspaceInsights({ works = [], activity = [], tasks = [], onTasksChange, navigate, setModal, notify = () => {} }) {
  const [today] = useState(() => toActivityDate(new Date().toISOString()));
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [selectedDay, setSelectedDay] = useState(null);
  const [draft, setDraft] = useState(''), [taskError, setTaskError] = useState('');
  const taskInputId = useId();
  const stats = useMemo(() => workspaceSnapshotStats(works), [works]);
  const activityDays = useMemo(() => buildWorkspaceActivityDays(works, activity), [works, activity]);
  const cells = useMemo(() => workspaceCalendarCells(month, activityDays), [month, activityDays]);
  const taskList = useMemo(() => normalizeWorkspaceTasks(tasks), [tasks]);
  const completed = taskList.filter(task => task.done).length;
  const editable = typeof onTasksChange === 'function';
  const recordedDays = cells.filter(cell => cell?.recordedWorks > 0).length;
  const selected = cells.find(cell => cell?.date === selectedDay);
  const changeMonth = offset => { setMonth(current => shiftWorkspaceMonth(current, offset)); setSelectedDay(null); };
  const saveTasks = updater => {
    if (!editable) return false;
    try {
      const saved = onTasksChange(updater);
      if (saved === false) notify('任务已保留，请检查工作空间的保存状态。');
      setTaskError('');
      return true;
    } catch {
      setTaskError('任务暂未保存，请保留输入后重试。');
      return false;
    }
  };
  const addTask = event => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) { setTaskError('先写下一个你想完成的任务。'); return; }
    if (text.length > MAX_TASK_TEXT_LENGTH) { setTaskError('每个任务最多 120 字，请缩短后添加。'); return; }
    if (taskList.length >= MAX_WORKSPACE_TASKS) { setTaskError('最多保留 100 个任务，请先移除不需要的任务。'); return; }
    // Generate once per explicit add, outside the collection's function updater.
    const task = { id: newId(), text, done: false, createdAt: new Date().toISOString() };
    if (saveTasks(previous => {
      const current = normalizeWorkspaceTasks(previous);
      return current.length < MAX_WORKSPACE_TASKS ? [...current, task] : previous;
    })) setDraft('');
  };
  const toggleTask = (id, done) => saveTasks(previous => normalizeWorkspaceTasks(previous).map(task => task.id === id ? { ...task, done } : task));
  const removeTask = id => saveTasks(previous => normalizeWorkspaceTasks(previous).filter(task => task.id !== id));

  return <div className="workspace-insights" aria-label="创作数据与计划">
    <section className="wi-card wi-statistics" aria-labelledby={`${taskInputId}-stats`}>
      <header className="wi-heading"><h2 id={`${taskInputId}-stats`}>创作数据</h2><span className="wi-range-label">全部作品</span></header>
      <div className="wi-stat-grid">
        <div className="wi-stat wi-stat-words"><span><FileText size={14} aria-hidden="true" />正文字数</span><strong>{stats.words.toLocaleString('zh-CN')}<small>字</small></strong></div>
        <div className="wi-stat wi-stat-works"><span><BookOpen size={14} aria-hidden="true" />作品</span><strong>{stats.works.toLocaleString('zh-CN')}<small>部</small></strong></div>
        <div className="wi-stat wi-stat-chapters"><span><ListChecks size={14} aria-hidden="true" />章节</span><strong>{stats.chapters.toLocaleString('zh-CN')}<small>章 / 场</small></strong></div>
      </div>
      <p className="wi-card-note">按当前作品正文统计，不含回收站和大纲、人物设定。</p>
    </section>

    <section className="wi-card wi-calendar" aria-labelledby={`${taskInputId}-calendar`}>
      <header className="wi-heading"><h2 id={`${taskInputId}-calendar`}><CalendarDays size={16} aria-hidden="true" />创作日历</h2><span className="wi-record-count">记录 {recordedDays} 天</span></header>
      <div className="wi-month-controls"><strong aria-live="polite">{monthLabel(month)}</strong><div><button type="button" aria-label="查看上个月的创作记录" onClick={() => changeMonth(-1)}><ChevronLeft size={16} /></button><button type="button" className="wi-current-month" aria-label="回到本月创作记录" disabled={month === today.slice(0, 7)} onClick={() => { setMonth(today.slice(0, 7)); setSelectedDay(null); }}>本月</button><button type="button" aria-label="查看下个月的创作记录" onClick={() => changeMonth(1)}><ChevronRight size={16} /></button></div></div>
      <div className="wi-weekdays" aria-hidden="true">{['一', '二', '三', '四', '五', '六', '日'].map(day => <span key={day}>{day}</span>)}</div>
      <div className="wi-calendar-grid" role="group" aria-label={`${monthLabel(month)}的已记录活动`}>
        {cells.map((cell, index) => cell ? <button type="button" key={cell.date} className={`wi-day${cell.date === today ? ' wi-today' : ''}${cell.date === selectedDay ? ' wi-selected-day' : ''}`} data-activity-level={Math.min(cell.recordedWorks, 3)} data-known-date={cell.knownWorks > 0 && !cell.recordedWorks ? 'true' : undefined} aria-label={dayLabel(cell)} aria-pressed={cell.date === selectedDay} title={dayLabel(cell)} onClick={() => setSelectedDay(cell.date)}><time dateTime={cell.date}>{cell.day}</time></button> : <span className="wi-empty-day" aria-hidden="true" key={`empty-${index}`} />)}
      </div>
      <p className="wi-day-detail" role="status">{selected ? dayLabel(selected) : '选择日期，查看当日记录的来源。'}</p>
      <div className="wi-calendar-legend"><span><i className="wi-legend-recorded" />已记录活动</span><span><i className="wi-legend-known" />已知作品日期</span><span><i className="wi-legend-empty" />无记录</span></div>
      <p className="wi-card-note">仅显示当前作品已记录的活动；创建、更新日期补充为已知日期，不代表完整历史。日期按北京时间显示。</p>
    </section>

    <section className="wi-card wi-tasks" aria-labelledby={`${taskInputId}-tasks`}>
      <header className="wi-heading"><h2 id={`${taskInputId}-tasks`}>写作待办</h2><span className="wi-task-count">{completed} / {taskList.length} 已完成</span></header>
      {taskList.length ? <ul className="wi-task-list">{taskList.map(task => <li className={task.done ? 'wi-task-done' : undefined} key={task.id}><label><input type="checkbox" aria-label={`完成任务：${task.text}`} checked={task.done} disabled={!editable} onChange={event => toggleTask(task.id, event.target.checked)} /><span className="wi-checkbox-mark" aria-hidden="true">{task.done && <Check size={12} />}</span><span className="wi-task-text">{task.text}</span></label><button type="button" className="wi-remove-task" aria-label={`删除任务：${task.text}`} title="移除任务" disabled={!editable} onClick={() => removeTask(task.id)}><X size={14} /></button></li>)}</ul> : <div className="wi-task-empty"><ListChecks size={23} aria-hidden="true" /><p>给今天留一个小目标</p><span>写下你自己的任务，完成后再勾选。</span></div>}
      <form className="wi-task-form" onSubmit={addTask}><label className="wi-visually-hidden" htmlFor={taskInputId}>新增写作任务</label><input id={taskInputId} aria-label="新增写作任务" aria-invalid={Boolean(taskError)} aria-describedby={taskError ? `${taskInputId}-error` : undefined} value={draft} maxLength={MAX_TASK_TEXT_LENGTH} placeholder="例如：完成第一章的对话修改" disabled={!editable || taskList.length >= MAX_WORKSPACE_TASKS} onChange={event => { setDraft(event.target.value); setTaskError(''); }} /><button type="submit" aria-label="添加写作任务" disabled={!editable || taskList.length >= MAX_WORKSPACE_TASKS}><Plus size={17} /></button></form>
      {taskError && <p className="wi-task-error" id={`${taskInputId}-error`} role="alert">{taskError}</p>}
      {!editable && <p className="wi-card-note">任务清单暂不可保存，请稍后再试。</p>}
      {taskList.length >= MAX_WORKSPACE_TASKS && <p className="wi-card-note">已达到 100 个任务的上限，可移除不再需要的任务。</p>}
    </section>

    <section className="wi-card wi-tools" aria-labelledby={`${taskInputId}-tools`}>
      <header className="wi-heading"><h2 id={`${taskInputId}-tools`}>常用工具</h2>{typeof navigate === 'function' && <button type="button" className="wi-all-tools" onClick={() => navigate('tools')}>全部工具<ArrowUpRight size={13} /></button>}</header>
      <div className="wi-shortcuts">{shortcuts.map(({ id, label, Icon, tone }) => {
        const tool = tools.find(item => item.id === id);
        return <button type="button" key={id} aria-label={`打开${label}`} disabled={!tool || typeof setModal !== 'function'} onClick={() => setModal({ type: 'tool', tool })}><span className={`wi-shortcut-icon wi-tone-${tone}`}><Icon size={17} aria-hidden="true" /></span><span>{label}</span></button>;
      })}</div>
    </section>
  </div>;
}
