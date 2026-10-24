// Explicit, paid integration check. Never part of npm test. Uses generated test content only.
import fs from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import OSS from 'ali-oss';
import {createApi} from '../server/api.mjs';
const directory=await fs.mkdtemp(join(tmpdir(),'mdd-live-flow-')),report={checkedAt:new Date().toISOString(),steps:[],totalTokens:0};
const ai=JSON.parse(await fs.readFile('.local/ai.json','utf8')),originalOSS=JSON.parse(await fs.readFile('.local/oss.json','utf8'));
const oss={...originalOSS,prefix:`${originalOSS.prefix}/integration-${randomUUID()}`};
await fs.writeFile(join(directory,'ai.json'),JSON.stringify(ai),{mode:0o600});await fs.writeFile(join(directory,'oss.json'),JSON.stringify(oss),{mode:0o600});
const handler=createApi({directory}),server=createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
const call=async(path,body,method=body===undefined?'GET':'POST')=>{const res=await fetch(base+path,{method,headers:{'Content-Type':'application/json','X-Mdd-Client':'workspace-v1'},...(body===undefined?{}:{body:JSON.stringify(body)})});const data=await res.json();if(!res.ok)throw new Error(`${path}: ${data.error||res.status}`);return data;};
const mark=(step,data)=>{report.steps.push({step,...data});console.log(JSON.stringify({step,...data}));};
try {
 const work={id:'live-audit-work',title:'钟楼来信',kind:'短篇故事',genre:'悬疑',chapters:[{id:'live-chapter',title:'第一章 · 旧钟',text:'雨夜，旧钟修复师林沫收到一封来自明天的信。信里是一把不属于任何钟表的钥匙。'}],outline:'林沫循着未来来信找到旧钟楼中被隐藏的房间。',characters:'林沫，旧钟修复师，谨慎而执着。'};
 const generate=async(task,extra={})=>{const result=await call('/api/generate',{requestId:randomUUID(),task,prompt:'联通测试。请结合设定给出简洁的实际结果，普通文字任务控制在 150 字以内。',context:{workId:work.id,chapterId:work.chapters[0].id,title:work.title,outline:work.outline,characters:work.characters,text:work.chapters[0].text,...extra.context},target:task==='storyboard'||task==='reading'?1000:400,...extra});report.totalTokens+=result.usage?.totalTokens||0;mark(task,{ok:true,model:ai.model,tokens:result.usage?.totalTokens});return result;};
 for(const task of ['ideas','outline','character','continue','polish','dialogue','review','title'])await generate(task);
 const plan=await generate('chapterPlan',{context:{workId:work.id,title:work.title,outline:work.outline,characters:work.characters,count:3}});if(plan.structured.chapters.length!==3)throw new Error('Chapter count mismatch');
 const reading=await generate('reading',{dimensions:['structure','characters']});if(reading.structured.sections.length!==2)throw new Error('Reading sections missing');
 const boards=await generate('storyboard',{prompt:'水彩悬疑风格，4 个镜头，每个镜头画面描述控制在 40 字内。'});
 const data=await call('/api/data');await call('/api/data/works',{revision:data.collections.works.revision,data:[work]},'PUT');if((await call('/api/data')).collections.works.data[0].id!==work.id)throw new Error('Persistence failed');mark('durable-data',{ok:true});
 const tasks=await call('/api/tasks');if(tasks.items.length!==11||tasks.items.some(t=>t.status!=='succeeded'))throw new Error('History status mismatch');mark('generation-history',{ok:true,count:tasks.items.length});
 const frame=await call('/api/media/image',{requestId:randomUUID(),draftId:'qa-draft',boardId:'qa-board',boardIndex:0,prompt:'水彩悬疑插画，雨夜的旧钟修复店，一张木桌上放着信封和一把古旧银色钥匙，柔和电影光，无文字。'});if(frame.status!=='succeeded')throw new Error('Image did not complete');const image=await fetch(base+frame.result.assetUrl);if(!image.ok)throw new Error('Image proxy failed');await fs.mkdir('.local/qa',{recursive:true,mode:0o700});await fs.writeFile('.local/qa/分镜联通样图.png',Buffer.from(await image.arrayBuffer()),{mode:0o600});mark('image-generation',{ok:true,model:frame.result.model,bytes:frame.result.size});
 const video=await call('/api/media/video',{requestId:randomUUID(),draftId:'qa-draft',prompt:'生成单镜头视频，水彩悬疑风格。雨夜的旧钟修复店，镜头缓慢推近木桌上的信封与银色钥匙，窗外雨水落下，无人物对白。',duration:2});mark('video-submitted',{ok:true,model:video.result.model,duration:2});let clip=video;
 for(let n=0;n<36&&clip.status==='running';n++){await new Promise(r=>setTimeout(r,10000));clip=await call(`/api/media/poll/${video.id}`,{});if(n%3===0)console.log(JSON.stringify({step:'video-wait',status:clip.status}));}
 if(clip.status!=='succeeded')throw new Error(`Video did not complete: ${clip.error||clip.status}`);const mp4=await fetch(base+clip.result.assetUrl);if(!mp4.ok)throw new Error('Video proxy failed');const buffer=Buffer.from(await mp4.arrayBuffer());await fs.writeFile('.local/qa/视频联通样片.mp4',buffer,{mode:0o600});if(!buffer.subarray(0,40).includes(Buffer.from('ftyp')))throw new Error('Not a valid MP4');mark('video-generation',{ok:true,bytes:buffer.length});
 const snapshot={format:'mdd-workspace',version:1,works:[work],favorites:[],submissions:[],reading:[],workflows:[],video:[]};const backup=await call('/api/oss/backups',snapshot);const restore=await call('/api/oss/restore',{key:backup.key});if(restore.works[0].title!==work.title)throw new Error('Cloud restore mismatch');mark('cloud-roundtrip',{ok:true});
 report.ok=true;
}catch(e){report.ok=false;report.error=e.message;console.log(JSON.stringify({failed:e.message}));process.exitCode=1;}
finally{
 const client=new OSS({bucket:oss.bucket,region:'oss-'+oss.region,endpoint:oss.endpoint,accessKeyId:oss.accessKeyId,accessKeySecret:oss.accessKeySecret,authorizationV4:true,secure:true,timeout:20000,retryMax:0});
 try{const objects=await client.list({prefix:oss.prefix+'/','max-keys':100});for(const object of objects.objects||[])await client.delete(object.name);report.testObjectsCleanedUp=true;}catch{report.testObjectsCleanedUp=false;report.remainingPrefix=oss.prefix;}
 await fs.mkdir('.local/qa',{recursive:true,mode:0o700});await fs.writeFile('.local/qa/完整流程验证.json',JSON.stringify(report,null,2),{mode:0o600});server.closeAllConnections();await new Promise(r=>server.close(r));handler.close();await fs.rm(directory,{recursive:true,force:true});console.log(JSON.stringify({ok:report.ok,totalTokens:report.totalTokens,steps:report.steps.length,cleanedUp:report.testObjectsCleanedUp}));
}
