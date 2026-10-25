import React, {useState} from 'react';
import {ArrowRight, ArrowUpRight, BookMarked, BookOpen, ChevronDown, ChevronRight, CircleHelp, Clapperboard, Cloud, Crown, Feather, Lightbulb, ListTree, MessagesSquare, Plus, RefreshCw, ScanText, Send, Settings2, Sparkles, Star, Type, Upload, UsersRound, WandSparkles, X} from 'lucide-react';
import {useGeneration} from './Generation';
import {BookCover} from './Art';
import {ToolGuide} from './ToolGuide';
import {toolGuides} from './toolGuides';
import {tools, inspirations, workWords} from './data';

const genres = ['玄幻','都市','言情','悬疑','科幻','仙侠','历史','奇幻','武侠','末世','游戏','现实','青春','治愈'];
const ideas = ['离职后，我继承了一家能修复记忆的旧书店','全城停电那晚，只有失踪十年的灯塔亮了','穿越成小说里的反派，我决定先救下主角','重逢的第一天，他归还了那封迟到的情书','星舰最后一位乘客，是来自未来的自己','她的每一幅画，都会在第二天变成现实','最后一班地铁，把我送回了十年前的夏天','我在末日开了一家只接受故事付款的旅馆'];
const toolIcons = {ideas:Lightbulb,outline:ListTree,character:UsersRound,polish:WandSparkles,continue:Feather,dialogue:MessagesSquare,review:ScanText,title:Type};

export function Generator({setModal, notify, onImport}) {
  const generation = useGeneration();
  const [prompt,setPrompt] = useState(''), [genre,setGenre] = useState('玄幻'), [audience,setAudience] = useState('全频');
  const [perspective,setPerspective] = useState('第三人称'), [length,setLength] = useState('长篇小说'), [mode,setMode] = useState('灵感共创'), [batch,setBatch] = useState(0), [moreGenres,setMoreGenres] = useState(false);
  const submit = event => {
    event.preventDefault();
    if (!prompt.trim()) return notify('先写下一点灵感，或者选择下方的示例');
    setModal({type:'quick-start', autoGenerate:true, idea:prompt.trim(), genre, audience, perspective, kind:length, mode});
  };
  const choices = (label,value,setValue,values,extra) => <div className="home-choice-group" role="group" aria-label={label}><span>{label}</span><div>{values.map(option => <button type="button" key={option} aria-pressed={value === option} className={value === option ? 'selected' : ''} onClick={() => setValue(option)}>{option}</button>)}{extra}</div></div>;
  const serviceLabel = generation.mode === 'ai' ? '智能创作' : '示例体验';
  return <section className="home-composer" aria-label="一句话创作">
    <header className="home-composer-heading"><h1>一句话生成<span>爆款小说</span></h1><p>输入故事灵感，生成小说大纲、人物设定和开篇正文</p></header>
    <form className="home-composer-form" onSubmit={submit}>
      <div className="home-prompt-field"><textarea aria-label="一句话故事灵感" maxLength={500} value={prompt} onChange={event => setPrompt(event.target.value)} placeholder={'你想写一个怎样的故事？\n例如：一位能听见旧物记忆的修复师，收到了一封来自明天的信……'}/><span>{prompt.length} / 500</span></div>
      <div className="home-creation-options">{choices('故事题材',genre,setGenre,moreGenres ? genres : genres.slice(0,8).concat(genres.indexOf(genre) >= 8 ? [genre] : []),<button type="button" className="home-more-genres" aria-label="更多故事题材" aria-expanded={moreGenres} onClick={() => setMoreGenres(!moreGenres)}>{moreGenres ? '收起' : '更多'}<ChevronDown size={13}/></button>)}<div className="home-preference-row">{choices('目标读者',audience,setAudience,['男频','女频','全频'])}{choices('叙述视角',perspective,setPerspective,['第一人称','第三人称'])}{choices('作品篇幅',length,setLength,['短篇故事','长篇小说'])}</div></div>
      <div className="home-composer-footer"><div><label className="home-mode-select"><Sparkles size={17}/><select aria-label="创作模式" value={mode} onChange={event => setMode(event.target.value)}><option>灵感共创</option><option>长篇规划</option></select></label><span className="home-service-status">{serviceLabel}</span>{onImport&&<button type="button" className="home-text-link home-import" onClick={onImport}><Upload size={15}/>导入文稿</button>}</div><button className="button primary" type="submit"><Sparkles size={19}/>开始生成小说<ArrowRight size={19}/></button></div>
    </form>
    <div className="home-prompt-ideas"><span><Lightbulb size={17}/>试试这些灵感</span>{ideas.slice(batch*2,batch*2+2).map(text => <button type="button" key={text} title={text} onClick={() => {setPrompt(text); setGenre(['悬疑','都市','奇幻','言情'][batch]);}}>{text}</button>)}<button className="home-refresh" type="button" aria-label="换一批灵感" title="换一批灵感" onClick={() => setBatch((batch+1)%4)}><RefreshCw size={17}/></button></div>
  </section>;
}

