import React, {useCallback, useEffect, useId, useRef, useState} from 'react';
import {ArrowRight, BookMarked, BookOpen, CirclePlay, FolderOpen, Globe2, ChevronDown, ChevronRight, CircleHelp, Clapperboard, Cloud, Crown, Ellipsis, Feather, Lightbulb, ListTree, MessagesSquare, Plus, RefreshCw, ScanText, Send, Settings2, Sparkles, Star, Type, Upload, UsersRound, WandSparkles, X} from 'lucide-react';
import {useGeneration} from './Generation';
import {ToolGuide} from './ToolGuide';
import './commercial-landing.css';
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

export function PublicHomeComposer({value='',onChange,onSend,onShowExample,onReference,onShowDemo,notify=()=>{},appearance='default',forwardedInputRef}) {
  const inputId=useId();
  const [error,setError]=useState(''),[mode,setMode]=useState('智能创作'),localInputRef=useRef(null);
  const inputRef=forwardedInputRef||localInputRef;
  useEffect(()=>{if(value.trim())setError('');},[value]);
  const submit=event=>{event.preventDefault();const prompt=value.trim();if(!prompt){setError('先写下一点故事灵感，或者选择一个示例。');inputRef.current?.focus();notify('先写下一点故事灵感，或者选择一个示例');return;}setError('');onSend(mode==='智能创作'?prompt:`请围绕「${mode}」与我讨论以下创作需求：\n${prompt}`);};
  const suggestions=[
   ['帮我构思一个小说创意','我想写一家能够修复记忆的旧书店，请先提供三个不同的故事方向，帮我一起找到主角与核心冲突。',Lightbulb],
   ['生成详细的大纲','请帮我规划一部悬疑小说的大纲：旧物修复师收到来自明天的信，必须在寻找父亲和阻止事故之间选择。',ListTree],
   ['设计主要人物设定','我想设计一位旧物修复师，她擅长修复别人珍惜的东西，却总是回避自己的过去。请先帮我梳理她的目标、动机与弱点。',UsersRound],
   ['写第一章正文','我准备写一部以海边旧书店为起点的小说。请先与我确认主角、冲突和第一章的场景目标，再讨论开篇。',Feather],
   ['润色已有章节','我有一段已经写好的章节，想保留原有事实与文风，改善表达和对话。请先询问我需要处理的原文与要求。',WandSparkles]
  ];
  const fill=(event,prompt)=>{onChange(prompt);const details=event.currentTarget.closest?.('details');if(details)details.open=false;inputRef.current?.focus();};
  const suggestionLinks=<div className="home-public-suggestions"><span>试试这些：</span>{suggestions.map(([label,prompt,Icon])=><button type="button" key={label} onClick={event=>fill(event,prompt)}><Icon size={15}/>{label}</button>)}</div>;
  if(appearance==='reference'){
   const quickSuggestions=[['帮我构思一个小说大纲',suggestions[1][1],ListTree],['设计主要人物角色',suggestions[2][1],UsersRound],['生成第一章内容',suggestions[3][1],BookOpen],['润色优化我的章节',suggestions[4][1],Feather]];
   const optimize=()=>{const prompt=value.trim();if(!prompt){setError('先写下你的小说创意，再一起完善灵感。');inputRef.current?.focus();return;}setError('');onSend(`请帮我完善下面的小说灵感，保留我的核心想法，先讨论主角、目标与冲突，给出可选方向，等待我确认后再展开：\n${prompt}`);};
   return <section className="home-public-composer home-reference-composer" aria-label="公开创作入口"><form aria-label="故事创作表单" onSubmit={submit}><span className="mdd-reference-composer-icon" aria-hidden="true"><Feather size={22}/></span><label className="home-public-input-label" htmlFor={inputId}>告诉我们你的小说创意</label><textarea id={inputId} ref={inputRef} aria-invalid={Boolean(error)} aria-describedby={error?inputId+'-error':undefined} aria-label="故事灵感输入" maxLength={2000} rows={2} value={value} onChange={event=>onChange(event.target.value)} placeholder={'告诉我们你的小说创意，例如：\n“我想写一部东方玄幻小说，主角从废柴成长为强者……”'}/><div className="mdd-reference-composer-controls"><button type="button" aria-label="优化当前故事灵感" onClick={optimize}><Sparkles size={13}/>灵感优化</button><button type="submit" aria-label="开始创作" title="开始创作"><ArrowRight size={22}/><span className="sr-only">开始创作</span></button></div>{error&&<p className="home-public-input-error" id={inputId+'-error'} role="alert">{error}</p>}</form><div className="home-public-suggestions" aria-label="试试这些创作需求">{quickSuggestions.map(([label,prompt,Icon])=><button type="button" key={label} onClick={event=>fill(event,prompt)}><Icon size={18}/>{label}</button>)}</div><details className="mdd-reference-composer-options"><summary>创作选项<ChevronDown size={12}/></summary><div><div className="home-public-composer-footer"><button type="button" className="home-text-link" aria-label="添加参考资料" onClick={onReference}><Plus size={15}/>参考资料</button><details className="mdd-prompt-menu"><summary><Sparkles size={15}/>灵感模板</summary><div><strong>从一个想法开始</strong>{suggestions.map(([label,prompt,Icon])=><button type="button" key={label} onClick={event=>fill(event,prompt)}><Icon size={15}/>{label}</button>)}<button type="button" className="mdd-template-example" onClick={onShowExample}>查看完整预写示例<ArrowRight size={14}/></button></div></details><label className="mdd-creation-mode"><span className="sr-only">创作模式</span><select aria-label="创作模式" value={mode} onChange={event=>setMode(event.target.value)}>{['智能创作','大纲规划','人物设计','正文续写','文字润色'].map(item=><option key={item}>{item}</option>)}</select><ChevronDown size={14} aria-hidden="true"/></label>{onShowDemo&&<button type="button" className="home-text-link" onClick={onShowDemo}><CirclePlay size={15}/>查看产品演示</button>}</div><span className="mdd-prompt-count">{value.length} / 2,000 · 内容由你确认后采用</span></div></details></section>;
  }
  return <section className={'home-public-composer'+(appearance==='landing'?' home-landing-composer':'')} aria-label="公开创作入口"><form aria-label="故事创作表单" onSubmit={submit}><label className="home-public-input-label" htmlFor={inputId}>告诉墨多多，你想写一个什么故事？</label><textarea id={inputId} ref={inputRef} aria-invalid={Boolean(error)} aria-describedby={error?inputId+'-error':undefined} aria-label="故事灵感输入" maxLength={2000} rows={2} value={value} onChange={event=>onChange(event.target.value)} placeholder="告诉墨多多你想写的小说，比如：一部现代都市的创业逆袭小说……"/><div className="home-public-composer-footer"><div className="mdd-composer-extras"><button type="button" className="home-text-link" aria-label="添加参考资料" onClick={onReference}><Plus size={16}/>参考资料</button><details className="mdd-prompt-menu"><summary><Sparkles size={15}/>灵感模板</summary><div><strong>从一个想法开始</strong>{suggestions.map(([label,prompt,Icon])=><button type="button" key={label} onClick={event=>fill(event,prompt)}><Icon size={15}/>{label}</button>)}<button type="button" className="mdd-template-example" onClick={onShowExample}>查看完整预写示例<ArrowRight size={14}/></button></div></details></div><span className="mdd-prompt-count">{value.length} / 2,000</span><label className="mdd-creation-mode"><span className="sr-only">创作模式</span><select aria-label="创作模式" value={mode} onChange={event=>setMode(event.target.value)}>{['智能创作','大纲规划','人物设计','正文续写','文字润色'].map(item=><option key={item}>{item}</option>)}</select><ChevronDown size={14} aria-hidden="true"/></label><button type="submit" className="button primary" aria-label="开始创作" title="开始创作"><Send size={21}/><span className="sr-only">开始创作</span></button></div>{error&&<p className="home-public-input-error" id={inputId+'-error'} role="alert">{error}</p>}</form>{suggestionLinks}<p className="home-public-composer-note">从灵感聊起，生成的内容由你确认后采用。</p></section>;
}

