#!/bin/bash
# ============================================================
# 本地一键启动器（macOS 双击运行）· v0.7.68
# 双击本文件 → 自动准备环境 → 启动前后端 → 打开浏览器。
# 停止：回到这个终端窗口按 Ctrl+C（会同时停掉前后端）。
# ============================================================
set -e
cd "$(dirname "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

if ! command -v node >/dev/null 2>&1; then
  echo "❌ 没找到 Node.js。请先安装 Node（https://nodejs.org），装完再双击我。"
  read -r -p "按回车关闭..." _
  exit 1
fi

# 数据库原生组件必须匹配本机系统/Node 版本。测试环境曾把它编译成 Linux 版，
# 这里检测到加载失败就自动重编译回 macOS 版（首次约 1-2 分钟，之后秒过）。
if ! node -e "require('./server/node_modules/better-sqlite3')" >/dev/null 2>&1; then
  echo "🔧 首次准备：为这台 Mac 重新编译数据库组件（约 1-2 分钟）..."
  (cd server && npm rebuild better-sqlite3)
  echo "✅ 数据库组件就绪"
fi

cleanup() {
  echo ""
  echo "🛑 正在停止前后端..."
  kill "$SERVER_PID" "$CLIENT_PID" 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

echo "🚀 启动后端 (http://localhost:3001)..."
(cd server && npm run dev) &
SERVER_PID=$!
sleep 3

echo "🎨 启动前端 (http://localhost:5173)..."
(cd client && npm run dev) &
CLIENT_PID=$!
sleep 4

open "http://localhost:5173" 2>/dev/null || true
echo ""
echo "✅ 已启动！浏览器没自动打开的话，手动访问 http://localhost:5173"
echo "   默认管理员：admin / admin123（首次登录会要求改密码）"
echo "   停止服务：在本窗口按 Ctrl+C"
wait