function ContinueCard({works, navigate, setModal}) {
  return <section className="home-resume" aria-label="继续创作与创作概况">
    {works.length ? <div className="home-books-grid">{works.slice(0,3).map((work,index) => <article className={`home-book-card${index === 0 ? ' home-book-recent' : ''}`} key={work.id}>
      <button className="home-book-open" aria-label={`打开作品：${work.title}`} onClick={() => navigate(`editor/${work.id}`)}><div className="home-book-cover" aria-hidden="true"><BookCover work={work}/></div><span className="home-book-copy"><strong>{work.title}</strong><small>{work.kind} · {work.genre}</small><small>{workWords(work).toLocaleString()} 字 · {work.chapters.length} 章</small></span><ChevronRight size={16}/></button>
      {index === 0 && <button className="home-resume-action" aria-label={`继续最近作品：${work.title}`} onClick={() => navigate(`editor/${work.id}`)}><Feather size={13}/>继续写作<ArrowRight size={13}/></button>}
    </article>)}</div> : <div className="home-resume-empty"><span className="home-empty-book-icon"><BookOpen size={25}/></span><div><h3>创建第一部作品</h3><p>你的故事，值得被写下。让第一句话有个归处。</p></div><button className="home-resume-action" aria-label="创建第一部作品" onClick={() => setModal({type:'create'})}><Plus size={15}/>新建我的第一部作品<ArrowRight size={15}/></button></div>}
  </section>;
}

function HomeToolCard({tool, favorite, onFavorite, onOpen, onGuide, guideOpen}) {
  const Icon = toolIcons[tool.id] || Sparkles;
  return <article className={`home-tool-card home-tool-${tool.id}`}><button className="home-tool-open" aria-label={`使用${tool.title}`} onClick={onOpen}><span className="home-tool-icon" aria-hidden="true"><Icon size={26} strokeWidth={1.75}/></span><span className="home-tool-copy"><strong>{tool.title}</strong><small>{toolGuides[tool.id]?.summary || tool.desc}</small></span><ChevronRight size={14}/></button><div className="home-tool-meta"><button className="home-tool-guide-link" aria-label={`查看${tool.title}使用指南`} aria-expanded={guideOpen} onClick={onGuide}>使用指南</button><button className={`home-tool-favorite${favorite ? ' active' : ''}`} aria-label={favorite ? `取消收藏${tool.title}` : `收藏${tool.title}`} title={favorite ? '取消收藏' : '收藏工具'} aria-pressed={favorite} onClick={onFavorite}><Star size={14} fill={favorite ? 'currentColor' : 'none'}/>{favorite?'已收藏':'收藏'}</button></div></article>;
}