function HomeSupport({navigate,setModal,gate}) {
  const [index,setIndex]=useState(0),idea=inspirations[index];
  return <div className="home-support" aria-label="创作指南与灵感"><nav className="home-publishing-links" aria-label="写作与出版"><span>写作与出版</span><button type="button" onClick={()=>gate(()=>navigate('novels'))}><BookOpen size={15}/>小说写作</button><button type="button" onClick={()=>gate(()=>navigate('scripts'))}><Clapperboard size={15}/>剧本创作</button><button type="button" onClick={()=>gate(()=>navigate('dismantle'))}><BookMarked size={15}/>小说拆书</button><button type="button" onClick={()=>gate(()=>navigate('submit'))}><Send size={15}/>投稿中心</button></nav><div className="home-service-links"><details className="home-daily-inspiration"><summary><Lightbulb size={13}/>今日灵感</summary><div><blockquote>{idea.quote.replace('\n','')}</blockquote><span>{idea.tags.join(' · ')}</span><button type="button" className="home-icon-button" aria-label="切换今日灵感" onClick={()=>setIndex((index+1)%inspirations.length)}><RefreshCw size={14}/></button><button type="button" className="home-text-link" onClick={()=>gate(()=>setModal({type:'create',idea:idea.prompt}))}>用这个灵感<ArrowRight size={13}/></button></div></details><button type="button" onClick={()=>gate(()=>setModal({type:'settings'}))}><Settings2 size={13}/>创作设置</button><button type="button" onClick={()=>gate(()=>setModal({type:'settings'}))}><Cloud size={13}/>备份恢复</button><button type="button" aria-label="使用帮助" onClick={()=>setModal({type:'help'})}><CircleHelp size={13}/>帮助</button><button type="button" onClick={()=>gate(()=>navigate('membership'))}><Crown size={13}/>查看创作方案</button></div></div>;
}


