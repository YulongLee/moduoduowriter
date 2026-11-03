import React from 'react';
import {seoResources} from './seo-resource-index.mjs';

const labels={
 '/features/ai-novel-writing/':'AI 小说写作',
 '/features/novel-outline/':'小说大纲规划',
 '/features/character-design/':'人物设定',
 '/features/text-polish/':'文字润色',
 '/features/story-ideas/':'故事灵感',
 '/features/novel-continuation/':'小说续写',
 '/features/novel-title-synopsis/':'书名与简介',
 '/features/novel-analysis/':'小说拆书',
 '/features/script-writing/':'剧本写作',
 '/guides/getting-started/':'新手入门',
 '/guides/ai-novel-prompts/':'写作提示词',
 '/guides/ai-long-novel/':'长篇创作指南'
};
export function SeoResourceLinks(){
 return <nav className="public-resource-directory" aria-label="写作功能与教程目录">{[['/features/','了解创作功能'],['/guides/','从这里开始学习']].map(([prefix,title])=><section key={prefix}><h2>{title}</h2><div>{seoResources.filter(page=>page.path.startsWith(prefix)).map(page=><a key={page.path} href={page.path}>{labels[page.path]||page.label}<span aria-hidden="true">↗</span></a>)}</div></section>)}</nav>;
}
