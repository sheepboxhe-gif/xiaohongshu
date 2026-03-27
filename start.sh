#!/bin/bash

echo "🍠 启动小红薯实时互动社区..."

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误：未检测到 Node.js，请先安装 Node.js 16+"
    exit 1
fi

# 检查 node_modules
if [ ! -d "node_modules" ]; then
    echo "📦 首次启动，正在安装依赖..."
    npm install
fi

# 创建日志目录
mkdir -p logs

# 启动服务器
echo "🚀 启动服务器..."
echo "访问地址: http://localhost:3000"
echo "管理员密码: admin123"
echo ""

node server.js
