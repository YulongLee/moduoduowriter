import React, {useCallback, useEffect, useId, useRef, useState} from 'react';
import {ArrowRight, BookMarked, BookOpen, ChevronDown, ChevronRight, CircleHelp, Clapperboard, Cloud, Crown, Ellipsis, Feather, Lightbulb, ListTree, MessagesSquare, Plus, RefreshCw, ScanText, Send, Settings2, Sparkles, Star, Type, Upload, UsersRound, WandSparkles, X} from 'lucide-react';
import {useGeneration} from './Generation';
import {BookCover} from './Art';
import {ToolGuide} from './ToolGuide';
import {HomeFeatureArtwork} from './HomeFeatureArtwork.jsx';
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

export function PublicHomeComposer({value='',onChange,onSend,onShowExample,onReference,notify=()=>{},appearance='default',forwardedInputRef}) {
  const inputId=useId();
  const [error,setError]=useState(''),localInputRef=useRef(null);
  const inputRef=forwardedInputRef||localInputRef;
  useEffect(()=>{if(value.trim())setError('');},[value]);
  const submit=event=>{event.preventDefault();const prompt=value.trim();if(!prompt){setError('先写下一点故事灵感，或者选择一个示例。');inputRef.current?.focus();notify('先写下一点故事灵感，或者选择一个示例');return;}setError('');onSend(prompt);};
  const suggestions=[['聊聊故事灵感','我想写一家能够修复记忆的旧书店，请帮我一起找到主角与核心冲突。'],['设计一个角色','我想设计一位旧物修复师，她擅长修复别人珍惜的东西，却总是回避自己的过去。'],['讨论下一章','我想讨论下一章的走向：主角收到一封来自明天的信，应该如何行动才能自然推进悬念？']];
  const suggestionLinks=<div className="home-public-suggestions"><span>{appearance==='landing'?'试试这些创作想法':'试试'}</span>{suggestions.map(([label,prompt])=><button type="button" key={label} onClick={()=>onChange(prompt)}>{label}</button>)}</div>;
  return <section className={'home-public-composer'+(appearance==='landing'?' home-landing-composer':'')} aria-label="公开创作入口"><form aria-label="故事创作表单" onSubmit={submit}><label className="home-public-input-label" htmlFor={inputId}>把你的故事想法，写在这里</label><textarea id={inputId} ref={inputRef} aria-invalid={Boolean(error)} aria-describedby={error?inputId+'-error':undefined} aria-label="故事灵感输入" maxLength={2000} rows={2} value={value} onChange={event=>onChange(event.target.value)} placeholder="描述你的故事想法，让墨多多帮你把它变成精彩的小说……"/>{appearance!=='landing'&&suggestionLinks}<div className="home-public-composer-footer"><div><button type="button" className="home-text-link" onClick={onReference}><BookMarked size={16}/>添加参考资料</button><button type="button" className="home-text-link" onClick={onShowExample}>查看生成示例<ChevronRight size={14}/></button></div><span>{value.length} / 2,000</span><button type="submit" className="button primary" aria-label="开始创作">开始创作<ArrowRight size={17}/></button></div>{error&&<p className="home-public-input-error" id={inputId+'-error'} role="alert">{error}</p>}</form>{appearance==='landing'&&suggestionLinks}<p className="home-public-composer-note">先把灵感聊清楚，再生成和修改。创作内容由你确认后采用。</p></section>;
}

