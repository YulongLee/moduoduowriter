# 首页商业体验优化稿 v3

生成方式：内置 imagegen 工具。仅交付效果图，网站代码未改。

## 本稿变化

- 延续 v2 中性灰白、近黑与墨绿，不更换配色方向。
- 品牌标识和功能图标实现时直接复用现有 SVG / lucide-react 组件；栅格效果图不是新的图标资源。
- 首屏保留故事题材和篇幅，读者、视角等放进创作偏好。
- 增加先看生成示例与明确标记的预写示例，展示大纲、人物、开篇。
- 最近作品只出现一次，增加上次编辑章节与继续写作。
- 生成前确认用量，不编造扣点、耗时、余额和收益数据。
- 功能入口、工具和步骤指南降低视觉权重，保留完整入口。

## 状态约定

本图展示老用户手动展开示例的状态。默认新用户可预览示例并开始首部作品；老用户默认收起示例，将最近章节与待恢复任务前置。恢复入口仅在真实存在未完成任务时出现。示例不冒充实时生成结果。真实支付仍未启用，不以设计图作为计费已上线的证据。

## 原始生成提示词

Use case: ui-mockup.
Edit Image 1, the current approved neutral-palette homepage design for “墨多多写作”, into a more commercially complete and easier-to-use homepage. Image 2 is the authoritative EXISTING BRAND AND ICONS reference from the user's app. Preserve those exact logo and icon designs, their outline strokes and original small icon colors. The user explicitly forbids redesigning icons.

Output ONE high-fidelity complete app homepage screenshot, flat and front-facing, no browser chrome or monitor, no annotations outside the UI, no palette board. Use a slightly taller landscape image around 1920x1536 so the full homepage has readable typography rather than squeezed tiny text. Main content maximum width about 1440px with clear gutters. Keep the exact same 64px icon rail, thin header, original brand mark, muted neutral gray-white #F5F6F3 background, white #FFFFFF surfaces, near-black #222A26 text, legible secondary text #66716A, muted forest-green #285B49 primary controls, #EDF3EE selected states, #E0E5E0 borders. Matte flat colors, no bluish cast, cream cast, bright gradients or green shadows.

SCREEN SCENARIO:
A returning author has manually expanded “生成效果示例”, so this single screenshot can show both the sample-output preview and improved continue-writing cards. It is an interface mockup with sample book titles, not a report of real user activity. Do not add fictitious income, popularity or performance claims.

PRESERVE:
- Sidebar icon rail and top header from Image 1. The ORIGINAL brand mark (near-black square, two white book pages, small mint pen nib at upper right) must match in both rail and header. No new logo.
- Sidebar actual source icon shapes: four-tile LayoutDashboard, FolderOpen, BookOpen, Clapperboard, BookMarked, Sparkles, Workflow linked rounded nodes, Clock3, Send, GraduationCap, Crown, bottom help and avatar.
- Chinese headline exactly “一句话生成爆款小说”, first part near-black and second part forest green, large readable ~46px, weight700 rather than ultra-black. Subtitle exactly “输入故事灵感，生成小说大纲、人物设定和开篇正文”.
- Complete alignment, all content in a single main column. No adjacent hero side panel.

MAIN OPTIMIZATIONS AND PAGE ORDER:
1. PROMINENT FULL-WIDTH COMPOSER:
A white restrained panel with one simple thin border, 12–14px radius, good internal padding. Textarea area about 150px tall. Readable placeholder: “你想写一个怎样的故事？” and second line “例如：一位能听见旧物记忆的修复师，收到了一封来自明天的信……”. Counter “0 / 500”. No unnecessary nested thick borders.
Below textarea show ONLY a row “故事题材” with large comfortable pills “玄幻” selected, “都市”, “言情”, “悬疑”, “科幻”, “仙侠”, “历史”, “更多”.
Next row: “作品篇幅” segmented “短篇故事” / selected “长篇小说”. Nearby a light secondary disclosure button “创作偏好⌄” with small caption “读者、视角等”. Do NOT show all reader and perspective chips on the main form; they are collapsed here.
Bottom action line: at left original sparkle and “灵感共创⌄”, a secondary text link “先看生成示例”, a quiet “导入文稿” link. At right one dominant matte forest-green button “开始生成小说 →”. Immediately below/right, in legible small muted text, show “生成前确认用量 · 失败退回预留额度”. Do not invent any numeric balance, cost, duration or paid entitlement. No model/provider name.
Below the form, a short lightbulb row “试试这些灵感” with two short suggested story chips and refresh, similar to Image 1 but less visually prominent.

