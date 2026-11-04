# 墨多多首页：参考图落地

日期：2026-11-04。根据用户提供的首页图实现为真实网页，保留原品牌图标、产品名称「墨多多」与副标「写作」。

本文件记录此前的左对齐参考。用户后来明确指定新的居中山水参考图 `9ddc69de`；最新结构与素材以 `design/centered-home-reference-2026-11-04.md` 为准，后续不要把该新版恢复为本文件的左对齐布局。

## 页面结构

- 五项顶部导航：首页、创作工具、灵感广场、作品示例、创作方案。
- 左对齐宋体大标题、原创山水画与墨绿主按钮；明亮纸白背景，正文保持深色。
- 悬浮对话输入框：参考资料、灵感模板、任务模式、发送；5个建议仅填草稿。
- 六个功能入口与创作工作台界面示意；三种实际创作场景；4个明确标记的原创预写故事。
- 可公开浏览的演示弹窗（大纲/人物/开篇tabs），以及诚实说明当前演示状态的创作方案弹窗。
- 保留完整工具、FAQ、真实创作入口、14页SEO链接与备案号。

真实生成与私有资料仍须登录且显式触发；不会因浏览、模式切换、查看演示或选择示例而自动生成、计费、读取私人作品。演示不是视频，不展示虚构作者收益、用户数字或未实现的富文本功能。

## 视觉素材

最终项目文件：`public/art/hero-shanshui-v1.webp`，1942×809，76,510字节。
使用内置 image_gen 生成，输入截图仅作构图/风格参考，不将网页文字、按钮或界面烘焙进图片。保留生成的原始PNG；项目副本仅进行WebP编码，未改变画面内容。原品牌图标未替换。

最终生成提示词：

> Use case: stylized-concept. Asset type: a single wide ORIGINAL Chinese fantasy landscape website hero background, not a screenshot or UI mockup. Input image is a composition/style reference only: use ONLY the pale watercolor mountain scenery of its top hero, ignore ALL webpage elements and text. Generate artwork only, no typography, no logo, no watermark, no buttons, no interface, no boxes. Very wide panoramic composition approximately 2400x1000. LEFT 45% is nearly blank warm ivory paper (#faf9f7), gently misty with barely visible distant mountains very low on the left; this area must remain bright and quiet for dark website headings. RIGHT 55% detailed elegant Chinese shan-shui watercolor and subtle cinematic illustration: layered slate-blue grey peaks in white cloud, distant Chinese pagodas embedded in cliff mountains toward far right, a warm pale apricot sun behind the peak upper right-center. A small lone robed traveler with flowing dark cloak standing on a rocky promontory at right 74%, looking out over the mountains. Organic painterly details in rock and sparse gold bamboo/grass at lower-right. Soft morning light, refined commercial novel-writing brand, serene and spacious, no high-saturation green, no cartoon, no heavy black ink texture. BOTTOM 25% softly fades seamlessly into clean warm-white mist to place a white composer over it, not a hard image edge. Keep scenery concentrated to right so landscape never interferes with left-side text. Faithfully match the reference hero's restrained palette, atmospheric depth and spatial balance, create new illustration rather than whole webpage.

## 验收

- Chrome真实桌面页面与390×844响应式界面目测；修正旧CSS覆盖、新图标发送按钮的辅助文字、手机标题断行和手机演示内容顺序。
- 产品演示在手机上直接显示内容标签，避免编辑器缩略图占满弹窗；桌面展示工作台示意。
- 完整 npm test 通过；新增模式、5建议、6功能、3场景、4案例与公开演示/方案测试，原登录延迟、账号隔离、禁止自动生成及私有缓存边界测试保留。
- 14个公开页面、20词映射、SSR/交互接管、canonical、CSP、站点地图测试通过。

## 正式环境验收

已部署到 https://moduoduowriter.com/ ，运行版本 `c88858cc798ce61b8210431f497f9a03dfc2578b`。

- 线上14页均200，HTML及首页所引CSS/JS/图片与本地构建逐字节一致；首页6功能/3场景/4案例数量核验通过。
- 正式官网已通过Chrome原生浏览器目测，桌面山水背景、字体、输入框与工作台示意正常显示。
- canonical、CSP及发现文件一致；手机号/邮箱方式可用，匿名私有数据请求401。
- 所有其他服务均运行中，进程及Nginx配置未改变，墨多多账号数据校验值未改变。未向用户发送短信/邮件或调用真实生成。
- 未修改其他服务配置；本次仅更新墨多多自身版本，原版本与专属备份可用于回退。

机器可读验收记录：`design/homepage-reference-release-2026-11-04.json`。没有以视觉验收替代真实的流量或CWV数据。
