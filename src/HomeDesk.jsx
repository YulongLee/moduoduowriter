import React, {useCallback, useEffect, useId, useRef, useState} from 'react';
import {ArrowRight, BookMarked, BookOpen, ChevronDown, ChevronRight, CircleHelp, Clapperboard, Cloud, Crown, Ellipsis, Feather, Lightbulb, ListTree, MessagesSquare, Plus, RefreshCw, ScanText, Send, Settings2, Sparkles, Star, Type, Upload, UsersRound, WandSparkles, X} from 'lucide-react';
import {useGeneration} from './Generation';
import {ToolGuide} from './ToolGuide';
import {tools, inspirations} from './data';

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
const homeToolGroups = [
  {id:'planning',title:'构思与规划',description:'把想法、主线与角色准备好',ids:['ideas','outline','character','title']},
  {id:'writing',title:'正文与修改',description:'推动情节，反复打磨每一章',ids:['continue','polish','dialogue','review']}
];
// Authored preview only. Opening or using it never invokes generation.
const storyExample = {
  idea:'一位能听见旧物记忆的修复师，收到了一封来自明天的信。',
  title:'雨夜来信',
  outline:'修复师收到明日来信，沿着旧物中的记忆寻找寄信人，却发现最后一件旧物与父亲有关。',
  character:'沈听澜 · 旧物修复师。擅长修复旧物，却始终不敢面对父亲留下的秘密。',
  text:'雨落在旧书店的玻璃上。她拆开信封，看见落款处写着明天的日期。'
};

export function PublicHomeComposer({value='',onChange,onSend,onShowExample,onReference,notify=()=>{}}) {
  const inputId=useId();
  const [error,setError]=useState(''),inputRef=useRef(null);
  useEffect(()=>{if(value.trim())setError('');},[value]);
  const submit=event=>{event.preventDefault();const prompt=value.trim();if(!prompt){setError('先写下一点故事灵感，或者选择一个示例。');inputRef.current?.focus();notify('先写下一点故事灵感，或者选择一个示例');return;}setError('');onSend(prompt);};
  const suggestions=[['聊聊故事灵感','我想写一家能够修复记忆的旧书店，请帮我一起找到主角与核心冲突。'],['设计一个角色','我想设计一位旧物修复师，她擅长修复别人珍惜的东西，却总是回避自己的过去。'],['讨论下一章','我想讨论下一章的走向：主角收到一封来自明天的信，应该如何行动才能自然推进悬念？']];
  return <section className="home-public-composer" aria-label="公开创作入口"><form aria-label="故事创作表单" onSubmit={submit}><label className="home-public-input-label" htmlFor={inputId}>把你的故事想法，写在这里</label><textarea id={inputId} ref={inputRef} aria-invalid={Boolean(error)} aria-describedby={error?inputId+'-error':undefined} aria-label="故事灵感输入" maxLength={2000} rows={2} value={value} onChange={event=>onChange(event.target.value)} placeholder="描述你的故事想法，一起把灵感变成可以写下去的故事……"/><div className="home-public-suggestions"><span>试试</span>{suggestions.map(([label,prompt])=><button type="button" key={label} onClick={()=>onChange(prompt)}>{label}</button>)}</div><div className="home-public-composer-footer"><div><button type="button" className="home-text-link" onClick={onReference}><BookMarked size={16}/>添加参考资料</button><button type="button" className="home-text-link" onClick={onShowExample}>查看生成示例<ChevronRight size={14}/></button></div><span>{value.length} / 2,000</span><button type="submit" className="button primary" aria-label="开始创作">开始创作<ArrowRight size={17}/></button></div>{error&&<p className="home-public-input-error" id={inputId+'-error'} role="alert">{error}</p>}</form><p className="home-public-composer-note">先把灵感聊清楚，再生成和修改。创作内容由你确认后采用。</p></section>;
}

