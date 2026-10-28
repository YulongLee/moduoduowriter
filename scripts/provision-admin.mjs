import {DatabaseSync} from 'node:sqlite';
import * as sqlite from 'node:sqlite';
import {mkdir,stat,chmod,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {createInterface} from 'node:readline';
import {createStore} from '../server/store.mjs';
import {normalizeLoginTarget} from '../server/auth-identity.mjs';

// Local maintenance only. No HTTP route or source-controlled default credentials.
export async function provisionLocalAdmin(directory,input) {
 const username=normalizeLoginTarget('email',input?.username),password=input?.password;
 if(typeof password!=='string'||password.length<8||password.length>128)throw Error('管理员密码需为 8–128 个字符。');
 const root=resolve(directory),source=join(root,'studio.sqlite');await mkdir(root,{recursive:true,mode:0o700});
 let backupFile=null,exists=false;try{await stat(source);exists=true;}catch(error){if(error.code!=='ENOENT')throw error;}
 if(exists){
  const snapshots=join(root,'admin-snapshots');await mkdir(snapshots,{recursive:true,mode:0o700});
  backupFile=join(snapshots,'before-admin-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID()+'.sqlite');
  const db=new DatabaseSync(source);
  try{if(typeof sqlite.backup==='function')await sqlite.backup(db,backupFile);else db.exec("VACUUM INTO '"+backupFile.replace(/'/g,"''")+"'");await chmod(backupFile,0o600);}
  catch(error){await rm(backupFile,{force:true}).catch(()=>{});throw error;}finally{db.close();}
 }
 const store=createStore(root);
 try{
  const result=await store.provisionAdmin({username,password});const verification=await store.login(username,password);if(verification.user.id!==result.user.id||verification.user.role!=='admin')throw Error('管理员登录校验未通过。');store.logout(verification.token);
  return {initialized:true,username:result.loginAlias,role:'admin',spaceId:result.user.id,existingSpacePreserved:!result.created,credentialsVerified:true,backupCreated:Boolean(backupFile)};
 }finally{store.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  if(process.argv[2]!=='--stdin')throw Error('请使用 --stdin 通过标准输入提供一行初始化资料，勿将密码放入命令参数。');
  const index=process.argv.indexOf('--directory'),directory=index<0?resolve('.local'):resolve(process.argv[index+1]||'');
  const reader=createInterface({input:process.stdin,crlfDelay:Infinity});const line=await new Promise((resolve,reject)=>{reader.once('line',resolve);reader.once('close',()=>reject(Error('未收到初始化资料。')));});reader.close();process.stdin.pause();
  if(line.length>4096)throw Error('初始化资料过长。');let input;try{input=JSON.parse(line);}catch{throw Error('初始化资料格式不正确。');}
  const result=await provisionLocalAdmin(directory,input);input.password='';process.stdout.write(JSON.stringify(result)+'\n');
 }catch(error){process.stderr.write((error.status?error.message:'管理员初始化未完成，请检查本地资料与服务状态。')+'\n');process.exitCode=1;}
}
