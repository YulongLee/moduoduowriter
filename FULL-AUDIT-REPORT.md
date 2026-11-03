# 墨多多 SEO / GEO 审计与实施记录

## A. 审计摘要

范围：`full-site`，审计官网 https://moduoduowriter.com/ 与本次新增的 6 个公开产品说明页。日期：2026-11-03。技术基线已在生产构建及隔离 HTTP/DOM 环境验证；正式环境验收记录在上线后补充。本报告不以技术检查分数推断流量、排名、收录或 AI 引用。

修改前的主要问题是首屏 HTML 仅包含空的应用挂载点、没有站点地图，以及缺少规范地址和结构化产品信息。本次将实际公共页面预渲染为完整 HTML，补充 6 个独立说明页及相互链接，并保留账号文稿与后台的访问边界。

主要机会：让公开内容无需脚本即可读取；围绕真实写作任务提供有信息量的说明；通过标准搜索发现与结构化品牌信息减少理解歧义。

## B. 已验证发现

| 领域 | 严重度 | 置信度 | 证据与影响 | 处理 |
| --- | --- | --- | --- | --- |
| 初始页面 | Warning → 已修复 | Confirmed | 修改前 `home-before.json` 中 `h1=[]`、无正文内链。依赖客户端渲染增加抓取成本，不能由此断言 Google 无法收录 | 7 个公开页面输出相同的真实可见 React HTML，无机器人专用内容 |
| 发现入口 | Warning → 已修复 | Confirmed | robots、sitemap、llms 两文件原为 404 | sitemap 仅列 7 个规范公开 URL；robots 允许公开抓取并限制私有路径 |
| 页面信息 | Warning → 已修复 | Confirmed | 原 canonical=null，OG/Twitter/schema 为空 | 每页独立标题、描述、自引用 canonical、社交分享与 JSON-LD |
| 内容结构 | Warning → 已修复 | Confirmed | 原官网缺少可抓取的独立功能说明 | 新增写作、大纲、人物、润色、入门和品牌页，含方法、原创提示示例、FAQ、相关链接 |
| 错误路由 | Warning → 已修复 | Confirmed | 原 HTTP 服务对不存在的无扩展名 HTML 地址回退为首页 200 | 真正的 404、noindex、统一末尾斜杠和 index.html 重定向 |
| 私有边界 | Pass | Confirmed | 隔离测试覆盖未登录 API、私有 hash 页面 noindex、公开渲染无用户作品、密钥或模型名称 | 账号鉴权继续负责保护内容；robots/noindex 不代替访问控制 |
| 结构化数据 | Pass | Confirmed | JSON-LD 解析、注入防护与逐页 CSP 哈希测试通过 | Organization / WebSite / WebApplication / WebPage / AboutPage / BreadcrumbList；无虚构评分、价格和不适用的 FAQ/HowTo 标记 |
| 交互接管 | Pass | Confirmed | 内存 DOM 加载实际入口：保留初始节点与 useId，无 hydration 警告；手机号登录和私有页切换通过 | 公共首页预渲染与交互共用组件 |
| 性能 | Info | Confirmed | Google PageSpeed API 限流；报告中 performance_score=null，无有效 CrUX 字段 | 未编造 CWV 或性能分；当前应用脚本仍可继续按业务模块拆分 |
| 收录与引用 | Info | Confirmed | 未连接站长平台或 AI 引荐分析数据 | 不宣称已收录、排名提升或获得 AI 引用 |

原始证据：`.seo/baseline/home-before.html`、`home-before.json`、`findings.json`、`verified-findings.json`。`finding_verifier.py` 已去重校验；其作用是核对证据一致性，不是搜索引擎排名认证。

## C. 公开内容与搜索意图

| 规范路径 | 对应需求 |
| --- | --- |
| `/` | 墨多多、AI 小说创作与内容编辑 |
| `/features/ai-novel-writing/` | AI 小说写作的步骤、提示与作者审稿 |
| `/features/novel-outline/` | 小说梗概、大纲与章节计划怎么写 |
| `/features/character-design/` | 人物动机、人物关系与成长弧线 |
| `/features/text-polish/` | 小说文字润色、对话与正文修改 |
| `/guides/getting-started/` | 登录、创作、确认采用与 TXT 文稿管理 |
| `/about/` | 产品定位、品牌身份及当前服务边界 |

这些是业务意图映射，未声称有经工具测得的搜索量。说明页署名为「墨多多产品说明」，明确更新日期，不虚构专家履历、用户案例或研究统计。

## D. GEO 的具体处理与边界

- 用完整 HTML、短段落、明确问题、操作清单和原创提示示例提供可独立理解的内容。
- 品牌「墨多多」、副标「写作」、官网、原图标与功能名称在网页、结构化数据和摘要中保持一致。
- `llms.txt` 与 `llms-full.txt` 是补充阅读入口；它们不是主流搜索引擎统一要求的收录标准，不保证被读取或引用。
- 搜索与训练爬虫用途不同。本次未擅自新增训练授权政策；公开页面继承通配规则，私有 API 仍须鉴权。
- IndexNow 只提交这 7 个公开规范地址，公开校验文件不包含账户凭证。协议成功响应只表示通知已收到或校验待处理。
- 手机号/邮箱登录可用、微信暂缓、会员墨点为演示、示例为预写内容、无视频服务；公开内容不披露模型厂商或账号资料。

## E. 后续需要的数据

1. 验证百度搜索资源平台、Google Search Console、Bing Webmaster Tools 的站点所有权，提交 `https://moduoduowriter.com/sitemap.xml`，查看 URL 检查与实际收录。
2. API 配额恢复后测量 PageSpeed；真实 CWV 还需足够的用户现场数据。内存 DOM 测试不代替真实浏览器的视觉/性能验收。
3. 持续更新与产品一致的示例与教程，收集经授权的真实用户反馈；当前没有流量基线，无法给出可信增长百分比。
4. 不虚构公司名称、客服资料、第三方背书或法律页面。后续应由运营方提供正式主体与支持渠道，再补充对应公开信息。

## 官方依据

- [Google：AI 搜索功能与网站](https://developers.google.com/search/docs/appearance/ai-features)：沿用可抓取、可索引与有用内容等 SEO 基础，无额外专用标记要求。
- [Google：站点名称](https://developers.google.com/search/docs/appearance/site-names)、[组织结构化数据](https://developers.google.com/search/docs/appearance/structured-data/organization)。
- [OpenAI 爬虫说明](https://developers.openai.com/api/docs/bots)、[Anthropic 爬虫说明](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler)。
- [Bing 站点地图](https://www.bing.com/webmasters/help/sitemaps-3b5cf6ed)、[IndexNow 协议与响应含义](https://www.indexnow.org/documentation)。
