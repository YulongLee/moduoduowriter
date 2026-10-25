# 首页工具区重做 · v4

仅更新设计稿，网站代码未改。使用内置 imagegen 工具。

## 本次改动

- 工具名使用清楚的中文操作名称，不再将 AI、类别和推荐状态做成前台徽章。
- 八个工具由密集卡片改为两栏四行的开放列表，细分隔线组织内容。
- 工具外围去掉大色块；品牌标识、SVG 图形和图标颜色在正式实现时直接复用原文件。
- 小说、剧本、拆书、投稿改为一行简洁入口。
- 最近作品合并为单条三栏作品区域；输入选项减少为题材、篇幅和创作偏好。
- 示例默认收起，预览入口保留。
- 本稿继续采用中性灰白、近黑与墨绿；不继续更换色彩方向。

## 生成提示词

Use case: ui-mockup, substantial layout redesign.
Create ONE new high-fidelity desktop homepage design for the Chinese writing application 墨多多写作, revising Image 1. Image 2 contains the user's existing brand mark and SVG icons; these are invariant assets. The user strongly dislikes Image 1: too many ugly labels, tabs, colored tiles and boxed tool cards. The new design must look substantially more refined and editorial, with fewer containers and clearer typography. Do not make another variation of the same grid of tiny cards.

Output a full realistic application screenshot, flat front-facing, around 1800x1440, readable Chinese typography, no browser chrome, no outside design annotations. Main content maximum width about 1320px, centered with generous controlled gutters, no huge empty bottom region. Keep a 64px collapsed icon rail and slim white top header. Use neutral #F5F6F3 background, white #FFFFFF panels, near-black #222A26 text, legible muted #66716A text, matte deep forest-green #285B49 primary action, subtle #E0E5E0 lines. No gradients, colorful shadows or excessive green surfaces. The only decorative color is the user's existing tiny icon accent colors and the three small existing book covers.

BRAND AND ICONS MUST NOT BE REDESIGNED:
Use Image 2's near-black rounded-square open-book mark with small mint pen nib at upper right, same mark in sidebar and header. Existing sidebar icons in order: LayoutDashboard, FolderOpen, BookOpen, Clapperboard, BookMarked, Sparkles, Workflow, Clock3, Send, GraduationCap, Crown. Existing tool glyphs: Lightbulb, ListTree, UsersRound, WandSparkles, Feather, MessagesSquare, ScanText, Type. Preserve shapes, stroke style and glyph colors. Icons may be placed at an appropriate small size in the new layout, with no big colorful surrounding tile. No invented symbols, no game controller, no new logo.
Header wordmark 墨多多写作, breadcrumb 创作工作台, right search and notifications and same avatar from reference.

NEW PAGE COMPOSITION:
A. LEFT-ALIGNED HERO, closely connected to the composer below.
Main title exact “一句话生成爆款小说”, large but elegant ~44–46px, weight650, NOT enormous extra-black 900. “爆款小说” in forest green, other words near-black.
Below, a single understated clear line “输入一个故事灵感，从大纲、人物到开篇，一步开始创作”.
No huge centered promotional hero, no illustrated mascot.

B. CLEAN SINGLE COMPOSER, a beautiful generous white writing surface with one subtle outer border and 12px radius, WITHOUT a nested bordered textarea rectangle.
Inside top small plain label “故事灵感”.
Textarea region ~155px high, 20px readable placeholder “你想写一个怎样的故事？” and secondary line “例如：一位能听见旧物记忆的修复师，收到了一封来自明天的信……”. Character counter “0 / 500” discreet at lower-right.
One thin divider then ONE compact orderly horizontal control bar:
left plain labels and bare dropdowns “题材：悬疑⌄” | “篇幅：长篇小说⌄” | “创作偏好⌄”.
These are simple typographic controls, NOT a cloud of pills or chips. No row of 10 genre tags; no reader/gender/person controls exposed.
Right one primary solid matte forest-green button “开始生成小说 →”, 46px high.
Outside the panel directly below: left a quiet inline “试试：旧书店里，一封来自未来的信” link, plus refresh icon. Right a text link “查看生成示例 →”. Under the main action show small legible “生成前确认用量 · 失败退回预留额度”. Do not invent numeric costs or balances.