function HomeSupport({navigate,setModal,gate}) {
  const [index,setIndex]=useState(0),idea=inspirations[index];
  return <div className="home-support" aria-label="创作指南与灵感"><nav className="home-publishing-links" aria-label="写作与出版"><span>写作与出版</span><button type="button" onClick={()=>gate(()=>navigate('novels'))}><BookOpen size={15}/>小说写作</button><button type="button" onClick={()=>gate(()=>navigate('scripts'))}><Clapperboard size={15}/>剧本创作</button><button type="button" onClick={()=>gate(()=>navigate('dismantle'))}><BookMarked size={15}/>小说拆书</button><button type="button" onClick={()=>gate(()=>navigate('submit'))}><Send size={15}/>投稿中心</button></nav><div className="home-service-links"><details className="home-daily-inspiration"><summary><Lightbulb size={13}/>今日灵感</summary><div><blockquote>{idea.quote.replace('\n','')}</blockquote><span>{idea.tags.join(' · ')}</span><button type="button" className="home-icon-button" aria-label="切换今日灵感" onClick={()=>setIndex((index+1)%inspirations.length)}><RefreshCw size={14}/></button><button type="button" className="home-text-link" onClick={()=>gate(()=>setModal({type:'create',idea:idea.prompt}))}>用这个灵感<ArrowRight size={13}/></button></div></details><button type="button" onClick={()=>gate(()=>setModal({type:'settings'}))}><Settings2 size={13}/>创作设置</button><button type="button" onClick={()=>gate(()=>setModal({type:'settings'}))}><Cloud size={13}/>备份恢复</button><button type="button" aria-label="使用帮助" onClick={()=>setModal({type:'help'})}><CircleHelp size={13}/>帮助</button><button type="button" onClick={()=>gate(()=>navigate('membership'))}><Crown size={13}/>查看创作方案</button></div></div>;
}


const publicStoryExamples = [
  {id:'rain-letter',title:'雨夜来信',genre:'悬疑',kind:'原创预写示例',cover:'fog',description:'一封写着明天日期的信，让旧书店的秘密重新浮出水面。',...storyExample},
  {id:'spring-wind',title:'风来的那一天',genre:'言情',kind:'原创预写示例',cover:'spring',description:'重返海边小城，两个错过的人收到同一间旧屋的钥匙。',idea:'十年后，两位曾经的恋人回到海边故乡，发现他们各自继承了同一间旧屋的一半。',outline:'从旧屋的归属争执开始，两人一同修缮房子，逐渐发现当年的离别藏着未寄出的解释，最终各自作出新的选择。',character:'余夏 · 插画师。习惯用轻松掩盖失落，想把旧屋改成画室，却害怕再次留不住重要的人。',text:'风把门缝里的信吹到了她脚边。余夏弯腰拾起，看见另一串钥匙已经放在了窗台上。'},
  {id:'silent-moon',title:'沉默的第七颗月亮',genre:'科幻',kind:'原创预写示例',cover:'orbit',description:'在一颗失去日出的行星，探险队收到了一段来自明天的求救。',idea:'探险队在一颗从不日出的行星着陆，收到一段来自明天、由他们自己发出的求救信号。',outline:'队员循着求救信号寻找源头，发现每次通信都会改变一段航行记录。他们必须在信任彼此和相信记录之间作出选择。',character:'纪遥 · 航行记录员。相信所有答案都能被记录，却发现自己最重要的一段记忆从未写入日志。',text:'第七颗月亮升起时，所有时钟都停了。纪遥摘下耳机，通讯舱里传出了她明天才会说出的第一句话。'}
];