2. COMPACT EXPANDED RESULT SAMPLE:
A compact white preview strip spanning the same content width. Header left “生成效果示例”, a tiny neutral badge “预写示例”, right “查看完整示例 →” and collapse chevron. It should be clearly recognizable as example content, never real generated output.
Inside three small side-by-side reading columns separated by subtle lines, NOT bulky nested cards:
- label “故事大纲”, strong short title “雨夜来信”, description “修复师收到一封明日来信，沿着旧物中的记忆寻找寄信人。”
- label “人物设定”, strong short title “沈听澜 · 旧物修复师”, description “擅长修复旧物，却始终不敢面对父亲留下的秘密。”
- label “开篇正文”, short literary excerpt “雨落在旧书店的玻璃上。她拆开信封，看见落款处写着明天的日期。”
Make this preview modest in height, enough to communicate tangible outcomes without stealing the main action.

3. MORE USEFUL CONTINUE-WRITING SECTION, ONLY ONCE:
Heading “继续你的故事”, right “全部作品 →”.
Three horizontal book cards. Use the same THREE SMALL illustrated cover designs and titles from Image 1: “长街雾未散”, “等风也等你”, “第七次日落”. Cover art should remain unchanged, small and tasteful.
First card subtly emphasized with a thin green-gray outline, show title, metadata “悬疑 · 长篇小说”, the important extra line “上次编辑：雨夜来信”, and a clearly visible “继续写作 →” button. Other two cards show their title, genre/length and a quieter “打开作品 →” action. Do not fabricate counts, progress percentages, dates or writing statistics. No duplicated recent-work strip further down.

4. FOUR COMPACT WORKFLOW ENTRY CARDS:
Keep one row four equal compact white cards, original icons and soft plates from the source:
BookOpen = “小说写作” / “从大纲到每一章”
Clapperboard = “剧本创作” / “写好每一场戏”
BookMarked (open book with bookmark, NOT bare bookmark) = “小说拆书” / “拆解结构与写法”
Send = “投稿中心” / “整理文稿与进度”.
These are secondary entry links, slightly quieter than recent works.

5. COMPACT TOOLS:
Heading “常用创作工具”, adjacent “推荐工具” selected and “我的收藏”, right “全部工具 →”.
Keep 8 compact tool cards in a 4-column 2-row grid as Image 1, but with less border/shadow emphasis. Exact original icons from Image 2, no replacements:
故事灵感发生器 = ochre Lightbulb
长篇大纲规划师 = blue ListTree (actual branching list geometry)
立体人物设计 = teal UsersRound (two people)
文字质感润色 = ochre WandSparkles
沉浸式剧情续写 = blue Feather, never game controller
人物对白打磨 = violet MessagesSquare
章节审稿助手 = violet ScanText
书名与简介灵感 = ochre Type letter T.
Retain original colored plates and outline style. Each card includes title, one readable short description, subtle “使用指南” and star favorite. Small tool icons are the only broad color variety, no photo banners.

6. SLIM FOOTER GUIDE:
A modest horizontal guide with original open-book icon “创作指南”, then “1 确定题材 → 2 搭建大纲 → 3 写好章节 → 4 准备投稿”, right “查看工作流 →”. Small footer links “创作设置 · 备份恢复 · 帮助”.
No tall empty bottom region.

COMMERCIAL QUALITY:
The screen must show a clear path from idea → seeing what the product delivers → starting a work → returning to a chapter, while leaving payment information understandable at the action point. Maintain readable text and generous but efficient spacing. Do not make every card equally prominent. Typography should be crisp modern Chinese sans-serif, dark and legible. Use existing icons literally from the supplied reference rather than designing new versions.
FORBIDDEN: video, models/providers, APIs, made-up rankings, income, sales popups, aggressive membership promotions, repeated New Work buttons, decorative mascots, new brand design, phone frame, explanatory annotations, unsupported precise costs or guarantees. Output only the finished app screen.
