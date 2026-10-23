import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, BarChart3, BookOpen, Check, CheckCircle2, ChevronRight, Coins, Crown, Feather, Gift, Info, LoaderCircle, ReceiptText, ShieldCheck, Sparkles, Wallet, X } from 'lucide-react';
import { BILLING_KEY, activePlan, applyDemoPurchase, balanceOf, billingTasks, creditPacks, dateLabel, finishTask, money, newBillingAccount, number, offerDetails, plans, quoteTask, readBilling, refreshBilling, reserveTask, writingModes } from './billing';
import './billing.css';
import { useGeneration } from './Generation';

const BillingContext=createContext(null);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export function BillingProvider({children}) {
  const [account,setAccount]=useState(()=>readBilling(globalThis.localStorage));
  const current=useRef(account);
  const [storageError,setStorageError]=useState('');
  const [destinationTab,setDestinationTab]=useState('plans');
  const [navigationKey,setNavigationKey]=useState(0);
  const persist=next=>{
    try { globalThis.localStorage.setItem(BILLING_KEY,JSON.stringify(next));current.current=next;setAccount(next);setStorageError('');return true; }
    catch { setStorageError('演示账本未能保存，已暂停本次计费操作。文稿编辑不受影响。');return false; }
  };
  useEffect(()=>{
    persist(current.current);
    const timer=setInterval(()=>{const next=refreshBilling(current.current);if(next!==current.current)persist(next);},60000);
    return()=>clearInterval(timer);
  },[]);
  const go=tab=>{setDestinationTab(tab||'plans');setNavigationKey(value=>value+1);location.hash='membership';};
  const runTask=async(quote,producer,{force=false}={})=>{
    if(!current.current.enabled&&!force){try{await producer();return {ok:true};}catch(error){return {ok:false,message:error.message||'任务未完成，请重试。'};}}
    let reserved;
    try{reserved=reserveTask(current.current,quote);}catch(error){return {ok:false,message:error.message,code:error.code};}
    if(!persist(reserved.account))return {ok:false,message:'账本未能保存，本次没有开始，也没有扣除墨点。',code:'storage'};
    try {
      await producer();
      const saved=persist(finishTask(current.current,reserved.ticket,true));
      return {ok:true,message:saved?'': '结果已生成，结算尚未保存；重新打开后将恢复这笔未完成扣点。'};
    } catch (error) {
      const saved=persist(finishTask(current.current,reserved.ticket,false));
      return {ok:false,message:saved?`${error.message||'任务未完成'}；模拟墨点已退回。`:'任务未完成，退款状态尚未保存；重新打开后将恢复这笔未完成扣点。',code:'failed'};
    }
  };
  const purchase=(offer,requestId)=>persist(applyDemoPurchase(current.current,offer,requestId));
  const setEnabled=value=>persist({...refreshBilling(current.current),enabled:value});
  const reset=()=>current.current.ledger.some(row=>row.status==='pending')?false:persist(newBillingAccount());
  return <BillingContext.Provider value={{account,balance:balanceOf(account),plan:activePlan(account),storageError,destinationTab,navigationKey,go,runTask,purchase,setEnabled,reset}}>{children}</BillingContext.Provider>;
}
export function useBilling(){return useContext(BillingContext);}

