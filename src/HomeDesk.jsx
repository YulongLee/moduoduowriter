import React, {useState} from 'react';
import {ArrowRight, ArrowUpRight, BookMarked, BookOpen, ChevronRight, CircleHelp, Clapperboard, Cloud, Feather, Lightbulb, ListTree, MessagesSquare, Plus, RefreshCw, Send, Settings2, Sparkles, Star, Type, Upload, UsersRound, WandSparkles} from 'lucide-react';
import {useGeneration} from './Generation';
import {BookCover} from './Art';
import {tools, inspirations, workWords} from './data';

const genres = ['玄幻','都市','言情','悬疑','科幻','仙侠','历史','奇幻','武侠','末世','游戏','现实','青春','治愈'];
const ideas = ['离职后，我继承了一家能修复记忆的旧书店','全城停电那晚，只有失踪十年的灯塔亮了','穿越成小说里的反派，我决定先救下主角','重逢的第一天，他归还了那封迟到的情书','星舰最后一位乘客，是来自未来的自己','她的每一幅画，都会在第二天变成现实','最后一班地铁，把我送回了十年前的夏天','我在末日开了一家只接受故事付款的旅馆'];
const toolIcons = {ideas:Lightbulb, outline:ListTree, character:UsersRound, polish:WandSparkles, continue:Feather, dialogue:MessagesSquare, review:BookMarked, title:Type};

export function Generator({setModal, notify, onImport}) {
  const generation = useGeneration();
  const [prompt,setPrompt] = useState(''), [genre,setGenre] = useState('玄幻'), [audience,setAudience] = useState('全频');
  const [perspective,setPerspective] = useState('第三人称'), [length,setLength] = useState('长篇小说'), [mode,setMode] = useState('灵感共创'), [batch,setBatch] = useState(0);
  const submit = event => {
    event.preventDefault();
    if (!prompt.trim()) return notify('先写下一点灵感，或者选择下方的示例');
    setModal({type:'quick-start', autoGenerate:true, idea:prompt.trim(), genre, audience, perspective, kind:length, mode});
  };
  const choices = (label,value,setValue,values) => <div className="home-choice-group" role="group" aria-label={label}><span>{label}</span><div>{values.map(option => <button type="button" key={option} aria-pressed={value === option} className={value === option ? 'selected' : ''} onClick={() => setValue(option)}>{option}</button>)}</div></div>;
  const serviceLabel = generation.mode === 'ai' ? '智能创作' : '示例体验';
  return <section className="home-composer" aria-label="一句话创作">
    <header className="home-composer-heading"><div className="home-composer-topline"><span className="home-eyebrow"><Sparkles size={18}/>墨多多 · 灵感共创</span><div className="home-composer-actions">{onImport&&<button className="home-text-link" onClick={onImport}><Upload size={16}/>导入文稿</button>}<button className="home-text-link" onClick={() => setModal({type:'create'})}><Plus size={16}/>新建作品</button></div></div><h1>一句话，开启你的<span>下一部好故事</span></h1><p>把脑海里的一个念头，写成大纲、人物与故事的第一章。</p></header>
    <form className="home-composer-form" onSubmit={submit}>
      <div className="home-prompt-field"><textarea aria-label="一句话故事灵感" maxLength={500} value={prompt} onChange={event => setPrompt(event.target.value)} placeholder={'你想写一个怎样的故事？\n比如：一位能听见旧物记忆的修复师，收到了一封来自明天的信……'}/><span>{prompt.length} / 500</span></div>
      <div className="home-creation-options">{choices('故事题材',genre,setGenre,genres)}<div className="home-preference-row">{choices('目标读者',audience,setAudience,['男频','女频','全频'])}{choices('叙述视角',perspective,setPerspective,['第一人称','第三人称'])}{choices('作品篇幅',length,setLength,['短篇故事','长篇小说'])}</div></div>
      <div className="home-composer-footer"><div><select aria-label="创作模式" value={mode} onChange={event => setMode(event.target.value)}><option>灵感共创</option><option>长篇规划</option></select><span className="home-service-status"><Sparkles size={15}/>{serviceLabel}</span></div><button className="button primary" type="submit"><Sparkles size={18}/>开始创作<ArrowRight size={18}/></button></div>
    </form>
    <div className="home-prompt-ideas"><span><Lightbulb size={14}/>灵感参考</span>{ideas.slice(batch*2,batch*2+2).map(text => <button type="button" key={text} title={text} onClick={() => {setPrompt(text); setGenre(['悬疑','都市','奇幻','言情'][batch]);}}>{text}</button>)}<button className="home-refresh" type="button" aria-label="换一批灵感" title="换一批灵感" onClick={() => setBatch((batch+1)%4)}><RefreshCw size={15}/></button></div>
  </section>;
}

