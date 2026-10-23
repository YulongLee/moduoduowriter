import React, { useState } from 'react';
import { ArrowRight, ArrowUpRight, BookOpen, CheckCheck, Clock3, Download, FileText, LayoutGrid, List, Plus, Settings2, Search, Type, Upload } from 'lucide-react';
import { BookCover } from './Art';
import { workWords } from './data';

export function WorkCard({work,onOpen,onExport,onManage}) {
  return <article className={`work-card shelf-${work.cover||'plain'}`}>
    <div className="work-cover-stage"><button className="work-cover-open" onClick={onOpen} aria-label={`继续写作：${work.title}`}><span className="shelf-ring"/><BookCover work={work} large/><span className="work-cover-cta">打开作品<ArrowUpRight size={15}/></span></button><span className="work-cover-kind">{work.kind}</span>{onManage&&<button className="work-export work-manage-button icon-button" title="管理作品" aria-label={`管理${work.title}`} onClick={onManage}><Settings2 size={16}/></button>}{onExport&&<button className="work-export icon-button" title="导出作品" aria-label={`导出${work.title}`} onClick={onExport}><Download size={16}/></button>}</div>
    <div className="work-card-content"><div className="work-card-category"><span>{work.genre}</span><span><i/>创作中</span></div><button className="work-name" onClick={onOpen}>{work.title}</button><p>{work.description||'一个等待继续书写的故事。'}</p><div className="work-card-stats"><span><Type size={13}/>{workWords(work).toLocaleString()} 字</span><span><FileText size={13}/>{work.chapters.length} 章</span></div></div>
    <footer className="work-card-bottom"><span><Clock3 size={12}/>{work.updated}</span><button onClick={onOpen}>继续写作<ArrowRight size={15}/></button></footer>
  </article>;
}

function WorkRow({work,onOpen,onExport,onManage}) {
  return <article className="work-list-row"><button className="work-list-name" onClick={onOpen}><BookCover work={work}/><span><strong>{work.title}</strong><small>{work.kind} · {work.genre}</small></span></button><span className="work-list-words">{workWords(work).toLocaleString()}<small>字 · {work.chapters.length} 章</small></span><span className="work-list-time">{work.updated}</span>{onManage&&<button className="text-button" aria-label={`管理${work.title}`} onClick={onManage}>管理</button>}<button className="text-button" onClick={onOpen}>继续写作<ArrowRight size={14}/></button>{onExport&&<button className="icon-button" aria-label={`导出${work.title}`} onClick={onExport}><Download size={16}/></button>}</article>;
}

