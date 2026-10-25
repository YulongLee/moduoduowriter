import {newId} from './works.js';
import {wordCount} from './data.js';

export const defaultSubmissionRequirements={minWords:0,maxWords:0,descriptionMinChars:0,notes:'',confirmed:false};
export function submissionPreparation(work,values={}) {
 return {chapterIds:values.chapterIds===undefined?(work?.chapters||[]).map(chapter=>chapter.id):[...values.chapterIds],description:values.description??work?.description??'',genre:values.genre??work?.genre??'',requirements:{...defaultSubmissionRequirements,...values.requirements}};
}
export function checkSubmission(work,values={}) {
 const preparation=submissionPreparation(work,values),ids=new Set(preparation.chapterIds),chapters=(work?.chapters||[]).filter(chapter=>ids.has(chapter.id));
 const words=chapters.reduce((total,chapter)=>total+wordCount(chapter.text),0),requirements=preparation.requirements;
 const min=Math.max(0,Number(requirements.minWords)||0),max=Math.max(0,Number(requirements.maxWords)||0),descriptionMin=Math.max(0,Number(requirements.descriptionMinChars)||0);
 const missingIds=preparation.chapterIds.filter(id=>!chapters.some(chapter=>chapter.id===id));
 const checks=[
  {id:'source',label:'原作品可用',ok:Boolean(work),detail:work?'原作品已关联':'原作品已移除，请重新关联后再留存当前稿'},
  {id:'title',label:'作品名称',ok:Boolean(work?.title?.trim()),detail:work?.title||'尚未填写作品名称'},
  {id:'genre',label:'投稿题材',ok:Boolean(preparation.genre.trim()),detail:preparation.genre||'尚未填写题材'},
  {id:'description',label:'投稿简介',ok:Boolean(preparation.description.trim()),detail:preparation.description.trim()?`已准备 ${wordCount(preparation.description)} 字简介`:'尚未填写简介'},
  {id:'range',label:'投递章节范围',ok:chapters.length>0&&!missingIds.length,detail:missingIds.length?`${missingIds.length} 个已选章节已移除，请重新选择`:chapters.length?`已选择 ${chapters.length} 章`:'至少选择一章'},
  {id:'chapterTitles',label:'章节标题',ok:chapters.length>0&&chapters.every(chapter=>chapter.title.trim()),detail:chapters.some(chapter=>!chapter.title.trim())?'存在未填写标题的章节':'逐章核对标题与顺序'},
  {id:'text',label:'章节正文',ok:chapters.length>0&&chapters.every(chapter=>chapter.text.trim()),detail:chapters.some(chapter=>!chapter.text.trim())?'存在空白章节':`${words.toLocaleString()} 字正文（不含空白）`},
  {id:'words',label:'作者填写的字数要求',ok:(!min||words>=min)&&(!max||words<=max)&&(!min||!max||min<=max),detail:min&&max&&min>max?'最低字数高于最高字数，请修改':min||max?`当前 ${words.toLocaleString()} 字；要求 ${min?min.toLocaleString():'不限'} 至 ${max?max.toLocaleString():'不限'} 字`:'尚未设置字数门槛，请自行核对目标平台要求'},
  {id:'descriptionWords',label:'作者填写的简介要求',ok:!descriptionMin||wordCount(preparation.description)>=descriptionMin,detail:descriptionMin?`简介至少 ${descriptionMin} 字，当前 ${wordCount(preparation.description)} 字`:'未设置简介字数门槛'},
  {id:'requirements',label:'平台要求人工核对',ok:requirements.confirmed===true,detail:requirements.confirmed?'已由作者确认本次填写的要求':'请到目标平台核对，并确认填写的要求'}
 ];
 return {preparation,chapters,wordCount:words,checks,missing:checks.filter(item=>!item.ok),capturable:Boolean(work&&chapters.length&&!missingIds.length&&chapters.some(chapter=>chapter.text.trim()))};
}
export function captureSubmissionVersion(work,values={},options={}) {
 const checked=checkSubmission(work,values);
 if(!checked.capturable)throw new Error('请先关联作品，选择有效章节并准备正文，再保存投递版本。');
 return {id:options.id||newId(),capturedAt:options.capturedAt||new Date().toISOString(),title:String(work.title||''),genre:checked.preparation.genre,description:checked.preparation.description,chapters:checked.chapters.map(({id,title,text})=>({id,title,text})),wordCount:checked.wordCount,versionLabel:options.versionLabel||'投递版本'};
}
export function submissionVersions(record) {
 const versions=[...(record.snapshot?[record.snapshot]:[]),...(record.versions||[])];
 return versions.filter((version,index)=>version&&Array.isArray(version.chapters)&&versions.findIndex(item=>item?.id===version.id)===index);
}
export function withSubmissionVersion(record,snapshot,{delivered=false}={}) {
 return {...record,snapshot:record.snapshot||snapshot,versions:[...submissionVersions(record),snapshot],activeVersionId:snapshot.id,status:delivered?'已投递':record.status,updatedAt:snapshot.capturedAt};
}
export function defaultSubmissionVersion(record,selectedId) {
 const versions=submissionVersions(record);
 return versions.find(version=>version.id===(selectedId||record.activeVersionId))||record.snapshot||versions.at(-1)||null;
}
export function submissionPackage(record,snapshot,{preparation=false,checks=[]}={}) {
 if(!snapshot)throw new Error('未留投递版本，无法还原当时投递内容。请补记当前稿或导出准备包。');
 return [preparation?'投稿准备包 · 当前工作稿':'投稿留存版本',preparation?'此包用于准备与人工投递，尚未确认为当次投递版本。':'此包来自作者明确留存的版本；平台投递状态以作者在目标平台的实际操作为准。',`作品名称：${snapshot.title}`,`题材：${snapshot.genre}`,`目标平台：${record.platform||'待填写'}`,`版本：${snapshot.versionLabel}`,`${preparation?'生成时间':'留存时间'}：${snapshot.capturedAt}`,`正文：${snapshot.wordCount} 字（不含空白）`,`章节范围：${snapshot.chapters.map(chapter=>chapter.title).join(' / ')}`,`简介：\n${snapshot.description||'（未填写）'}`,...(preparation&&record.requirements?.notes?[`作者填写的平台要求备注：${record.requirements.notes}`]:[]),...(preparation&&checks.length?[`准备清单：\n${checks.map(item=>`${item.ok?'已核对':'待补充'} · ${item.label}：${item.detail}`).join('\n')}`]:[]),'正文',snapshot.chapters.map(chapter=>`${chapter.title}\n\n${chapter.text}`).join('\n\n')].join('\n\n');
}
