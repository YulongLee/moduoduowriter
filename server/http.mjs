import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {realpath,stat} from 'node:fs/promises';
import {pipeline} from 'node:stream/promises';
import {resolve,join,extname,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createApi} from './api.mjs';

const releaseRoot=fileURLToPath(new URL('../',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.otf':'font/otf','.txt':'text/plain; charset=utf-8','.xml':'application/xml; charset=utf-8','.webmanifest':'application/manifest+json'};
const policy="default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-src 'self' https://open.weixin.qq.com; media-src 'self' blob:; worker-src 'self' blob:";
const inside=(root,file)=>file===root||file.startsWith(root+sep);
const respond=(res,status,message,head=false)=>{
 const body=JSON.stringify(message);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(body),'Cache-Control':'no-store'});res.end(head?undefined:body);
};
function pathnameOf(value) {
 const raw=String(value||'').split(/[?#]/,1)[0];let pathname;
 try{pathname=decodeURIComponent(raw);}catch{return null;}
 if(!pathname.startsWith('/')||pathname.startsWith('//')||/[\u0000-\u001f\u007f\\%]/.test(pathname)||pathname.split('/').some(part=>part.startsWith('.')))return null;
 // API routing is deliberately canonical: never rewrite encoded endpoint names.
 if(pathname.startsWith('/api/')&&!raw.startsWith('/api/'))return null;
 return pathname;
}

/** Serve a built release and its authenticated API; never expose the source tree. */
export async function createProductionServer({directory,distDirectory=join(releaseRoot,'dist'),publicOrigin,fetchImpl=globalThis.fetch,mailTransport,trustLoopbackProxy=false}={}) {
 if(typeof directory!=='string'||!directory)throw Error('MDD_DATA_DIR must name a dedicated persistent data directory.');
 if(typeof publicOrigin!=='string'||!publicOrigin)throw Error('MDD_PUBLIC_ORIGIN must name the public HTTPS origin.');
 const root=await realpath(resolve(distDirectory));
 const index=await realpath(join(root,'index.html'));
 if(!inside(root,index)||!(await stat(index)).isFile())throw Error('The production build is incomplete.');
 const api=createApi({directory:resolve(directory),publicOrigin,fetchImpl,mailTransport,requireAccount:true,trustLoopbackProxy});
 const allowedPublicHost=new URL(publicOrigin).host;
 const findFile=async pathname=>{
  const candidate=join(root,pathname);
  if(!inside(root,candidate))return null;
  try{const file=await realpath(candidate);if(!inside(root,file))return null;const info=await stat(file);return info.isFile()?{file,info}:null;}
  catch(error){if(['ENOENT','ENOTDIR','EACCES'].includes(error.code))return null;throw error;}
 };
 const handler=async(req,res)=>{
  const head=req.method==='HEAD';
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','SAMEORIGIN');res.setHeader('Content-Security-Policy',policy);res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  const host=req.headers.host||'';
  if(host!==allowedPublicHost&&!/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(host))return respond(res,403,{error:'请求域名不被允许。'},head);
  const pathname=pathnameOf(req.url);
  if(!pathname)return respond(res,400,{error:'请求路径不正确。'},head);
  if(pathname==='/healthz'){
   if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');return respond(res,405,{error:'不支持的请求方式。'},head);}
   return respond(res,200,{status:'ok'},head);
  }
  if(pathname==='/api'||pathname.startsWith('/api/')){
   if(pathname==='/api')return respond(res,404,{error:'接口不存在。'},head);
   return api(req,res);
  }
  if(/^\/(?:src|server|scripts|deploy|node_modules)(?:\/|$)/.test(pathname))return respond(res,404,{error:'文件不存在。'},head);
  if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');return respond(res,405,{error:'不支持的请求方式。'},head);}
  const extension=extname(pathname).toLowerCase();
  if(extension&&!types[extension])return respond(res,404,{error:'文件不存在。'},head);
  let target=await findFile(pathname==='/'?'index.html':pathname.slice(1));
  if(!target){
   const appNavigation=!extension&&!/^\/(?:assets|art|src|server|scripts|deploy|node_modules)(?:\/|$)/.test(pathname)&&String(req.headers.accept||'').split(',').some(value=>value.trim().split(';')[0]==='text/html');
   if(!appNavigation)return respond(res,404,{error:'文件不存在。'},head);
   target={file:index,info:await stat(index)};
  }
  const contentType=types[extname(target.file).toLowerCase()];
  if(!contentType)return respond(res,404,{error:'文件不存在。'},head);
  const html=extname(target.file).toLowerCase()==='.html',immutable=/^\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$/.test(pathname),etag=`W/"${target.info.size.toString(16)}-${Math.trunc(target.info.mtimeMs).toString(16)}"`;
  res.setHeader('Cache-Control',html?'no-store':immutable?'public, max-age=31536000, immutable':'public, max-age=3600');
  if(!html){res.setHeader('ETag',etag);if(req.headers['if-none-match']===etag){res.writeHead(304);return res.end();}}
  res.writeHead(200,{'Content-Type':contentType,'Content-Length':target.info.size});
  if(head)return res.end();
  await pipeline(createReadStream(target.file),res);
 };
 const server=createServer((req,res)=>{handler(req,res).catch(()=>{if(res.destroyed)return;if(res.headersSent)res.destroy();else respond(res,500,{error:'服务暂时无法完成请求。'},req.method==='HEAD');});});
 server.requestTimeout=120000;server.headersTimeout=15000;server.keepAliveTimeout=5000;server.maxHeadersCount=100;
 server.once('close',()=>api.close());
 return server;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  const port=process.env.PORT===undefined?18731:Number(process.env.PORT);
  if(!Number.isInteger(port)||port<1024||port>65535)throw Error('PORT must be an unprivileged TCP port.');
  const server=await createProductionServer({directory:process.env.MDD_DATA_DIR,distDirectory:process.env.MDD_DIST_DIR||join(releaseRoot,'dist'),publicOrigin:process.env.MDD_PUBLIC_ORIGIN,trustLoopbackProxy:process.env.MDD_TRUST_LOOPBACK_PROXY==='1'});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  process.stdout.write(JSON.stringify({event:'listening',host:'127.0.0.1',port})+'\n');
  let stopping=false;
  const stop=()=>{if(stopping)return;stopping=true;const timer=setTimeout(()=>server.closeAllConnections(),100000);timer.unref();server.close(()=>clearTimeout(timer));};
  process.once('SIGTERM',stop);process.once('SIGINT',stop);
 }catch(error){process.stderr.write('Production server could not start: '+error.message+'\n');process.exitCode=1;}
}