C. ONE ELEGANT CONTINUE-WRITING STRIP, no separate boxed work cards.
Heading “继续写作”, right link “全部作品 →”.
Below a SINGLE unified white horizontal surface, with three book items separated only by fine vertical dividers. Use the same three small covers and book titles from Image 1: 长街雾未散 (rainy old street), 等风也等你 (sunlit seaside), 第七次日落 (science-fiction planet). Covers about 58x84px. Each item has the title and one readable metadata line. The first has “上次编辑：雨夜来信” and a restrained outlined green “继续写作 →” action. Other two have simple small arrows. No statistics, timestamps, percentages, extra badges or repeated recent works.

D. FOUR MODE LINKS, NOT FOUR CARDS:
One simple unboxed horizontal row with a small section label “写作与出版”, then original small BookOpen + “小说写作”, Clapperboard + “剧本创作”, BookMarked + “小说拆书”, Send + “投稿中心”. Plenty of space, understated separators. No pastel tile, no colored card background, no subtitles per item, no arrows competing everywhere.

E. TOOLS REDESIGNED AS A PREMIUM TYPOGRAPHIC LIST:
Heading “写作工具”, 23–24px medium weight; right one quiet text link “查看全部 →”.
ABSOLUTELY NO “AI工具” badge, no “推荐工具” tab/pill, no “我的收藏” tab, no repeated category labels, no eight bordered cards. No visible repeated “使用指南” footer per item. No star beside every row. No thumbnail art.
Instead use TWO WIDE COLUMNS with FOUR ROWS each. Each row is a generous ~72px unboxed item with only a very light bottom separator. Original 24px outline icon at left; strong 17–18px simple Chinese tool name; below one muted but readable 14–15px purpose sentence. Discreet small arrow on the far right only if needed; not a button box. Preserve the actual source icon glyph for each function:
Left column:
Lightbulb “灵感构思” / “让一个念头，长成一个故事”
ListTree “大纲规划” / “理清主线，搭好故事骨架”
UsersRound “人物设定” / “写出有动机、有变化的角色”
Feather “剧情续写” / “承接上文，继续推动故事”
Right column:
WandSparkles “文字润色” / “保留文风，让表达更准确”
MessagesSquare “对白打磨” / “让每个角色有自己的声音”
ScanText “章节审稿” / “检查逻辑、节奏与衔接”
Type “书名与简介” / “写好故事与读者的第一次见面”
Use original icon colors at low area coverage, no new categories or filled illustrations. The tool names should feel like clear product commands, not promotional labels.

F. CALM FOOTER:
One small plain footer line “从灵感到成稿” followed by unboxed steps “确定题材 → 搭建大纲 → 写好章节 → 准备投稿”. Right “查看工作流 →”.
Below or same row small utility links “创作设置 · 备份恢复 · 帮助”. No numbered green circles, tour chips, big footer box, promotion or upsell.

QUALITY BAR:
Sophisticated real paid SaaS writing workbench. Strong visual hierarchy, comfortable legible type, careful 8px spacing, restrained boundaries and calm density. The eye should move naturally from headline to input to continuing a story to writing tools. Content should be aligned and balanced; avoid both sprawling empty width and crammed mini elements. Use editorial white space and typography rather than adding more backgrounds, chips, badges and nested cards.
Keep original icons intact. Simplify the chrome surrounding them.
Do not include video, provider/model names, APIs, rankings, fake revenue, testimonials, unsupported timing or credits, sale banners, a right-hand sidebar, decorative photos outside book covers, or external annotations.
Output only the finished homepage image.
