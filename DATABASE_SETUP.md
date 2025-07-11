# 数据库配置说明

## 问题修复

我们已经修复了以下问题：

1. **数据持久化问题** - 现在支持PostgreSQL数据库，数据不会在重启后丢失
2. **录制状态同步问题** - 前端和后端的录制状态现在能正确同步
3. **直播间导入问题** - localStorage和数据库之间的同步已修复
4. **React重复导入错误** - 已清理重复的导入语句

## 数据库配置选项

### 选项1：使用PostgreSQL数据库（推荐）

1. 安装PostgreSQL数据库
2. 创建数据库：
```sql
CREATE DATABASE ketu_live_score;
```

3. 在 `backend` 目录创建 `.env` 文件：
```env
# 方式1：使用DATABASE_URL
DATABASE_URL=postgresql://username:password@localhost:5432/ketu_live_score

# 或方式2：使用单独的环境变量
PGHOST=localhost
PGPORT=5432
PGDATABASE=ketu_live_score
PGUSER=postgres
PGPASSWORD=your_password

JWT_SECRET=your_jwt_secret_key_here
PORT=3001
NODE_ENV=development
```

4. 重启后端服务，系统会自动：
   - 连接到PostgreSQL数据库
   - 创建必要的表结构
   - 数据将持久化保存

### 选项2：使用内存数据库（带持久化）

如果没有配置PostgreSQL，系统会自动使用内存数据库，但现在具有持久化功能：

- 数据保存在：`backend/data/memory_db.json`
- 每30秒自动保存
- 进程退出时保存
- 重启后自动恢复数据

## 安装新依赖

```bash
cd backend
npm install
```

## 重启服务

```bash
# 后端
cd backend
npm run dev

# 前端
cd frontend
npm run dev
```

## 验证修复

1. **数据持久化**：添加直播间后重启服务，数据应该保留
2. **录制状态同步**：开始/停止录制后，状态应该在前端和后端保持一致
3. **直播间导入**：从管理页面导入的直播间应该正确显示在监控页面
4. **页面刷新**：刷新页面后录制状态应该正确显示

## 故障排除

如果仍有问题：

1. 检查浏览器控制台的错误信息
2. 检查后端日志输出
3. 确认数据库连接配置正确
4. 清理浏览器缓存和localStorage 