export function useTaskMeter(taskId,{inputChars=0,dimensions=4,outputChars:initialOutput=1000}={}) {
  const billing=useBilling();
  const [model,setMode]=useState('standard');
  const [outputChars,setOutputChars]=useState(initialOutput);
  const [error,setError]=useState(null);
  const pending=useRef(new Set());
  const running=useRef(false);
  useEffect(()=>()=>{for(const cancel of pending.current)cancel(new Error('Task cancelled'));pending.current.clear();},[]);
  let quote,invalid;
  try { quote=quoteTask({taskId,model,inputChars,outputChars,dimensions}); } catch(e){invalid=e.message;}
  const setModel=value=>{setMode(value);setError(null);};
  const run=async(producer,options)=>{
    if(running.current)return false;
    setError(null);
    if(invalid){setError({message:invalid});return false;}
    running.current=true;
    let cancel;
    const cancelled=new Promise((_,reject)=>{cancel=reject;});
    cancelled.catch(()=>{});
    pending.current.add(cancel);
    const execute=()=>Promise.race([Promise.resolve().then(producer),cancelled]);
    let result;
    try {
      if(billing)result=await billing.runTask(quote,execute,options);
      else{try{await execute();result={ok:true};}catch(error){result={ok:false,message:error.message||'任务未完成，请重试。'};}}
    } finally {running.current=false;pending.current.delete(cancel);}
    if(result.message)setError(result);
    return result.ok;
  };
  return {billing,taskId,quote,model,setModel,outputChars,setOutputChars,error,invalid,run};
}
export function TaskMeter({meter,compact=false,hideSize=false}) {
  const {billing,quote,error,invalid}=meter;const generation=useGeneration();
  const options=<div className="task-meter-options"><label>计费模式<select aria-label="创作计费模式" value={meter.model} onChange={e=>meter.setModel(e.target.value)}>{writingModes.map(mode=><option value={mode.id} key={mode.id}>{mode.name} · {mode.multiplier} 倍</option>)}</select></label>{!hideSize&&meter.taskId!=='reading'&&<label>目标篇幅<select aria-label="计费目标篇幅" value={meter.outputChars} onChange={e=>meter.setOutputChars(Number(e.target.value))}>{[500,1000,2000].map(size=><option value={size} key={size}>{number(size)} 字</option>)}</select></label>}</div>;
  const cost=<div className="task-meter-quote"><span><Coins size={14}/>预计 <strong>{quote?.credits??'—'}</strong> 墨点</span><small>{billing?.account.enabled?'模拟扣点已开启':generation.mode==='ai'?'墨点未扣，模型费用由服务商收取':'当前示例不扣点'}</small></div>;
  return <div className={`task-meter ${compact?'meter-compact':''}`}>
    {compact?<>{cost}<details className="meter-config"><summary>{quote?.mode||'计费设置'} · {number(meter.outputChars)} 字<span>调整<ChevronRight size={12}/></span></summary>{options}<p>{generation.mode==='ai'?'目标篇幅与模式会随生成需求发送；墨点金额仍为模拟。':'当前返回预置示例，模式与篇幅只用于费用演示。'}</p></details></>:<>{options}{cost}</>}
    {billing&&<div className="task-meter-balance"><span>演示可用 {number(billing.balance)} 墨点</span><button onClick={()=>billing.go('usage')}>计费说明<ChevronRight size={12}/></button></div>}
    {(error||invalid)&&<div className="meter-message" role="status"><Info size={14}/><div><p>{invalid||error.message}</p>{error?.code==='insufficient'&&<div><button onClick={()=>billing?.go('packs')}>查看加油包<ArrowRight size={12}/></button><button onClick={()=>billing?.go('plans')}>比较会员套餐</button></div>}</div></div>}
    {!compact&&<p className="meter-demo-note">{generation.mode==='ai'?'当前使用已配置的模型；墨点用于费用模拟，服务商另行计费。':'篇幅与模式用于费用演示；当前返回预置示例。'}</p>}
  </div>;
}

export function BillingBadge({onClick}) {
  const billing=useBilling();
  if(!billing)return null;
  return <button className="billing-topbar-badge" onClick={onClick||(()=>billing.go('plans'))} aria-label="查看会员与墨点"><Coins size={15}/><strong>{number(billing.balance)}</strong><span>墨点</span><i>演示</i></button>;
}
export function AccountBilling({onOpen}) {
  const billing=useBilling();if(!billing)return null;
  return <button className="account-billing" onClick={onOpen}><span><Crown size={18}/><strong>{billing.plan.name}</strong><small>演示账户</small></span><span>{number(billing.balance)} 墨点<ArrowUpRight size={16}/></span></button>;
}

