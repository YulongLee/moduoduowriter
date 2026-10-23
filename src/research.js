import { initialWorks, wordCount } from './data';

export const readingDimensions = [
  { id:'structure', name:'剧情结构', desc:'主线、冲突与关键转折' },
  { id:'characters', name:'人物塑造', desc:'人物动机与关系变化' },
  { id:'rhythm', name:'叙事节奏', desc:'悬念、信息与情绪推进' },
  { id:'style', name:'表达特点', desc:'视角、语言与场景细节' }
];
export const sampleReadingText = initialWorks[0].chapters.map(c=>`${c.title}\n\n${c.text}`).join('\n\n');

export function textFacts(text) {
  return {
    words: wordCount(text),
    paragraphs: text.split(/\n\s*\n/).map(p=>p.trim()).filter(Boolean).length,
    chapters: text.split('\n').filter(line=>/^第[一二三四五六七八九十百千零\d]+[章回节卷]/.test(line.trim())).length,
    dialogue: (text.match(/[“「]/g)||[]).length
  };
}

export function buildReadingReport({title,text,dimensions}) {
  const isSample = text.trim() === sampleReadingText.trim();
  return {
    id:`reading-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    title:title.trim()||'未命名阅读笔记',
    createdAt:new Date().toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit'}),
    text,dimensions:[...dimensions],facts:textFacts(text),isSample,note:'',
    overview:isSample?'一封寄给失踪母亲的信，把旧书店店主林深带回十七年前的往事。开篇用“母亲的名字”“陌生男孩”和“停摆的钟楼”连续制造信息缺口，将私人记忆与旧城悬案连接起来。':'这是一份针对当前文稿的阅读框架。左侧统计来自实际文本；以下问题用于辅助人工观察，尚未调用 AI 分析。',
    sections:readingDimensions.filter(d=>dimensions.includes(d.id)).map(d=>({
      id:d.id,title:d.name,
      items:(isSample?{
        structure:[['故事起点','林深在雨夜关店时，收到一封写着母亲名字的信。母亲已失踪十七年，信的到来打破了日常。'],['信息升级','照片里母亲牵着的男孩不是林深；本应停摆的钟楼发出了钟声。两个异常推动主角主动调查。'],['情节推进','林深来到档案馆寻找银杏巷住户资料。管理员的停顿与看向门口的目光，为后续人物关系留下伏笔。']],
        characters:[['林深 · 主动调查者','旧书店店主。从关店拆信，到查阅档案，再到进入钟楼，行动逐步升级，寻找母亲的动机构成故事驱动力。'],['母亲 · 缺席的中心','通过名字、字迹和照片进入故事。她虽未直接出场，却让主角的过去与现在产生连接。'],['档案管理员 · 信息守门人','听到“银杏巷”时出现反常反应，用细微行为建立她与旧案之间尚未揭示的联系。']],
        rhythm:[['由静入动','从雨夜关店这一日常场景切入，随后加入来信，先建立空间，再制造变化。'],['短句停顿','“是他母亲的名字。”和“那个男孩不是他。”独立成段，形成阅读停顿，突出关键发现。'],['章节悬念','第二章结尾让人物望向门口；第三章开头用身后的脚步声承接“不安”，避免过早交代答案。']],
        style:[['观察视角','主要贴近林深的感知，读者与主角同时获取信息，保留悬念。'],['可感知的细节','雨水洇湿的信封、钟声、旧照片、木梯级数，把抽象的不安落在具体物件和声音上。'],['可借鉴的方法','用熟悉事物中的一个异常开启故事，让线索同时承担情节推进与情绪营造。借鉴叙事方法，保留自己的原创人物和情节。']]
      }:{
        structure:[['主线目标','主角此刻最想完成什么？把目标写成一个可以被行动验证的句子。'],['冲突与代价','什么阻止主角达成目标？如果他失败，将具体失去什么？'],['关键转折','标记让人物改变计划的信息或事件，检查前后行动是否有关联。']],
        characters:[['人物动机','主角的外在目标与内在需求分别是什么？哪些行为体现了它们？'],['关系变化','挑选一段关键对话，记录关系在场景前后发生了什么变化。'],['人物一致性','选择一次重要决定，写下与既有人物设定相吻合的理由。']],
        rhythm:[['场景节奏','将文本分成“行动、对话、解释、描写”四类，观察连续出现的段落。'],['信息分配','标出新问题的提出位置与答案出现的位置，检查是否保留了阅读动力。'],['情绪变化','记录开篇、中段和结尾的情绪变化，并为每个判断附上原文依据。']],
        style:[['叙述视角','判断信息通过谁的观察呈现，标记可能超出该人物认知的内容。'],['语言特征','选择两处有代表性的句子，记录长短句、修辞与词语的特点。'],['原创练习','提炼一个表达方法，在全新的人物和情境中练习，避免复用原作情节。']]
      })[d.id].map(([label,body])=>({label,body}))
    }))
  };
}

export function reportText(report) {
  return `${report.title}\n${report.source==='ai'?'AI 拆书报告':report.isSample?'预置示例解析':'阅读观察框架'} · ${report.createdAt}\n\n文稿统计：${report.facts.words} 字 / ${report.facts.paragraphs} 段 / ${report.facts.chapters} 章\n\n内容概览\n${report.overview}\n\n${report.sections.map(s=>`${s.title}\n${s.items.map(item=>`${item.label}\n${item.body}`).join('\n\n')}`).join('\n\n')}\n\n我的阅读笔记\n${report.note||'尚未添加笔记'}`;
}

export function applyDraft(original,candidate,mode) {
  return mode==='replace'?candidate:[original,candidate].filter(Boolean).join('\n\n');
}
