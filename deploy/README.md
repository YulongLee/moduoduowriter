# 墨多多生产部署

此目录提供独立的 Node HTTP 服务、域名站点、证书续期和版本切换资产。部署只操作墨多多自己的目录、服务和 Nginx 站点；现有 PaperKnow、OneShowLearn 等服务继续运行。

## 固定边界

| 用途 | 位置 |
| --- | --- |
| 专属运行用户 | `moduoduo`，无登录 shell |
| 版本目录 | `/opt/moduoduowriter/releases/<Git提交号>` |
| 当前版本 | `/opt/moduoduowriter/current`，原子切换软链接 |
| 独立 Node 24 | `/opt/moduoduowriter/runtime/node/bin/node` |
| 业务数据与配置 | `/var/lib/moduoduowriter`，`moduoduo:moduoduo`，0700 |
| 切换前数据快照 | `/var/backups/moduoduowriter`，root 专用，0700 |
| 进程配置 | `/etc/moduoduowriter.env`，root:root，0600 |
| 后端监听 | `127.0.0.1:18731`，不开放公网后端端口 |
| ACME 公开验证文件 | `/var/www/moduoduowriter-acme`，root:root，0755 |
| 独立证书目录 | `/etc/moduoduowriter/letsencrypt` |
| 证书临时目录 | `/var/lib/moduoduowriter-certbot`，root 专用 |
| 证书日志 | `/var/log/moduoduowriter-certbot`，root 专用 |
| 应用服务 | `moduoduowriter.service` |
| 专属 Nginx 配置 | `/etc/nginx/sites-available/moduoduowriter.conf`，同名 enabled 软链 |

Node 二进制独立安装于上述目录，不替换系统 Node、不修改其他服务的 PATH。版本制品包含 `dist/`、`server/`、运行所需 `src/*.js`、`package.json`、锁文件、此部署目录及由锁文件安装的生产依赖；不包含开发机 `.local`、`.env`、SSH 私钥、Git 目录或其他项目数据。发布目录应由 root 持有，应用用户只读，数据存放在版本目录之外。

应用通过 `server/http.mjs` 提供构建后的静态页面与 API，不使用 Vite 开发服务器或 `vite preview` 对外运行。生产入口固定只监听 IPv4 loopback，强制已初始化账号才能访问私人 API。管理员通过本地维护脚本从标准输入初始化，密码不写入代码、命令参数或站点配置。

## 首次部署顺序

1. 记录现有站点和服务状态，确认 18731 端口空闲；不停止或改写现有服务。
2. 创建专属用户及上表目录，安装经过官方校验的独立 Node 24，把经过测试、构建并提交到 Git 的代码放入提交号目录。运行该 Node 自带的 npm 安装锁定的生产依赖，不对其他应用执行 npm 操作。
3. 将 `moduoduowriter.env.example` 复制为 `/etc/moduoduowriter.env`，保持 0600。它只包含运行参数；模型、OSS、登录服务密钥按项目原约定保存在专属数据目录内，不放入 Git 或前端构建。
4. 在首次公开访问前初始化管理员。若需要迁移账号，必须同时迁移原 `studio.sqlite` 和 `auth-pepper`；原 JSON/OSS 文稿导出不包含账号，不能代替账号数据库。不要把开发机全部资料打包上传。新服务器数据目录及文件应归 `moduoduo`，目录 0700、私密文件 0600。
5. 将 `moduoduowriter.service` 安装到 `/etc/systemd/system/`，执行 `systemctl daemon-reload`。只启用并启动 `moduoduowriter.service`，使用下文健康检查确认后端和管理员初始化。
6. 先把 `nginx-http.conf` 安装到专属站点文件并链接 enabled。此阶段域名只提供 ACME 验证及 503 维护响应，不通过明文 HTTP 提供登录。运行 `nginx -t` 成功后执行 `systemctl reload nginx`，不重启 Nginx，不改默认站点或其他站点文件。
7. 解析与接入条件就绪后，以 webroot 模式仅为此站点申请证书。使用独立的证书、临时、日志目录，避免 Certbot 自动改写其他 Nginx 站点：

   ```sh
   sudo certbot certonly --webroot \
     --webroot-path /var/www/moduoduowriter-acme \
     --config-dir /etc/moduoduowriter/letsencrypt \
     --work-dir /var/lib/moduoduowriter-certbot \
     --logs-dir /var/log/moduoduowriter-certbot \
     --cert-name moduoduowriter.com \
     -d moduoduowriter.com -d www.moduoduowriter.com
   ```

   首次申请按 Certbot 提示填写有效运维邮箱并确认条款。不要使用 Nginx 自动安装模式，不改变其他证书的续期配置。若 DNS 或接入条件尚未就绪，保留维护站点和已验证的后台，不声称 HTTPS 已上线。

