export const EVALUATION_DIMENSIONS={consistency:'人物与事实一致性',causality:'情节因果与衔接',style:'语言与风格'};
export const FIXED_WRITING_CASES=[
 {id:'opening',title:'开篇 · 午夜灯塔',task:'continue',sourceText:'故事事实：林渡，28岁，雾港修船师，不会游泳。他的父亲三年前出海失踪。雾港灯塔已停用十年。叙述采用第三人称限知，只呈现林渡能感知的信息。',prompt:'写约600字小说开篇：午夜，林渡在修船铺收到一张当天拍摄的照片，照片里的失踪父亲站在停用灯塔上。用具体行动建立悬念，不提前解释照片来源。遵守所给事实和第三人称限知视角。',checks:['开篇是否尽早出现具体异常','林渡的职业与不会游泳的事实是否保持','是否避免直接揭示幕后真相']},
 {id:'continuation',title:'续写 · 退潮后的门',task:'continue',sourceText:'林渡站在旧仓库的铁门前。顾明给的钥匙只转了半圈，锁眼里便传来碎裂声。他不敢再拧，退后一步，看见门底的积水正往外涌。顾明昨晚说过，这座仓库十年没进过水。林渡不会游泳，手机只剩百分之三的电。',prompt:'承接原文续写约600字。让林渡通过观察和有限工具调查仓库，遇到一次合理阻碍，结尾得到一条可以核实的新线索。不能突然获得游泳能力、外援或从未出现的万能工具。',checks:['动作是否直接承接断钥匙与渗水','电量、能力等限制是否持续生效','新线索是否由人物行动得到']},
 {id:'dialogue',title:'对白 · 不能说出的航次',task:'dialogue',sourceText:'林渡想问出父亲最后一次出海的目的地。顾明是当年的领航员，答应过保密，却欠林家一条命。两人在清晨的鱼市修补船灯。林渡话少，顾明习惯用玩笑遮掩不安。顾明知道目的地，但不会在这场对话里直说。',prompt:'写约500字含动作的对话。林渡试探，顾明回避，直到林渡指出船灯上的新划痕，顾明才交出一条间接线索。用潜台词表现亏欠，不用独白直接解释双方心理，不直接说出目的地。',checks:['两人的口吻是否可区分','回避与松动是否有具体触发点','秘密是否仍未被直接说破']},
 {id:'character',title:'人物 · 有边界的盟友',task:'character',sourceText:'雾港旧档案馆需要一位与林渡合作的管理员。故事已确定：三年前父亲失踪，港口货运记录被人为删去一页。管理员不是全知者，不能靠数据库直接解决谜案。',prompt:'设计档案管理员人物卡：身份、外在目标、内在需要、缺点、底线、与林渡的关系、一个会妨碍合作的秘密，以及三次逐步变化的行动。明确她知道什么、不知道什么；避免万能盟友。',checks:['目标、弱点与行动是否相互支撑','知识边界是否清楚','人物弧线是否通过选择而非标签呈现']},
 {id:'outline',title:'大纲 · 三章因果链',task:'outline',sourceText:'已发生：林渡收到父亲在停用灯塔上的新照片；顾明给了旧仓库钥匙。限制：林渡不会游泳；顾明暂不肯公开最后航次目的地。终点：第三章末，林渡发现照片拍摄时间被人为修改。',prompt:'规划接下来三章，每章写目标、阻碍、人物选择、选择的后果、结尾悬念。让第三章的时间篡改发现由前两章线索推导出来，不能靠匿名人直接告知答案。不要扩展为全书大纲。',checks:['后一章是否由前一章选择推动','篡改线索是否提前埋设','每章目标与代价是否具体']},
 {id:'review',title:'审稿 · 找出有依据的冲突',task:'review',sourceText:'人物设定：林渡不会游泳，对父亲失踪的海域有恐惧。他的手机已在进入仓库前耗尽电量。\n正文：林渡看见档案漂进水池，毫不犹豫地跳下去，熟练游到对岸。他掏出手机，打开手电照向纸页。纸上写着“凌晨两点”。他因此断定，顾明就是绑架父亲的人。',prompt:'根据给定设定和正文审稿。区分明确矛盾、动机缺失和证据不足，每条引用原文并给可操作的改法。不要补写未提供的幕后事实，也不要把人物恐惧等同于绝对不能行动。',checks:['是否识别游泳能力和手机电量矛盾','是否指出从时间到指控的证据跳跃','建议是否给出原文依据且不过度推断']},
 {id:'polish',title:'润色 · 保留信息的克制表达',task:'polish',sourceText:'雨很大。林渡拿着照片站在灯塔下面。他很害怕，但他还是走了进去。里面很黑，他闻到了柴油的味道，听到上面有人咳嗽。他想喊父亲，可是最后没有喊。他把照片折好，放进口袋。',prompt:'在不新增人物、对白、事实或线索的前提下润色这段文字，保持第三人称限知与克制的悬疑气氛。保留柴油气味、楼上咳嗽、没有喊出父亲这三项信息，约250字。只返回润色正文。',checks:['关键感觉与动作是否都保留','是否添加了原文没有的解释或线索','节奏和措辞是否清晰且克制']},
 {id:'title',title:'书名 · 承诺与故事匹配',task:'title',sourceText:'悬疑小说：不会游泳的修船师林渡，收到失踪父亲站在停用灯塔上的照片。他沿着旧仓库、航次记录和被篡改的时间调查，逐渐发现港口集体隐瞒的救援事故。主线是寻找真相与修复家庭关系，不含超自然设定。',prompt:'给出5个原创中文书名，每个附一句命名理由；再写100字以内简介。避免承诺鬼怪、重生或复仇爽文，不在简介里泄露救援事故真相。名字尽量具体，简介包含主角、异常、行动与阻碍。',checks:['书名是否贴合灯塔、时间或航港意象','是否错误承诺超自然或复仇类型','简介是否有行动与阻碍且保留谜底']}
];
const newId=()=>globalThis.crypto?.randomUUID?.()||`evaluation-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;
const cleanText=value=>typeof value==='string'?value:'';
const nullableNumber=(value,max)=>value===null||value===''||value===undefined?null:Number.isFinite(Number(value))&&Number(value)>=0&&Number(value)<=max?Number(value):null;
export function newEvaluationCandidate(value={}) {
 const content=cleanText(value.text).slice(0,20000);
 return {id:newId(),text:content,label:cleanText(value.label).slice(0,160),editedText:typeof value.editedText==='string'?value.editedText.slice(0,20000):content,finalConfirmed:value.finalConfirmed===true,scores:Object.fromEntries(Object.keys(EVALUATION_DIMENSIONS).map(key=>[key,[1,2,3,4,5].includes(Number(value.scores?.[key]))?Number(value.scores[key]):null])),elapsedMs:nullableNumber(value.elapsedMs,31536000000),costCredits:nullableNumber(value.costCredits,1000000000),costCny:nullableNumber(value.costCny,1000000000)};
}
export function createWritingEvaluation(caseId='opening') {
 const sample=FIXED_WRITING_CASES.find(value=>value.id===caseId),timestamp=new Date().toISOString();
 return {id:newId(),caseId:sample?.id||'custom',title:sample?`${sample.title} · 人工比较`:'自定义人工比较',createdAt:timestamp,updatedAt:timestamp,candidates:[newEvaluationCandidate(),newEvaluationCandidate()],preferredId:'',notes:'',blind:true,method:'manual'};
}
export function validateWritingEvaluation(record) {
 if(!record||typeof record.id!=='string'||!record.id||typeof record.title!=='string'||!record.title.trim()||record.title.length>120||!Array.isArray(record.candidates)||record.candidates.length<2||record.candidates.length>4)throw new Error('请填写评估名称，并保留 2–4 个候选。');
 if(typeof record.caseId!=='string'||record.caseId.length>160||record.method!=='manual'||typeof record.blind!=='boolean'||![record.createdAt,record.updatedAt].every(value=>typeof value==='string'&&Number.isFinite(Date.parse(value)))||record.candidates.some(candidate=>typeof candidate.id!=='string'||!candidate.id||candidate.id.length>500))throw new Error('评估标识、时间或人工评估方式不正确。');
 if(record.candidates.some(candidate=>typeof candidate.text!=='string'||!candidate.text.trim()||candidate.text.length>20000||typeof candidate.editedText!=='string'||candidate.editedText.length>20000||typeof candidate.label!=='string'||candidate.label.length>160||typeof candidate.finalConfirmed!=='boolean'))throw new Error('每个候选都需有原始文本，单份文本最多 2 万字符。');
 if(new Set(record.candidates.map(candidate=>candidate.id)).size!==record.candidates.length)throw new Error('候选编号重复，请重新导入。');
 for(const candidate of record.candidates){
  if(Object.keys(EVALUATION_DIMENSIONS).some(key=>candidate.scores?.[key]!==null&&![1,2,3,4,5].includes(candidate.scores?.[key])))throw new Error('人工评分应为 1–5 分，也可以留空。');
  if([['elapsedMs',31536000000],['costCredits',1000000000],['costCny',1000000000]].some(([key,max])=>candidate[key]!==null&&(!Number.isFinite(candidate[key])||candidate[key]<0||candidate[key]>max)))throw new Error('耗时、费用和墨点请填写有效非负数字，未记录时留空。');
 }
 if(record.preferredId&&!record.candidates.some(candidate=>candidate.id===record.preferredId))throw new Error('所选最优候选已不存在。');
 if(typeof record.notes!=='string'||record.notes.length>4000)throw new Error('评估笔记最多 4,000 字符。');
 return {...record,method:'manual',updatedAt:new Date().toISOString()};
}
export function saveWritingEvaluation(records,record) {
 const checked=validateWritingEvaluation(record);
 if(records.length>=100&&!records.some(value=>value.id===checked.id))throw new Error('最多保存 100 份评估，请先导出并删除不再需要的记录。');
 return [checked,...records.filter(value=>value.id!==checked.id)];
}
export function writingTextStats(value) {
 const text=cleanText(value),sentences=text.split(/[。！？!?\n]+/).map(sentence=>sentence.replace(/\s/g,'')).filter(Boolean),counts=new Map();
 for(const sentence of sentences.filter(sentence=>sentence.length>=6))counts.set(sentence,(counts.get(sentence)||0)+1);
 const repeated=[...counts.entries()].filter(([,count])=>count>1).map(([sentence,count])=>({sentence,count}));
 return {chars:Array.from(text.replace(/\s/g,'')).length,paragraphs:text.split(/\n\s*\n/).filter(paragraph=>paragraph.trim()).length,sentences:sentences.length,repeatedSentenceKinds:repeated.length,repeatedOccurrences:repeated.reduce((sum,item)=>sum+item.count-1,0),repeated};
}
// Bounded Myers comparison gives exact retained characters for ordinary revisions.
// Large rewrites use the proven common prefix/suffix and are explicitly marked approximate.
export function writingRevisionStats(original,edited,{maxSteps=1500000}={}) {
 const a=Array.from(cleanText(original).replace(/\s/g,'')),b=Array.from(cleanText(edited).replace(/\s/g,'')),n=a.length,m=b.length;
 let prefix=0,suffix=0;
 while(prefix<n&&prefix<m&&a[prefix]===b[prefix])prefix++;
 while(suffix<n-prefix&&suffix<m-prefix&&a[n-suffix-1]===b[m-suffix-1])suffix++;
 const left=a.slice(prefix,n-suffix),right=b.slice(prefix,m-suffix),ln=left.length,rn=right.length;
 let common=prefix+suffix,approximate=false;
 if(ln&&rn){
  const frontier=new Map([[1,0]]);let steps=0,found=false;
  outer:for(let distance=0;distance<=ln+rn;distance++){
   for(let diagonal=-distance;diagonal<=distance;diagonal+=2){
    if(++steps>maxSteps){approximate=true;break outer;}
    let x=diagonal===-distance||(diagonal!==distance&&(frontier.get(diagonal-1)??-Infinity)<(frontier.get(diagonal+1)??-Infinity))?(frontier.get(diagonal+1)||0):(frontier.get(diagonal-1)||0)+1;
    let y=x-diagonal;
    while(x<ln&&y<rn&&left[x]===right[y]){x++;y++;if(++steps>maxSteps){approximate=true;break outer;}}
    frontier.set(diagonal,x);
    if(x>=ln&&y>=rn){common+=(ln+rn-distance)/2;found=true;break outer;}
   }
  }
  if(!found)approximate=true;
 }
 return {originalChars:n,editedChars:m,retainedChars:common,addedChars:m-common,removedChars:n-common,retentionRate:n?common/n:null,approximate};
}
export function evaluationCandidateSummary(candidate) {
 const filled=Object.values(candidate.scores||{}).filter(value=>[1,2,3,4,5].includes(value));
 return {...writingTextStats(candidate.text),revision:writingRevisionStats(candidate.text,candidate.editedText),score:filled.length?filled.reduce((sum,value)=>sum+value,0)/filled.length:null,scoredDimensions:filled.length,elapsedMs:candidate.elapsedMs??null,costCredits:candidate.costCredits??null,costCny:candidate.costCny??null};
}
export function parseEvaluationCandidateImport(content,name='导入候选') {
 let value;try{value=JSON.parse(content);}catch{if(!content.trim()||content.length>20000)throw new Error('候选文本不能为空，且最多 2 万字符。');return [newEvaluationCandidate({text:content,label:name})];}
 const source=Array.isArray(value)?value:Array.isArray(value?.candidates)?value.candidates:[];
 if(!source.length||source.length>4)throw new Error('候选 JSON 需包含 1–4 个文本或 candidates 条目。');
 return source.map((candidate,index)=>{
  const item=typeof candidate==='string'?{text:candidate,label:`${name} ${index+1}`}:candidate;
  if(!item||typeof item.text!=='string'||!item.text.trim()||item.text.length>20000)throw new Error('候选文本不能为空，且最多 2 万字符。');
  return newEvaluationCandidate(item);
 });
}
const csvCell=value=>{let text=value===null||value===undefined?'':String(value);if(/^[=+@-]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';};
export function writingEvaluationsCsv(records) {
 const rows=[['评估编号','案例','评估名称','候选','版本备注（非盲评时）','人物事实一致性','情节因果衔接','语言风格','已评分维度','人工评分均值','原始字符','定稿是否确认','定稿字符','保留字符','新增字符','删除字符','保留比例','差异是否估算','重复句额外次数','耗时毫秒（手填）','实际成本元（手填）','墨点（手填）','人工首选','评估笔记']];
 for(const record of records)record.candidates.forEach((candidate,index)=>{const summary=evaluationCandidateSummary(candidate),final=candidate.finalConfirmed;rows.push([record.id,record.caseId,record.title,String.fromCharCode(65+index),record.blind?'':candidate.label,candidate.scores.consistency,candidate.scores.causality,candidate.scores.style,summary.scoredDimensions,summary.score,summary.revision.originalChars,final?'是':'否',final?summary.revision.editedChars:null,final?summary.revision.retainedChars:null,final?summary.revision.addedChars:null,final?summary.revision.removedChars:null,final?summary.revision.retentionRate:null,final?(summary.revision.approximate?'是':'否'):'',summary.repeatedOccurrences,candidate.elapsedMs,candidate.costCny,candidate.costCredits,record.preferredId===candidate.id?'是':'',record.notes]);});
 return rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
}