export function ReferenceHome({navigate,setModal,notify=()=>{},onRequireAccount,authenticated=false,onEnterStudio}) {
  const [prompt,setPrompt]=useState(''),[guideId,setGuideId]=useState(null),[menuId,setMenuId]=useState(null),[exampleOpen,setExampleOpen]=useState(false),[exampleId,setExampleId]=useState(publicStoryExamples[0].id),[exampleFilter,setExampleFilter]=useState('全部'),[toolsOpen,setToolsOpen]=useState(false);
  const exampleRef=useRef(null),heroRef=useRef(null),toolsRef=useRef(null),inputRef=useRef(null);
  const closeMenu=useCallback(()=>setMenuId(null),[]);
  const gate=action=>{if(onRequireAccount)return onRequireAccount(action);if(authenticated)return action();notify('请先登录，再继续创作');};
  const enterStudio=()=>onEnterStudio?onEnterStudio():gate(()=>navigate('works'));
  const openConversation=initialPrompt=>gate(()=>setModal({type:'home-conversation',initialPrompt}));
  const openTool=(tool,extra={})=>gate(()=>setModal({type:'tool',tool,...extra}));
  const selectedExample=publicStoryExamples.find(item=>item.id===exampleId)||publicStoryExamples[0];
  const showExample=()=>{setExampleOpen(true);exampleRef.current?.scrollIntoView({behavior:'smooth',block:'start'});};
  const useExample=()=>{setPrompt(selectedExample.idea);heroRef.current?.scrollIntoView({behavior:'smooth',block:'start'});inputRef.current?.focus?.({preventScroll:true});notify('示例灵感已填入，点击开始创作后再继续。');};
  const groups=homeToolGroups.map(group=>({...group,tools:group.ids.map(id=>tools.find(tool=>tool.id===id)).filter(Boolean)}));
  const guideTool=tools.find(tool=>tool.id===guideId);
  const features=[['ideas','灵感生成','找到故事的起点，让一个念头长成新的可能。','amber'],['outline','故事大纲','梳理主线与转折，让故事有清晰的方向。','blue'],['character','人物设定','塑造角色的目标、动机与人物关系。','mint'],['continue','剧情续写','承接已有情节，把故事继续写下去。','violet'],['polish','文字润色','保留作者风格，打磨节奏与表达。','teal']];
  return <div className="home-v2 home-business home-window home-public home-landing">
    <section className="home-window-hero" aria-label="首页创作入口" id="landing-create" ref={heroRef}><div className="home-window-inner home-landing-hero-grid"><header className="home-landing-hero-copy"><span className="home-landing-eyebrow"><Sparkles size={14}/>新一代 AI 小说创作平台</span><h1><span>让好故事</span><span>从一个想法<em>开始</em></span></h1><p>用 AI 激发灵感，构建故事、塑造角色，<br className="home-landing-desktop-break"/>把脑海里的那个想法，写成属于你的作品。</p><ul className="home-landing-capabilities" aria-label="创作能力"><li><strong>大纲与人物</strong><span>搭建故事骨架</span></li><li><strong>续写与修改</strong><span>打磨每一章节</span></li><li><strong>作者确认采纳</strong><span>创作由你掌控</span></li></ul></header><div className="home-landing-hero-input"><PublicHomeComposer appearance="landing" forwardedInputRef={inputRef} value={prompt} onChange={setPrompt} onSend={openConversation} onReference={()=>openConversation(prompt.trim())} onShowExample={showExample} notify={notify}/></div></div></section>
    <div className="home-window-content home-landing-content">
      <section className="home-landing-features-section" aria-label="创作功能" id="landing-features"><header className="home-landing-section-heading"><div><h2>从想法到作品，陪你走过创作的每一步</h2><p>无论是初次尝试，还是已经写下许多故事，都能找到合适的创作帮手。</p></div><button type="button" className="home-text-link" onClick={()=>{setToolsOpen(true);toolsRef.current?.scrollIntoView({behavior:'smooth',block:'start'});}}>了解更多<ArrowRight size={15}/></button></header><div className="home-landing-features" aria-label="创作快捷入口">{features.map(([id,label,description,color])=>{const Icon=toolIcons[id];return <button type="button" className={'home-landing-feature feature-'+color} key={id} aria-label={'体验'+label} onClick={()=>openTool(tools.find(tool=>tool.id===id))}><span className="home-landing-feature-visual" aria-hidden="true"><HomeFeatureArtwork feature={id}/></span><span className="home-landing-feature-copy"><span className="home-landing-feature-title"><span className="home-landing-feature-icon" aria-hidden="true"><Icon size={18} strokeWidth={1.8}/></span><strong>{label}</strong><ArrowRight className="home-landing-feature-arrow" size={16} aria-hidden="true"/></span><small>{description}</small></span></button>;})}</div></section>
      <section className="home-landing-examples" aria-label="预写创作示例" id="landing-examples" ref={exampleRef}><header className="home-landing-section-heading"><div><h2>创作示例</h2><p>原创预写内容，仅展示故事与输出形式；不是实时生成结果或用户真实作品。</p></div><div className="home-landing-example-filters" role="group" aria-label="示例题材">{['全部','悬疑','言情','科幻'].map(genre=><button type="button" key={genre} aria-pressed={exampleFilter===genre} onClick={()=>setExampleFilter(genre)}>{genre}</button>)}</div></header><div className="home-landing-example-grid">{publicStoryExamples.filter(item=>exampleFilter==='全部'||item.genre===exampleFilter).map(item=><button type="button" className={'home-landing-example'+(exampleOpen&&exampleId===item.id?' is-selected':'')} key={item.id} aria-label={'查看预写示例：'+item.title} onClick={()=>{setExampleId(item.id);setExampleOpen(true);}}><span className="home-landing-example-cover" aria-hidden="true"><BookCover work={item}/></span><span className="home-landing-example-copy"><strong>{item.title}</strong><span>{item.genre} · 预写示例</span><p>{item.description}</p><small>查看故事构思<ArrowRight size={13}/></small></span></button>)}</div><div className="home-landing-example-actions"><button type="button" className="home-text-link" aria-expanded={exampleOpen} onClick={()=>setExampleOpen(!exampleOpen)}>{exampleOpen?'收起示例':'展开示例'}<ChevronDown size={15}/></button></div>{exampleOpen&&<div className="home-public-example"><header><div><span>预先编写的输出示例</span><h2>{selectedExample.title}</h2></div><button type="button" className="home-text-link" onClick={useExample}>填入示例灵感<ArrowRight size={15}/></button></header><div className="home-public-example-columns"><article><span>故事大纲</span><p>{selectedExample.outline}</p></article><article><span>人物设定</span><p>{selectedExample.character}</p></article><article><span>开篇正文</span><p>{selectedExample.text}</p></article></div></div>}</section>
      <details className="home-landing-toolbox" id="landing-tools" ref={toolsRef} open={toolsOpen} onToggle={event=>setToolsOpen(event.currentTarget.open)}><summary><span><strong>更多写作工具与使用指南</strong><small>对白、审稿、书名与简介，以及完整的示例说明</small></span><ChevronDown size={18}/></summary><section className="home-tools-section" aria-label="写作工具"><div className="home-tool-groups">{groups.map(group=><section className="home-tool-group" aria-label={group.title} key={group.id}><h3>{group.title}</h3><div className="home-tools-grid">{group.tools.map(tool=><HomeToolRow key={tool.id} tool={tool} favorite={false} publicMode onFavorite={()=>gate(()=>navigate('tools'))} onOpen={()=>openTool(tool)} guideOpen={guideId===tool.id} onGuide={()=>setGuideId(guideId===tool.id?null:tool.id)} menuOpen={menuId===tool.id} onMenuToggle={force=>setMenuId(current=>force?tool.id:current===tool.id?null:tool.id)} onMenuClose={closeMenu}/>)}</div></section>)}</div>{guideTool&&<div className="home-open-guide"><button type="button" className="home-guide-close" aria-label="收起工具使用指南" onClick={()=>setGuideId(null)}><X size={16}/>收起指南</button><ToolGuide key={guideTool.id} toolId={guideTool.id} onUseExample={value=>openTool(guideTool,{prompt:value})}/></div>}<button type="button" className="home-text-link" onClick={()=>gate(()=>navigate('tools'))}>进入工具库<ArrowRight size={15}/></button></section></details>
      <section className="home-landing-studio-cta" aria-label="进入创作空间" id="landing-plans"><span className="home-landing-cta-icon"><BookOpen size={40}/></span><div><h2>开启你的创作之旅</h2><p>把脑海里的那个故事，认真写成你的作品。</p></div><button type="button" onClick={enterStudio}>进入创作空间<ArrowRight size={17}/></button></section>
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
