import React, {useCallback, useEffect, useId, useRef, useState} from 'react';
import {ArrowRight, BookMarked, BookOpen, ChevronDown, ChevronRight, CircleHelp, Clapperboard, Cloud, Crown, Ellipsis, Feather, Lightbulb, ListTree, MessagesSquare, Plus, RefreshCw, ScanText, Send, Settings2, Sparkles, Star, Type, Upload, UsersRound, WandSparkles, X} from 'lucide-react';
import {useGeneration} from './Generation';
import {BookCover} from './Art';
import {ToolGuide} from './ToolGuide';
import {tools, inspirations, workWords} from './data';

const genres = ['玄幻','都市','言情','悬疑','科幻','仙侠','历史','奇幻','武侠','末世','游戏','现实','青春','治愈'];
const ideas = ['离职后，我继承了一家能修复记忆的旧书店','全城停电那晚，只有失踪十年的灯塔亮了','穿越成小说里的反派，我决定先救下主角','重逢的第一天，他归还了那封迟到的情书','星舰最后一位乘客，是来自未来的自己','她的每一幅画，都会在第二天变成现实','最后一班地铁，把我送回了十年前的夏天','我在末日开了一家只接受故事付款的旅馆'];
const ideaGenres = ['悬疑','悬疑','奇幻','言情','科幻','奇幻','奇幻','末世'];
const toolIcons = {ideas:Lightbulb,outline:ListTree,character:UsersRound,polish:WandSparkles,continue:Feather,dialogue:MessagesSquare,review:ScanText,title:Type};
const homeToolCopy = {
  ideas:['灵感构思','让一个念头，长成一个故事'],
  outline:['大纲规划','理清主线，搭好故事骨架'],
  character:['人物设定','写出有动机、有变化的角色'],
  continue:['剧情续写','承接上文，继续推动故事'],
  polish:['文字润色','保留文风，让表达更准确'],
  dialogue:['对白打磨','让每个角色有自己的声音'],
  review:['章节审稿','检查逻辑、节奏与衔接'],
  title:['书名与简介','写好故事与读者的第一次见面']
};
const homeToolOrder = ['ideas','polish','outline','dialogue','character','review','continue','title'];
// Authored preview only. Opening or using it never invokes generation.
const storyExample = {
  idea:'一位能听见旧物记忆的修复师，收到了一封来自明天的信。',
  title:'雨夜来信',
  outline:'修复师收到明日来信，沿着旧物中的记忆寻找寄信人，却发现最后一件旧物与父亲有关。',
  character:'沈听澜 · 旧物修复师。擅长修复旧物，却始终不敢面对父亲留下的秘密。',
  text:'雨落在旧书店的玻璃上。她拆开信封，看见落款处写着明天的日期。'
};

function HomeSelect({label,value,onChange,values}) {
  return <label className="home-select-field"><span>{label}</span><select aria-label={label} value={value} onChange={event=>onChange(event.target.value)}>{values.map(option=><option key={option}>{option}</option>)}</select></label>;
}

