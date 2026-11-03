export const workTypes=Object.freeze([
 {value:'长篇小说',label:'长篇小说',description:'适合多章节故事'},
 {value:'短篇故事',label:'短篇故事',description:'聚焦一个核心冲突'},
 {value:'剧本',label:'剧本',description:'分场、行动与对白'},
]);
export const workGenres=Object.freeze(['玄幻','都市','科幻','历史','仙侠','悬疑','言情','游戏','现实','奇幻','武侠','青春','治愈','其他']);
export const workStyles=Object.freeze(['热血','轻松','爽文','正剧','脑洞','群像','成长','治愈','悬疑','浪漫','黑暗','其他']);

// Original, editable planning material only. No template contains chapter prose.
export const creationTemplates=Object.freeze([
 {
  id:'xianxia',name:'玄幻修仙模板',summary:'宗门旧约、修行代价与少年的独立选择',title:'山门旧约',description:'一名负责保管宗门旧约的弟子，发现续约的代价正在由山下村落承担。他必须在守护师门与公开事实之间作出选择。',
  tags:['宗门','成长','旧约'],image:'/art/hero-shanshui-v1.webp',genre:'仙侠',styles:['成长','群像'],
  outline:'世界框架：山谷中的三座宗门依靠共同维护的灵契分配修行资源。每次续约都会消耗一种可被核实的现实资源，能力有明确代价。\n核心冲突：主角负责整理旧约，发现账面承诺与山下实际付出的代价不符。公开材料可能让师门失去资源，隐瞒又会使村落继续承受损失。\n主线方向：核实旧约来源—比较不同立场的证据—寻找可承担的新方案—由作者确定最终选择及后果。\n待作者确认：灵契规则、村落的主动诉求、师门内部不同目标，以及不能轻易消除的代价。',
  characters:'主角候选｜沈照：保管旧约的年轻弟子，擅长辨认契文，习惯把服从当成负责。目标是查明续约的真实代价。\n关系候选｜陆苇：山下水渠的修理人，希望先解决眼前的资源问题，不愿只听新的承诺。\n对手候选｜顾岑：负责续约的师长，担心公开旧账会使宗门失去保护村落的能力。其动机与责任由作者进一步确定。',
  notes:'先确定灵契的作用、代价与谁在承担它，再用人物的选择推动主线。为每次破局保留需要付出的代价。',
 },
 {
  id:'urban',name:'都市异能模板',summary:'旧物回声、记忆代价与城市暗线相互交织',title:'旧城回声',description:'继承旧街修理铺后，周知远发现自己能看见旧物经历过的一分钟，但每次使用都会失去当天的一段私人记忆。当失踪者的物品接连出现，他必须在追查真相与保住自我之间选择。',
  tags:['旧物异能','记忆代价','都市悬疑'],image:'/art/cover-fog.webp',genre:'都市',styles:['脑洞','悬疑'],
  outline:'世界框架：当代城市的旧街修理铺，开始收来与失踪事件有关的物品。主角触碰旧物可以重现它曾接触过的一分钟，只能观察片段，不能读心或改变过去。\n能力规则：每天最多使用三次；每次都会覆盖他当天的一段私人记忆。片段的观察角度受物件所在位置限制，遗漏的信息仍需靠调查补足。\n核心冲突：追查失踪者需要继续使用能力，但被覆盖的记忆正与关键证人和父亲留下的约定有关。另一名知晓能力代价的人，试图安排他选择看到什么。\n主线方向：发现第一段回声—记录使用与遗失的记忆—让不同片段互相矛盾—找出操纵物品来路的人—由作者确定最后一次使用能力的代价。\n待作者确认：能力的触发条件、失去的记忆如何影响关系、哪些线索可以在不使用异能时得到。',
  characters:'主角候选｜周知远：准备卖掉修理铺离开旧城的归来者，习惯记录细节，却发现自己的记录也会被尚未察觉的失忆影响。\n伙伴候选｜许宁：寻找失踪同伴的街区摄影师，能够补足物件没有看见的现场，但开始怀疑周知远每次失忆后是否还是原来的选择。\n对手候选｜陈述：熟悉旧物交易的中间人，掌握一部分能力规则，希望通过物品的流转影响调查走向。',
  notes:'用记录表区分物件中的片段、现实调查与主角失去的记忆。每次使用异能都应改变人物处境，让代价参与冲突与关系变化。',
 },
 {
  id:'future',name:'科幻未来模板',summary:'深空信号、资源边界与返航抉择相互牵动',title:'远航的回声',description:'深空观测站收到一段可能来自未来的返航指令。负责记录的工程师必须确认信号的来源，同时面对能源不足与队员不同的返航目标。',
  tags:['远航','规则','伦理'],image:'/art/cover-orbit.webp',genre:'科幻',styles:['脑洞','悬疑'],
  outline:'世界框架：一座远离补给线的观测站，只能在有限通信窗口与外界交换信息。能源、航行时间和通信能力需要明确约束。\n核心冲突：新信号给出的返航路线与现有记录冲突。照做可能挽救资源，也可能让队伍放弃尚未完成的责任；验证信号本身会消耗时间与能源。\n主线方向：保存原始记录—提出可检验解释—让一次验证改变队伍处境—在仍有未知时作出有代价的选择。\n待作者确认：信号机制、时间相关规则、工程限制，以及哪些现象仍只是人物推测。',
  characters:'主角候选｜纪澄：观测站记录工程师，相信可复核的证据，害怕自己的旧记录曾误导他人。\n伙伴候选｜唐序：负责航行的队员，希望尽早返航，对继续验证持保留态度，但并非不关心同伴。\n关系候选｜白遥：维护生命保障系统的研究员，掌握一部分资源状况，需要决定何时向团队公开自己的不确定判断。',
  notes:'先确定通信窗口、能源与航行规则，再设计验证信号的行动。把观测事实、人物解释与尚未证实的假说分开记录。',
 },
 {
  id:'history',name:'历史权谋模板',summary:'粮运账册、城坊疑案与多方权力博弈',title:'城坊旧册',description:'一名负责核对粮运账册的小吏发现，几户人家的缺粮与一本被反复修改的名册有关。他需要在期限内查清来路，同时保住能够作证的人。',
  tags:['城坊','账册','权谋'],image:'/art/hero-shanshui-v1.webp',genre:'历史',styles:['正剧','群像'],
  outline:'世界框架：架空水运城中的仓场、街坊与渡口相互依赖。粮商掌握船运，仓官控制名册，行会握有证人与人脉，三方都希望维持对城坊的影响。\n核心冲突：主角需要让账面数额与实际到粮情况相符，却发现一条被修改的记录牵动不同派系的利益。公开问题可能使证人失去庇护，接受某一方的帮助又会被用来交换立场。\n主线方向：核对物证与记录—沿运输环节寻找缺口—比较各方提供的条件—用有限权限争取证人—由作者决定如何留下证据并承担结果。\n待作者确认：粮运流程、主角权限、期限与派系关系，以及哪项利益会迫使盟友改变选择。',
  characters:'主角候选｜程素：刚接手旧册的小吏，长于核算，不擅长在不同权力关系间表达异议。\n伙伴候选｜叶舟：熟悉渡口往来的船工，希望先让欠粮得到补发，也担心自己的同伴被当成替罪者。\n关系候选｜闻庭：掌管仓场事务的上级，既承担供粮责任，也有尚未公开的工作限制；具体动机待作者确认。',
  notes:'先确定人物权限与各方希望换取的利益，再安排结盟、试探和转折。让证据改变谈判条件，而不只是揭晓答案。',
 },
].map(template=>Object.freeze({...template,tags:Object.freeze(template.tags),styles:Object.freeze(template.styles)})));

