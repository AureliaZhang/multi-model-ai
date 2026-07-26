#!/bin/bash
# ============================================================
# multi-model-ai 一键部署/更新脚本 · v0.7.81
# 在 Oracle 小鸡上运行：  bash ~/multi-model-ai/deploy.sh
#
# 首次运行：自动生成密钥（存在 ~/.multi-model-ai.env，不进 git，
#           以后更新永不覆盖）、装 pm2、启动服务。
# 日常更新：拉代码 → 装依赖 → 编译 → 重启。GitHub Actions push 后
#           会自动来跑这个脚本，手动跑效果完全一样。
# 端口/域名想改：编辑 ~/.multi-model-ai.env 后重跑本脚本。
# ============================================================
set -euo pipefail

APP_NAME="multi-model-ai"
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$HOME/.multi-model-ai.env"
DEFAULT_PORT=8500                       # 在 Oracle 放行的 8000-9000 范围内
DEFAULT_DOMAIN="https://official.aureliazhsy.com"

echo "📦 multi-model-ai 部署/更新 · $(date '+%F %T')"

command -v node >/dev/null 2>&1 || {
  echo "❌ 这台机器还没有 Node.js。先运行下面两行再重试："
  echo "   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -"
  echo "   sudo apt-get install -y nodejs build-essential python3"
  exit 1
}
echo "ℹ️  Node $(node -v)"

# ---- 首次部署：生成密钥文件（chmod 600，永不覆盖已有文件）----
if [ ! -f "$ENV_FILE" ]; then
  echo "🔑 首次部署：生成密钥 → $ENV_FILE"
  cat > "$ENV_FILE" <<ENVEOF
# multi-model-ai 生产环境配置（此文件不在 git 里，删除会导致已加密的 API key 无法解密！）
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
PORT=$DEFAULT_PORT
CORS_ORIGIN=$DEFAULT_DOMAIN
NODE_ENV=production
# REQUIRE_INVITE=1   # 开启邀请制注册：去掉行首的 # 再重跑本脚本
ENVEOF
  chmod 600 "$ENV_FILE"
fi
set -a
. "$ENV_FILE"
set +a

cd "$APP_DIR"
echo "⬇️  拉取最新代码..."
git pull --ff-only

echo "🔧 后端：依赖 + 编译..."
cd "$APP_DIR/server"
npm ci --no-audit --no-fund
npx tsc

echo "🎨 前端：依赖 + 构建..."
cd "$APP_DIR/client"
npm ci --no-audit --no-fund
npm run build

command -v pm2 >/dev/null 2>&1 || {
  echo "📥 安装 pm2（进程守护，让服务常驻+开机自启）..."
  sudo npm i -g pm2 || npm i -g pm2
}

echo "🚀 启动/重启服务（端口 $PORT）..."
cd "$APP_DIR/server"
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 restart "$APP_NAME" --update-env
else
  pm2 start dist/index.js --name "$APP_NAME"
  pm2 save
  echo "ℹ️  想要开机自启的话，运行一次:  pm2 startup  （然后照它打印的 sudo 命令执行）"
fi
pm2 save >/dev/null 2>&1 || true

echo ""
echo "✅ 部署完成！访问 $CORS_ORIGIN（服务器本机端口 $PORT）"
echo "   查看运行日志:  pm2 logs $APP_NAME --lines 50"