function ContinueCard({works, navigate, setModal}) {
  const work = works[0], words = works.reduce((sum,item) => sum+workWords(item),0), chapters = works.reduce((sum,item) => sum+item.chapters.length,0);
  return <section className="home-resume" aria-label="继续创作与创作概况">
    <header><span><BookOpen size={17}/>继续创作</span><button onClick={() => navigate('works')}>我的作品<ArrowUpRight size={14}/></button></header>
    {work ? <><div className="home-resume-book"><div><span className="home-resume-label">最近编辑的作品</span><h2>{work.title}</h2><p>{work.description || '让故事继续，从下一句话开始。'}</p><small>{work.kind} · {work.genre}</small></div><div className="home-resume-cover" aria-hidden="true"><BookCover work={work}/></div></div><button className="home-resume-action" aria-label={`继续最近作品：${work.title}`} onClick={() => navigate(`editor/${work.id}`)}><Feather size={16}/>继续写作<ArrowRight size={17}/></button></> : <div className="home-resume-empty"><BookOpen size={38}/><h2>你的故事，值得被写下。</h2><p>新建一本作品，让第一句话有个归处。</p><button className="home-resume-action" onClick={() => setModal({type:'create'})}><Plus size={16}/>新建我的第一部作品<ArrowRight size={16}/></button></div>}
    <dl className="home-resume-stats"><div><dt>累计字数</dt><dd>{words.toLocaleString()}</dd></div><div><dt>作品</dt><dd>{works.length}<small>部</small></dd></div><div><dt>章节</dt><dd>{chapters}<small>章</small></dd></div></dl>
  </section>;
}

function HomeToolCard({tool, favorite, onFavorite, onOpen}) {
  const Icon = toolIcons[tool.id] || Sparkles;
  return <article className={`home-tool-card home-tool-${tool.id}`}><button className="home-tool-open" aria-label={`使用${tool.title}`} onClick={onOpen}><span className="home-tool-icon"><Icon size={24} strokeWidth={1.7}/></span><span><strong>{tool.title}</strong><small>{tool.desc}</small></span><ArrowUpRight className="home-tool-arrow" size={17}/></button><button className={`home-tool-favorite${favorite ? ' active' : ''}`} aria-label={favorite ? `取消收藏${tool.title}` : `收藏${tool.title}`} title={favorite ? '取消收藏' : '收藏工具'} aria-pressed={favorite} onClick={onFavorite}><Star size={16} fill={favorite ? 'currentColor' : 'none'}/></button></article>;
}

function HomeSupport({works, navigate, setModal}) {
  const [index,setIndex] = useState(0), idea = inspirations[index];
  const steps = [['准备作品','新建或导入你的文稿',() => setModal({type:'create'})],['搭建大纲','规划情节与人物设定',() => setModal({type:'tool', tool:tools.find(tool => tool.id === 'outline'), workId:works[0]?.id})],['写好章节','继续写作与修改润色',() => works[0] ? navigate(`editor/${works[0].id}`) : setModal({type:'create'})],['准备投稿','整理文稿与投稿计划',() => navigate('submit')]];
  return <section className="home-support-grid"><div className="home-guide-card"><div className="home-section-heading"><h2>让创作更顺手</h2><button className="home-text-link" onClick={() => navigate('workflows')}>分步创作工作流<ArrowUpRight size={15}/></button></div><div className="home-guide-steps">{steps.map(([title,description,action],i) => <button key={title} onClick={action}><span>0{i+1}</span><strong>{title}</strong><small>{description}</small></button>)}</div><div className="home-service-links"><button onClick={() => setModal({type:'settings'})}><Settings2 size={15}/>创作设置</button><button onClick={() => setModal({type:'settings'})}><Cloud size={15}/>备份恢复</button><button aria-label="使用帮助" onClick={() => setModal({type:'help'})}><CircleHelp size={15}/>使用帮助</button></div></div><div className="home-inspiration-card"><div className="home-section-heading"><span><Lightbulb size={16}/>给今天的一点灵感</span><button className="home-icon-button" aria-label="切换今日灵感" onClick={() => setIndex((index+1)%inspirations.length)}><RefreshCw size={16}/></button></div><blockquote>{idea.quote.replace('\n','')}</blockquote><div><span>{idea.tags.join(' · ')}</span><button className="home-text-link" onClick={() => setModal({type:'create',idea:idea.prompt})}>以此创建故事<ArrowRight size={15}/></button></div></div></section>;
}