const publicStoryExamples = [
  {id:'rain-letter',title:'雨夜来信',genre:'悬疑',kind:'原创预写示例',cover:'fog',description:'一封写着明天日期的信，让旧书店的秘密重新浮出水面。',...storyExample},
  {id:'spring-wind',title:'风来的那一天',genre:'言情',kind:'原创预写示例',cover:'spring',description:'重返海边小城，两个错过的人收到同一间旧屋的钥匙。',idea:'十年后，两位曾经的恋人回到海边故乡，发现他们各自继承了同一间旧屋的一半。',outline:'从旧屋的归属争执开始，两人一同修缮房子，逐渐发现当年的离别藏着未寄出的解释，最终各自作出新的选择。',character:'余夏 · 插画师。习惯用轻松掩盖失落，想把旧屋改成画室，却害怕再次留不住重要的人。',text:'风把门缝里的信吹到了她脚边。余夏弯腰拾起，看见另一串钥匙已经放在了窗台上。'},
  {id:'silent-moon',title:'沉默的第七颗月亮',genre:'科幻',kind:'原创预写示例',cover:'orbit',description:'在一颗失去日出的行星，探险队收到了一段来自明天的求救。',idea:'探险队在一颗从不日出的行星着陆，收到一段来自明天、由他们自己发出的求救信号。',outline:'队员循着求救信号寻找源头，发现每次通信都会改变一段航行记录。他们必须在信任彼此和相信记录之间作出选择。',character:'纪遥 · 航行记录员。相信所有答案都能被记录，却发现自己最重要的一段记忆从未写入日志。',text:'第七颗月亮升起时，所有时钟都停了。纪遥摘下耳机，通讯舱里传出了她明天才会说出的第一句话。'}
  ,{id:'cloud-road',title:'云海问归',genre:'玄幻',kind:'原创预写示例',cover:'mountain',description:'少年带着一封无字的家书，走进一座只在晨雾里出现的山城。',idea:'一名从未离开过山村的少年，收到一封只有在云海升起时才会显字的家书；寄信的地方在地图上并不存在。',outline:'少年为寻找家书的来源进入云海山城，发现城中每个人都在等待一位不会归来的故人。他要在找回自己的身世与打破山城的等待之间作出选择。',character:'陆青川 · 山村送信人。相信每一封信都应有归处，却从未收到过写给自己的信。',text:'天亮以前，信上终于出现了第一个字。青川攥紧包袱，望见云海里浮出了一条从未有过的石阶。'}
];

