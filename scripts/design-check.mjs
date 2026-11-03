import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Contrast verification uses the actual stylesheet tokens, without a browser.
const css = readFileSync(new URL('../src/studio.css', import.meta.url), 'utf8');
const root = css.match(/:root\s*\{([^}]+)\}/)?.[1];
assert.ok(root, 'Design tokens must be available');
const tokens = Object.fromEntries([...root.matchAll(/(--[\w-]+)\s*:\s*(#[\da-f]{6})\s*;/gi)].map(match => [match[1], match[2]]));

function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

const pairs = [
  ['正文 / 页面', '--text', '--canvas'],
  ['正文 / 面板', '--text', '--surface'],
  ['辅助文字 / 页面', '--muted', '--canvas'],
  ['辅助文字 / 面板', '--muted', '--surface'],
  ['次级文字 / 页面', '--subtle', '--canvas'],
  ['主按钮', '--surface', '--accent'],
  ['主按钮悬停', '--surface', '--accent-hover'],
  ['品牌文字 / 选中背景', '--accent', '--accent-soft'],
  ['会员说明', '--gold', '--gold-soft'],
  ['深色套餐正文', '--inverse-text', '--inverse'],
  ['深色套餐辅助文字', '--inverse-muted', '--inverse'],
  ['强调按钮', '--inverse', '--highlight'],
  ['蓝色功能文字', '--blue', '--blue-soft'],
  ['紫色功能文字', '--violet', '--violet-soft'],
  ['暖金功能文字', '--amber', '--amber-soft'],
  ['玫瑰色功能文字', '--rose', '--rose-soft'],
  ['蓝色实心图标', '--surface', '--blue'],
  ['紫色实心图标', '--surface', '--violet'],
  ['暖金实心图标', '--surface', '--amber'],
  ['玫瑰色实心图标', '--surface', '--rose'],
  ['辅助文字 / 蓝色面板', '--muted', '--blue-soft'],
  ['辅助文字 / 紫色面板', '--muted', '--violet-soft'],
  ['辅助文字 / 暖金面板', '--muted', '--amber-soft'],
  ['辅助文字 / 表单底色', '--muted', '--surface-soft'],
  ['剧本主视觉正文', '--text', '--accent-soft'],
  ['剧本主视觉说明', '--muted', '--accent-soft'],
  ['剧本主操作', '--surface', '--accent']
];
for (const [name, foreground, background] of pairs) {
  assert.ok(tokens[foreground] && tokens[background], `${name}: missing color token`);
  const ratio = contrast(tokens[foreground], tokens[background]);
  assert.ok(ratio >= 4.5, `${name}: ${ratio.toFixed(2)}:1 is below 4.5:1`);
  console.log(`PASS ${name} ${ratio.toFixed(2)}:1`);
}
// Homepage has scoped colors; check their actual values as well as the shared theme.
const homeCss=readFileSync(new URL('../src/home.css',import.meta.url),'utf8');
const homeRoot=homeCss.match(/\.home-v2\s*\{([^}]+)\}/)?.[1];
assert.ok(homeRoot,'Homepage scoped design tokens must be available');
const homeTokens={...tokens,...Object.fromEntries([...homeRoot.matchAll(/(--[\w-]+)\s*:\s*(#[\da-f]{6})\s*;/gi)].map(match=>[match[1],match[2]]))};
const resolve=value=>{const variable=value?.trim().match(/^var\((--[\w-]+)\)$/)?.[1];const color=variable?homeTokens[variable]:value?.trim();assert.match(color||'',/^#[\da-f]{6}$/i,'Contrast source must resolve to an actual color');return color;};
const placeholder=homeCss.match(/\.home-prompt-field textarea::placeholder\s*\{[^}]*color\s*:\s*([^;]+);/)?.[1];
for(const [name,foreground,background] of [
  ['首页正文',homeTokens['--home-text'],homeTokens['--home-surface']],
  ['首页辅助文字',homeTokens['--home-muted'],homeTokens['--home-surface']],
  ['首页辅助文字 / 页面',homeTokens['--home-muted'],tokens['--canvas']],
  ['首页输入提示',resolve(placeholder),homeTokens['--home-surface']],
  ['首页主操作',homeTokens['--home-surface'],homeTokens['--home-accent']]
]){
  const ratio=contrast(resolve(foreground),resolve(background));
  assert.ok(ratio>=4.5,`${name}: ${ratio.toFixed(2)}:1 is below 4.5:1`);
  console.log(`PASS ${name} ${ratio.toFixed(2)}:1`);
}
console.log('Shared and homepage colors meet a 4.5:1 text contrast threshold. This does not replace browser visual QA.');

// The private library uses scoped colors for its actual metadata and state chips.
const libraryCss=readFileSync(new URL('../src/works-library.css',import.meta.url),'utf8');
const libraryRoot=libraryCss.match(/\.novel-library\s*\{([^}]+)\}/)?.[1];
const libraryTokens=Object.fromEntries([...libraryRoot.matchAll(/(--[\w-]+)\s*:\s*(#[\da-f]{6})\s*;/gi)].map(match=>[match[1],match[2]]));
const libraryRule=selector=>{
 const escaped=selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const match=libraryCss.match(new RegExp(escaped+'\\s*\\{([^}]+)\\}'));
 assert.ok(match,`Missing library contrast source: ${selector}`);
 return property=>{
  const value=match[1].match(new RegExp('(?:^|;)\\s*'+property+'\\s*:\\s*([^;]+)'))?.[1]?.trim();
  const variable=value?.match(/^var\((--[\w-]+)\)$/)?.[1];
  return variable?libraryTokens[variable]:value;
 };
};
const libraryPairs=[
 ['作品库正文',libraryTokens['--novel-ink'],'#ffffff'],
 ['作品库辅助文字',libraryTokens['--novel-muted'],'#f7f8f6'],
 ...[
  ['作品分类数量','.novel-library .novel-kind-tabs > button small','#ffffff'],
  ['选中分类数量','.novel-library .novel-kind-tabs > .novel-tab-selected small','#eef4ec'],
  ['作品日期','.novel-library .novel-work-edited','#ffffff'],
  ['作品字数','.novel-library .novel-work-size','#ffffff'],
  ['搜索输入提示','.novel-library .novel-library-search input::placeholder','#fbfcfa'],
  ['新建小说说明','.novel-library .novel-shortcut-primary .novel-shortcut-copy > span','#245b42']
 ].map(([label,selector,background])=>[label,libraryRule(selector)('color'),background]),
 ...['writing','serializing','completed'].map(state=>{
  const property=libraryRule(`.novel-library .novel-work-tags>.novel-work-status-${state}`);
  return [`作品状态 ${state}`,property('color'),property('background')];
 })
];
for(const [label,foreground,background] of libraryPairs){
 const ratio=contrast(foreground,background);
 assert.ok(ratio>=4.5,`${label}: ${ratio.toFixed(2)}:1 is below 4.5:1`);
 console.log(`PASS ${label} ${ratio.toFixed(2)}:1`);
}
const createCss=readFileSync(new URL('../src/create-work-page.css',import.meta.url),'utf8');
const createTokens=Object.fromEntries([...createCss.match(/\.create-work-page\s*\{([^}]+)\}/)[1].matchAll(/(--[\w-]+)\s*:\s*(#[\da-f]{6})\s*;/gi)].map(match=>[match[1],match[2]]));
const createColor=selector=>{
 const escaped=selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const values=[...createCss.matchAll(new RegExp(escaped+'\\s*\\{([^}]+)\\}','g'))].map(match=>match[1].match(/(?:^|;)\s*color\s*:\s*([^;]+)/)?.[1]?.trim()).filter(Boolean);
 const value=values.at(-1);
 assert.ok(value,`Missing creation contrast source: ${selector}`);
 const resolved=createTokens[value?.match(/^var\((--[\w-]+)\)$/)?.[1]]||value;
 return /^#[\da-f]{3}$/i.test(resolved)?'#'+resolved.slice(1).split('').map(character=>character+character).join(''):resolved;
};
for(const [label,foreground,background] of [
 ['新建作品正文',createTokens['--create-work-ink'],'#ffffff'],
 ['新建作品说明',createTokens['--create-work-muted'],'#f7f8f6'],
 ['名称与简介计数',createColor('.create-work-page .create-work-label-row > span'),'#ffffff'],
 ['选中题材与风格',createColor('.create-work-page .create-work-chip-selected'),'#f1f7eb'],
 ['模板说明',createColor('.create-work-page .create-work-template-description'),'#ffffff'],
 ['模板标签',createColor('.create-work-page .create-work-template-tags > span'),'#f0f4ec'],
 ['创建作品按钮',createColor('.create-work-page .create-work-submit'),'#245b40']
]){
 const ratio=contrast(foreground,background);
 assert.ok(ratio>=4.5,`${label}: ${ratio.toFixed(2)}:1 is below 4.5:1`);
 console.log(`PASS ${label} ${ratio.toFixed(2)}:1`);
}
const studioCss=readFileSync(new URL('../src/studio-conversation.css',import.meta.url),'utf8')+'\n'+readFileSync(new URL('../src/studio-conversation-tools.css',import.meta.url),'utf8');
const studioTokens=Object.fromEntries([...studioCss.match(/\.studio-conversation\s*\{([^}]+)\}/)[1].matchAll(/(--[\w-]+)\s*:\s*(#[\da-f]{6})\s*;/gi)].map(match=>[match[1],match[2]]));
const studioColor=selector=>{
 const values=[...studioCss.matchAll(/([^{}]+)\{([^{}]+)\}/g)].filter(match=>match[1].split(',').map(value=>value.trim()).includes(selector)).map(match=>match[2].match(/(?:^|;)\s*color\s*:\s*([^;]+)/)?.[1]?.trim()).filter(Boolean);
 const value=values.at(-1),resolved=studioTokens[value?.match(/^var\((--[\w-]+)\)$/)?.[1]]||value;
 assert.ok(resolved,`Missing studio contrast source: ${selector}`);
 return /^#[\da-f]{3}$/i.test(resolved)?'#'+resolved.slice(1).split('').map(character=>character+character).join(''):resolved;
};
for(const [label,foreground,background] of [
 ['对话正文',studioTokens['--studio-conversation-ink'],'#fcfdf9'],
 ['对话辅助文字',studioTokens['--studio-conversation-muted'],'#f7f9f4'],
 ['对话历史摘要',studioColor('.studio-conversation .studio-conversation-history-item small'),'#f7f9f4'],
 ['用户消息',studioColor('.studio-conversation .home-chat-message.from-user p'),'#edf4e7'],
 ['工具说明',studioColor('.studio-conversation .wc-studio-tool small'),'#ffffff'],
 ['回复排版正文',studioColor('.studio-conversation .conversation-rich-text'),'#fcfdf9'],
 ['发送对话按钮',studioColor('.studio-conversation .studio-conversation-send'),'#245b40']
]){
 const ratio=contrast(foreground,background);
 assert.ok(ratio>=4.5,`${label}: ${ratio.toFixed(2)}:1 is below 4.5:1`);
 console.log(`PASS ${label} ${ratio.toFixed(2)}:1`);
}
