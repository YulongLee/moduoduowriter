# SEO / GEO 执行清单

日期：2026-11-03。

| 顺序 | 类别 | 工作 | 状态与验证 |
| --- | --- | --- | --- |
| 1 | Strategic | 首屏与公开内容预渲染 | 已实现；同一内容向用户/爬虫输出，SSR/交互接管测试通过 |
| 2 | Quick win | metadata、canonical、OG/Twitter、品牌结构化信息 | 已实现；逐页唯一性、安全转义、CSP、分享图尺寸测试通过 |
| 3 | Strategic | 6 页功能、入门与产品说明，首页与相关内链 | 已实现；非空正文、单 H1、提示示例、所有链接/锚点测试通过 |
| 4 | Quick win | robots、7 URL sitemap、llms 两份摘要 | 已实现；MIME、URL 一致性和私有路径规则测试通过 |
| 5 | Quick win | 真 404、规范 308、私有 API 与 hash 页面 noindex | 已实现；生产 HTTP 和实际入口 DOM 测试通过 |
| 6 | Quick win | IndexNow 发现通知 | 已实现并一次提交；线上返回 202（校验待处理），不代表收录 |
| 7 | Maintenance | 上线后 HTTPS、全部页面、文件与服务隔离检查 | 已上线验收：7 页/发现文件/登录/私有边界通过，其他服务进程与配置保持不变 |
| 8 | Maintenance | 百度/Google/Bing 站长所有权与 sitemap 提交 | 需要运营方站长平台验证信息；不假定已有权限或收录 |
| 9 | Maintenance | CWV 与真实 AI 引荐监测 | PageSpeed API 本次限流；不编造性能、流量或 AI 引用结果 |

本地复验：`npm test`（包含构建、SEO/结构化数据/生产 HTTP/DOM 交互测试）。

搜索发现预演：`node scripts/submit-indexnow.mjs --dry-run`。正式通知：`npm run search:submit`，仅在公开校验文件和页面部署成功后执行；无自动重复推送。

后续监测流程见 `.seo/monitoring/README.md`。审计与证据见 `FULL-AUDIT-REPORT.md`。
