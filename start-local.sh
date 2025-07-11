#!/bin/bash

echo "========================================"
echo "Ketu Live Score 本地开发环境启动脚本"
echo "========================================"

echo
echo "1. 测试数据库连接..."
cd backend
npm run test-db

echo
echo "2. 启动后端服务器..."
npm run dev &
BACKEND_PID=$!

echo
echo "3. 等待后端启动完成..."
sleep 3

echo
echo "4. 启动前端开发服务器..."
cd ../frontend
npm run dev &
FRONTEND_PID=$!

echo
echo "========================================"
echo "本地开发环境启动完成！"
echo "后端: http://localhost:5555"
echo "前端: http://localhost:5173"
echo "测试账户: admin@163.com / password"
echo "========================================"
echo
echo "按 Ctrl+C 停止所有服务"

# 等待用户中断
trap 'kill $BACKEND_PID $FRONTEND_PID; exit' INT
wait 