# 居中首页山水背景

日期：2026-11-04。

使用内置 image_gen 生成一张原创背景图，类型为 stylized-concept；不是整页网页效果图，没有烘焙文字、Logo、按钮或输入框。用户新参考图只用于理解构图与气质，本次为全新生成，没有将它作为编辑目标。

## 保存与编码

- 内置工具原始文件：`/Users/liyulong/.codex/generated_images/01a1a0ca-6792-7563-ad4f-e2157ca52f10/exec-b211487c-64d3-4d67-86e5-b04cfa90f9ad.png`。
- 项目内完整原始 PNG：`design/assets/hero-jianghu-centered-v2-original.png`，2172×724，1,648,312 字节。逐字节复制，保留原图。
- 页面使用文件：`public/art/hero-jianghu-centered-v2.webp`，2304×768，85,824 字节。仅以 Lanczos 等比缩放并编码 WebP（quality=86, method=6），没有裁剪、重绘、调色、叠加或生成式修改。

## 输出检查

已检查生成图：左右两侧为青蓝与薄荷色山峰、浅色云海及桃花；右侧山门与淡杏日轮、右下小幅披风行者均留在外侧。中央大块近白留白可承载居中标题与输入区，没有文字、水印或网页元素。图像尺寸比例为 3:1。此项是原始素材检查，不等同于整页浏览器视觉验收。

## 最终提示词

```text
Use case: stylized-concept.
Asset type: ONE original wide website hero BACKGROUND illustration, 2304 by 768 pixels, aspect ratio exactly 3:1. This is artwork only, NOT a website screenshot or UI mockup.
Primary request: a bright refined Chinese shan-shui watercolor landscape for a commercial novel-writing platform. Build the scene on BOTH OUTSIDE EDGES, preserving an exceptionally clean nearly-white central area for a centered headline and input form.
Composition: the entire central band from x=26% to x=74%, from the top down through at least 65% of image height, must remain quiet near-white (#fcfbfa) negative space with only the faintest distant white mist, no mountains, no branches, no sun, no people, no objects. Keep this central negative space broad and contiguous, not a narrow valley. The bottom center also softly fades to near-white mist.
LEFT edge x=0% to 25%: clear elegant blue-grey and mint-green mountain peaks, very subtle gold sunlit edges, layers of white cloud sea; a small amount of delicate pink-white peach blossom branches in the far lower-left foreground. Peaks taper and dissolve completely before entering the central band.
RIGHT edge x=78% to 100%: clear slate-blue and mint cliffs with distant Chinese mountain gate and small pavilions toward the far right; a pale apricot sun confined to the upper-right edge; a SMALL lone traveler in a dark flowing cloak standing on a ledge at approximately x=91%, y=77%. The traveler must be small and stay on the far lower-right edge, fully outside the central input area. Delicate pale peach blossom branch at the extreme lower-right is acceptable. Keep all architecture and the sun confined to the right perimeter.
Style and mood: fine detailed watercolor illustration with restrained cinematic depth, bright soft morning light, serene Jianghu literary atmosphere, tasteful and premium. Gentle blue-grey, mint and pale peach palette against nearly white paper. Crisp enough mountain contours at the edges to remain visible, no flat icon art, no cartoon, no dark ink wash.
Absolute constraints: NO text, letters, calligraphy, logos, watermark, buttons, form fields, borders, webpage elements, panels or interface. No overall yellow tint, no sepia filter, no heavy black ink, no center foreground object. Preserve the specified 3:1 panorama and the huge clean center.
```

