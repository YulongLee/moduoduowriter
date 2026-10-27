import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { buildPrompt, parseStructured } from './prompts.mjs';
import { validateBackup } from '../src/backup.js';
import {quoteTask} from '../src/billing.js';
import {videoEnabled} from '../src/features.js';
import {createMediaService} from './media.mjs';
import {createStore,collections} from './store.mjs';
import { createCloudStore,defaultOSS,publicOSS,validateOSS } from './oss.mjs';

const defaultConfig={baseUrl:'',model:'',protocol:'chat',apiKey:'',jsonMode:false,defaultMode:'demo'};
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
export function validateConfig(value,previous=defaultConfig) {
 const next={baseUrl:String(value.baseUrl||'').trim().replace(/\/+$/,''),model:String(value.model||'').trim(),protocol:value.protocol==='responses'?'responses':'chat',jsonMode:value.jsonMode===true,apiKey:value.apiKey===undefined||value.apiKey===''?previous.apiKey:String(value.apiKey).trim()};
 if(typeof value.enableThinking==='boolean')next.enableThinking=value.enableThinking;
 next.defaultMode=value.defaultMode==='ai'?'ai':'demo';
 if(value.clearKey)next.apiKey='';
 if(next.baseUrl) {
  let url;try{url=new URL(next.baseUrl);}catch{throw fail('请填写有效的接口地址');}
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[|.*\.local$)/i.test(url.hostname))throw fail('接口地址须为公开 HTTPS 地址，不含账号、查询参数或片段');
 }
 if(next.model.length>150||next.apiKey.length>4096||/[\r\n]/.test(next.apiKey))throw fail('模型名称或密钥格式无效');
 return next;
}
async function atomicJSON(file,value) {
 await fs.mkdir(path.dirname(file),{recursive:true,mode:0o700});
 const temp=`${file}.${randomUUID()}.tmp`;
 try{await fs.writeFile(temp,JSON.stringify(value),{mode:0o600});await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true}).catch(()=>{});}
}
async function readJSON(file,fallback){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw fail('本地数据文件无法读取，请先保留备份并检查文件',500);}}
const configured=config=>!!(config.baseUrl&&config.model&&config.apiKey);
// Technical configuration is fetched only by the local operator page.
const adminConfig=config=>({baseUrl:config.baseUrl,model:config.model,protocol:config.protocol,jsonMode:config.jsonMode,enableThinking:config.enableThinking,defaultMode:config.defaultMode||'demo',hasKey:!!config.apiKey,configured:configured(config)});
const serviceStatus=config=>({configured:configured(config),defaultMode:config.defaultMode||'demo'});
// Keep provider metadata in local records, out of ordinary generation responses.
const clientResult=value=>{if(!value)return value;const {model,...result}=value;return result;};
const clientTask=value=>({...value,result:clientResult(value.result)});
function send(res,status,value){if(res.destroyed)return;res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));}
async function readBody(req,limit=200000) {
 let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>limit)throw fail('提交内容过大',413);chunks.push(chunk);}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw fail('提交的数据不是有效 JSON');}
}
async function limitedJSON(response) {
 const chunks=[];let size=0;
 for await(const chunk of response.body){size+=chunk.length;if(size>1500000)throw fail('模型响应过大，请减少目标篇幅',502);chunks.push(chunk);}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw fail('模型服务返回了无法识别的响应',502);}
}
export function createApi({directory=path.resolve('.local'),fetchImpl=globalThis.fetch,cloudStore=createCloudStore()}={}) {
 let active=0,writeQueue=Promise.resolve();
 const configFile=path.join(directory,'ai.json'),backupFile=path.join(directory,'workspace.json'),ossFile=path.join(directory,'oss.json'),mediaPermissionsFile=path.join(directory,'media-permissions.json');
 const serial=fn=>{const job=writeQueue.then(fn);writeQueue=job.catch(()=>{});return job;};
 const config=()=>readJSON(configFile,defaultConfig);
 const media=createMediaService({fetchImpl,cloudStore}),polls=new Map();
 const ossConfig=()=>readJSON(ossFile,defaultOSS);
 let store,closed=false;const timers=new Map();
 const database=()=>{if(!store){store=createStore(directory);for(const task of store.mediaTasks().filter(t=>t.task==='video'&&t.status==='running'))schedulePoll(task.id);}return store;};
 const pollVideo=async(id)=>{if(polls.has(id))return polls.get(id);const task=database().task(id);if(task.status!=='running')return {id,status:task.status,result:task.result,error:task.error};if(Date.now()-Date.parse(task.started_at)>23*3600000){database().finishTask(id,task.result,'视频任务超过查询时限，请检查服务商任务记录');return {id,status:'failed',result:task.result,error:'视频任务超过查询时限'};}if(Date.now()-(task.result?.lastPoll||0)<4000)return {id,status:'running',result:task.result};const promise=(async()=>{try{const state=await media.poll(await config(),await ossConfig(),id,task.result);if(!closed){if(state.done)database().finishTask(id,state.result,null);else database().pendingTask(id,state.result);}return {id,status:state.done?'succeeded':'running',result:state.result};}catch(e){if(e.status&&(/视频任务未完成/.test(e.message)||e.code==='Model.AccessDenied')){if(!closed)database().finishTask(id,task.result,e.message);return {id,status:'failed',result:task.result,error:e.message};}throw e;}finally{polls.delete(id);}})();polls.set(id,promise);return promise;};
 const schedulePoll=id=>{if(!videoEnabled||closed||timers.has(id))return;timers.set(id,setTimeout(async()=>{timers.delete(id);try{const state=await pollVideo(id);if(state.status==='running')schedulePoll(id);}catch{if(!closed)schedulePoll(id);}},10000));};
 const failures=new Map();
 const sessionToken=req=>String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('mdd_session='))?.slice(12);
 const quoteForGeneration=body=>quoteTask({taskId:['plan','chapterPlan'].includes(body.task)?'outline':body.task==='memoryExtract'?'review':body.task==='chapterDraft'?'continue':body.task,inputChars:JSON.stringify({prompt:body.prompt||'',context:body.context||{},previous:body.previous||{}}).length,outputChars:Math.min(4000,Math.max(300,Number(body.target)||1000)),model:body.mode==='refine'?'refine':'standard',dimensions:body.dimensions?.length||4});
 const cookie=(res,token)=>res.setHeader('Set-Cookie',`mdd_session=${token||''}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${token?604800:0}`);
 const handle=async(req,res,next=()=>send(res,404,{error:'接口不存在'}))=>{
  const url=new URL(req.url,'http://localhost');if(!url.pathname.startsWith('/api/'))return next();
  try {
   const host=req.headers.host||'';
   if(!/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(host))throw fail('仅允许从本机打开创作空间',403);
   if(req.headers.origin&&req.headers.origin!==`http://${host}`&&req.headers.origin!==`https://${host}`)throw fail('请求来源不被允许',403);
   if(req.method!=='GET'&&req.headers['x-mdd-client']!=='workspace-v1')throw fail('请求缺少本地工作台标记',403);
   if(url.pathname==='/api/auth/status'&&req.method==='GET')return send(res,200,database().auth(sessionToken(req)));
   if(['/api/auth/login','/api/auth/register','/api/auth/recover'].includes(url.pathname)&&req.method==='POST') {
    const address=req.socket?.remoteAddress||'local',attempts=failures.get(address)||{count:0,until:0};if(attempts.until>Date.now()&&attempts.count>=5)throw fail('尝试次数过多，请 15 分钟后再试',429);
    failures.set(address,{count:attempts.until>Date.now()?attempts.count+1:1,until:Date.now()+900000});
    const body=await readBody(req,2000);let result;
    try{result=url.pathname.endsWith('register')?await database().register(body.username,body.password):url.pathname.endsWith('recover')?await database().recover(body.username,body.recoveryCode,body.password):await database().login(body.username,body.password);failures.delete(address);}catch(e){throw e;}
    cookie(res,result.token);return send(res,200,{user:result.user,...(result.recoveryCode?{recoveryCode:result.recoveryCode}:{})});
   }
   const auth=database().auth(sessionToken(req));if(auth.configured&&!auth.user)throw fail('请先登录本机创作空间',401);
   const spaceId=auth.spaceId||'local',workspace=database().forUser(spaceId),isAdmin=!auth.configured||auth.user?.role==='admin';
   if(req.headers['x-mdd-space']&&req.headers['x-mdd-space']!==spaceId)throw Object.assign(fail('账号空间已切换，请重新登录或刷新后继续',412),{code:'space-mismatch'});
   if(['/api/settings','/api/test','/api/oss/test','/api/media/permissions/reset'].includes(url.pathname)&&!isAdmin)throw fail('此操作需要管理员权限',403);
   if(url.pathname==='/api/oss/settings'&&req.method!=='GET'&&!isAdmin)throw fail('存储配置需要管理员权限',403);
   const scopedOSS=async()=>{const value=await ossConfig();return spaceId==='local'?value:{...value,prefix:value.prefix+'/users/'+spaceId};};
   const userBackup=spaceId==='local'?backupFile:path.join(directory,'users',spaceId,'workspace.json');
   if(url.pathname==='/api/auth/recovery'&&req.method==='POST'){if(!auth.user)throw fail('请先设置账号并登录',401);const body=await readBody(req,2000);return send(res,200,await database().rotateRecovery(auth.user.id,body.password));}
   if(url.pathname==='/api/auth/logout'&&req.method==='POST'){database().logout(sessionToken(req));cookie(res,'');return send(res,200,{ok:true});}
   if(url.pathname==='/api/data'&&req.method==='GET')return send(res,200,{spaceId,collections:workspace.all()});
   if(url.pathname.startsWith('/api/data/')&&req.method==='PUT'){const name=url.pathname.slice('/api/data/'.length),body=await readBody(req,20000000);return send(res,200,{...workspace.save(name,body.data,body.revision),spaceId});}
   if(!videoEnabled&&url.pathname.startsWith('/api/media/')){if(url.pathname==='/api/media/status'&&req.method==='GET')return send(res,200,{enabled:false,configured:false,reason:'视频相关功能已暂缓'});throw fail('视频相关功能已暂缓，当前版本专注文字创作',503);}
   if(url.pathname==='/api/media/status'&&req.method==='GET'){const ai=await config(),oss=await ossConfig(),permissions=await readJSON(mediaPermissionsFile,{});return send(res,200,{...permissions,configured:!!(ai.apiKey&&ai.baseUrl&&new URL(ai.baseUrl).hostname.endsWith('.aliyuncs.com')&&publicOSS(oss).configured),imageModel:'qwen-image-3.0',videoModel:'wan2.7-t2v-2026-06-12'});}
   if(url.pathname==='/api/media/permissions/reset'&&req.method==='POST'){await serial(()=>atomicJSON(mediaPermissionsFile,{}));return send(res,200,{ok:true});}
   if(url.pathname==='/api/media/jobs'&&req.method==='GET')return send(res,200,{items:workspace.mediaTasks(url.searchParams.get('draftId'))});
   if(['/api/media/image','/api/media/video'].includes(url.pathname)&&req.method==='POST') {
    const body=await readBody(req,15000),kind=url.pathname.endsWith('image')?'image':'video',id=typeof body.requestId==='string'&&/^[a-f0-9-]{36}$/.test(body.requestId)?body.requestId:randomUUID();
    if(workspace.mediaTasks().filter(t=>t.status==='running').length>=2)throw fail('已有两个媒体任务在生成，请等待完成',429);
    const permission=await readJSON(mediaPermissionsFile,{});if(permission[kind+'Available']===false)throw fail(`当前百炼账号尚无${kind==='image'?'图像':'视频'}模型权限，请在百炼开通后重新启用`,503);
    if(!publicOSS(await ossConfig()).configured)throw fail('请先连接 OSS 以保存生成的媒体文件',503);
    const existing=workspace.beginTask(id,{...body,task:kind});if(existing)return send(res,200,{id,status:existing.status,result:existing.result?JSON.parse(existing.result):null});
    try{const result=kind==='image'?await media.image(await config(),await ossConfig(),id,body):await media.video(await config(),body);if(kind==='image')workspace.finishTask(id,result,null);else{workspace.pendingTask(id,result);schedulePoll(id);}return send(res,kind==='image'?200:202,{id,status:kind==='image'?'succeeded':'running',result});}
    catch(e){if(e.code==='Model.AccessDenied'||e.code==='AccessDenied')await serial(async()=>atomicJSON(mediaPermissionsFile,{...await readJSON(mediaPermissionsFile,{}),[kind+'Available']:false,checkedAt:new Date().toISOString()}));workspace.finishTask(id,null,e.status?e.message:'媒体服务连接失败');throw e;}
   }
   if(url.pathname.startsWith('/api/media/poll/')&&req.method==='POST'){const id=url.pathname.slice(16);if(workspace.task(id).task!=='video')throw fail('不是视频任务');return send(res,200,await pollVideo(id));}
   if(url.pathname.startsWith('/api/media/assets/')&&req.method==='GET') {
    const id=url.pathname.slice(18),task=workspace.task(id);if(!['image','video'].includes(task.task)||task.status!=='succeeded'||!task.result?.key)throw fail('媒体文件尚未就绪',404);
    const range=req.headers.range;if(range&&!/^bytes=\d+-\d*$/.test(range))throw fail('不支持的文件读取范围',416);const asset=await cloudStore.readMedia(await ossConfig(),task.result.key,range);const type=task.task==='image'?'image/png':'video/mp4';res.writeHead(asset.res?.status===206?206:200,{'Content-Type':type,'Content-Length':asset.content.length,'Cache-Control':'private, no-store','Accept-Ranges':'bytes',...(asset.res?.headers?.['content-range']?{'Content-Range':asset.res.headers['content-range']}:{}),...(url.searchParams.has('download')?{'Content-Disposition':`attachment; filename="moduoduo-${id}.${task.task==='image'?'png':'mp4'}"`}:{})});return res.end(asset.content);
   }
   if(url.pathname==='/api/tasks'&&req.method==='GET')return send(res,200,{items:workspace.tasks().map(clientTask)});
   if(url.pathname.startsWith('/api/tasks/')&&req.method==='GET')return send(res,200,clientTask(workspace.task(decodeURIComponent(url.pathname.slice(11)))));
   if(url.pathname==='/api/service/status'&&req.method==='GET')return send(res,200,serviceStatus(await config()));
   if(url.pathname==='/api/settings'&&req.method==='GET')return send(res,200,adminConfig(await config()));
   if(url.pathname==='/api/settings'&&req.method==='PUT') {
    const body=await readBody(req,10000);
    const updated=await serial(async()=>{const updated=validateConfig(body,await config());await atomicJSON(configFile,updated);return updated;});
    return send(res,200,adminConfig(updated));
   }
   if(url.pathname==='/api/oss/settings'&&req.method==='GET')return send(res,200,isAdmin?{...publicOSS(await scopedOSS()),canManage:true}:{configured:publicOSS(await scopedOSS()).configured,verifiedAt:(await scopedOSS()).verifiedAt,canManage:false});
   if(url.pathname==='/api/oss/settings'&&req.method==='PUT') {
    const body=await readBody(req,15000);
    const updated=await serial(async()=>{const value=validateOSS(body,await ossConfig());await atomicJSON(ossFile,value);return value;});
    return send(res,200,publicOSS(updated));
   }
   if(url.pathname==='/api/oss/test'&&req.method==='POST') {
    const configured=await ossConfig(),result=await cloudStore.test(configured);
    await serial(async()=>{const current=await ossConfig();if(JSON.stringify(current)===JSON.stringify(configured))await atomicJSON(ossFile,{...current,verifiedAt:result.verifiedAt});});
    return send(res,200,result);
   }
   if(url.pathname==='/api/oss/backups'&&req.method==='GET')return send(res,200,await cloudStore.list(await scopedOSS(),url.searchParams.get('cursor')||''));
   if(url.pathname==='/api/oss/backups'&&req.method==='POST')return send(res,201,await cloudStore.save(await scopedOSS(),await readBody(req,20000000)));
   if(url.pathname==='/api/oss/restore'&&req.method==='POST') {const body=await readBody(req,2000);return send(res,200,await cloudStore.get(await scopedOSS(),body.key));}
   if(url.pathname==='/api/workspace'&&req.method==='GET') {const saved=await readJSON(userBackup,null);return send(res,200,saved?{revision:saved.revision,savedAt:saved.savedAt,data:saved.data}:{revision:0,data:null});}
   if(url.pathname==='/api/workspace'&&req.method==='PUT') {
    const body=await readBody(req,20000000);
    const result=await serial(async()=>{
     const previous=await readJSON(userBackup,{revision:0});
     if(body.revision!==previous.revision)throw fail('另一窗口已更新磁盘备份，请重新载入备份后再保存',409);
     try{validateBackup(body.data);}catch(e){throw fail(e.message);}
     const updated={revision:previous.revision+1,savedAt:new Date().toISOString(),data:body.data};
     if(previous.data)await atomicJSON(path.join(path.dirname(userBackup),'workspace.previous.json'),previous);
     await atomicJSON(userBackup,updated);return {revision:updated.revision,savedAt:updated.savedAt};
    });return send(res,200,result);
   }
   if(url.pathname==='/api/billing'&&req.method==='GET')return send(res,200,workspace.billing());
   if(url.pathname==='/api/billing/purchase'&&req.method==='POST'){const body=await readBody(req,5000);if(typeof body.requestId!=='string'||!/^[a-zA-Z0-9_:-]{1,120}$/.test(body.requestId))throw fail('订单编号格式不正确');return send(res,200,workspace.purchase(body.offer,body.requestId));}
   if(url.pathname==='/api/billing/settings'&&req.method==='POST'){const body=await readBody(req,1000);return send(res,200,workspace.billingEnabled(body.enabled));}
   if(url.pathname==='/api/billing/reset'&&req.method==='POST')return send(res,200,workspace.resetBilling());
   if(url.pathname==='/api/billing/reservations'&&req.method==='POST'){const body=await readBody(req,5000);return send(res,200,workspace.reserveDemo(body.requestId,body.request));}
   if(url.pathname.startsWith('/api/billing/reservations/')&&req.method==='POST'){const body=await readBody(req,1000);return send(res,200,workspace.settleDemo(decodeURIComponent(url.pathname.slice('/api/billing/reservations/'.length)),body.success));}
   if(url.pathname==='/api/generation/quote'&&req.method==='POST'){const body=await readBody(req);try{buildPrompt(body);return send(res,200,{quote:quoteForGeneration(body),enabled:workspace.billing().account.enabled,mode:'server-demo'});}catch(e){throw fail(e.message);}}
   if((url.pathname==='/api/generate'||url.pathname==='/api/test')&&req.method==='POST') {
    if(active>=2)throw fail('已有两个生成任务正在进行，请稍后重试',429);
    const test=url.pathname==='/api/test',settings=await config();if(!configured(settings))throw fail(test?'请先填写并保存接口地址、模型名称和密钥':'智能创作暂不可用，请稍后重试或选择示例体验',503);
    const body=await readBody(req);
    if(!test&&!videoEnabled&&body.task==='storyboard')throw fail('视频相关功能已暂缓，当前版本专注文字创作',503);
    const prompt=test?{system:'你是连接测试助手。',user:'只回复：连接成功',structured:false,target:30}:(()=>{try{return buildPrompt(body);}catch(e){throw fail(e.message);}})();
    const taskKey=test?null:(typeof body.requestId==='string'&&/^[a-zA-Z0-9_:-]{8,120}$/.test(body.requestId)?body.requestId:randomUUID());
    if(taskKey){const existing=workspace.beginTask(taskKey,body);if(existing){if(existing.request!==JSON.stringify(body))throw fail('任务编号已用于不同的创作内容，请重新发起',409);if(existing.status==='succeeded')return send(res,200,clientResult(JSON.parse(existing.result)));if(['interrupted','cancelled'].includes(existing.status))workspace.restartTask(taskKey,body);else throw fail('此生成请求已提交，请在生成记录查看状态或重新发起任务',409);}}
    active++;const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),90000);
    const disconnected=()=>controller.abort();res.on('close',disconnected);
    try {
     const reservation=taskKey?workspace.reserveGeneration(taskKey,quoteForGeneration(body).request):null;
     const responses=settings.protocol==='responses';
     const payload=responses?{model:settings.model,instructions:prompt.system,input:prompt.user,store:false,max_output_tokens:test?256:Math.min(10000,prompt.target*3)}:{model:settings.model,messages:[{role:'system',content:prompt.system},{role:'user',content:prompt.user}],stream:false,max_tokens:test?256:Math.min(10000,prompt.target*3)};
     if(!responses&&new URL(settings.baseUrl).hostname.endsWith('.aliyuncs.com')&&typeof settings.enableThinking==='boolean')payload.enable_thinking=settings.enableThinking;
     // JSON mode is opt-in because not all compatible providers support it.
     if(prompt.structured&&settings.jsonMode){if(responses)payload.text={format:{type:'json_object'}};else payload.response_format={type:'json_object'};}
     const upstream=await fetchImpl(`${settings.baseUrl}/${responses?'responses':'chat/completions'}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${settings.apiKey}`},body:JSON.stringify(payload),signal:controller.signal,redirect:'error'});
     if(!upstream.ok)throw fail(test?(upstream.status===401||upstream.status===403?'模型服务拒绝访问，请检查密钥与模型权限':upstream.status===429?'模型服务额度不足或请求频繁，请检查余额后重试':`模型服务返回 ${upstream.status}，请检查地址、模型名称与服务状态`):(upstream.status===429?'创作服务当前繁忙或可用额度不足，请稍后重试':'创作服务暂时不可用，请稍后重试'),502);
     const data=await limitedJSON(upstream);
     if(data.status&&data.status!=='completed')throw fail('模型生成未完整结束，请调整篇幅后重试',502);
     if(data.choices?.[0]?.finish_reason==='length')throw fail('生成达到服务长度上限，请减少篇幅后重试',502);
     const text=responses?(data.output||[]).flatMap(item=>item.type==='message'?item.content||[]:[]).filter(item=>item.type==='output_text').map(item=>item.text).join('\n'):data.choices?.[0]?.message?.content;
     if(typeof text!=='string'||!text.trim())throw fail('创作服务未返回可用文字，请稍后重试',502);
     const structured=test?null:(()=>{try{return parseStructured(body.task,text,body.dimensions,body.context);}catch(e){throw fail(e.message,502);}})();
     const usage=data.usage?{inputTokens:data.usage.prompt_tokens??data.usage.input_tokens??0,outputTokens:data.usage.completion_tokens??data.usage.output_tokens??0,totalTokens:data.usage.total_tokens??0}:null;
     const result={text,structured,model:data.model||settings.model,source:'ai',usage,requestId:taskKey,...(reservation?{billing:{credits:reservation.quote.credits,mode:'server-demo'}}:{})};if(taskKey){workspace.finishTask(taskKey,result,null);workspace.settleGeneration(taskKey,true);}
     return send(res,200,clientResult(result));
    }catch(e){if(taskKey)workspace.settleGeneration(taskKey,false);const cancelled=e.name==='AbortError'||controller.signal.aborted;if(taskKey)workspace.finishTask(taskKey,null,cancelled?'生成已取消或超时':e.status?e.message:'模型服务请求失败',cancelled?'cancelled':'failed');if(cancelled)throw fail('生成已取消或等待超过 90 秒，请重试',504);throw e;}
    finally{active--;clearTimeout(timeout);res.off('close',disconnected);}
   }
   return send(res,404,{error:'接口不存在'});
  }catch(e){return send(res,e.status||400,{error:e.status?e.message:'任务未完成，请检查设置或稍后重试',...(e.code?{code:e.code}:{})});}
 };
 handle.close=()=>{closed=true;for(const timer of timers.values())clearTimeout(timer);timers.clear();store?.close();};return handle;
}
export function localApiPlugin(){const handler=createApi();return {name:'mdd-local-api',configureServer(server){server.middlewares.use(handler);server.httpServer?.once('close',()=>handler.close());},configurePreviewServer(server){server.middlewares.use(handler);server.httpServer?.once('close',()=>handler.close());}};}
