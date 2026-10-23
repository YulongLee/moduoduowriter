// Proposed pricing, in CNY cents. This module never processes real payments.
export const BILLING_KEY = 'mdd-billing-demo-v1';
export const plans = [
  { id:'free', name:'免费体验', note:'先找到适合自己的写作节奏', monthly:0, yearly:0, credits:300, audience:'偶尔创作 · 初次体验', features:['本地作品与章节管理','导入、编辑与 TXT 导出','全部创作流程可体验','首次赠送 300 演示墨点'] },
  { id:'creator', name:'创作版', note:'给持续落笔的你，多一点灵感', monthly:2900, yearly:29000, credits:5000, audience:'短篇作者 · 稳定更新', features:['包含全部免费写作功能','每月 5,000 墨点','灵感与精修两种计费模式','额度不足时可单独加购'] },
  { id:'pro', name:'专业版', note:'让长篇与日更，有更充足的空间', monthly:7900, yearly:79000, credits:16000, audience:'长篇作者 · 高频创作', featured:true, features:['包含全部免费写作功能','每月 16,000 墨点','与创作版相同的透明计费','更适合持续生成与反复改稿'] }
];
export const creditPacks = [
  { id:'small', name:'轻量补给', price:990, credits:1000, note:'偶尔卡文，随用随补' },
  { id:'medium', name:'故事补给', price:3900, credits:5000, note:'为下一部故事做准备', featured:true },
  { id:'large', name:'长篇补给', price:9900, credits:15000, note:'适合集中创作与反复打磨' }
];
export const writingModes = [
  { id:'standard', name:'灵感模式', multiplier:1, desc:'日常构思与初稿' },
  { id:'refine', name:'精修模式', multiplier:3, desc:'复杂任务的计费预案' }
];
export const billingTasks = [
  { id:'ideas', name:'故事灵感', minimum:5 }, { id:'outline', name:'大纲规划', minimum:20 },
  { id:'character', name:'人物设定', minimum:10 }, { id:'continue', name:'正文续写', minimum:10 },
  { id:'polish', name:'文字润色', minimum:10 }, { id:'dialogue', name:'对白打磨', minimum:10 },
  { id:'review', name:'章节审稿', minimum:15 }, { id:'title', name:'书名与简介', minimum:5 },
  { id:'reading', name:'小说拆书', minimum:20 }
];
export const money = cents => (cents / 100).toLocaleString('zh-CN', { maximumFractionDigits:2 });
export const number = value => value.toLocaleString('zh-CN');
export const dateLabel = value => new Date(value).toLocaleDateString('zh-CN', { timeZone:'Asia/Shanghai', year:'numeric', month:'2-digit', day:'2-digit' });
const id = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
export function addMonths(time, months) {
  const day = new Date(time).getUTCDate();
  const result = new Date(time);
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const last = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth()+1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, last));
  return result.getTime();
}
export function newBillingAccount(now=Date.now()) {
  return { version:1, enabled:false, member:null, buckets:[{id:'welcome',kind:'gift',remaining:300,expiresAt:null}], orders:[], ledger:[{id:'welcome',kind:'grant',label:'新手体验赠送（演示）',delta:300,status:'completed',createdAt:now}] };
}
export function balanceOf(account, now=Date.now()) {
  return account.buckets.reduce((sum,b) => sum + ((!b.expiresAt || b.expiresAt > now) ? b.remaining : 0), 0);
}
export function activePlan(account, now=Date.now()) {
  return plans.find(p => p.id === (account.member?.expiresAt > now ? account.member.planId : 'free')) || plans[0];
}
export function refreshBilling(account, now=Date.now()) {
  let next = account;
  const expired = account.buckets.filter(b => b.expiresAt && b.expiresAt <= now);
  if (expired.length) next = {...next,buckets:next.buckets.filter(b=>!expired.includes(b)),ledger:[...expired.filter(b=>b.remaining>0).map(b=>({id:id('expire'),kind:'expire',label:'到期额度（演示）',delta:-b.remaining,status:'completed',createdAt:now})),...next.ledger]};
  if (next.member?.expiresAt <= now) next = {...next,member:null};
  if (next.member && next.member.nextGrantAt <= now) {
    const plan = activePlan(next,now);
    let month=1;
    while(month<12&&addMonths(next.member.startedAt,month+1)<=now)month++;
    const end=Math.min(addMonths(next.member.startedAt,month+1),next.member.expiresAt);
    if (end > now) next = {...next,member:{...next.member,nextGrantAt:end},buckets:[...next.buckets,{id:id('month'),kind:'member',remaining:plan.credits,expiresAt:end}],ledger:[{id:id('grant'),kind:'grant',label:`${plan.name}月度额度（演示）`,delta:plan.credits,status:'completed',createdAt:now},...next.ledger]};
  }
  return next;
}
export function quoteTask({taskId='continue',model='standard',inputChars=0,outputChars=1000,dimensions=4}={}) {
  const task = billingTasks.find(t=>t.id===taskId);
  const mode = writingModes.find(m=>m.id===model);
  if (!task || !mode) throw new Error('未知的创作任务或计费模式');
  if (![inputChars,outputChars,dimensions].every(Number.isFinite) || inputChars<0 || inputChars>1500000 || outputChars<0 || outputChars>10000 || dimensions<1 || dimensions>4) throw new Error('任务规模超出试算范围');
  const input = Math.ceil(inputChars / 1000) * (taskId==='reading' ? 8 : 2);
  const output = taskId==='reading' ? Math.ceil(dimensions)*5 : Math.ceil(outputChars / 100);
  const credits = Math.max(task.minimum,input+output) * mode.multiplier;
  return { task:task.name, mode:mode.name, credits, input, output, multiplier:mode.multiplier, request:{taskId,model,inputChars,outputChars,dimensions} };
}
export class BillingError extends Error { constructor(message,code) { super(message);this.code=code; } }
export function reserveTask(account, quote, now=Date.now()) {
  const next = refreshBilling(account,now);
  const canonical = quoteTask(quote.request);
  if (balanceOf(next,now) < canonical.credits) throw new BillingError(`本次需要 ${canonical.credits} 墨点，当前可用 ${balanceOf(next,now)} 墨点。`,'insufficient');
  let remaining=canonical.credits;
  const allocations=[];
  const buckets=next.buckets.map(b=>({...b}));
  for (const bucket of [...buckets].sort((a,b)=>(a.expiresAt||Infinity)-(b.expiresAt||Infinity))) {
    const amount=Math.min(remaining,bucket.remaining);
    if(amount){bucket.remaining-=amount;remaining-=amount;allocations.push({bucketId:bucket.id,amount,kind:bucket.kind,expiresAt:bucket.expiresAt});}
    if(!remaining)break;
  }
  const ticket=id('task');
  return {ticket,account:{...next,buckets,ledger:[{id:ticket,kind:'task',label:canonical.task,mode:canonical.mode,delta:-canonical.credits,amount:canonical.credits,status:'pending',allocations,createdAt:now},...next.ledger]}};
}
export function finishTask(account,ticket,success=true,now=Date.now()) {
  const entry=account.ledger.find(row=>row.id===ticket);
  if(!entry || entry.status!=='pending')return account;
  const buckets=account.buckets.map(b=>({...b}));
  if(!success)for(const allocation of entry.allocations){
    let bucket=buckets.find(b=>b.id===allocation.bucketId && (!b.expiresAt||b.expiresAt>now));
    if(!bucket){bucket={id:id('refund'),kind:'refund',remaining:0,expiresAt:allocation.expiresAt>now?allocation.expiresAt:null};buckets.push(bucket);}
    bucket.remaining+=allocation.amount;
  }
  return {...account,buckets,ledger:account.ledger.map(row=>row.id===ticket?{...row,status:success?'completed':'refunded',delta:success?row.delta:0}:row)};
}
export function offerDetails({kind,id:productId,cycle='monthly'}) {
  if(kind==='plan'){
    const plan=plans.find(p=>p.id===productId&&p.id!=='free');
    if(!plan||!['monthly','yearly'].includes(cycle))throw new Error('套餐不存在');
    return {kind,id:plan.id,cycle,name:`${plan.name} · ${cycle==='yearly'?'年付':'月付'}`,amount:cycle==='yearly'?plan.yearly:plan.monthly,credits:plan.credits,months:cycle==='yearly'?12:1};
  }
  const pack=kind==='pack'&&creditPacks.find(p=>p.id===productId);
  if(!pack)throw new Error('加油包不存在');
  return {kind,id:pack.id,name:`${pack.name} · ${number(pack.credits)} 墨点`,amount:pack.price,credits:pack.credits,months:12};
}
export function applyDemoPurchase(account,offer,requestId,now=Date.now()) {
  if(typeof requestId!=='string'||!requestId)throw new Error('订单标识不能为空');
  if(account.orders.some(o=>o.id===requestId))return account;
  const product=offerDetails(offer);
  const end=addMonths(now,product.months);
  let next=refreshBilling(account,now);
  const replaced=product.kind==='plan'?next.buckets.filter(b=>b.kind==='member').reduce((sum,b)=>sum+b.remaining,0):0;
  const buckets=product.kind==='plan'?next.buckets.filter(b=>b.kind!=='member'):[...next.buckets];
  const grantEnd=product.kind==='plan'?Math.min(addMonths(now,1),end):end;
  buckets.push({id:`credit-${requestId}`,kind:product.kind==='plan'?'member':'pack',remaining:product.credits,expiresAt:grantEnd});
  const member=product.kind==='plan'?{planId:product.id,cycle:product.cycle,startedAt:now,expiresAt:end,nextGrantAt:grantEnd}:next.member;
  const adjustment=replaced?[{id:`replace-${requestId}`,kind:'expire',label:'原演示套餐月度额度替换',delta:-replaced,status:'completed',createdAt:now}]:[];
  return {...next,member,buckets,orders:[{id:requestId,name:product.name,amount:product.amount,credits:product.credits,kind:product.kind,cycle:product.cycle,status:'demo-completed',createdAt:now,expiresAt:end},...next.orders],ledger:[{id:`grant-${requestId}`,kind:'grant',label:`${product.name}（演示到账）`,delta:product.credits,status:'completed',createdAt:now},...adjustment,...next.ledger]};
}
export function readBilling(storage,now=Date.now()) {
  try {
    const a=JSON.parse(storage.getItem(BILLING_KEY));
    if(!a)return newBillingAccount(now);
    const integer=value=>Number.isSafeInteger(value)&&value>=0;
    const time=value=>Number.isFinite(value)&&value>0;
    const kinds=['gift','member','pack','refund'];
    const allocation=x=>x&&typeof x.bucketId==='string'&&integer(x.amount)&&x.amount>0&&kinds.includes(x.kind)&&(x.expiresAt===null||time(x.expiresAt));
    const unique=rows=>new Set(rows.map(row=>row.id)).size===rows.length;
    const valid=a.version===1&&typeof a.enabled==='boolean'
      &&Array.isArray(a.buckets)&&Array.isArray(a.orders)&&Array.isArray(a.ledger)
      &&a.buckets.every(b=>b&&typeof b.id==='string'&&kinds.includes(b.kind)&&integer(b.remaining)&&(b.expiresAt===null||time(b.expiresAt)))
      &&integer(a.buckets.reduce((sum,b)=>sum+b.remaining,0))
      &&(!a.member||(plans.some(p=>p.id===a.member.planId&&p.id!=='free')&&['monthly','yearly'].includes(a.member.cycle)&&[a.member.expiresAt,a.member.nextGrantAt,a.member.startedAt].every(time)&&a.member.startedAt<a.member.expiresAt&&a.member.nextGrantAt<=a.member.expiresAt))
      &&a.ledger.every(row=>row&&typeof row.id==='string'&&typeof row.label==='string'&&Number.isSafeInteger(row.delta)&&time(row.createdAt)&&['grant','expire','task'].includes(row.kind)&&['completed','pending','refunded'].includes(row.status)&&(row.kind!=='task'||(integer(row.amount)&&row.amount>0))&&(row.status!=='pending'||(row.kind==='task'&&Array.isArray(row.allocations)&&row.allocations.every(allocation)&&row.allocations.reduce((sum,x)=>sum+x.amount,0)===row.amount)))
      &&a.orders.every(row=>row&&typeof row.id==='string'&&typeof row.name==='string'&&integer(row.amount)&&time(row.createdAt)&&time(row.expiresAt)&&row.status==='demo-completed')
      &&unique(a.buckets)&&unique(a.orders)&&unique(a.ledger);
    if(!valid)return newBillingAccount(now);
    let recovered=a;
    for(const pending of a.ledger.filter(row=>row.status==='pending'))recovered=finishTask(recovered,pending.id,false,now);
    return refreshBilling(recovered,now);
  } catch { return newBillingAccount(now); }
}