export function Generator({setModal, notify, onImport}) {
  const generation = useGeneration();
  const preferencesId = useId(), exampleId = useId(), promptId = useId();
  const preferenceToggle = useRef(null), promptField = useRef(null);
  const [prompt,setPrompt] = useState(''), [genre,setGenre] = useState('玄幻'), [audience,setAudience] = useState('全频');
  const [perspective,setPerspective] = useState('第三人称'), [length,setLength] = useState('长篇小说'), [mode,setMode] = useState('灵感共创');
  const [batch,setBatch] = useState(0), [preferencesOpen,setPreferencesOpen] = useState(false), [exampleOpen,setExampleOpen] = useState(false);
  const submit = event => {
    event.preventDefault();
    if (!prompt.trim()) return notify('先写下一点灵感，或者选择下方的示例');
    setModal({type:'quick-start', autoGenerate:true, idea:prompt.trim(), genre, audience, perspective, kind:length, mode});
  };
  const fillIdea = (text,nextGenre) => {setPrompt(text);if(nextGenre)setGenre(nextGenre);promptField.current?.focus();};
  const useExample = () => {fillIdea(storyExample.idea,'悬疑');setLength('长篇小说');notify('示例灵感已填入，点击开始生成后才会创作');};
  const serviceLabel = generation.mode === 'ai' ? '智能创作' : '示例体验';
  const generationNotice = generation.mode === 'ai' ? '智能创作 · 结果确认后写入作品' : '示例体验 · 不产生真实费用';
  return <section className="home-composer" aria-label="一句话创作">
    <header className="home-composer-heading"><h1>一句话生成<span>爆款小说</span></h1><p>输入一个故事灵感，从大纲、人物到开篇，一步开始创作</p></header>
    <form className="home-composer-form" onSubmit={submit}>
      <label className="home-prompt-label" htmlFor={promptId}>故事灵感</label>
      <div className="home-prompt-field"><textarea id={promptId} ref={promptField} aria-label="一句话故事灵感" maxLength={500} value={prompt} onChange={event=>setPrompt(event.target.value)} placeholder={'你想写一个怎样的故事？\n例如：一位能听见旧物记忆的修复师，收到了一封来自明天的信……'}/><span>{prompt.length} / 500</span></div>
      <div className="home-composer-footer">
        <div className="home-creation-options">
          <HomeSelect label="故事题材" value={genre} onChange={setGenre} values={genres}/>
          <HomeSelect label="作品篇幅" value={length} onChange={setLength} values={['短篇故事','长篇小说']}/>
          <button type="button" className="home-preferences-toggle" aria-label="创作偏好" aria-expanded={preferencesOpen} aria-controls={preferencesId} ref={preferenceToggle} onClick={()=>setPreferencesOpen(!preferencesOpen)}>创作偏好<ChevronDown size={14}/></button>
        </div>
        <div className="home-generate-action"><button className="button primary" type="submit">开始生成小说<ArrowRight size={19}/></button><small>{generationNotice}</small></div>
      </div>
      {preferencesOpen&&<div className="home-preference-panel" id={preferencesId} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setPreferencesOpen(false);preferenceToggle.current?.focus();}}}>
        <HomeSelect label="目标读者" value={audience} onChange={setAudience} values={['男频','女频','全频']}/>
        <HomeSelect label="叙述视角" value={perspective} onChange={setPerspective} values={['第一人称','第三人称']}/>
        <HomeSelect label="创作模式" value={mode} onChange={setMode} values={['灵感共创','长篇规划']}/>
        <div className="home-preference-actions"><span className="home-service-status">{serviceLabel}</span><button type="button" className="home-text-link" onClick={()=>setModal({type:'settings'})}><Settings2 size={14}/>创作设置</button></div>
      </div>}
    </form>
    <div className="home-composer-links">
      <div className="home-prompt-ideas"><span><Lightbulb size={17}/>试试</span><button type="button" className="home-prompt-example" title={ideas[batch]} onClick={()=>fillIdea(ideas[batch],ideaGenres[batch])}>{ideas[batch]}</button><button className="home-refresh" type="button" aria-label="换一批灵感" title="换一批灵感" onClick={()=>setBatch((batch+1)%ideas.length)}><RefreshCw size={17}/></button></div>
      <div className="home-heading-actions">{onImport&&<button type="button" className="home-text-link home-import" onClick={onImport}><Upload size={15}/>导入文稿</button>}<button type="button" className="home-example-toggle" aria-label="查看生成示例" aria-expanded={exampleOpen} aria-controls={exampleId} onClick={()=>setExampleOpen(!exampleOpen)}>{exampleOpen?'收起生成示例':'查看生成示例'}{exampleOpen?<ChevronDown size={15}/>:<ArrowRight size={15}/>}</button></div>
    </div>
    {exampleOpen&&<section className="home-example-preview" aria-label="生成效果示例" id={exampleId}>
      <header><h2>生成效果示例</h2><span>预写示例</span></header>
      <div className="home-example-columns"><div><h3>故事大纲 · {storyExample.title}</h3><p>{storyExample.outline}</p></div><div><h3>人物设定</h3><p>{storyExample.character}</p></div><div><h3>开篇正文</h3><p>{storyExample.text}</p></div></div>
      <footer><p>以下为预先编写的示例，仅说明输出形式，不是本次生成的结果。</p><button type="button" className="home-text-link" onClick={useExample}>用这个灵感<ArrowRight size={14}/></button></footer>
    </section>}
  </section>;
}

function ContinueCard({works, navigate, setModal, onImport}) {
  return <section className="home-resume" aria-label="继续创作与创作概况">
    {works.length?<div className="home-books-grid">{works.slice(0,3).map((work,index)=>{
      const editedChapter = work.chapters.find(chapter=>chapter.id===work.lastEditedChapterId);
      return <article className={`home-book-card${index===0?' home-book-recent':''}`} key={work.id}>
        <button className="home-book-open" aria-label={`打开作品：${work.title}`} onClick={()=>navigate(`editor/${work.id}`)}><div className="home-book-cover" aria-hidden="true"><BookCover work={work}/></div><span className="home-book-copy"><strong>{work.title}</strong><small>{work.kind} · {work.genre}</small>{index===0&&editedChapter?<small className="home-book-chapter">上次编辑：{editedChapter.title}</small>:<small>{workWords(work).toLocaleString()} 字 · {work.chapters.length} 章</small>}</span><ChevronRight size={16}/></button>
        {index===0&&<div className="home-book-actions"><button className="home-resume-action" aria-label={`继续最近作品：${work.title}`} onClick={()=>navigate(`editor/${work.id}`)}>继续写作<ArrowRight size={14}/></button></div>}
      </article>;
    })}</div>:<div className="home-resume-empty"><span className="home-empty-book-icon"><BookOpen size={25}/></span><div><h3>创建第一部作品</h3><p>从一个灵感开始，给故事一个归处。</p></div><button className="home-resume-action" aria-label="创建第一部作品" onClick={()=>setModal({type:'create'})}><Plus size={15}/>新建我的第一部作品<ArrowRight size={15}/></button>{onImport&&<button className="home-text-link" onClick={onImport}><Upload size={15}/>导入已有文稿</button>}</div>}
  </section>;
}

