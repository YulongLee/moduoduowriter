import React from 'react';
import { BookOpen, Feather, FileText, Lightbulb, ListTree, Maximize2, MessagesSquare, ScanText, Sparkles, Type, UsersRound, WandSparkles } from 'lucide-react';
import './landing-workspace-preview.css';

const chapters = [
  { number: '第1章', title: '少年出山', selected: true },
  { number: '第2章', title: '山外来客' },
  { number: '第3章', title: '一封旧信' },
];

const assistantTools = [
  { Icon: Feather, label: '续写下一段', tone: 'green' },
  { Icon: WandSparkles, label: '优化文风', tone: 'purple' },
  { Icon: ScanText, label: '扩写细节', tone: 'blue' },
  { Icon: MessagesSquare, label: '生成对白', tone: 'amber' },
  { Icon: Lightbulb, label: '情节建议', tone: 'rose' },
];

export default function LandingWorkspacePreview() {
  return <figure className="landing-workspace-preview" aria-label="创作工作台功能示意">
    <div className="lwp-window">
      <div className="lwp-window-bar">
        <div className="lwp-window-brand"><img src="/brand-mark.svg?v=3" width="23" height="23" alt="" aria-hidden="true" /><span>创作工作台</span></div>
        <div className="lwp-work-name"><BookOpen size={13} aria-hidden="true" /><span>苍山行记</span></div>
        <span className="lwp-example-label">示例文稿</span>
      </div>

      <div className="lwp-canvas">
        <div className="lwp-sidebar">
          <p className="lwp-sidebar-heading"><BookOpen size={14} aria-hidden="true" /><span>作品目录</span></p>
          <div className="lwp-sidebar-work">苍山行记<span>长篇小说 · 玄幻</span></div>
          <p className="lwp-section-label">章节</p>
          <ul className="lwp-chapter-list" aria-label="章节目录示意">{chapters.map(chapter => <li className={chapter.selected ? 'lwp-chapter-selected' : ''} key={chapter.number}><FileText size={13} aria-hidden="true" /><span><small>{chapter.number}</small>{chapter.title}</span></li>)}</ul>
          <div className="lwp-story-settings"><p className="lwp-section-label">故事设定</p><span><ListTree size={14} aria-hidden="true" />故事大纲</span><span><UsersRound size={14} aria-hidden="true" />人物档案</span></div>
        </div>

        <div className="lwp-editor">
          <div className="lwp-editor-toolbar" role="group" aria-label="正文字号、参考资料、AI助手与专注模式功能示意">
            <span className="lwp-text-style"><Type size={14} aria-hidden="true" />正文</span>
            <span className="lwp-font-size">18</span>
            <span className="lwp-toolbar-divider" aria-hidden="true" />
            <FileText size={14} aria-hidden="true" /><Sparkles size={14} aria-hidden="true" /><Maximize2 className="lwp-optional-tool" size={14} aria-hidden="true" />
          </div>
          <div className="lwp-manuscript">
            <p className="lwp-manuscript-kicker">苍山行记</p>
            <h3>第1章 少年出山</h3>
            <p>晨雾未散，山门前的石阶已经湿透。沈砚背好旧剑，回头看了一眼住了十六年的小院。</p>
            <p>师父没有送他，只留下一个信封：“去临江城，把它交给等你的人。”封口的墨印上，是一只从未见过的飞鸟。</p>
            <p>他把信收入怀中，沿着山道走向晨光。石阶尽头，一个撑着青伞的陌生人抬起头，像是已经等了很久。</p>
          </div>
        </div>

        <div className="lwp-assistant">
          <p className="lwp-assistant-heading"><Sparkles size={15} aria-hidden="true" /><span>AI 助手</span></p>
          <p className="lwp-assistant-description">让想法继续生长</p>
          <ul className="lwp-assistant-tools" aria-label="AI写作工具示意">{assistantTools.map(({ Icon, label, tone }) => <li key={label}><span className={`lwp-tool-icon lwp-tone-${tone}`}><Icon size={15} aria-hidden="true" /></span><span>{label}</span></li>)}</ul>
          <div className="lwp-assistant-note"><span aria-hidden="true">“</span><p>从一个想法，<br />到下一段故事。</p></div>
        </div>
      </div>

      <div className="lwp-window-status"><span><span className="lwp-status-dot" aria-hidden="true" />第一章 · 示例正文</span><span>编辑 · 规划 · 创作</span></div>
    </div>
    <figcaption>界面示意</figcaption>
  </figure>;
}
