import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,symlink,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {request} from 'node:http';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createProductionServer} from '../server/http.mjs';
import {createStore} from '../server/store.mjs';

// All files, accounts and data live in a disposable directory; no real services.
const directory=await mkdtemp(join(tmpdir(),'mdd-production-http-')),dist=join(directory,'dist'),data=join(directory,'data'),origin='https://writer.example.com';
let server,child;let providerCalls=0;
const fetchImpl=async()=>{providerCalls++;throw Error('No live provider is allowed in production HTTP tests');};
const start=async()=>{server=await createProductionServer({directory:data,distDirectory:dist,publicOrigin:origin,fetchImpl});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));};
const close=async()=>{if(!server)return;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));server=null;};
const call=(path,{method='GET',host='writer.example.com',headers={},body}={})=>new Promise((resolve,reject)=>{const req=request({hostname:'127.0.0.1',port:server.address().port,path,method,headers:{Host:host,'X-Mdd-Client':'workspace-v1','Content-Type':'application/json',...headers}},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text:Buffer.concat(chunks).toString('utf8')}));});req.on('error',reject);req.end(body===undefined?undefined:JSON.stringify(body));});
try{
 await mkdir(join(dist,'assets'),{recursive:true});await mkdir(join(dist,'art'));await mkdir(join(dist,'src'));await mkdir(join(dist,'.git'));
 await writeFile(join(dist,'index.html'),'<!doctype html><html><head></head><body>Fixture homepage</body></html>');
 await writeFile(join(dist,'assets/index-a1b2c3d4.js'),'console.log("fixture-built-module")');await writeFile(join(dist,'assets/plain.js'),'console.log("nonhashed")');
 await writeFile(join(dist,'art/cover.svg'),'<svg xmlns="http://www.w3.org/2000/svg"/>');
 for(const name of ['private.json','.env','.git/config','src/leak.js','assets/index-a1b2c3d4.js.map'])await writeFile(join(dist,name),'PRIVATE_CONFIG_SHOULD_NEVER_LEAK');
 await writeFile(join(directory,'outside.txt'),'PRIVATE_OUTSIDE_DATA');await symlink(join(directory,'outside.txt'),join(dist,'symlink.txt'));
 await assert.rejects(createProductionServer({distDirectory:dist,publicOrigin:origin}));await assert.rejects(createProductionServer({directory:data,distDirectory:dist}));
 await start();let value=await call('/healthz');assert.equal(value.status,200);assert.deepEqual(JSON.parse(value.text),{status:'ok'});assert.match(value.headers['cache-control'],/no-store/);
 assert.equal((await call('/healthz',{method:'HEAD'})).text,'');assert.equal((await call('/healthz',{method:'POST',body:{}})).status,405);
 assert.equal((await call('/api/auth/status')).status,503);assert.equal((await call('/api/auth/register',{method:'POST',body:{username:'public-bootstrap',password:'fixture-would-be-owner'}})).status,503,'Public startup can never adopt the existing space');
 console.log('PASS production starts only with explicit data/origin, liveness stays minimal and anonymous bootstrap fails closed');
 await close();const store=createStore(data),owner=await store.register('fixture_owner','fixture-owner-password');store.close();await start();
 value=await call('/');assert.equal(value.status,200);assert.match(value.text,/Fixture homepage/);assert.match(value.headers['content-type'],/^text\/html/);assert.match(value.headers['cache-control'],/no-store/);
 assert.match(value.headers['content-security-policy'],/frame-src 'self' https:\/\/open\.weixin\.qq\.com/);assert.match(value.headers['content-security-policy'],/object-src 'none'/);assert.equal(value.headers['x-content-type-options'],'nosniff');assert.equal(value.headers['x-frame-options'],'SAMEORIGIN');
 const head=await call('/index.html',{method:'HEAD'});assert.equal(head.status,200);assert.equal(head.text,'');assert.equal(head.headers['content-length'],String(Buffer.byteLength(value.text)));
 value=await call('/assets/index-a1b2c3d4.js');assert.equal(value.status,200);assert.match(value.headers['content-type'],/^text\/javascript/);assert.match(value.headers['cache-control'],/immutable/);
 assert.equal((await call('/assets/index-a1b2c3d4.js',{headers:{'If-None-Match':value.headers.etag}})).status,304);
 value=await call('/assets/plain.js');assert.match(value.headers['cache-control'],/max-age=3600/);assert.ok(!value.headers['cache-control'].includes('immutable'));
 assert.equal((await call('/art/cover.svg?v=3')).headers['content-type'],'image/svg+xml');
 assert.equal((await call('/about',{headers:{Accept:'text/html'}})).status,200);assert.equal((await call('/about',{headers:{Accept:'application/json'}})).status,404);
 assert.equal((await call('/assets/missing.js',{headers:{Accept:'text/html'}})).status,404);assert.equal((await call('/art/missing',{headers:{Accept:'text/html'}})).status,404);
 console.log('PASS built HTML/assets, HEAD, conditional cache and HTML-only navigation fallback without disguising missing resources');
 for(const path of ['/../outside.txt','/%2e%2e/outside.txt','/%252e%252e/outside.txt','/%2eenv','/.env','/.git/config','/assets/../private.json','/assets/%2e%2e/private.json','/assets%5c..%5cprivate.json','/assets/%00file.js','/private.json','/src/leak.js','/%73rc/leak.js','/server/api.mjs','/scripts/check.mjs','/node_modules/react/index.js','/assets/index-a1b2c3d4.js.map','/symlink.txt','/%61pi/auth/status','/%invalid']){
  value=await call(path,{headers:{Accept:'text/html'}});assert.ok([400,404].includes(value.status),`${path} must be blocked`);assert.ok(!value.text.includes('PRIVATE_'));
 }
 assert.equal((await call('/',{host:'unknown.example.com'})).status,403);assert.equal((await call('/',{method:'POST',body:{}})).status,405);assert.equal((await call('/api/unknown',{headers:{Accept:'text/html'}})).status,401);
 value=await call('/api/auth/status',{headers:{Cookie:'mdd_session='+owner.token}});assert.equal(value.status,200);assert.equal(JSON.parse(value.text).user.id,owner.user.id);
 assert.equal((await call('/api/auth/status',{headers:{Origin:'https://attacker.example'}})).status,403);assert.equal(providerCalls,0);
 console.log('PASS raw/encoded traversal, hidden/source/config paths and symlink escape rejection, plus authenticated API/origin boundaries');
 await close();
 // The real CLI owns its signal handlers; bind a disposable port and read health.
 const probe=await createProductionServer({directory:data,distDirectory:dist,publicOrigin:origin,fetchImpl});await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 const cli=new URL('../server/http.mjs',import.meta.url);child=spawn(process.execPath,[fileURLToPath(cli)],{env:{...process.env,PORT:String(port),MDD_DATA_DIR:data,MDD_DIST_DIR:dist,MDD_PUBLIC_ORIGIN:origin},stdio:['ignore','pipe','pipe']});
 let output='',error='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>error+=chunk);
 await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Production CLI did not start')),5000);const listen=chunk=>{if((output+String(chunk)).includes('"event":"listening"')){clearTimeout(timeout);child.stdout.off('data',listen);resolve();}};child.stdout.on('data',listen);child.once('exit',code=>{clearTimeout(timeout);reject(Error('CLI exited before ready: '+code+' '+error));});});
 const stopped=new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('SIGTERM did not stop production CLI')),5000);child.once('exit',(code,signal)=>{clearTimeout(timeout);resolve({code,signal});});});child.kill('SIGTERM');assert.deepEqual(await stopped,{code:0,signal:null});child=null;
 assert.ok(!output.includes('fixture-owner-password'));assert.ok(!output.includes(data));
 console.log('PASS loopback-only production CLI startup and clean SIGTERM without configuration or credential logging');
}finally{if(child)child.kill('SIGKILL');await close();await rm(directory,{recursive:true,force:true});}
