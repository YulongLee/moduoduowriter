import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import React from 'react';
import TestRenderer,{act} from 'react-test-renderer';
import {createServer as createViteServer} from 'vite';
import {createCloudStore,publicOSS,validateOSS} from '../server/oss.mjs';
import {createApi} from '../server/api.mjs';
const config={bucket:'test-bucket',region:'cn-shanghai',endpoint:'https://oss-cn-shanghai.aliyuncs.com',prefix:'materials/moduoduo-writing',accessKeyId:'test-id',accessKeySecret:'test-secret'};
const objects=new Map(),actions=[];let corrupt=false;
const fake={async put(key,content,options){actions.push({op:'put',key,options});assert.ok(!objects.has(key),'Backups should be immutable');objects.set(key,{content:Buffer.from(content),headers:options.headers});return {res:{status:200}};},async get(key){if(!objects.has(key))throw {status:404,code:'NoSuchKey'};const {content,headers}=objects.get(key);return {content:corrupt?Buffer.from('changed'):content,res:{headers}};},async getACL(key){return {acl:objects.get(key).headers['x-oss-object-acl']};},async list(query){actions.push({op:'list',query});return {objects:[...objects].filter(([name])=>name.startsWith(query.prefix)).map(([name,value])=>({name,size:value.content.length,lastModified:new Date().toISOString()})),isTruncated:false};},async delete(key){objects.delete(key);return {res:{status:204}};},async head(key){return {res:{headers:{'content-length':objects.get(key)?.content.length||0}}};}};
const store=createCloudStore({makeClient:()=>fake});
const backup={format:'mdd-workspace',version:1,works:[],favorites:[],submissions:[],reading:[],workflows:[],video:[]};
const directory=await mkdtemp(join(tmpdir(),'mdd-cloud-test-'));let server,renderer,vite;
try {
 const redacted=publicOSS(config);assert.equal(redacted.configured,true);assert.ok(!JSON.stringify(redacted).includes('test-secret'));assert.ok(!JSON.stringify(redacted).includes('test-id'));
 assert.equal(validateOSS({...config,accessKeyId:'',accessKeySecret:''},config).accessKeySecret,'test-secret');assert.equal(validateOSS({...config,clearCredentials:true},config).accessKeyId,'');
 assert.throws(()=>validateOSS({...config,prefix:'materials/../other'}));assert.throws(()=>validateOSS({...config,endpoint:'http://127.0.0.1'}));assert.throws(()=>validateOSS({...config,endpoint:'https://oss-cn-beijing.aliyuncs.com'}));
 const test=await store.test(config);assert.equal(test.private,true);assert.equal(test.cleanedUp,true);assert.equal(objects.size,0);
 const saved=await store.save(config,backup);assert.ok(saved.key.startsWith(config.prefix+'/backups/'));assert.equal(actions.find(a=>a.op==='put'&&a.key===saved.key).options.headers['x-oss-object-acl'],'private');assert.equal((await store.list(config)).items.length,1);assert.equal((await store.get(config,saved.key)).format,'mdd-workspace');
 await assert.rejects(store.get(config,'materials/another-app/private.json'),/只能访问/);await assert.rejects(store.list(config,'other/prefix'),/只能访问/);await assert.rejects(store.save(config,{works:[]}),/备份/);corrupt=true;await assert.rejects(store.get(config,saved.key),/校验失败/);corrupt=false;
 console.log('PASS private OSS upload, immutable names, integrity verification, scoped restore, list and temporary-test cleanup');
 server=createServer(createApi({directory,cloudStore:store}));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const call=async(path,body,method=body===undefined?'GET':'POST')=>{const res=await fetch(base+path,{method,headers:{'Content-Type':'application/json','X-Mdd-Client':'workspace-v1'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:res.status,data:await res.json()};};
 assert.equal((await call('/api/oss/settings')).data.configured,false);const settings=await call('/api/oss/settings',config,'PUT');assert.equal(settings.status,200);assert.ok(!JSON.stringify(settings.data).includes('test-secret'));assert.equal((await call('/api/oss/test',{})).data.cleanedUp,true);assert.ok((await call('/api/oss/settings')).data.verifiedAt);const uploaded=await call('/api/oss/backups',backup);assert.equal(uploaded.status,201);assert.equal((await call('/api/oss/restore',{key:uploaded.data.key})).data.format,'mdd-workspace');assert.equal((await call('/api/oss/restore',{key:'outside/private.json'})).status,403);assert.ok((await readFile(join(directory,'oss.json'),'utf8')).includes('test-secret'));
 console.log('PASS cloud API settings redaction, successful connection status, backup listing and scoped restore endpoints');
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;const values=new Map();globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
 vite=await createViteServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});const {CloudBackup}=await vite.ssrLoadModule('/src/CloudBackup.jsx');const realFetch=globalThis.fetch;let restored,uploadedPayload;
 globalThis.fetch=async(url,options={})=>{
  if(url==='/api/oss/settings')return Response.json(publicOSS(config));
  if(url==='/api/oss/backups'&&options.method==='GET')return Response.json({items:[{key:saved.key,size:1200,updatedAt:new Date().toISOString()}],nextCursor:null});
  if(url==='/api/oss/backups'){uploadedPayload=JSON.parse(options.body);return Response.json({...saved,works:0});}
  if(url==='/api/oss/restore')return Response.json(backup);
  if(url==='/api/oss/test')return Response.json(test);
  throw new Error('Unexpected test request');
 };
 try{
  const text=n=>typeof n==='string'?n:(n?.children||[]).map(text).join('');const btn=label=>renderer.root.findAllByType('button').find(b=>text(b).trim()===label);const click=async b=>act(async()=>await b.props.onClick());
  await act(async()=>{renderer=TestRenderer.create(React.createElement(CloudBackup,{works:[],notify(){},onPrepareRestore:data=>restored=data}));});assert.ok(text(renderer.root).includes('已配置'));await click(btn('备份到 OSS'));assert.equal(uploadedPayload.format,'mdd-workspace');assert.equal(restored,undefined);await click(btn('读取并恢复'));assert.equal(restored.format,'mdd-workspace');assert.ok(text(renderer.root).includes('请在下方确认合并导入'));await click(btn('存储配置'));assert.equal(renderer.root.findByProps({'aria-label':'OSS AccessKey Secret'}).props.value,'');await act(async()=>renderer.unmount());
 }finally{globalThis.fetch=realFetch;}
 console.log('PASS cloud settings UI, entire-workspace upload, restore preview and masked server-side credentials');
}finally{if(vite)await vite.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}await rm(directory,{recursive:true,force:true});}