8. 证书成功签发后，以 `nginx-https.conf` 替换同一个专属站点文件。两个模板不能同时启用，它们定义了同名日志格式。再次先 `nginx -t`，再 `systemctl reload nginx`；失败时恢复该站点上一份文件，不修改其他站点。
9. 只有独立证书已成功签发后，安装并启用 `moduoduowriter-certificate-renew.service` 与 `.timer`。它仅管理独立证书目录，续期成功才运行 `reload-nginx-after-certificate.sh`；钩子先验证配置，再平滑 reload Nginx。应用进程不重启。
10. 复核 HTTPS、主站和 www 跳转、登录、备案信息、私人 API 权限、外部来源拒绝及其他原有服务的状态。微信、短信和邮箱登录仍需各自申请并明确启用。

实际切换域名之前，应核对域名已按实际接入商完成备案接入。DNS 解析不替代应用部署或接入备案。当前域名与别名应指向该服务器，主站为 `https://moduoduowriter.com`，www 的 HTTPS 入口跳转到主站。

## 配置约定

环境示例固定端口与正式来源：

```ini
NODE_ENV=production
PORT=18731
MDD_DATA_DIR=/var/lib/moduoduowriter
MDD_PUBLIC_ORIGIN=https://moduoduowriter.com
MDD_TRUST_LOOPBACK_PROXY=1
```

`MDD_TRUST_LOOPBACK_PROXY` 只能在后端固定 loopback、Nginx 直接转发的部署中启用。模板把 `X-Real-IP` 和 `X-Forwarded-For` 覆盖为 Nginx 观察到的来源地址；不信任公网调用者提交的转发链。应用继续校验实际 Host、Origin、登录身份及空间标头。未来增加 CDN 或其他代理时，需要重新设计可信代理链，不能直接放开任意转发头。

系统服务 CPU 上限为单核的 80%，内存高水位 512MB、硬上限 768MB，最多 128 个线程/任务；独立数据目录是应用唯一系统写入例外。没有配置阻止 Node JIT 的 `MemoryDenyWriteExecute`。停止宽限 110 秒，以便当前最长 90 秒生成请求及 HTTP 服务 100 秒优雅退出完成。限额限制这一个服务，不修改服务器全局参数。

Nginx 访问日志使用专属格式，只记录路径 `$uri`，不包含 OAuth 授权码所在的查询参数、Cookie、认证头和请求正文。HTTP 先保持验证/维护站点，TLS 配置就绪后才启用反向代理；TLS 最低 1.2，HSTS 初始仅主站一周，不对未知子域名加策略。

## 后续版本切换与回滚

先完成测试、构建和 Git 提交，再把新的不可变版本放入 `/opt/moduoduowriter/releases/<提交号>`，安装其生产依赖；不要覆盖正在运行的目录。

```sh
sudo bash /opt/moduoduowriter/releases/<提交号>/deploy/activate-release.sh <提交号>
```

脚本只停止墨多多自己的进程，创建一致性的 SQLite 及账号安全配置快照，原子切换 current，并启动这个服务。它串行锁定同一个应用的发布操作，检查健康接口与管理员初始化；失败时恢复原软链和墨多多服务。它不操作 Nginx、其他应用或全局 Node，不自动删除旧版本。每次发布的数据快照保存在 root 专用的 `/var/backups/moduoduowriter`，需要按实际空间手动规划保留周期。

恢复上一版代码：

```sh
sudo bash /opt/moduoduowriter/current/deploy/rollback.sh
```

也可为 rollback 指定明确的旧提交号。回滚脚本只切换代码并重启墨多多，不自动恢复数据库，不覆盖用户发布后写入的文稿。若版本包含不兼容的数据库迁移，应先准备对应的数据恢复方案，必要时在停止这个应用后由维护者明确恢复快照及配套 `auth-pepper`。自动健康失败回滚不是数据库降级工具。

## 核验命令

```sh
sudo systemctl status moduoduowriter.service --no-pager
curl --fail -H 'Host: moduoduowriter.com' http://127.0.0.1:18731/healthz
curl --fail -H 'Host: moduoduowriter.com' http://127.0.0.1:18731/api/auth/status
sudo nginx -t
curl --fail --resolve moduoduowriter.com:443:127.0.0.1 https://moduoduowriter.com/
curl --head --resolve www.moduoduowriter.com:443:127.0.0.1 https://www.moduoduowriter.com/
sudo systemctl list-timers moduoduowriter-certificate-renew.timer --no-pager
```

日志仅查看本服务的 `journalctl -u moduoduowriter.service` 及专属 Nginx 日志。排错时不要输出环境文件、模型/OSS/登录密钥或用户文稿。验证完成后再次核对部署前记录的其他服务；健康探测不能代替真实 HTTPS、登录和权限验收。