function HomeToolRow({tool, favorite, onFavorite, onOpen, onGuide, guideOpen, menuOpen, onMenuToggle, onMenuClose}) {
  const Icon = toolIcons[tool.id] || Sparkles;
  const [name,description] = homeToolCopy[tool.id];
  const wrapRef = useRef(null), triggerRef = useRef(null), menuRef = useRef(null), initialFocus = useRef('first');
  const menuId = useId();
  useEffect(()=>{
    if(!menuOpen)return;
    const items=menuRef.current?.querySelectorAll('[role="menuitem"]');
    if(items?.length)items[initialFocus.current==='last'?items.length-1:0].focus();
    const outside=event=>{if(!wrapRef.current?.contains(event.target))onMenuClose();};
    const escape=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onMenuClose();triggerRef.current?.focus();}};
    if(typeof document==='undefined')return;
    document.addEventListener('pointerdown',outside);
    document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
  },[menuOpen,onMenuClose]);
  const menuKeys=event=>{
    if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
    event.preventDefault();
    const items=Array.from(menuRef.current?.querySelectorAll('[role="menuitem"]')||[]);
    if(!items.length)return;
    const active=items.indexOf(document.activeElement);
    const next=event.key==='Home'?0:event.key==='End'?items.length-1:(active+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;
    items[next].focus();
  };
  return <article className={`home-tool-card home-tool-${tool.id}`}>
    <button type="button" className="home-tool-open" aria-label={`使用${tool.title}`} onClick={onOpen}><span className="home-tool-icon" aria-hidden="true"><Icon size={26} strokeWidth={1.75}/></span><span className="home-tool-copy"><strong>{name}</strong><small>{description}</small></span><ChevronRight size={14}/></button>
    <div className="home-tool-more-wrap" ref={wrapRef} onBlur={event=>{if(menuOpen&&!event.currentTarget.contains(event.relatedTarget))onMenuClose();}}>
      <button type="button" className="home-tool-more" ref={triggerRef} aria-label={`${tool.title}更多操作`} aria-haspopup="menu" aria-expanded={menuOpen} aria-controls={menuId} onClick={()=>{initialFocus.current='first';onMenuToggle();}} onKeyDown={event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();initialFocus.current=event.key==='ArrowUp'?'last':'first';onMenuToggle(true);}}}><Ellipsis size={17}/></button>
      {menuOpen&&<div className="home-tool-menu" id={menuId} ref={menuRef} role="menu" aria-label={`${tool.title}操作`} onKeyDown={menuKeys}>
        <button type="button" role="menuitem" aria-label={`查看${tool.title}使用指南`} aria-expanded={guideOpen} onClick={()=>{triggerRef.current?.focus();onMenuClose();onGuide();}}><BookOpen size={15}/>使用指南</button>
        <button type="button" role="menuitem" aria-label={favorite?`取消收藏${tool.title}`:`收藏${tool.title}`} onClick={()=>{triggerRef.current?.focus();onMenuClose();onFavorite();}}><Star size={15} fill={favorite?'currentColor':'none'}/>{favorite?'取消收藏':'收藏工具'}</button>
      </div>}
    </div>
  </article>;
}