function HomeSupport({navigate,setModal,gate}) {
  const [index,setIndex]=useState(0),idea=inspirations[index];
  return <div className="home-support" aria-label="创作指南与灵感"><nav className="home-publishing-links" aria-label="写作与出版"><span>写作与出版</span><button type="button" onClick={()=>gate(()=>navigate('novels'))}><BookOpen size={15}/>小说写作</button><button type="button" onClick={()=>gate(()=>navigate('scripts'))}><Clapperboard size={15}/>剧本创作</button><button type="button" onClick={()=>gate(()=>navigate('dismantle'))}><BookMarked size={15}/>小说拆书</button><button type="button" onClick={()=>gate(()=>navigate('submit'))}><Send size={15}/>投稿中心</button></nav><div className="home-service-links"><details className="home-daily-inspiration"><summary><Lightbulb size={13}/>今日灵感</summary><div><blockquote>{idea.quote.replace('\n','')}</blockquote><span>{idea.tags.join(' · ')}</span><button type="button" className="home-icon-button" aria-label="切换今日灵感" onClick={()=>setIndex((index+1)%inspirations.length)}><RefreshCw size={14}/></button><button type="button" className="home-text-link" onClick={()=>gate(()=>setModal({type:'create',idea:idea.prompt}))}>用这个灵感<ArrowRight size={13}/></button></div></details><button type="button" onClick={()=>gate(()=>setModal({type:'settings'}))}><Settings2 size={13}/>创作设置</button><button type="button" onClick={()=>gate(()=>setModal({type:'settings'}))}><Cloud size={13}/>备份恢复</button><button type="button" aria-label="使用帮助" onClick={()=>setModal({type:'help'})}><CircleHelp size={13}/>帮助</button><button type="button" onClick={()=>gate(()=>navigate('membership'))}><Crown size={13}/>查看创作方案</button></div></div>;
}