function Checkout({offer,billing,onClose,onSuccess}) {
  const product=offerDetails(offer);
  const [accepted,setAccepted]=useState(false);
  const [error,setError]=useState('');
  const lock=useRef(false);
  const requestId=useRef(`demo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`);
  const dialog=useRef(null);
  useEffect(()=>{
    if(!dialog.current)return;
    const previous=document.activeElement;
    const getItems=()=>Array.from(dialog.current.querySelectorAll('button,input')).filter(el=>!el.disabled);
    getItems()[0]?.focus();
    const key=e=>{if(e.key==='Escape')onClose();if(e.key==='Tab'){const items=getItems(),first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};
    dialog.current.addEventListener('keydown',key);
    const element=dialog.current;
    return()=>{element.removeEventListener('keydown',key);if(previous?.isConnected)previous.focus();};
  },[]);
  const confirm=()=>{
    if(!accepted||lock.current)return;lock.current=true;
    if(billing.purchase(offer,requestId.current)){onSuccess(`${product.name}已模拟到账，未发生真实付款。`);onClose();}
    else{lock.current=false;setError('本地账本未能保存，本次没有开通，请检查浏览器存储后重试。');}
  };
  return <div className="modal-backdrop billing-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section className="modal billing-checkout" role="dialog" aria-modal="true" aria-label="确认演示订单" ref={dialog}>
    <button className="icon-button modal-close" aria-label="关闭演示订单" onClick={onClose}><X size={20}/></button>
    <span className="billing-modal-icon"><ReceiptText size={24}/></span><span className="eyebrow">墨多多 · 方案体验</span><h2>确认这份创作补给</h2><p className="modal-desc">这是可操作的订单演示，不会跳转支付或真实扣款。</p>
    <div className="checkout-product"><div><strong>{product.name}</strong><small>{product.kind==='plan'?`每月 ${number(product.credits)} 墨点，${product.months===12?'按月到账，共 12 个月':'有效 1 个月'}`:`${number(product.credits)} 墨点，一次到账，有效 12 个月`}</small></div><Crown size={25}/></div>
    <dl className="checkout-summary"><div><dt>方案测试价</dt><dd>¥{money(product.amount)}</dd></div><div><dt>购买方式</dt><dd>单次购买 · 不自动续费</dd></div><div><dt>到账规则</dt><dd>{product.kind==='plan'?'本次到账首月额度':'与会员额度分开保留'}</dd></div>{product.cycle==='yearly'&&<div><dt>年付总额</dt><dd>¥{money(product.amount)} / 年，非按月扣款</dd></div>}<div className="checkout-total"><dt>演示订单金额</dt><dd>¥<strong>{money(product.amount)}</strong></dd></div></dl>
    {product.kind==='plan'&&billing.account.member&&<p className="checkout-replace">本地演示会替换当前演示套餐和剩余月度额度，加油包保留。本演示不计算真实升级差价。</p>}
    <label className="billing-consent"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/><span>我了解这是模拟开通，不会产生真实付款；月赠额度当月有效，加油包有效 12 个月。</span></label>
    {error&&<p className="billing-error" role="alert">{error}</p>}
    <button className="button primary full" disabled={!accepted} onClick={confirm}>确认模拟{product.kind==='plan'?'开通':'充值'}<ArrowRight size={16}/></button><p className="checkout-footnote"><ShieldCheck size={13}/>当前无需填写银行卡或支付信息</p>
  </section></div>;
}

const faqs=[
  ['不开会员，可以继续写作吗？','可以。本地写作、章节管理、导入与 TXT 导出始终免费。墨点用于 AI 任务的计费方案，额度不足也不会锁住你的文稿。'],
  ['年付会员是一次到账一年的墨点吗？','不是。年付是一次购买 12 个月的会员，墨点按月到账，未使用的月赠额度在当月到期。页面同时展示年付总额和折算月价。'],
  ['加油包和会员额度，先用哪一个？','优先使用更早到期的额度。会员月赠额度按月有效，加油包独立保留 12 个月。更换演示套餐不会删除加油包。'],
  ['一次生成到底要花多少？','文本任务按目标篇幅和输入规模试算，精修模式按 3 倍墨点计算。拆书按输入字数与维度计费。每次操作前都展示估算，当前示例输出长度不等于目标篇幅。'],
  ['生成失败，会扣墨点吗？','开启计费演示后，任务先预留额度，完成后结算，失败则退回。刷新中断的未完成任务会在下次打开时恢复额度。正式收费时也应遵守明确公示的失败退回规则。'],
  ['现在可以真实付费吗？','还不可以。这里展示的是测试价格和模拟订单，没有接入支付、真实模型或正式会员权益。不会自动续费，也不会要求提供支付信息。']
];

export function MembershipPage({navigate}) {
  const billing=useBilling();
  const [tab,setTab]=useState(billing?.destinationTab||'plans');
  const [cycle,setCycle]=useState('monthly');
  const [offer,setOffer]=useState(null);
  const [notice,setNotice]=useState('');
  const [recordType,setRecordType]=useState('credits');
  const [task,setTask]=useState('continue');
  const [inputChars,setInputChars]=useState(1000);
  const [dimensions,setDimensions]=useState(4);
  const [busy,setBusy]=useState(false);
  const [resetConfirm,setResetConfirm]=useState(false);
  const [failure,setFailure]=useState(false);
  const meter=useTaskMeter(task,{inputChars,dimensions});
  useEffect(()=>{if(billing)setTab(billing.destinationTab);},[billing?.destinationTab]);
  if(!billing)return null;
  const {account,balance,plan}=billing;
  const memberBalance=account.buckets.filter(b=>b.kind==='member'&&(!b.expiresAt||b.expiresAt>Date.now())).reduce((sum,b)=>sum+b.remaining,0);
  const used=account.member?Math.max(0,plan.credits-memberBalance):0;
  const changeTab=value=>{setTab(value);setNotice('');};
  const trial=async()=>{if(busy)return;setBusy(true);const ok=await meter.run(async()=>{await delay(420);if(failure)throw new Error('Simulated provider failure');},{force:true});setBusy(false);if(ok)setNotice(`已模拟完成一次${meter.quote.task}，演示扣除 ${meter.quote.credits} 墨点。`);};
  const exportRecords=()=>{
    const text=JSON.stringify({notice:'墨多多本地计费演示记录，非付款凭证',exportedAt:new Date().toISOString(),orders:account.orders,ledger:account.ledger},null,2);
    const url=URL.createObjectURL(new Blob([text],{type:'application/json;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='墨多多-演示账单.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  return <div className="membership-page">
    <div className="billing-page-heading"><div><h1>会员与墨点</h1><p>按创作频率选择，用量和费用一目了然。</p></div><span className="billing-preview-badge"><ShieldCheck size={14}/>方案预览 · 暂不收款</span></div>
    <section className="billing-account-panel"><div className="billing-account-plan"><span className="billing-account-icon"><Crown size={24}/></span><div><span>当前方案 · 演示账户</span><h2>{plan.name}</h2><p>{account.member?`${dateLabel(account.member.expiresAt)} 到期 · 不自动续费`:'手动写作与导出永久免费'}</p></div></div><div className="billing-balance"><span>可用演示墨点</span><strong>{number(balance)}<small>墨点</small></strong><button onClick={()=>changeTab('usage')}>查看用量<ArrowUpRight size={13}/></button></div><div className="billing-month-progress"><div><span>{account.member?'本月会员额度':'新手体验额度'}</span><strong>{account.member?`${number(memberBalance)} / ${number(plan.credits)}`:'首次赠送 300 墨点'}</strong></div><div className="billing-progress-track"><span style={{width:`${account.member?Math.max(0,100-used/plan.credits*100):Math.min(100,balance/300*100)}%`}}/></div><p>{account.member?`下次到账 / 到期：${dateLabel(account.member.nextGrantAt)}`:'当前预置示例默认不扣点，可在下方开启模拟计费。'}</p></div></section>
    {billing.storageError&&<div className="billing-error-banner" role="alert"><Info size={16}/>{billing.storageError}</div>}
    {notice&&<div className="billing-success" role="status"><CheckCircle2 size={17}/>{notice}<button aria-label="关闭计费提示" onClick={()=>setNotice('')}><X size={15}/></button></div>}
    <div className="billing-page-tabs"><div>{[['plans','会员套餐'],['packs','墨点加油包'],['usage','用量与订单']].map(([key,label])=><button key={key} aria-pressed={tab===key} className={tab===key?'active':''} onClick={()=>changeTab(key)}>{label}{key==='packs'&&<small>按需购买</small>}</button>)}</div><span><Check size={13}/>免费写作始终保留</span></div>
    {tab==='plans'&&<>
      <div className="billing-section-intro"><div><h2>适合你的，才是好方案。</h2><p>所有套餐都能管理作品。根据创作频率，选择合适的 AI 额度。</p></div><div className="billing-cycle" aria-label="会员购买周期"><button className={cycle==='monthly'?'active':''} aria-pressed={cycle==='monthly'} onClick={()=>setCycle('monthly')}>按月购买</button><button className={cycle==='yearly'?'active':''} aria-pressed={cycle==='yearly'} onClick={()=>setCycle('yearly')}>按年购买<small>省 2 个月</small></button></div></div>
      <div className="billing-plan-grid">{plans.map(p=><article className={`billing-plan-card ${p.featured?'featured':''}`} key={p.id}>{p.featured&&<span className="billing-plan-ribbon"><Sparkles size={12}/>适合高频创作</span>}<div className="billing-plan-label"><span>{p.id==='free'?<Feather size={21}/>:p.id==='creator'?<BookOpen size={21}/>:<Crown size={21}/>}</span><p>{p.audience}</p></div><h3>{p.name}</h3><p className="billing-plan-note">{p.note}</p><div className="billing-plan-price"><span>¥</span><strong>{p.id==='free'?'0':money(cycle==='yearly'?Math.round(p.yearly/12):p.monthly)}</strong><small>{p.id==='free'?'/ 永久免费':'/ 月'}</small></div><p className="billing-plan-total">{p.id==='free'?'首次赠送体验墨点，无需购买':cycle==='yearly'?`年付总额 ¥${money(p.yearly)}，一次购买 12 个月`:'每次购买 1 个月，到期不自动续费'}</p><div className="billing-plan-credit"><Coins size={17}/><strong>{number(p.credits)}</strong><span>{p.id==='free'?'首次体验墨点':'墨点 / 月'}</span></div><button className={`button ${p.featured?'primary':'secondary'} full`} onClick={()=>p.id==='free'?navigate('works'):setOffer({kind:'plan',id:p.id,cycle})}>{p.id==='free'?'继续免费写作':`模拟开通${p.name}`}<ArrowRight size={15}/></button><ul>{p.features.map(f=><li key={f}><Check size={14}/>{f}</li>)}</ul></article>)}</div>
      <div className="billing-principle"><ShieldCheck size={19}/><div><strong>作品属于你，选择也由你掌握。</strong><p>额度不足只影响模拟生成，随时可以手动写作、整理资料和导出全文。</p></div><button onClick={()=>changeTab('packs')}>只想偶尔用？看看加油包<ArrowRight size={14}/></button></div>
    </>}
    {tab==='packs'&&<><div className="billing-section-intro"><div><h2>不用开会员，也能给灵感加油。</h2><p>一次购买，独立保留 12 个月；优先消耗更早到期的额度。</p></div><span className="soft-label"><Wallet size={14}/>全账户可购买</span></div><div className="billing-pack-grid">{creditPacks.map(p=><article className={`billing-pack-card ${p.featured?'featured':''}`} key={p.id}><div><span className="billing-pack-icon"><Coins size={23}/></span>{p.featured&&<span className="soft-label">日常补给</span>}</div><h3>{p.name}</h3><p>{p.note}</p><strong className="billing-pack-amount">{number(p.credits)}<small>墨点</small></strong><div className="billing-pack-price"><strong>¥{money(p.price)}</strong><span>约 ¥{money(Math.round(p.price/p.credits*1000))} / 千墨点</span></div><button className={`button ${p.featured?'primary':'secondary'} full`} onClick={()=>setOffer({kind:'pack',id:p.id})}>模拟购买<ArrowRight size={15}/></button><small className="billing-pack-expiry">演示到账后有效 12 个月 · 不自动续购</small></article>)}</div><div className="billing-pack-tip"><Gift size={18}/><p>经常使用可以比较会员的月度额度；偶尔创作，用多少补多少。</p><button onClick={()=>changeTab('plans')}>比较套餐<ArrowRight size={13}/></button></div></>}
    {tab==='usage'&&<section className="billing-records"><div className="billing-record-heading"><div><h2>每一次灵感，都有清楚的记录。</h2><p>当前仅记录本浏览器的演示操作，不是支付凭证。</p></div><button className="button secondary" onClick={exportRecords}><ReceiptText size={15}/>导出演示账单</button></div><div className="billing-record-filters"><button className={recordType==='credits'?'active':''} onClick={()=>setRecordType('credits')}>墨点明细<span>{account.ledger.length}</span></button><button className={recordType==='orders'?'active':''} onClick={()=>setRecordType('orders')}>演示订单<span>{account.orders.length}</span></button></div><div className="billing-table-scroll">{recordType==='credits'?<table className="billing-table"><thead><tr><th>任务 / 事项</th><th>时间</th><th>墨点变化</th><th>状态</th></tr></thead><tbody>{account.ledger.slice(0,100).map(row=><tr key={row.id}><td><strong>{row.label}</strong><small>{row.mode?`${row.mode} · `:''}本地演示</small></td><td>{new Date(row.createdAt).toLocaleString('zh-CN',{hour12:false})}</td><td className={row.delta>0?'billing-positive':''}>{row.delta>0?'+':''}{row.delta}{row.status==='refunded'&&<small>已退回 {row.amount} 墨点</small>}</td><td><span className={`billing-status ${row.status==='pending'?'pending':''}`}>{row.status==='pending'?'模拟预留':row.status==='refunded'?'已退回':'演示完成'}</span></td></tr>)}</tbody></table>:account.orders.length?<table className="billing-table"><thead><tr><th>演示商品</th><th>时间</th><th>演示金额</th><th>状态</th></tr></thead><tbody>{account.orders.map(order=><tr key={order.id}><td><strong>{order.name}</strong><small>{order.id}</small></td><td>{new Date(order.createdAt).toLocaleString('zh-CN',{hour12:false})}</td><td>¥{money(order.amount)}</td><td><span className="billing-status">演示完成 · 未收款</span></td></tr>)}</tbody></table>:<div className="billing-record-empty"><ReceiptText size={31}/><h3>还没有演示订单</h3><p>从一份套餐或加油包开始体验，订单记录会显示在这里。</p><button className="text-button" onClick={()=>changeTab('plans')}>看看会员套餐<ArrowRight size={13}/></button></div>}</div></section>}
    <section className="billing-estimator"><div className="billing-estimator-intro"><span className="billing-section-icon"><BarChart3 size={22}/></span><span className="eyebrow">SPEND WITH A CLEAR PICTURE</span><h2>动笔之前，先算清楚。</h2><p>选择任务、篇幅和模式，看看一次创作的预估消耗。</p><div className="billing-rate-note"><span>文本：每百字输出 1 墨点，<br/>每千字输入 2 墨点。</span><span>拆书：每千字输入 8 墨点，<br/>每个观察维度 5 墨点。</span><small>各任务有最低额度，精修模式为 3 倍。当前只模拟估算，不调用真实模型。</small></div></div><div className="billing-estimator-form"><div className="billing-estimator-fields"><label>创作任务<select aria-label="试算创作任务" value={task} onChange={e=>setTask(e.target.value)}>{billingTasks.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>输入 / 上下文字数<input aria-label="试算输入字数" type="number" min={0} max={1500000} step={100} value={inputChars} onChange={e=>setInputChars(Math.max(0,Math.min(1500000,Number(e.target.value)||0)))}/></label>{task==='reading'&&<label>观察维度<select aria-label="试算观察维度" value={dimensions} onChange={e=>setDimensions(Number(e.target.value))}>{[1,2,3,4].map(n=><option key={n} value={n}>{n} 个维度</option>)}</select></label>}</div><TaskMeter meter={meter}/><div className="billing-estimator-actions"><label><input type="checkbox" checked={failure} onChange={e=>setFailure(e.target.checked)}/>模拟任务失败并退回</label><button className="button secondary" disabled={busy} onClick={trial}>{busy?<LoaderCircle size={15} className="spin"/>:<Sparkles size={15}/>}体验一次模拟扣点</button></div></div></section>
    <section className="billing-faq"><div><span className="eyebrow">EVERYTHING, IN PLAIN WORDS</span><h2>关于费用，你可能还想知道</h2></div><div>{faqs.map(([q,a])=><details key={q}><summary>{q}<span>+</span></summary><p>{a}</p></details>)}</div></section>
    <section className="billing-demo-settings"><div><Info size={18}/><div><strong>计费演示设置</strong><p>开启后，编辑器、工具、工作流和拆书会使用同一份模拟额度。默认预置示例不扣点。</p></div></div><label className="billing-enable"><input type="checkbox" checked={account.enabled} onChange={e=>billing.setEnabled(e.target.checked)}/><span>在创作功能中启用模拟计费</span></label><div className="billing-reset">{resetConfirm?<><span>仅重置演示额度与账单，作品和阅读笔记保留。</span><button onClick={()=>{if(billing.reset()){setResetConfirm(false);setNotice('计费演示已重置，作品和笔记未改动。');}else setNotice('还有任务处理中，请稍后重置。');}}>确认重置</button><button onClick={()=>setResetConfirm(false)}>取消</button></>:<button onClick={()=>setResetConfirm(true)}>重置演示账户</button>}</div></section>
    {offer&&<Checkout key={`${offer.kind}-${offer.id}-${offer.cycle||''}`} offer={offer} billing={billing} onClose={()=>setOffer(null)} onSuccess={setNotice}/>}
  </div>;
}