export function ReferenceHome({works, navigate, setModal, notify, favorites, toggleFavorite, onImport}) {
  const [tab,setTab] = useState('推荐工具');
  const list = tab === '我的收藏' ? tools.filter(tool => favorites.includes(tool.id)) : tools;
  const entries = [['小说写作','从总纲、人物到每一章节',BookOpen,'novels','mint'],['剧本创作','写好每一场戏与对白',Clapperboard,'scripts','peach'],['小说拆书','拆解结构，积累写作方法',BookMarked,'dismantle','blue'],['投稿中心','整理文稿，跟进投稿进度',Send,'submit','lavender']];
  return <div className="home-v2">
    <div className="home-hero-grid"><Generator setModal={setModal} notify={notify} onImport={onImport}/><ContinueCard works={works} navigate={navigate} setModal={setModal}/></div>
    <section className="home-entry-grid" aria-label="创作快捷入口">{entries.map(([title,description,Icon,route,color]) => <button className={`home-entry entry-${color}`} key={route} onClick={() => navigate(route)}><span className="home-entry-icon"><Icon size={24} strokeWidth={1.7}/></span><span><strong>{title}</strong><small>{description}</small></span><ArrowUpRight size={17}/></button>)}</section>
    <section className="home-tools-section"><div className="home-section-heading"><div><h2>AI 创作工具</h2><div className="home-tool-tabs" role="group" aria-label="工具筛选">{['推荐工具','我的收藏'].map(value => <button key={value} aria-pressed={tab === value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{value}{value === '我的收藏' && <span>{favorites.length}</span>}</button>)}</div></div><button className="home-text-link" onClick={() => navigate('tools')}>全部工具<ArrowRight size={15}/></button></div><div className="home-tools-grid">{list.map(tool => <HomeToolCard key={tool.id} tool={tool} favorite={favorites.includes(tool.id)} onFavorite={() => toggleFavorite(tool.id)} onOpen={() => setModal({type:'tool',tool})}/>)}</div>{!list.length && <div className="home-empty-tools"><Star size={27}/><h3>还没有收藏工具</h3><p>收藏常用工具，下次创作更快找到。</p><button className="button secondary" onClick={() => setTab('推荐工具')}>看看推荐工具<ArrowRight size={15}/></button></div>}</section>
    <section className="home-books-section"><div className="home-section-heading"><h2>最近作品</h2><button className="home-text-link" onClick={() => navigate('works')}>管理作品<ArrowRight size={15}/></button></div><div className="home-books-grid">{works.slice(0,3).map(work => <button className="home-book-card" aria-label={`打开作品：${work.title}`} key={work.id} onClick={() => navigate(`editor/${work.id}`)}><div className="home-book-cover" aria-hidden="true"><BookCover work={work}/></div><span><small>{work.kind} · {work.genre}</small><strong>{work.title}</strong><span>{work.description || '每一个故事，都从第一句话开始。'}</span><small>{workWords(work).toLocaleString()} 字<span>·</span>{work.chapters.length} 章</small></span><ChevronRight size={17}/></button>)}{!works.length && <button className="home-book-card home-create-book" aria-label="创建第一部作品" onClick={() => setModal({type:'create'})}><span className="home-create-book-icon"><Plus size={26}/></span><span><strong>创建第一部作品</strong><span>让灵感有一个归处。</span></span><ArrowRight size={18}/></button>}</div></section>
    <HomeSupport works={works} navigate={navigate} setModal={setModal}/>
  </div>;
}
