import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// 导入路由
import authRoutes from './routes/auth.js';
import anchorRoutes from './routes/anchors.js';
import roomRoutes from './routes/rooms.js';
import scheduleRoutes from './routes/schedules.js'; // 新增排班路由
import streamMonitorRoutes from './routes/streamMonitor.js';
import uploadRoutes from './routes/upload.js';

// Basic configuration
dotenv.config();

// 设置默认的JWT密钥（如果环境变量中没有的话）
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'ketu_live_score_jwt_secret_2024_local_dev';
}

const app = express();
const PORT = process.env.PORT || 5555;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get('/', (req, res) => {
    res.json({
        status: 'success',
        message: '🎥 Ketu Live Score Backend Server',
        version: '2.0.0',
        features: [
            '✨ 简化的直播间管理',
            '🎯 iframe实时监控',
            '📹 屏幕录制功能',
            '🔧 清洁的代码架构'
        ],
        timestamp: new Date().toISOString()
    });
});

// 注册路由
app.use('/api/auth', authRoutes);
app.use('/api/anchors', anchorRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/schedules', scheduleRoutes); // 新增排班路由
app.use('/api/stream-monitor', streamMonitorRoutes);
app.use('/uploads', express.static('uploads'));
app.use('/api/upload', uploadRoutes);

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `路由 ${req.originalUrl} 不存在`,
        available_routes: [
            'GET  /',
            'POST /api/auth/login',
            'POST /api/auth/register',
            'GET  /api/rooms',
            'POST /api/rooms',
            'GET  /api/stream-monitor/rooms',
            'POST /api/stream-monitor/rooms'
        ]
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('服务器错误:', err);
    res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: '服务器内部错误',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// 启动服务器
app.listen(PORT, () => {
    console.log('');
    console.log('🚀'.repeat(30));
    console.log('🎥 Ketu Live Score - 直播间监控系统');
    console.log('🚀'.repeat(30));
    console.log('');
    console.log('✅ 服务器启动成功!');
    console.log(`🌐 服务地址: http://localhost:${PORT}`);
    console.log('');
    console.log('📋 系统特性:');
    console.log('   ✨ 简化的直播间管理 - 告别复杂爬虫');
    console.log('   🎯 iframe实时监控 - 直观显示直播内容');
    console.log('   📹 屏幕录制功能 - 一键录制并下载');
    console.log('   🔧 清洁的代码架构 - 易于维护和扩展');
    console.log('');
    console.log('🛠️  主要功能模块:');
    console.log('   📝 直播间管理: /api/rooms');
    console.log('   👀 实时监控: /api/stream-monitor');
    console.log('   🔐 用户认证: /api/auth');
    console.log('   👤 主播管理: /api/anchors');
    console.log('');
    console.log('💡 使用提示:');
    console.log('   1. 通过直播间管理页面录入URL和基本信息');
    console.log('   2. 在实时监控页面选择直播间进行iframe预览');
    console.log('   3. 使用媒体流检测判断直播状态');
    console.log('   4. 支持屏幕录制功能记录直播内容');
    console.log('');
    console.log('🎯 访问地址:');
    console.log(`   API文档: http://localhost:${PORT}/`);
    console.log(`   健康检查: http://localhost:${PORT}/`);
    console.log('');
    console.log('🚀'.repeat(30));
    console.log('');
}); 