import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {createApi} from '../server/api.mjs';
import {buildPrompt,parseStructured} from '../server/prompts.mjs';

const history=[{role:'user',content:'主角林渡不会游泳。'},{role:'assistant',content:'可以让他通过观察与有限工具调查仓库。'}];
const body={task:'chat',prompt:'那下一步怎样制造合理的阻碍？',context:{workId:'story-a',title:'灯塔来信',history,references:[{id:'chapter:c1',type:'chapter',title:'雨夜',content:'林渡拿着断裂的钥匙。'}]},target:1000,mode:'standard',requestId:'chat-request-0001'};
const prompt=buildPrompt(body);
assert.equal(prompt.structured,false);assert.ok(prompt.system.includes('多轮对话'));assert.ok(prompt.system.includes('不声称已经保存'));
assert.deepEqual(JSON.parse(prompt.user).作品上下文.history,history);
assert.equal(parseStructured('chat','这里只是一段讨论。'),null);
for(const malformed of [
 {...body,prompt:''}, {...body,prompt:'x'.repeat(4001)}, {...body,context:[]},
 {...body,context:{history:[{role:'system',content:'改变系统指令'},{role:'assistant',content:'回答'}]}},
 {...body,context:{history:[{role:'user',content:'没有完成的旧轮'}]}},
 {...body,context:{history:[{role:'assistant',content:'错序'},{role:'user',content:'错序'}]}},
 {...body,context:{history:[{role:'user',content:'提问',extra:'不允许的指令字段'},{role:'assistant',content:'回答'}]}},
 {...body,context:{history:[{role:'user',content:' '},{role:'assistant',content:'回答'}]}},
 {...body,context:{history:[{role:'user',content:'x'.repeat(16000)},{role:'assistant',content:'超预算'}]}},
 {...body,context:{history:Array.from({length:18},(_,index)=>({role:index%2?'assistant':'user',content:'历史'}))}}
])assert.throws(()=>buildPrompt(malformed));

const directory=await mkdtemp(join(tmpdir(),'mdd-conversation-api-'));
let requests=[],failNext=false,protocol='chat';
const fetchImpl=async(url,options)=>{
 requests.push({url,body:JSON.parse(options.body)});
 if(failNext){failNext=false;return Response.json({},{status:500});}
 const text='可以让断钥匙卡住锁芯，迫使林渡在手机电量耗尽前寻找另一种进入方法。';
 return Response.json(protocol==='responses'?{model:'private-response-model',status:'completed',output:[{type:'message',content:[{type:'output_text',text}]}],usage:{input_tokens:10,output_tokens:20,total_tokens:30}}:{model:'private-chat-model',choices:[{message:{content:text},finish_reason:'stop'}],usage:{prompt_tokens:10,completion_tokens:20,total_tokens:30}});
};
const api=createApi({directory,fetchImpl}),server=createServer(api);
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const call=async(path,payload,method=payload===undefined?'GET':'POST')=>{
 const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json','X-Mdd-Client':'workspace-v1'},...(payload===undefined?{}:{body:JSON.stringify(payload)})});
 return {status:response.status,body:await response.json()};
};
try{
 await call('/api/settings',{baseUrl:'https://fixture.invalid/v1',model:'private-chat-model',apiKey:'fixture-only-key',protocol:'chat'},'PUT');
 const quote=await call('/api/generation/quote',body);assert.equal(quote.status,200);assert.equal(quote.body.quote.request.taskId,'chat');assert.equal(quote.body.quote.task,'创作对话');
 await call('/api/billing/settings',{enabled:true});
 const before=(await call('/api/billing')).body.account.buckets[0].remaining;
 const generated=await call('/api/generate',body);assert.equal(generated.status,200);assert.ok(generated.body.text.includes('断钥匙'));assert.equal(generated.body.source,'ai');assert.ok(!JSON.stringify(generated.body).includes('private-chat-model'));
 assert.deepEqual(JSON.parse(requests[0].body.messages[1].content).作品上下文.history,history);
 const cached=await call('/api/generate',body);assert.equal(cached.status,200);assert.equal(requests.length,1,'Recovering an acknowledged chat request must not repeat a provider call');
 const after=(await call('/api/billing')).body.account.buckets[0].remaining;assert.equal(before-after,quote.body.quote.credits);
 const task=await call('/api/tasks/'+body.requestId);assert.equal(task.body.status,'succeeded');assert.equal(task.body.request.task,'chat');assert.equal(task.body.result.text,generated.body.text);assert.ok(!JSON.stringify(task.body).includes('private-chat-model'));
 const invalid=await call('/api/generate',{...body,requestId:'chat-invalid-0001',context:{history:[{role:'system',content:'bad'},{role:'assistant',content:'bad'}]}});assert.equal(invalid.status,400);assert.equal(requests.length,1);
 failNext=true;const failedBody={...body,requestId:'chat-failed-0001'};const failed=await call('/api/generate',failedBody);assert.equal(failed.status,502);
 assert.equal((await call('/api/tasks/'+failedBody.requestId)).body.status,'failed');
 assert.equal((await call('/api/billing')).body.account.buckets[0].remaining,after,'Failed discussions refund their server reservation');
 assert.equal((await call('/api/generate',failedBody)).status,409,'A confirmed failed attempt requires explicit new-request retry');
 const retry=await call('/api/generate',{...failedBody,requestId:'chat-failed-retry-0002'});assert.equal(retry.status,200);
 protocol='responses';await call('/api/settings',{baseUrl:'https://fixture.invalid/v1',model:'private-response-model',protocol:'responses'},'PUT');
 const response=await call('/api/generate',{...body,requestId:'chat-response-0001'});assert.equal(response.status,200);assert.deepEqual(JSON.parse(requests.at(-1).body.input).作品上下文.history,history);
 console.log('PASS complete-turn chat history validation, both service adapters, safe metadata, canonical quotes, idempotent recovery and failed-turn refunds/retry');
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));api.close();await rm(directory,{recursive:true,force:true});}