const strings=value=>typeof value==='string'?value:'';
const present=value=>typeof value==='string'&&value.trim().length>0;
const typeValues=workTypes.map(type=>type.value);
const templateIds=creationTemplates.map(template=>template.id);
const appendSource=(notes,label,value)=>notes.includes(value)?notes:[notes,`${label}：\n${value}`].filter(Boolean).join('\n\n');

/** Adapt old creation intents without discarding a long original story idea. */
export function createWorkDraft(initial={}){
 const source=initial&&typeof initial==='object'&&!Array.isArray(initial)?initial:{};
 const idea=strings(source.idea),rawDescription=strings(source.description)||idea;
 let notes=strings(source.notes);
 if(rawDescription.length>500)notes=appendSource(notes,'原始创作想法',rawDescription);
 if(present(idea)&&idea!==rawDescription)notes=appendSource(notes,'原始创作想法',idea);
 return {title:strings(source.title).trim(),description:rawDescription.trim().slice(0,500),kind:present(source.kind)?source.kind.trim():'长篇小说',genre:present(source.genre)?source.genre.trim():'玄幻',styles:Array.isArray(source.styles)?[...source.styles]:[],templateId:strings(source.templateId),outline:strings(source.outline),characters:strings(source.characters),notes};
}

export function validateCreateWorkDraft(draft){
 const value=draft&&typeof draft==='object'&&!Array.isArray(draft)?draft:{};
 const errors={};
 if(!present(value.title))errors.title='请填写作品名称';
 else if(value.title.length>50)errors.title='作品名称最多50个字符';
 if(value.description!==undefined&&(typeof value.description!=='string'||value.description.length>500))errors.description='作品简介最多500个字符';
 if(!typeValues.includes(value.kind))errors.kind='请选择长篇小说、短篇故事或剧本';
 if(!present(value.genre)||value.genre.length>50)errors.genre='请选择题材，题材名称最多50个字符';
 if(value.styles!==undefined&&(!Array.isArray(value.styles)||value.styles.length>3||new Set(value.styles).size!==value.styles.length||value.styles.some(style=>!workStyles.includes(style))))errors.styles='最多选择3个不重复的写作风格';
 if(value.templateId!==undefined&&value.templateId!==''&&!templateIds.includes(value.templateId))errors.templateId='请选择可用的创作模板';
 for(const field of ['outline','characters','notes'])if(value[field]!==undefined&&(typeof value[field]!=='string'||value[field].length>100000))errors.description ||= '故事资料每项最多100000个字符，请整理后再创建';
 return errors;
}

/** Creating a work saves editable metadata only; it never writes or generates prose. */
export function creationPayload(draft){
 const errors=validateCreateWorkDraft(draft);
 if(Object.keys(errors).length)throw Object.assign(new Error(Object.values(errors)[0]),{errors});
 return {title:draft.title.trim(),kind:draft.kind,genre:draft.genre.trim(),description:strings(draft.description).trim(),styles:[...(draft.styles||[])],...(draft.templateId?{templateId:draft.templateId}:{}),outline:strings(draft.outline),characters:strings(draft.characters),notes:strings(draft.notes),text:''};
}

/** Replace untouched prior template fields while retaining the author's edits. */
export function applyCreationTemplate(draft,id){
 const template=creationTemplates.find(value=>value.id===id);
 if(!template)throw new Error('请选择可用的创作模板');
 const previous=creationTemplates.find(value=>value.id===draft?.templateId);
 const next=createWorkDraft(draft);
 for(const field of ['title','description','outline','characters','notes']){
  const current=field==='notes'?next.notes:present(draft?.[field])?draft[field]:next[field];
  next[field]=!present(current)||(previous&&current===previous[field])?template[field]:current;
 }
 return {...next,genre:template.genre,styles:[...template.styles],templateId:template.id};
}
