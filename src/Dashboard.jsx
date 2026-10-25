import React, { useState } from 'react';
import {ArrowRight, ArrowUpRight, FileText, Search, Sparkles, Star, Workflow} from 'lucide-react';
import { tools } from './data';
import {ToolArtwork} from './ToolArtwork';
import {ToolGuide} from './ToolGuide';

export function ToolPoster({tool}) {
  return <ToolArtwork tool={tool}/>;
}
export function MarketCard({tool,favorite,onFavorite,onOpen,onUseExample}) {
  const [guideOpen,setGuideOpen] = useState(false);
  return <article className="market-card"><button className="market-cover-button" onClick={() => onOpen()} aria-label={`查看${tool.title}`}><ToolPoster tool={tool}/></button><div className="market-card-content"><span className="market-category">{tool.category}</span><button className="market-title" onClick={() => onOpen()}>{tool.title}</button><p>{tool.desc}</p><div className="market-tags">{tool.tags.map(tag=><span key={tag}>{tag}</span>)}</div><div className="market-author"><button className="market-guide-toggle" aria-label={`查看${tool.title}使用指南`} aria-expanded={guideOpen} onClick={() => setGuideOpen(!guideOpen)}>{guideOpen ? '收起指南' : '使用指南'}</button><button aria-label={favorite?`取消收藏${tool.title}`:`收藏${tool.title}`} className={favorite?'subscribed':''} aria-pressed={favorite} onClick={onFavorite}>{favorite?<><Star size={14} fill="currentColor"/>已收藏</>:<><Star size={14}/>收藏</>}</button></div></div>{guideOpen && <div className="market-tool-guide"><ToolGuide toolId={tool.id} onUseExample={onUseExample}/></div>}</article>;
}

export {Generator, ReferenceHome} from './HomeDesk';

export function ReferenceTools({favorites,toggleFavorite,setModal,navigate}) {
  const [category,setCategory]=useState('全部');
  const [tab,setTab]=useState('工具广场');
  const [query,setQuery]=useState('');
  const [sort,setSort]=useState('推荐排序');
  const list=tools.filter(t=>(category==='全部'||t.category===category)&&(tab!=='我的收藏'||favorites.includes(t.id))&&`${t.title}${t.desc}${t.tags.join('')}`.includes(query.trim()));
  if(sort==='名称排序')list.sort((a,b)=>a.title.localeCompare(b.title,'zh-CN'));
  return <div className="reference-tools"><div className="page-heading market-page-heading"><div><span className="page-kicker"><Sparkles size={14}/>创作工具箱</span><h1>写作工具</h1><p>从第一颗灵感到最后一次修改，找到需要的那一步。</p></div><div className="heading-actions"><button className="button secondary" onClick={()=>navigate('workflows')}><Workflow size={16}/>探索创作工作流<ArrowUpRight size={15}/></button></div></div><div className="market-top-tabs">{['工具广场','我的收藏','创作工作流'].map(v=><button key={v} className={tab===v?'active':''} aria-pressed={tab===v} onClick={()=>v==='创作工作流'?navigate('workflows'):setTab(v)}>{v}{v==='我的收藏'&&<small>{favorites.length}</small>}</button>)}</div><div className="market-filters"><span>分类</span><div>{['全部','灵感构思','大纲规划','人物设定','正文创作','修改润色'].map(v=><button key={v} aria-pressed={category===v} className={category===v?'active':''} onClick={()=>setCategory(v)}>{v}</button>)}</div></div><div className="market-list-toolbar"><span>{tab==='我的收藏'?'我的收藏':'全部工具'}<small>{list.length} 款</small></span><div><label><Search size={16}/><input aria-label="搜索工具" placeholder="搜索工具名称、关键词" value={query} onChange={e=>setQuery(e.target.value)}/></label><select aria-label="工具排序" value={sort} onChange={e=>setSort(e.target.value)}><option>推荐排序</option><option>名称排序</option></select></div></div><div className="market-grid full-market-grid">{list.map(tool=><MarketCard key={tool.id} tool={tool} favorite={favorites.includes(tool.id)} onFavorite={()=>toggleFavorite(tool.id)} onOpen={()=>setModal({type:'tool',tool})} onUseExample={prompt=>setModal({type:'tool',tool,prompt})}/>)}</div>{!list.length&&<div className="market-empty"><Search size={30}/><h3>{tab==='我的收藏'?'还没有收藏这类工具':'暂时没有找到相关工具'}</h3><p>试试其他分类，或者换个关键词。</p><button onClick={()=>{setQuery('');setCategory('全部');setTab('工具广场');}}>浏览全部工具<ArrowRight size={14}/></button></div>}<p className="market-data-note"><InfoNote/>工具会引用所选作品与章节，生成后可预览采纳；示例模式不会调用模型。</p></div>;
}
function InfoNote(){return <FileText size={13}/>;}