const landingQuestions=[
  ['只有一句话想法，也能开始写吗？','可以。先写下一个角色、场景或冲突，与创作助手讨论故事方向，再逐步完善大纲、人物与开篇。'],
  ['已经写了一部分，可以继续创作吗？','可以。登录后在「我的作品」中管理文稿或导入 TXT，再使用剧情续写、对白打磨和文字润色等工具继续创作。'],
  ['生成的内容可以自己修改吗？','可以。大纲、人物设定和正文都可以继续编辑。你可以调整故事方向、修改语言表达，让作品保留自己的风格。'],
  ['需要先登录才能浏览吗？','浏览首页、查看创作示例和填写灵感都无需登录。进入创作与保存作品时，优先使用手机号验证码登录，也支持邮箱登录。'],
  ['会员和墨点现在会真实扣款吗？','目前会员与墨点为方案演示，不产生真实收款。具体状态在方案页面中说明，进入创作空间后可查看。']
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
  const scrollTo=ref=>ref.current?.scrollIntoView({behavior:globalThis.window?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches?'auto':'smooth',block:'start'});
  const showExample=()=>{setExampleOpen(true);scrollTo(exampleRef);};
  const useExample=()=>{setPrompt(selectedExample.idea);scrollTo(heroRef);inputRef.current?.focus?.({preventScroll:true});notify('示例灵感已填入，点击开始创作后再继续。');};
  const groups=homeToolGroups.map(group=>({...group,tools:group.ids.map(id=>tools.find(tool=>tool.id===id)).filter(Boolean)}));
  const guideTool=tools.find(tool=>tool.id===guideId);
  const featureCards=[
   {id:'outline',label:'故事大纲',Icon:ListTree,description:'梳理故事主线，规划章节与转折',action:()=>openTool(tools.find(tool=>tool.id==='outline'))},
   {id:'character',label:'人物设定',Icon:UsersRound,description:'整理角色动机、成长与人物关系',action:()=>openTool(tools.find(tool=>tool.id==='character'))},
   {id:'world',label:'世界观设定',Icon:Globe2,description:'讨论故事背景、规则与人物处境',action:()=>openConversation('我想为一部小说构建世界观，请先询问故事题材、背景、核心规则与代价，和我一起比较设定方向。')},
   {id:'continue',label:'正文创作',Icon:Feather,description:'从第一章开始，让情节继续生长',action:()=>openTool(tools.find(tool=>tool.id==='continue'))},
   {id:'polish',label:'文字润色',Icon:WandSparkles,description:'保留你的文风，打磨表达与对白',action:()=>openTool(tools.find(tool=>tool.id==='polish'))},
   {id:'works',label:'创作管理',Icon:FolderOpen,description:'作品、章节与参考资料集中整理',action:()=>gate(()=>navigate('works'))}
  ];
  const gallery=[['悬疑','旧书店里，只有来自明天的信件才能被投递。'],['玄幻','所有人都在寻找长生，只有他想找回失去的一天。'],['都市','关门前的最后一单，让一家社区食堂重新热闹起来。'],['言情','两个人各自继承了一间旧屋的一半，谁也不愿先搬走。'],['科幻','星舰收到的求救信号，是船长明天才会说出口的话。'],['现实','退休的父亲开始送快递，送件地址却总是同一个地方。']];
  const sceneCards=[
   {id:'start',title:'从零创作小说',text:'输入一个想法，逐步完成大纲、设定与正文创作。',image:'/art/scene-start-v2.webp',action:()=>gate(()=>setModal({type:'quick-start'}))},
   {id:'continue',title:'续写已有小说',text:'带上前情与章节目标，让已有的故事继续生长。',image:'/art/scene-continue-v2.webp',action:()=>openConversation('我已经写了一部分小说，想继续下一章。请先帮我梳理前情、人物状态与本章目标，再讨论续写方向。')},
   {id:'polish',title:'修改润色小说',text:'优化文风、节奏与对白细节，让内容更精彩。',image:'/art/scene-polish-v2.webp',action:()=>openTool(tools.find(tool=>tool.id==='polish'))}
  ];
  const exampleImages={fog:'/art/cover-fog.webp',spring:'/art/cover-spring.webp',orbit:'/art/cover-orbit.webp',mountain:'/art/hero-shanshui-v1.webp'};
  return <div className="mdd-landing mdd-centered-landing">
   <section className="mdd-hero" aria-label="首页创作入口" id="landing-create" ref={heroRef}>
    <img className="mdd-hero-art" src="/art/hero-jianghu-centered-v2.webp" alt="" aria-hidden="true" width="2304" height="768" fetchPriority="high"/>
    <div className="mdd-container">
     <div className="mdd-hero-heading"><span className="mdd-eyebrow"><Sparkles size={16}/>AI 小说创作平台<ArrowRight size={12}/></span><h1>让好故事<em>更容易</em>写出来</h1><p>从灵感构思、世界观设定、人物塑造、大纲生成，到章节写作与润色，<br className="mdd-desktop-break"/>墨多多用 AI 陪你创作一部完整的小说。</p></div>
     <div className="mdd-composer-wrap"><PublicHomeComposer appearance="reference" forwardedInputRef={inputRef} value={prompt} onChange={setPrompt} onSend={openConversation} onReference={()=>openConversation(prompt.trim())} onShowExample={showExample} onShowDemo={()=>setModal({type:'product-demo'})} notify={notify}/></div>
    </div>
   </section>
   <section className="mdd-capability-strip" aria-label="创作功能" id="landing-features"><div className="mdd-container"><div className="mdd-feature-grid" aria-label="创作快捷入口">{featureCards.map(({id,label,Icon,description,action})=><button type="button" key={id} className={'mdd-feature mdd-feature-'+id} aria-label={'体验'+label} onClick={action}><Icon size={26}/><span><strong>{label}</strong><small>{description}</small></span></button>)}</div></div></section>
   <div className="mdd-container mdd-main-sections">
    <section className="mdd-scenes" aria-label="三种常用创作场景"><header className="mdd-section-heading"><div><h2>从灵感到成稿，一站式创作</h2></div><button type="button" className="home-text-link" onClick={()=>{setToolsOpen(true);scrollTo(toolsRef);}}>查看全部功能<ArrowRight size={15}/></button></header><div className="mdd-scene-grid">{sceneCards.map(scene=><button type="button" className={'mdd-scene mdd-scene-'+scene.id} aria-label={scene.title} key={scene.id} onClick={scene.action}><img src={scene.image} width="512" height="512" alt="" loading="lazy"/><span><strong>{scene.id==='start'?'从零开始写小说':scene.id==='continue'?'续写已有作品':'润色与优化'}</strong><small>{scene.text}</small></span><span className="mdd-scene-arrow"><ArrowRight size={16}/></span></button>)}</div></section>
    <section className="mdd-examples" aria-label="预写创作示例" id="landing-examples" ref={exampleRef}><header className="mdd-section-heading"><div><h2>创作案例</h2><p className="sr-only">原创预写内容，看看大纲、人物与开篇可以怎样呈现。</p></div><div className="mdd-example-filters" role="group" aria-label="示例题材">{['全部','悬疑','言情','科幻','玄幻'].map(genre=><button type="button" key={genre} aria-pressed={exampleFilter===genre} onClick={()=>setExampleFilter(genre)}>{genre}</button>)}</div></header><div className="mdd-example-grid">{publicStoryExamples.filter(item=>exampleFilter==='全部'||item.genre===exampleFilter).map(item=><button type="button" className={'mdd-example'+(exampleOpen&&exampleId===item.id?' is-selected':'')} key={item.id} aria-label={'查看预写示例：'+item.title} onClick={()=>{setExampleId(item.id);setExampleOpen(true);}}><img className={'mdd-example-cover mdd-example-cover-'+item.cover} src={exampleImages[item.cover]} width="90" height="112" loading="lazy" alt=""/><span className="mdd-example-copy"><strong>《{item.title}》</strong><span className="mdd-example-genre">{item.genre} · 原创预写</span><small>{item.description}</small></span></button>)}</div><div className="mdd-example-toggle"><button type="button" className="home-text-link" aria-expanded={exampleOpen} onClick={()=>setExampleOpen(!exampleOpen)}>{exampleOpen?'收起示例':'展开示例'}<ChevronDown size={15}/></button></div>{exampleOpen&&<div className="home-public-example"><header><div><span>预先编写的输出示例</span><h2>{selectedExample.title}</h2></div><button type="button" className="home-text-link" onClick={useExample}>填入示例灵感<ArrowRight size={15}/></button></header><div className="home-public-example-columns"><article><span>故事大纲</span><p>{selectedExample.outline}</p></article><article><span>人物设定</span><p>{selectedExample.character}</p></article><article><span>开篇正文</span><p>{selectedExample.text}</p></article></div></div>}</section>
    <details className="mdd-inspiration" id="landing-inspiration"><summary><span><Lightbulb size={19}/><strong>灵感广场</strong><small>从一个预写灵感，找到你的故事方向。</small></span><ChevronDown size={17}/></summary><div className="mdd-inspiration-grid">{gallery.map(([genre,idea])=><button type="button" key={genre} onClick={()=>{setPrompt(idea);scrollTo(heroRef);inputRef.current?.focus?.();}}><span>{genre} · 灵感模板</span><strong>{idea}</strong><small>填入这个灵感<ArrowRight size={14}/></small></button>)}</div></details>
    <details className="mdd-toolbox" id="landing-tools" ref={toolsRef} open={toolsOpen} onToggle={event=>setToolsOpen(event.currentTarget.open)}><summary><span><strong>更多写作工具</strong><small>对白打磨、章节审稿、书名与简介，让每一步创作更顺手。</small></span><span className="mdd-toolbox-toggle">查看工具<ChevronDown size={18}/></span></summary><section className="home-tools-section" aria-label="写作工具"><div className="home-tool-groups">{groups.map(group=><section className="home-tool-group" aria-label={group.title} key={group.id}><h3>{group.title}</h3><div className="home-tools-grid">{group.tools.map(tool=><HomeToolRow key={tool.id} tool={tool} favorite={false} publicMode onFavorite={()=>gate(()=>navigate('tools'))} onOpen={()=>openTool(tool)} guideOpen={guideId===tool.id} onGuide={()=>setGuideId(guideId===tool.id?null:tool.id)} menuOpen={menuId===tool.id} onMenuToggle={force=>setMenuId(current=>force?tool.id:current===tool.id?null:tool.id)} onMenuClose={closeMenu}/>)}</div></section>)}</div>{guideTool&&<div className="home-open-guide"><button type="button" className="home-guide-close" aria-label="收起工具使用指南" onClick={()=>setGuideId(null)}><X size={16}/>收起指南</button><ToolGuide key={guideTool.id} toolId={guideTool.id} onUseExample={value=>openTool(guideTool,{prompt:value})}/></div>}<button type="button" className="home-text-link" onClick={()=>gate(()=>navigate('tools'))}>进入工具库<ArrowRight size={15}/></button></section></details>
    <section className="mdd-faq" aria-label="常见问题" id="landing-faq"><div><h2>开始之前，你可能想知道</h2><p>关于写作、文稿和登录的几个小问题。</p></div><div className="mdd-faq-list">{landingQuestions.map(([question,answer])=><details key={question}><summary>{question}<Plus size={18}/></summary><p>{answer}</p></details>)}</div></section>
    <section className="mdd-final-cta" aria-label="进入创作空间" id="landing-plans"><div className="mdd-final-copy"><span>墨多多 · 写作</span><h2>让每一个好故事，都有一个开始。</h2><p>把一直想写的那个念头，现在写下来。</p></div><button type="button" onClick={enterStudio}>免费开始写作<ArrowRight size={18}/></button></section>
    <div className="mdd-support"><HomeSupport navigate={navigate} setModal={setModal} gate={gate}/></div>
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