export function ReferenceHome({navigate,setModal,notify=()=>{},onRequireAccount,authenticated=false}) {
  const [prompt,setPrompt]=useState(''),[guideId,setGuideId]=useState(null),[menuId,setMenuId]=useState(null),[exampleOpen,setExampleOpen]=useState(false);
  const exampleRef=useRef(null),heroRef=useRef(null);
  const closeMenu=useCallback(()=>setMenuId(null),[]);
  const gate=action=>{if(onRequireAccount)return onRequireAccount(action);if(authenticated)return action();notify('请先登录，再继续创作');};
  const openConversation=initialPrompt=>gate(()=>setModal({type:'home-conversation',initialPrompt}));
  const openTool=(tool,extra={})=>gate(()=>setModal({type:'tool',tool,...extra}));
  const generateStory=()=>{const idea=prompt.trim();gate(()=>setModal({type:'quick-start',idea,genre:'玄幻',audience:'全频',perspective:'第三人称',kind:'长篇小说',mode:'灵感共创',autoGenerate:Boolean(idea)}));};
  const showExample=()=>{setExampleOpen(true);exampleRef.current?.scrollIntoView({behavior:'smooth',block:'start'});};
  const useExample=()=>{setPrompt(storyExample.idea);heroRef.current?.scrollIntoView({behavior:'smooth',block:'start'});notify('示例灵感已填入，点击开始创作后再继续。');};
  const groups=homeToolGroups.map(group=>({...group,tools:group.ids.map(id=>tools.find(tool=>tool.id===id)).filter(Boolean)}));
  const guideTool=tools.find(tool=>tool.id===guideId);
  const quickEntries=[
    ['生成小说','从灵感出发，完成故事',Sparkles,'generate','amber'],
    ['故事大纲','理清主线与故事框架',ListTree,'outline','blue'],
    ['人物设定','写出鲜明生动的角色',UsersRound,'character','mint'],
    ['寻找灵感','让一个念头长成故事',Lightbulb,'ideas','amber'],
    ['剧情续写','承接上文，推进情节',Feather,'continue','violet'],
    ['文字润色','保留风格，打磨表达',WandSparkles,'polish','blue']
  ];
  return <div className="home-v2 home-business home-window home-public">
    <section className="home-window-hero" aria-label="首页创作入口" ref={heroRef}><div className="home-window-inner"><header className="home-hero-heading"><span>让灵感落笔，让故事发生</span><h1>今天，想写一个什么故事？</h1><p>从一个灵感开始，让墨多多陪你完成整部作品。</p></header><blockquote className="home-hero-quote">每一个好故事，<br/>都值得被认真书写。<cite>—— 墨多多写作</cite></blockquote><div className="home-hero-conversation"><PublicHomeComposer value={prompt} onChange={setPrompt} onSend={openConversation} onReference={()=>openConversation(prompt.trim())} onShowExample={showExample} notify={notify}/></div></div></section>
    <div className="home-window-content">
      <section className="home-quick-grid" aria-label="创作快捷入口">{quickEntries.map(([title,description,Icon,id,color])=><button type="button" className={'home-quick-entry quick-'+color} key={id} onClick={()=>id==='generate'?generateStory():openTool(tools.find(tool=>tool.id===id))}><span className="home-quick-icon"><Icon size={24} strokeWidth={1.75}/></span><span><strong>{title}</strong><small>{description}</small></span></button>)}</section>
      <section className="home-public-example" aria-label="预写创作示例" ref={exampleRef}><header><div><span>从灵感到故事</span><h2>一个念头，可以怎样写下去？</h2><p>以下内容为预先编写的示例，仅展示输出形式，不是本次实时生成的结果。</p></div><button type="button" className="home-text-link" aria-expanded={exampleOpen} onClick={()=>setExampleOpen(!exampleOpen)}>{exampleOpen?'收起示例':'展开示例'}<ChevronDown size={15}/></button></header><div className="home-public-example-summary"><Lightbulb size={20}/><p>{storyExample.idea}</p><button type="button" className="home-text-link" onClick={useExample}>填入示例灵感<ArrowRight size={15}/></button></div>{exampleOpen&&<div className="home-public-example-columns"><article><span>故事大纲</span><h3>{storyExample.title}</h3><p>{storyExample.outline}</p></article><article><span>人物设定</span><h3>沈听澜 · 旧物修复师</h3><p>{storyExample.character}</p></article><article><span>开篇正文</span><h3>让悬念从第一句话发生</h3><p>{storyExample.text}</p></article></div>}</section>
      <div className="home-assist-layout">
        <section className="home-tools-section" aria-label="写作工具"><div className="home-section-heading"><div><h2>常用写作工具</h2><p>从灵感到成稿，陪你打磨每一个故事。</p></div><button type="button" className="home-text-link" onClick={()=>gate(()=>navigate('tools'))}>进入工具库<ArrowRight size={15}/></button></div><div className="home-tool-groups">{groups.map(group=><section className="home-tool-group" aria-label={group.title} key={group.id}><h3>{group.title}</h3><div className="home-tools-grid">{group.tools.map(tool=><HomeToolRow key={tool.id} tool={tool} favorite={false} publicMode onFavorite={()=>gate(()=>navigate('tools'))} onOpen={()=>openTool(tool)} guideOpen={guideId===tool.id} onGuide={()=>setGuideId(guideId===tool.id?null:tool.id)} menuOpen={menuId===tool.id} onMenuToggle={force=>setMenuId(current=>force?tool.id:current===tool.id?null:tool.id)} onMenuClose={closeMenu}/>)}</div></section>)}</div>{guideTool&&<div className="home-open-guide"><button type="button" className="home-guide-close" aria-label="收起工具使用指南" onClick={()=>setGuideId(null)}><X size={16}/>收起指南</button><ToolGuide key={guideTool.id} toolId={guideTool.id} onUseExample={value=>openTool(guideTool,{prompt:value})}/></div>}</section>
        <section className="home-public-workflow" aria-label="创作流程"><header><span>把故事一步步写出来</span><h2>从灵感，到成稿</h2></header><ol><li><span>01</span><div><h3>聊清灵感</h3><p>先找到你想写的主角、冲突与故事方向。</p></div></li><li><span>02</span><div><h3>搭建故事</h3><p>规划大纲，补全角色，让情节有迹可循。</p></div></li><li><span>03</span><div><h3>写好每一章</h3><p>续写、打磨对白、修改表达，逐章向前。</p></div></li><li><span>04</span><div><h3>整理与导出</h3><p>核对文稿，保存版本，准备你的投稿资料。</p></div></li></ol><button type="button" className="home-text-link" onClick={showExample}>先看一个示例<ArrowRight size={15}/></button></section>
      </div>
      <section className="home-membership-banner" aria-label="会员创作方案"><span className="home-membership-icon"><Crown size={28}/></span><div><h2>让每一个灵感，都有写下去的空间</h2><p>了解会员与墨点方案。当前为方案演示，不发生真实收款。</p></div><button type="button" onClick={()=>gate(()=>navigate('membership'))}>查看创作方案<ArrowRight size={16}/></button></section>
      <HomeSupport navigate={navigate} setModal={setModal} gate={gate}/>
    </div>
  </div>;
}

