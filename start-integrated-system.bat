@echo off
chcp 65001 >nul
echo.
echo ================================================================
echo               Ketu Live Score 集成系统启动器
echo                直播间管理 + 智能爬虫监控系统
echo ================================================================
echo.

:: 检查Node.js环境
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 未检测到Node.js环境，请先安装Node.js
    pause
    exit /b 1
)

echo ✅ Node.js环境检查通过

:: 检查npm环境
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 未检测到npm环境
    pause
    exit /b 1
)

echo ✅ npm环境检查通过
echo.

:: 启动后端服务
echo 🚀 正在启动后端服务...
echo.
start "后端服务 - Ketu Live Score Backend" cmd /k "cd /d backend && echo 🔧 安装后端依赖... && npm install && echo 🚀 启动后端服务... && npm run dev"

:: 等待几秒让后端启动
timeout /t 5 /nobreak >nul

:: 启动前端服务
echo 🎨 正在启动前端服务...
echo.
start "前端服务 - Ketu Live Score Frontend" cmd /k "cd /d frontend && echo 🔧 安装前端依赖... && npm install && echo 🚀 启动前端服务... && npm run dev"

echo.
echo ================================================================
echo                      🎉 系统启动完成！
echo ================================================================
echo.
echo 📱 前端访问地址: http://localhost:5173 (或显示的其他端口)
echo 🔧 后端API地址:  http://localhost:5555
echo 🔍 监控API文档:  http://localhost:5555/api/live-monitor/status
echo.
echo 🔑 默认测试账户:
echo    邮箱: admin@163.com
echo    密码: password
echo.
echo 💡 功能特性:
echo    ✅ 直播间批量管理
echo    ✅ 智能爬虫监控 (V6最终版)
echo    ✅ 实时WebSocket连接
echo    ✅ 多平台支持 (抖音、快手、B站等)
echo    ✅ 智能数据看板
echo    ✅ 自动化状态监控
echo.
echo 📖 使用说明:
echo    1. 在直播间管理页面批量导入直播间URL
echo    2. 系统会自动获取标题和检测状态
echo    3. 对抖音直播间可启动实时WebSocket监控
echo    4. 在智能看板查看实时数据统计
echo.
echo ⚠️  注意事项:
echo    - 实时监控目前仅支持抖音直播间
echo    - 系统会每5分钟自动检查直播间状态
echo    - 浏览器需要支持现代Web标准
echo.
echo 按任意键退出启动器...
pause >nul 