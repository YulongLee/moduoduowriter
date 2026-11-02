import {DatabaseSync,backup} from 'node:sqlite';
import {existsSync,mkdirSync,chmodSync,copyFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

// Root maintenance entrypoint for this application's data only. Never prints values.
if(process.getuid?.()!==0)throw Error('Run the application data snapshot as root.');
const revision=process.argv[2]||'manual';
if(!/^(?:[a-f0-9]{7,40}|manual)$/.test(revision))throw Error('Invalid release revision.');
const directory='/var/lib/moduoduowriter';
const target=join('/var/backups/moduoduowriter',new Date().toISOString().replace(/[:.]/g,'-')+'-'+revision);
mkdirSync(target,{recursive:true,mode:0o700});chmodSync(target,0o700);
const copied=[];
for(const name of ['studio.sqlite','login-flows.sqlite']){
 const source=join(directory,name);if(!existsSync(source))continue;
 const db=new DatabaseSync(source,{readOnly:true});
 try{await backup(db,join(target,name));chmodSync(join(target,name),0o600);copied.push(name);}finally{db.close();}
}
for(const name of ['auth-pepper','auth-flow-key','auth.json','ai.json','oss.json','media-permissions.json']){
 const source=join(directory,name);if(!existsSync(source))continue;
 copyFileSync(source,join(target,name));chmodSync(join(target,name),0o600);copied.push(name);
}
writeFileSync(join(target,'snapshot.json'),JSON.stringify({createdAt:new Date().toISOString(),revision,files:copied},null,2),{mode:0o600});
process.stdout.write(JSON.stringify({snapshot:target,files:copied.length})+'\n');