function HomeSelect({label,value,onChange,values}) {
  return <label className="home-select-field"><span>{label}</span><select aria-label={label} value={value} onChange={event=>onChange(event.target.value)}>{values.map(option=><option key={option}>{option}</option>)}</select></label>;
}

export function Generator({setModal, notify, onImport, expanded, onToggle, focusRequest=0, collapsible=true}) {
  const generation = useGeneration();
  const preferencesId = useId(), exampleId = useId(), promptId = useId(), bodyId = useId();
  const preferenceToggle = useRef(null), promptField = useRef(null);
  const [localExpanded,setLocalExpanded] = useState(true);
  const isExpanded = expanded===undefined?localExpanded:expanded;
  const toggleExpanded = () => onToggle?onToggle(!isExpanded):setLocalExpanded(!isExpanded);
  const [prompt,setPrompt] = useState(''), [genre,setGenre] = useState('玄幻'), [audience,setAudience] = useState('全频');
  const [perspective,setPerspective] = useState('第三人称'), [length,setLength] = useState('长篇小说'), [mode,setMode] = useState('灵感共创');
  const [batch,setBatch] = useState(0), [preferencesOpen,setPreferencesOpen] = useState(false), [exampleOpen,setExampleOpen] = useState(false);
  useEffect(()=>{if(isExpanded&&focusRequest>0)promptField.current?.focus();},[isExpanded,focusRequest]);
  const submit = event => {
    event.preventDefault();
    if(!isExpanded)return;
    if (!prompt.trim()) return notify('先写下一点灵感，或者选择下方的示例');
    setModal({type:'quick-start', autoGenerate:true, idea:prompt.trim(), genre, audience, perspective, kind:length, mode});
  };
  const fillIdea = (text,nextGenre) => {setPrompt(text);if(nextGenre)setGenre(nextGenre);promptField.current?.focus();};
  const useExample = () => {fillIdea(storyExample.idea,'悬疑');setLength('长篇小说');notify('示例灵感已填入，点击开始生成后才会创作');};
  const serviceLabel = generation.mode === 'ai' ? '智能创作' : '示例体验';
  const generationNotice = generation.mode === 'ai' ? '智能创作 · 结果确认后写入作品' : '示例体验 · 不产生真实费用';
  return <section className="home-composer" aria-label="一句话创作" data-expanded={isExpanded}>
    <header className="home-composer-heading"><div><h2>一句话生成<span>爆款小说</span></h2><p>{isExpanded?'输入一个故事灵感，先得到可修改的大纲、人物和开篇。':'准备开启下一部作品？从一个新灵感开始。'}</p></div>{collapsible&&<button type="button" className="home-composer-toggle" aria-label="展开故事创作" aria-expanded={isExpanded} aria-controls={bodyId} onClick={toggleExpanded}>{isExpanded?'收起创作':'展开创作'}<ChevronDown size={16}/></button>}</header>
    <div className="home-composer-body" id={bodyId} aria-label="新故事创作内容" hidden={!isExpanded}>
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
    </div>
  </section>;
}


function HomeToolRow({tool, favorite, onFavorite, onOpen, onGuide, guideOpen, menuOpen, onMenuToggle, onMenuClose, publicMode=false}) {
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
        <button type="button" role="menuitem" aria-label={favorite?`取消收藏${tool.title}`:`收藏${tool.title}`} onClick={()=>{triggerRef.current?.focus();onMenuClose();onFavorite();}}><Star size={15} fill={favorite?'currentColor':'none'}/>{publicMode?'到工具库收藏':favorite?'取消收藏':'收藏工具'}</button>
      </div>}
    </div>
  </article>;
}
