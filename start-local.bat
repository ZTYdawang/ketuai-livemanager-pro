@echo off
echo ========================================
echo Ketu Live Score 本地开发环境启动脚本
echo ========================================

echo.
echo 1. 测试数据库连接...
cd backend
call npm run test-db

echo.
echo 2. 启动后端服务器...
start "Ketu Backend" cmd /k "npm run dev"

echo.
echo 3. 等待后端启动完成...
timeout /t 3 /nobreak > nul

echo.
echo 4. 启动前端开发服务器...
cd ..\frontend
start "Ketu Frontend" cmd /k "npm run dev"

echo.
echo ========================================
echo 本地开发环境启动完成！
echo 后端: http://localhost:5555
echo 前端: http://localhost:5173
echo 测试账户: admin@163.com / password
echo ========================================
pause 