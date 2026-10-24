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
console.log('Core colors meet a 4.5:1 text contrast threshold. This does not replace browser visual QA.');
