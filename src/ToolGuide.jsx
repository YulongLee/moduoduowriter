import React, {useState} from 'react';
import {BookOpen, Check, Copy, Sparkles} from 'lucide-react';
import {tools} from './data';
import {toolGuides} from './toolGuides';
import './tool-guides.css';

export function ToolGuide({toolId,onUseExample}) {
  const [copyState,setCopyState] = useState('');
  const guide = toolGuides[toolId], tool = tools.find(item => item.id === toolId);
  if (!guide || !tool) return null;
  const copy = async () => {
    try {
      if (!globalThis.navigator?.clipboard?.writeText) throw new Error('clipboard-unavailable');
      await globalThis.navigator.clipboard.writeText(guide.prompt);
      setCopyState('已复制示例输入');
    } catch {
      setCopyState('复制未完成，可直接选择下方示例文字复制。');
    }
  };
  return <section className="tool-guide" aria-label={`${tool.title}使用指南`}>
    <header><BookOpen size={17}/><h3>{tool.title} · 使用指南</h3><span>示例说明</span></header>
    <div className="tool-guide-overview"><div><h4>适用场景</h4><p>{guide.scene}</p></div><div><h4>输入要求</h4><ul>{guide.requirements.map(item => <li key={item}>{item}</li>)}</ul></div></div>
    <div className="tool-guide-example"><div className="tool-guide-example-heading"><h4>示例输入</h4><div><button type="button" aria-label={`复制${tool.title}示例`} onClick={copy}>{copyState === '已复制示例输入' ? <Check size={14}/> : <Copy size={14}/>}复制示例</button>{onUseExample && <button type="button" className="tool-guide-use" aria-label={`使用${tool.title}示例`} onClick={() => onUseExample(guide.prompt)}><Sparkles size={14}/>使用这个示例</button>}</div></div><pre>{guide.prompt}</pre><p className="tool-guide-copy-status" role="status">{copyState}</p></div>
    <details className="tool-guide-result"><summary>示例结果 · 展开查看</summary><p>以下是预先编写的示例，用于说明输出形式。</p><pre>{guide.result}</pre></details>
  </section>;
}
