import OSS from 'ali-oss';
import { randomUUID,createHash } from 'node:crypto';
import { validateBackup } from '../src/backup.js';
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
export const defaultOSS={bucket:'',region:'cn-shanghai',endpoint:'https://oss-cn-shanghai.aliyuncs.com',prefix:'materials/moduoduo-writing',accessKeyId:'',accessKeySecret:''};
export function validateOSS(value,previous=defaultOSS) {
 const next={bucket:String(value.bucket||'').trim(),region:String(value.region||'').trim().replace(/^oss-/,''),endpoint:String(value.endpoint||'').trim().replace(/\/+$/,''),prefix:String(value.prefix||'').trim().replace(/^\/+|\/+$/g,''),accessKeyId:value.accessKeyId?String(value.accessKeyId).trim():previous.accessKeyId,accessKeySecret:value.accessKeySecret?String(value.accessKeySecret).trim():previous.accessKeySecret};
 if(value.clearCredentials){next.accessKeyId='';next.accessKeySecret='';}
 if(!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(next.bucket))throw fail('Bucket 名称格式不正确');
 if(!/^[a-z]{2}-[a-z0-9-]+$/.test(next.region)||next.endpoint!==`https://oss-${next.region}.aliyuncs.com`)throw fail('请使用与地域一致的阿里云 OSS 公网 HTTPS 地址');
 if(!/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)+$/.test(next.prefix)||next.prefix.length>200)throw fail('请使用独立的应用目录，例如 materials/moduoduo-writing');
 for(const v of [next.accessKeyId,next.accessKeySecret])if(v.length>4096||/[\r\n]/.test(v))throw fail('OSS 访问凭证格式不正确');
 return next;
}
export const publicOSS=config=>({bucket:config.bucket,region:config.region,endpoint:config.endpoint,prefix:config.prefix,configured:!!(config.bucket&&config.accessKeyId&&config.accessKeySecret),hasCredentials:!!(config.accessKeyId&&config.accessKeySecret),verifiedAt:config.verifiedAt||null});
const digest=content=>createHash('sha256').update(content).digest('hex');
const writeOptions={headers:{'x-oss-object-acl':'private','x-oss-forbid-overwrite':'true','Content-Type':'application/json; charset=utf-8'}};
function safeError(error) {
 const code=error.code||error.name;
 if(code==='AccessDenied'||error.status===403)return fail('OSS 拒绝访问，请检查当前目录的上传、读取、列举和删除权限',502);
 if(['InvalidAccessKeyId','SignatureDoesNotMatch','InvalidSecurityToken'].includes(code))return fail('OSS 凭证验证失败，请检查 AccessKey 与地域配置',502);
 if(code==='NoSuchBucket')return fail('OSS Bucket 不存在或地域不匹配',502);
 if(code==='NoSuchKey'||error.status===404)return fail('这份云端备份已不存在，请刷新列表',404);
 return fail('OSS 操作未完成，请检查网络、配置或存储服务状态',502);
}
export function createCloudStore({makeClient=config=>new OSS({bucket:config.bucket,region:`oss-${config.region}`,endpoint:config.endpoint,accessKeyId:config.accessKeyId,accessKeySecret:config.accessKeySecret,authorizationV4:true,secure:true,timeout:20000,retryMax:0})}={}) {
 const client=config=>{if(!publicOSS(config).configured)throw fail('请先配置 OSS 存储',503);return makeClient(config);};
 const validKey=(config,key)=>{
  const prefix=`${config.prefix}/backups/`;
  if(typeof key!=='string'||!key.startsWith(prefix)||!/^\d{13}-[a-f0-9-]{36}\.json$/.test(key.slice(prefix.length)))throw fail('只能访问墨多多目录内的备份文件',403);
  return key;
 };
 return {
  async putMedia(config,id,content,kind){if(!/^[a-f0-9-]{36}$/.test(id)||!['image','video'].includes(kind))throw fail('媒体编号不正确');const key=`${config.prefix}/media/${id}.${kind==='image'?'png':'mp4'}`;const oss=client(config);try{await oss.put(key,content,{headers:{...writeOptions.headers,'Content-Type':kind==='image'?'image/png':'video/mp4','x-oss-meta-sha256':digest(content)}});return {key,size:content.length,sha256:digest(content)};}catch(e){if(e.code==='FileAlreadyExists')return {key,size:content.length,sha256:digest(content)};throw safeError(e);}},
  async readMedia(config,key,range){if(!key.startsWith(`${config.prefix}/media/`)||!/^[-a-f0-9]{36}\.(png|mp4)$/.test(key.slice(`${config.prefix}/media/`.length)))throw fail('不能读取应用外的媒体文件',403);try{return await client(config).get(key,range?{headers:{Range:range}}:{});}catch(e){throw safeError(e);}},
  async test(config) {
   const oss=client(config),key=`${config.prefix}/_connection-tests/${randomUUID()}.txt`,content=Buffer.from('墨多多 OSS 连接验证\n');let uploaded=false,failure,cleanupError;
   try{await oss.put(key,content,writeOptions);uploaded=true;const result=await oss.get(key);if(!result.content.equals(content))throw fail('OSS 写入与读回的内容不一致',502);const acl=await oss.getACL(key);if(acl.acl!=='private')throw fail('OSS 测试对象没有保持私有权限',502);await oss.list({prefix:`${config.prefix}/`,'max-keys':1});}
   catch(e){failure=e.status&&e.message?.startsWith('OSS ')?e:safeError(e);}
   finally{if(uploaded){try{await oss.delete(key);}catch{cleanupError=true;}}}
   if(cleanupError)throw fail(`OSS 测试文件未能清理，请在控制台删除 ${key}`,502);
   if(failure)throw failure;
   return {ok:true,uploaded:true,readBack:true,private:true,listed:true,cleanedUp:true,verifiedAt:new Date().toISOString()};
  },
  async save(config,data) {
   try{validateBackup(data);}catch(e){throw fail(e.message);}
   const content=Buffer.from(JSON.stringify(data));if(content.length>20000000)throw fail('云端备份不能超过 20MB',413);
   const hash=digest(content),key=`${config.prefix}/backups/${String(9999999999999-Date.now()).padStart(13,'0')}-${randomUUID()}.json`;
   const oss=client(config);
   try {
    // Read-back verification covers encoding, permissions and integrity before reporting success.
    await oss.put(key,content,{headers:{...writeOptions.headers,'x-oss-meta-sha256':hash,'Content-Disposition':'attachment; filename="moduoduo-backup.json"'}});
    const read=await oss.get(key);if(digest(read.content)!==hash)throw fail('OSS 备份校验失败，请保留本地备份',502);
    return {key,size:content.length,sha256:hash,createdAt:new Date().toISOString(),works:data.works.length};
   }catch(e){if(e.status&&e.message?.startsWith('OSS '))throw e;throw safeError(e);}
  },
  async list(config,cursor='') {
   if(cursor)validKey(config,cursor);const oss=client(config);
   try{const data=await oss.list({prefix:`${config.prefix}/backups/`,'max-keys':50,...(cursor?{marker:cursor}:{})});return {items:(data.objects||[]).flatMap(item=>{try{validKey(config,item.name);return [{key:item.name,size:item.size,updatedAt:item.lastModified}];}catch{return [];}}),nextCursor:data.isTruncated?data.nextMarker:null};}catch(e){throw safeError(e);}
  },
  async get(config,key) {
   validKey(config,key);const oss=client(config);
   try{const head=await oss.head(key);if(Number(head.res?.headers?.['content-length'])>20000000)throw fail('云端备份超过支持大小',413);const result=await oss.get(key);if(result.content.length>20000000)throw fail('云端备份超过支持大小',413);const expected=result.res?.headers?.['x-oss-meta-sha256'];if(expected&&digest(result.content)!==expected)throw fail('云端备份校验失败，请使用其他版本',502);return validateBackup(JSON.parse(result.content.toString('utf8')));}catch(e){if(e.status&&[400,413,502].includes(e.status))throw e;throw safeError(e);}
  }
 };
}
