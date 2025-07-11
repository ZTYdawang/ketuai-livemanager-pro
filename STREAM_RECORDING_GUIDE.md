# 直播流录制功能使用指南

## 🎯 功能概述

我们新增了基于流的录制功能，相比传统的屏幕录制有以下优势：

### ✅ 流录制模式 (推荐)
- ✅ **无需用户授权** - 不需要屏幕共享权限
- ✅ **后台录制** - 可以在后台运行，不影响其他操作
- ✅ **高质量录制** - 直接从直播流录制，画质无损失
- ✅ **服务端录制** - 录制文件存储在服务器，便于管理
- ✅ **支持暂存** - 录制文件自动保存，支持批量下载
- ✅ **多格式支持** - 支持 HLS、FLV、RTMP 等流格式

### ⚠️ 屏幕录制模式
- ❌ 需要用户手动授权屏幕共享
- ❌ 必须保持浏览器窗口活跃
- ❌ 录制质量取决于屏幕分辨率
- ✅ 可以录制任何内容（不限于直播流）

## 🛠️ 安装和配置

### 1. 后端依赖安装
```bash
cd backend
npm install fluent-ffmpeg
```

### 2. 系统依赖
确保系统安装了 FFmpeg：

**Windows:**
```bash
# 使用 chocolatey
choco install ffmpeg

# 或下载 FFmpeg 可执行文件并添加到 PATH
```

**Mac:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt update
sudo apt install ffmpeg
```

### 3. 数据库初始化
运行数据库迁移脚本：
```bash
cd backend
psql -d your_database -f stream_recordings.sql
```

## 🚀 使用方法

### 1. 切换录制模式
1. 点击右上角 "系统设置"
2. 在 "录制设置" 中选择 "流录制模式"
3. 点击保存

### 2. 开始流录制
1. 在直播间列表中选择要录制的直播间
2. 确保直播间正在播放（可以通过预览模式测试流地址）
3. 点击 "开始录制" 按钮
4. 系统会自动获取直播流地址并开始录制

### 3. 管理录制文件
1. 在 "系统设置" 中点击 "查看录制文件"
2. 查看所有录制文件列表
3. 点击 "下载" 按钮下载录制文件

## ⚙️ 录制设置说明

### 录制质量
- **高质量 (1080p)**: 适合高质量保存，文件较大
- **中质量 (720p)**: 平衡质量和文件大小，推荐
- **低质量 (480p)**: 文件小，适合快速录制

### 录制内容
- **音视频**: 完整录制视频和音频
- **仅音频**: 只录制音频，文件更小

### 其他设置
- **最大录制时长**: 防止录制文件过大，超时自动停止
- **自动停止**: 主播下线时自动停止录制

## 📁 文件存储

### 存储路径
- **录制文件**: `backend/recordings/`
- **临时文件**: `backend/temp/`

### 文件命名规则
```
recording_[直播间ID]_[时间戳].[扩展名]
例如: recording_123_2024-01-15T10-30-00-000Z.mp4
```

### 文件清理
系统提供自动清理功能：
- 默认保留 30 天内的录制文件
- 可以在 API 中调用清理接口
- 支持手动删除过期文件

## 🔧 API 接口

### 开始流录制
```http
POST /api/stream-monitor/rooms/:id/stream-recording/start
Content-Type: application/json

{
  "streamUrl": "https://example.com/stream.m3u8",
  "quality": "medium",
  "audioOnly": false,
  "maxDuration": 120
}
```

### 停止流录制
```http
POST /api/stream-monitor/rooms/:id/stream-recording/stop
```

### 获取录制文件列表
```http
GET /api/stream-monitor/recordings
GET /api/stream-monitor/recordings?roomId=123
```

### 下载录制文件
```http
GET /api/stream-monitor/recordings/:filename/download
```

### 清理过期文件
```http
POST /api/stream-monitor/recordings/cleanup
Content-Type: application/json

{
  "daysOld": 30
}
```

## 🐛 故障排除

### 常见问题

1. **无法获取直播流地址**
   - 确保直播间正在直播
   - 尝试不同的预览模式 (HLS/FLV)
   - 检查网络连接

2. **录制失败**
   - 检查 FFmpeg 是否正确安装
   - 查看服务器日志获取详细错误信息
   - 确认有足够的磁盘空间

3. **下载失败**
   - 检查录制文件是否存在
   - 确认服务器有足够的权限访问文件
   - 查看网络连接状态

### 日志查看
```bash
# 查看后端日志
cd backend
npm run dev

# 查看 FFmpeg 输出
tail -f logs/ffmpeg.log
```

## 🔒 安全考虑

1. **文件访问控制**: 录制文件只能通过认证用户访问
2. **文件名验证**: 防止路径遍历攻击
3. **存储限制**: 建议设置录制文件大小和数量限制
4. **定期清理**: 避免磁盘空间耗尽

## 📈 性能优化

1. **并发录制**: 支持多个直播间同时录制
2. **资源监控**: 监控 CPU 和内存使用情况
3. **存储优化**: 使用合适的视频编码设置
4. **网络优化**: 使用 CDN 加速文件下载

## 🎉 总结

基于流的录制功能提供了更好的用户体验和录制质量。相比屏幕录制：

- 🚀 **更简单**: 无需用户授权，一键开始录制
- 🎬 **更专业**: 直接从源流录制，质量更好
- 💾 **更方便**: 服务端存储，支持批量管理和下载
- ⚡ **更高效**: 后台录制，不影响其他操作

现在你可以轻松录制任何直播内容，并通过完善的文件管理系统进行下载和管理！ 