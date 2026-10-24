import React from 'react';
import {ArrowRight,BookOpen,Check,ChevronRight,Clapperboard,FileText,ListTree,MessagesSquare,Plus,Sparkles,UsersRound} from 'lucide-react';
import {BookCover} from './Art';
import {WorkCard} from './Library';
import {MarketCard} from './Dashboard';
import {tools,workflows} from './data';

function ScriptIllustration(){
 return <div className="script-illustration" aria-hidden="true"><span className="script-art-orbit"/><div className="script-art-book"><BookCover work={{cover:'fog',title:'雨夜来信',subtitle:'A STORY BEGINS'}}/></div><div className="script-art-page"><div className="script-page-top"><span>墨多多 · 剧本手记</span><Clapperboard size={15}/></div><span className="script-page-number">SCENE 01</span><strong>第一场 · 旧书店</strong><span className="script-scene-label">内景 / 夜</span><p>雨水沿着窗玻璃落下。<br/>她推开门，停在灯光里。</p><div className="script-art-dialogue"><small>林深</small><p>“你也收到那封信了？”</p></div><div className="script-page-lines"><i/><i/><i/></div><span className="script-page-footer">故事的第一场戏，由你写起。<span>01</span></span></div><span className="script-art-sticker"><Check size={12}/>把想法写成故事</span></div>;
}

export function ScriptDesk({works,navigate,setModal,favorites,toggleFavorite}){
 const scripts=works.filter(w=>w.kind==='剧本');
 const adapt=()=>setModal({type:'workflow',flow:workflows.find(f=>f.id==='script')});
 const create=()=>setModal({type:'create',kind:'剧本'});
 const steps=[{icon:BookOpen,title:'先有一个好故事',desc:'从原创灵感出发，或选择已有小说。',action:create},{icon:ListTree,title:'让情节成为场景',desc:'梳理人物关系，搭建分集与分场。',action:adapt},{icon:MessagesSquare,title:'听见角色的声音',desc:'打磨行动与对白，让每一场戏更鲜活。',action:()=>setModal({type:'tool',tool:tools.find(t=>t.id==='dialogue')})}];
 return <div className="script-desk"><div className="page-heading"><div><span className="page-kicker"><Clapperboard size={14}/>把文字，写成一场好戏</span><h1>剧本创作</h1><p>从原创故事到小说改编，专注写好每一场戏。</p></div><button className="button primary" onClick={create}><Plus size={16}/>新建剧本</button></div>
  <section className="script-feature"><div className="script-feature-copy"><span className="script-feature-kicker"><span/>墨多多 · 文字剧本工作室</span><h2>让好故事，<br/>有自己的<span>开场。</span></h2><p>把脑海里的画面，落成场景、行动与对白。<br/>你负责故事的方向，AI 陪你打磨每个细节。</p><div className="script-feature-actions"><button className="button script-primary" onClick={create}><Plus size={16}/>创作原创剧本<ArrowRight size={15}/></button><button className="button script-secondary" onClick={adapt}><BookOpen size={16}/>从小说改编</button></div><div className="script-feature-tags"><span><Check size={12}/>分集与分场</span><span><Check size={12}/>人物与对白</span><span><Check size={12}/>本机自动保存</span></div></div><ScriptIllustration/></section>
  <section className="script-path" aria-label="剧本创作步骤">{steps.map((step,i)=><button key={step.title} onClick={step.action}><span className="script-path-number">0{i+1}</span><span className="script-path-icon"><step.icon size={20}/></span><span><strong>{step.title}</strong><small>{step.desc}</small></span><ChevronRight size={15}/></button>)}</section>
  <div className="dashboard-section-heading script-section-heading"><div><h2>我的剧本 <span className="section-count">{scripts.length}</span></h2><span>每一场戏，都值得接着写。</span></div><button className="text-button" onClick={()=>navigate('works')}>管理全部作品<ArrowRight size={14}/></button></div>
  {scripts.length?<div className="work-grid">{scripts.map(w=><WorkCard key={w.id} work={w} onOpen={()=>navigate(`editor/${w.id}`)} onManage={()=>setModal({type:'work-details',work:w})}/>)}</div>:<section className="script-empty"><span className="script-empty-icon"><FileText size={27}/><i><Plus size={11}/></i></span><div><span className="empty-kicker">你的下一场好戏</span><h3>第一场戏，就从这里开始。</h3><p>新建一个剧本，或让已有的小说换一种表达。</p></div><button className="button secondary" onClick={create}>创建第一部剧本<ArrowRight size={15}/></button></section>}
  <section className="script-tools"><div className="dashboard-section-heading"><div><h2>给创作一点助力</h2><span>从人物到对白，找到你需要的工具。</span></div><button className="text-button" onClick={()=>navigate('tools')}>全部工具<ArrowRight size={14}/></button></div><div className="market-grid home-market-grid">{tools.filter(t=>['character','dialogue','outline','review'].includes(t.id)).map(tool=><MarketCard key={tool.id} tool={tool} favorite={favorites.includes(tool.id)} onFavorite={()=>toggleFavorite(tool.id)} onOpen={()=>setModal({type:'tool',tool})}/>)}</div></section>
 </div>;
}
