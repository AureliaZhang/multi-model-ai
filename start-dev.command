#!/bin/bash
# ============================================================
# 本地一键启动器（macOS 双击运行）· v0.7.70
# 双击本文件 → 自动准备环境 → 启动前后端 → 打开浏览器。
# 停止：回到这个终端窗口按 Ctrl+C（会同时停掉前后端）。
# 排查：所有后端日志都在 dev-logs/server.log，前端在 dev-logs/client.log。
# ============================================================
cd "$(dirname "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
mkdir -p dev-logs

fail() {
  echo ""
  echo "❌ $1"
  echo ""
  read -r -p "按回车关闭..." _
  exit 1
}

command -v node >/dev/null 2>&1 || fail "没找到 Node.js。请先安装 Node（https://nodejs.org），装完再双击我。"
echo "ℹ️  Node 版本：$(node -v)"

# 端口占用检查（上次没关干净的进程会挡路）
for PORT in 3001 5173; do
  PIDS=$(lsof -ti tcp:$PORT 2>/dev/null || true)
  if [ -n "$PIDS" ]; then
    echo "⚠️  端口 $PORT 被占用，正在停掉旧进程 ($PIDS)..."
    kill $PIDS 2>/dev/null || true
    sleep 1
  fi
done

# 数据库原生组件必须匹配本机系统/Node 版本。测试环境曾把它编译成 Linux 版。
# 注意：光 require 这个包是不够的（它到真正建库时才加载原生文件，所以 v2 的
# 探测在坏二进制下也会“通过”）。这里改成两道真检查：
#   1) 看二进制文件本身是不是 macOS (Mach-O) 格式；
#   2) 真的开一个内存数据库试试。
SQLITE_BIN="server/node_modules/better-sqlite3/build/Release/better_sqlite3.node"
sqlite_ok() {
  if [ -f "$SQLITE_BIN" ] && ! file "$SQLITE_BIN" 2>/dev/null | grep -q "Mach-O"; then
    return 1  # 二进制是别的系统（Linux）的，必须重编译
  fi
  (cd server && node -e "new (require('better-sqlite3'))(':memory:')") >/dev/null 2>&1
}
if ! sqlite_ok; then
  xcode-select -p >/dev/null 2>&1 || fail "需要先安装 Xcode 命令行工具才能编译：请在终端运行  xcode-select --install  ，装完（可能要几分钟）再双击我。"
  echo "🔧 首次准备：为这台 Mac 重新编译数据库组件（约 1-3 分钟，请稍候，别关窗口）..."
  : > dev-logs/rebuild.log
  (cd server && npm rebuild better-sqlite3) >> dev-logs/rebuild.log 2>&1 \
    || { echo "──────── 编译日志（最后 25 行）────────"; tail -n 25 dev-logs/rebuild.log; \
         fail "数据库组件编译失败——上面就是详细报错，截图发给 Claude。"; }
  if ! sqlite_ok; then
    echo "──────── 编译日志（最后 25 行）────────"
    tail -n 25 dev-logs/rebuild.log
    fail "编译完成但仍无法加载。兜底办法：在终端运行  cd \"$(pwd)/server\" && rm -rf node_modules && npm install  ，跑完再双击我；不行就把上面截图发给 Claude。"
  fi
  echo "✅ 数据库组件就绪（已编译为本机 macOS 版本）"
fi

cleanup() {
  echo ""
  echo "🛑 正在停止前后端..."
  kill "$SERVER_PID" "$CLIENT_PID" 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

echo "🚀 启动后端 (http://localhost:3001)，日志 → dev-logs/server.log ..."
(cd server && npm run dev) >> dev-logs/server.log 2>&1 &
SERVER_PID=$!

# 体检：最多等 30 秒，直到后端 /api/health 有响应
echo -n "   等待后端就绪"
UP=0
for _ in $(seq 1 30); do
  if curl -s -o /dev/null --max-time 1 http://localhost:3001/api/health; then UP=1; break; fi
  # 进程已经死了就不用再等了
  kill -0 "$SERVER_PID" 2>/dev/null || break
  echo -n "."
  sleep 1
done
echo ""
if [ "$UP" != "1" ]; then
  echo "──────── 后端日志（最后 30 行）────────"
  tail -n 30 dev-logs/server.log
  echo "──────────────────────────────────────"
  fail "后端没起来。上面就是真正的报错，把这段截图发给 Claude 就能修。"
fi
echo "✅ 后端就绪"

echo "🎨 启动前端 (http://localhost:5173)，日志 → dev-logs/client.log ..."
(cd client && npm run dev) >> dev-logs/client.log 2>&1 &
CLIENT_PID=$!
sleep 4

open "http://localhost:5173" 2>/dev/null || true
echo ""
echo "✅ 全部启动！浏览器没自动打开的话，手动访问 http://localhost:5173"
echo "   默认管理员：admin / admin123（首次登录会要求改密码）"
echo "   停止服务：在本窗口按 Ctrl+C"
wait