function HomeSupport({works, navigate, setModal}) {
  const [index,setIndex] = useState(0), idea = inspirations[index];
  const steps = [['确定题材',() => setModal({type:'create'})],['搭建大纲',() => setModal({type:'tool', tool:tools.find(tool => tool.id === 'outline'), workId:works[0]?.id})],['写好章节',() => works[0] ? navigate(`editor/${works[0].id}`) : setModal({type:'create'})],['准备投稿',() => navigate('submit')]];
  return <div className="home-support" aria-label="创作指南与灵感"><aside className="home-guide-strip" aria-label="创作指南"><h2><BookOpen size={18}/>创作指南</h2><div className="home-guide-steps">{steps.map(([title,action],i) => <React.Fragment key={title}><button onClick={action}><span>{i+1}</span>{title}</button>{i < steps.length-1 && <ChevronRight size={13} aria-hidden="true"/>}</React.Fragment>)}</div><button className="home-text-link" onClick={() => navigate('workflows')}>查看工作流<ArrowRight size={14}/></button></aside>
    <div className="home-service-links"><details className="home-daily-inspiration"><summary><Lightbulb size={13}/>今日灵感</summary><div><blockquote>{idea.quote.replace('\n','')}</blockquote><span>{idea.tags.join(' · ')}</span><button className="home-icon-button" aria-label="切换今日灵感" onClick={() => setIndex((index+1)%inspirations.length)}><RefreshCw size={14}/></button><button className="home-text-link" onClick={() => setModal({type:'create',idea:idea.prompt})}>用这个灵感<ArrowRight size={13}/></button></div></details><button onClick={() => setModal({type:'settings'})}><Settings2 size={13}/>创作设置</button><button onClick={() => setModal({type:'settings'})}><Cloud size={13}/>备份恢复</button><button aria-label="使用帮助" onClick={() => setModal({type:'help'})}><CircleHelp size={13}/>帮助</button><button onClick={() => navigate('membership')}><Crown size={13}/>查看创作方案</button></div>
  </div>;
}

export function ReferenceHome({works, navigate, setModal, notify, favorites, toggleFavorite, onImport}) {
  const [tab,setTab] = useState('推荐工具'), [guideId,setGuideId] = useState(null);
  const list = tab === '我的收藏' ? tools.filter(tool => favorites.includes(tool.id)) : tools;
  const guideTool = list.find(tool => tool.id === guideId);
  const entries = [['小说写作','从大纲到每一章',BookOpen,'novels','mint'],['剧本创作','写好每一场戏',Clapperboard,'scripts','violet'],['小说拆书','拆解结构与写法',BookMarked,'dismantle','blue'],['投稿中心','整理文稿与进度',Send,'submit','amber']];
  return <div className="home-v2">
    <Generator setModal={setModal} notify={notify} onImport={onImport}/>
    <section className="home-books-section"><div className="home-section-heading"><h2>继续你的故事</h2><button className="home-text-link" onClick={() => navigate('works')}>全部作品<ArrowRight size={15}/></button></div><ContinueCard works={works} navigate={navigate} setModal={setModal}/></section>
    <section className="home-entry-grid" aria-label="创作快捷入口">{entries.map(([title,description,Icon,route,color]) => <button className={`home-entry entry-${color}`} key={route} onClick={() => navigate(route)}><span className="home-entry-icon"><Icon size={23} strokeWidth={1.8}/></span><span><strong>{title}</strong><small>{description}</small></span><ArrowUpRight size={16}/></button>)}</section>
    <section className="home-tools-section"><div className="home-section-heading"><div><h2>常用创作工具</h2><div className="home-tool-tabs" role="group" aria-label="工具筛选">{['推荐工具','我的收藏'].map(value => <button key={value} aria-pressed={tab === value} className={tab === value ? 'active' : ''} onClick={() => {setTab(value);setGuideId(null);}}>{value}{value === '我的收藏' && <span>{favorites.length}</span>}</button>)}</div></div><button className="home-text-link" onClick={() => navigate('tools')}>全部工具<ArrowRight size={15}/></button></div><div className="home-tools-grid">{list.map(tool => <HomeToolCard key={tool.id} tool={tool} favorite={favorites.includes(tool.id)} onFavorite={() => toggleFavorite(tool.id)} onOpen={() => setModal({type:'tool',tool})} guideOpen={guideId === tool.id} onGuide={() => setGuideId(guideId === tool.id ? null : tool.id)}/>)}</div>{guideTool && <div className="home-open-guide"><button className="home-guide-close" aria-label="收起工具使用指南" onClick={() => setGuideId(null)}><X size={16}/>收起指南</button><ToolGuide key={guideTool.id} toolId={guideTool.id} onUseExample={prompt => setModal({type:'tool',tool:guideTool,prompt})}/></div>}{!list.length && <div className="home-empty-tools"><Star size={24}/><h3>还没有收藏工具</h3><p>收藏常用工具，下次创作更快找到。</p><button className="button secondary" onClick={() => setTab('推荐工具')}>看看推荐工具<ArrowRight size={15}/></button></div>}</section>
    <HomeSupport works={works} navigate={navigate} setModal={setModal}/>
  </div>;
}