export function WorksPage({works,navigate,setModal,onImport,notify,trashWorks=[],onRestoreWork}) {
  const [filter,setFilter]=useState('全部作品');const [showTrash,setShowTrash]=useState(false);
  const [query,setQuery]=useState('');
  const [sort,setSort]=useState('recent');
  const [view,setView]=useState('grid');
  const list=works.filter(w=>(filter==='全部作品'||w.kind===filter)&&`${w.title}${w.genre}`.includes(query.trim()));
  if(sort==='words')list.sort((a,b)=>workWords(b)-workWords(a));
  if(sort==='name')list.sort((a,b)=>a.title.localeCompare(b.title,'zh-CN'));
  const recent=works[0];
  const exportWork=work=>{const text=`${work.title}\n\n${work.chapters.map(ch=>`${ch.title}\n\n${ch.text}`).join('\n\n')}`;const url=URL.createObjectURL(new Blob(['\ufeff'+text],{type:'text/plain;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=`${work.title}.txt`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('完整作品已导出为 TXT');};
  return <div className="library-page">
    <div className="page-heading"><div><span className="page-kicker"><BookOpen size={14}/>我的创作空间</span><h1>我的作品</h1><p>每一个未完的故事，都值得被继续。</p></div><div className="heading-actions"><button className="button secondary" onClick={onImport}><Upload size={16}/>导入文稿</button><button className="button primary" onClick={()=>setModal({type:'create'})}><Plus size={17}/>新建作品</button></div></div>
    <section className="library-overview">{recent?<div className={`library-resume resume-${recent.cover}`}><div><span className="resume-label"><span/>接着上次的灵感</span><h2>{recent.title}</h2><p>{recent.chapters[0]?.title} <span>· {recent.updated}</span></p><button onClick={()=>navigate(`editor/${recent.id}`)}>继续写作<ArrowRight size={15}/></button></div><div className="resume-books" aria-hidden="true"><i/><BookCover work={recent}/></div></div>:<div className="library-resume"><div><span className="resume-label">你的第一个故事</span><h2>给灵感一个归处。</h2><p>从空白文稿开始，或导入已经写好的文字。</p><button onClick={()=>setModal({type:'create'})}>创建第一部作品<ArrowRight size={15}/></button></div></div>}
      <div className="library-metrics"><div><span><BookOpen size={16}/>作品总数</span><strong>{works.length}<small>部</small></strong></div><div><span><Type size={16}/>创作总字数</span><strong>{works.reduce((sum,w)=>sum+workWords(w),0).toLocaleString()}<small>字</small></strong></div><p><CheckCheck size={14}/>本地保存，随时导出</p></div>
    </section>
    <div className="library-section-title"><button className="text-button" onClick={()=>setShowTrash(!showTrash)}>{showTrash?'返回作品书架':`回收站（${trashWorks.length}）`}</button><h2>作品书架<span>{works.length}</span></h2><div className="library-view-toggle" aria-label="作品显示方式"><button className={view==='grid'?'active':''} aria-label="卡片视图" aria-pressed={view==='grid'} onClick={()=>setView('grid')}><LayoutGrid size={17}/></button><button className={view==='list'?'active':''} aria-label="列表视图" aria-pressed={view==='list'} onClick={()=>setView('list')}><List size={18}/></button></div></div>
    <div className="works-toolbar"><div className="pill-tabs">{['全部作品','长篇小说','短篇故事','剧本'].map(t=><button key={t} aria-pressed={filter===t} className={filter===t?'active':''} onClick={()=>setFilter(t)}>{t}</button>)}</div><div className="toolbar-end"><label className="inline-search"><Search size={16}/><input aria-label="搜索作品" value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索作品名称"/></label><select aria-label="排序方式" value={sort} onChange={e=>setSort(e.target.value)}><option value="recent">最近编辑</option><option value="words">字数最多</option><option value="name">名称排序</option></select></div></div>
    {showTrash?<div className="trash-list">{trashWorks.length?trashWorks.map(work=><article key={work.id}><span><strong>{work.title}</strong><small>{work.kind} · {workWords(work).toLocaleString()} 字</small></span><button className="button secondary" onClick={()=>onRestoreWork(work)}>恢复作品<ArrowRight size={14}/></button></article>):<div className="empty-state"><p>回收站是空的。</p></div>}</div>:list.length>0?<div className={view==='grid'?'work-grid full-works':'work-list'}>{list.map(work=>view==='grid'?<WorkCard key={work.id} work={work} onOpen={()=>navigate(`editor/${work.id}`)} onExport={()=>exportWork(work)} onManage={()=>setModal({type:'work-details',work})}/>:<WorkRow key={work.id} work={work} onOpen={()=>navigate(`editor/${work.id}`)} onExport={()=>exportWork(work)} onManage={()=>setModal({type:'work-details',work})}/>)}</div>:<div className="empty-state library-empty"><Search size={31}/><h3>{query?'没有找到这部作品':'这里还没有作品'}</h3><p>{query?'换个书名或题材，或者清空筛选。':'写下一句话，就有了新的开始。'}</p><button className="button secondary" onClick={()=>{if(query||filter!=='全部作品'){setQuery('');setFilter('全部作品');}else setModal({type:'create'});}}>{query||filter!=='全部作品'?'清空筛选':'新建作品'}<ArrowRight size={14}/></button></div>}
  </div>;
}
