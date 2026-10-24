import React from 'react';
import {ArrowUpRight} from 'lucide-react';
import './tool-artwork.css';

const scenes = {
  ideas:['cover-spring.webp','灵感构思'],
  outline:['cover-fog.webp','大纲规划'],
  character:['tool-writing-desk-v1.webp','人物设定'],
  polish:['tool-writing-desk-v1.webp','文字润色'],
  continue:['cover-orbit.webp','正文续写'],
  dialogue:['cover-spring.webp','人物对白'],
  review:['tool-writing-desk-v1.webp','章节审稿'],
  title:['cover-fog.webp','书名与简介']
};

export function ToolArtwork({tool}) {
  const [file,label] = scenes[tool.id] || scenes.ideas;
  return <div className={`tool-artwork artwork-${tool.id}`} style={{'--tool-image':`url("/art/${file}")`}} aria-hidden="true"><span>{label}</span><ArrowUpRight size={16}/></div>;
}
