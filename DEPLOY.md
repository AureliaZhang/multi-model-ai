# 测试服务器部署手册（Oracle 小鸡 + Cloudflare + Nginx Proxy Manager）

> 给未来忘记怎么弄的自己 😊 一次性配置做完之后，日常更新是全自动的：
> **在 Claude Code 里 push → 一两分钟后 https://official.aureliazhsy.com 自动变新版，什么都不用做。**

约定：子域名 `official.aureliazhsy.com`，应用端口 `8500`（在 Oracle 放行的 8000-9000 范围内），
服务器代码目录 `~/multi-model-ai`。想改端口/域名：部署一次后编辑 `~/.multi-model-ai.env` 再重跑 `deploy.sh`。

---

## 一次性配置（做一遍就再也不用管）

### 第 1 步 · Cloudflare 加 DNS（1 分钟）

dash.cloudflare.com → aureliazhsy.com → DNS → Add record：

- Type `A`，Name `official`，Content `167.234.208.190`，Proxy 开着（橙色云）

### 第 2 步 · 服务器初始化（SSH 进小鸡逐条执行）

```bash
ssh ubuntu@167.234.208.190        # Oracle Linux 系统的话用户名是 opc

# 2.1 装 Node 22（已有 v20+ 可跳过，node -v 查看）
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs build-essential python3

# 2.2 给这台机器生成一把 SSH 钥匙（后面 GitHub 拉代码 + 自动部署都用它）
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N "" -q
cat ~/.ssh/id_ed25519.pub          # ← 复制打印出来的这行「公钥」
```

### 第 3 步 · GitHub 两处配置（浏览器操作）

仓库：github.com/AureliaZhang/multi-model-ai-private

1. **让小鸡有权拉代码**：仓库 → Settings → Deploy keys → Add deploy key
   - Title 随意（如 `oracle-vm`），Key 粘贴上一步复制的**公钥**，不勾 write access。
2. **让 GitHub 有权登录小鸡**：仓库 → Settings → Secrets and variables → Actions → New repository secret，共建 3 个：
   - `VM_HOST` = `167.234.208.190`
   - `VM_USER` = `ubuntu`（或 `opc`）
   - `VM_SSH_KEY` = 小鸡上 `cat ~/.ssh/id_ed25519` 打印的**私钥全文**（含首尾 BEGIN/END 行）

### 第 4 步 · 首次部署（回到小鸡的 SSH 窗口）

```bash
git clone git@github.com:AureliaZhang/multi-model-ai-private.git ~/multi-model-ai
bash ~/multi-model-ai/deploy.sh
```

首次运行会自动：生成 JWT/加密密钥 + **随机的首任管理员密码**（都存在 `~/.multi-model-ai.env`，
终端也会打印一次，记下来！）、装依赖、编译前后端、装 pm2 并启动。
结尾提示运行 `pm2 startup` 的话照做一次（开机自启）。

### 第 5 步 · Nginx Proxy Manager 加代理（照抄现有条目的做法）

NPM（167.234.208.190:81）→ Hosts → Add Proxy Host：

- Domain Names：`official.aureliazhsy.com`
- Forward Hostname / IP：`172.17.0.1`，Port：`8500`（和 st./stock. 同款写法）
- ⚠️ **勾上 Websockets Support**（群聊实时消息必需！）
- SSL 标签页：选现有的那张 Custom Certificate

### 第 6 步 · 验收

浏览器打开 `https://official.aureliazhsy.com`：

1. 用 admin + 部署时打印的管理员密码登录（生产模式没有 admin123——系统拒绝默认弱密码；
   密码忘了就在小鸡上 `cat ~/.multi-model-ai.env` 看 ADMIN_PASSWORD）
2. 设置里配置中转站、联网搜索 key；记忆库设置里配 embedding API
3. 邀请同事前：编辑 `~/.multi-model-ai.env` 把 `# REQUIRE_INVITE=1` 行首的 `#` 去掉，
   重跑 `bash ~/multi-model-ai/deploy.sh`（注册从此需要邀请码，在用户管理里生成）

---

## 日常使用

- **更新**：Claude Code 里 push 即可，GitHub Actions 自动部署（仓库 Actions 页可看进度/日志）。
- **手动更新**（Actions 抽风时的备用）：`ssh` 进小鸡 → `bash ~/multi-model-ai/deploy.sh`
- **看运行日志**：`pm2 logs multi-model-ai --lines 50`
- **重启**：`pm2 restart multi-model-ai`
- **数据在哪**：`~/multi-model-ai/server/data/`（数据库 + 上传文件 + 每日自动备份，更新不会动它们）

## 排障速查

| 症状 | 先看什么 |
| --- | --- |
| 网页打不开 | `pm2 logs multi-model-ai` 有没有报错；NPM 里该条目是否 Online |
| Actions 部署失败 | 仓库 Actions 页点开红叉看日志（多半是 3 个 Secret 没配对） |
| 群聊消息不实时 | NPM 该条目的 Websockets Support 是否勾上 |
| 改了端口/域名 | 编辑 `~/.multi-model-ai.env` → 重跑 deploy.sh → NPM 里同步改 Forward Port |
| 密钥文件误删 | 已加密的中转站/搜索 key 解不开：重新生成后去设置页重填一遍各个 API key |
| pm2 显示 errored 反复重启 | `pm2 logs multi-model-ai --err --lines 25 --nostream` 看真实报错；常见：env 文件缺 ADMIN_PASSWORD（补上后按下方"手动重启带环境"三连） |
| 改了 env 文件后怎么生效 | `cd ~/multi-model-ai/server && set -a && . ~/.multi-model-ai.env && set +a && pm2 delete multi-model-ai && pm2 start dist/index.js --name multi-model-ai && pm2 save` |