function HomeSupport({works, navigate, setModal}) {
  const [index,setIndex] = useState(0), idea = inspirations[index];
  const steps = [['确定题材',()=>setModal({type:'create'})],['搭建大纲',()=>setModal({type:'tool',tool:tools.find(tool=>tool.id==='outline'),workId:works[0]?.id})],['写好章节',()=>works[0]?navigate(`editor/${works[0].id}`):setModal({type:'create'})],['准备投稿',()=>navigate('submit')]];
  return <div className="home-support" aria-label="创作指南与灵感"><aside className="home-guide-strip" aria-label="创作指南"><h2>从灵感到成稿</h2><div className="home-guide-steps">{steps.map(([title,action],i)=><React.Fragment key={title}><button type="button" onClick={action}>{title}</button>{i<steps.length-1&&<ArrowRight size={13} aria-hidden="true"/>}</React.Fragment>)}</div><button type="button" className="home-text-link" onClick={()=>navigate('workflows')}>查看工作流<ArrowRight size={14}/></button></aside>
    <div className="home-service-links"><details className="home-daily-inspiration"><summary><Lightbulb size={13}/>今日灵感</summary><div><blockquote>{idea.quote.replace('\n','')}</blockquote><span>{idea.tags.join(' · ')}</span><button type="button" className="home-icon-button" aria-label="切换今日灵感" onClick={()=>setIndex((index+1)%inspirations.length)}><RefreshCw size={14}/></button><button type="button" className="home-text-link" onClick={()=>setModal({type:'create',idea:idea.prompt})}>用这个灵感<ArrowRight size={13}/></button></div></details><button type="button" onClick={()=>setModal({type:'settings'})}><Settings2 size={13}/>创作设置</button><button type="button" onClick={()=>setModal({type:'settings'})}><Cloud size={13}/>备份恢复</button><button type="button" aria-label="使用帮助" onClick={()=>setModal({type:'help'})}><CircleHelp size={13}/>帮助</button><button type="button" onClick={()=>navigate('membership')}><Crown size={13}/>查看创作方案</button></div>
  </div>;
}

export function ReferenceHome({works, navigate, setModal, notify, favorites, toggleFavorite, onImport}) {
  const [filter,setFilter] = useState('all'), [guideId,setGuideId] = useState(null), [menuId,setMenuId] = useState(null);
  const closeMenu=useCallback(()=>setMenuId(null),[]);
  const filterRef=useRef(null);
  const list=homeToolOrder.map(id=>tools.find(tool=>tool.id===id)).filter(tool=>tool&&(filter!=='favorites'||favorites.includes(tool.id)));
  const guideTool=list.find(tool=>tool.id===guideId);
  const entries=[['小说写作',BookOpen,'novels','mint'],['剧本创作',Clapperboard,'scripts','violet'],['小说拆书',BookMarked,'dismantle','blue'],['投稿中心',Send,'submit','amber']];
  return <div className="home-v2">
    <Generator setModal={setModal} notify={notify} onImport={onImport}/>
    <section className="home-books-section"><div className="home-section-heading"><h2>继续写作</h2><button type="button" className="home-text-link" onClick={()=>navigate('works')}>全部作品<ArrowRight size={15}/></button></div><ContinueCard works={works} navigate={navigate} setModal={setModal} onImport={onImport}/></section>
    <section className="home-entry-grid" aria-label="创作快捷入口"><h2 className="home-entry-title">写作与出版</h2>{entries.map(([title,Icon,route,color])=><button type="button" className={`home-entry entry-${color}`} key={route} onClick={()=>navigate(route)}><span className="home-entry-icon"><Icon size={23} strokeWidth={1.8}/></span><strong>{title}</strong></button>)}</section>
    <section className="home-tools-section"><div className="home-section-heading"><h2>写作工具</h2><div className="home-heading-actions"><select className="home-tool-filter" ref={filterRef} aria-label="工具筛选" value={filter} onChange={event=>{setFilter(event.target.value);setGuideId(null);setMenuId(null);}}><option value="all">全部工具</option><option value="favorites">我的收藏</option></select><button type="button" className="home-text-link" onClick={()=>navigate('tools')}>查看全部<ArrowRight size={15}/></button></div></div>
      <div className="home-tools-grid">{list.map(tool=><HomeToolRow key={tool.id} tool={tool} favorite={favorites.includes(tool.id)} onFavorite={()=>{toggleFavorite(tool.id);if(filter==='favorites')filterRef.current?.focus();}} onOpen={()=>setModal({type:'tool',tool})} guideOpen={guideId===tool.id} onGuide={()=>setGuideId(guideId===tool.id?null:tool.id)} menuOpen={menuId===tool.id} onMenuToggle={force=>setMenuId(current=>force?tool.id:current===tool.id?null:tool.id)} onMenuClose={closeMenu}/>)}</div>
      {guideTool&&<div className="home-open-guide"><button type="button" className="home-guide-close" aria-label="收起工具使用指南" onClick={()=>setGuideId(null)}><X size={16}/>收起指南</button><ToolGuide key={guideTool.id} toolId={guideTool.id} onUseExample={prompt=>setModal({type:'tool',tool:guideTool,prompt})}/></div>}
      {!list.length&&<div className="home-empty-tools home-tool-grid-empty"><Star size={24}/><h3>还没有收藏工具</h3><p>在工具的更多操作中收藏，下次可以直接找到。</p><button type="button" className="button secondary" onClick={()=>setFilter('all')}>看看全部工具<ArrowRight size={15}/></button></div>}
    </section>
    <HomeSupport works={works} navigate={navigate} setModal={setModal}/>
  </div>;
}
