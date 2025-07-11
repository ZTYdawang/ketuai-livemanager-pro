# Ketu Live Score 快速开始指南

## 🚀 5分钟快速启动

### 选项1: 使用便携版PostgreSQL (推荐)

1. **下载便携版PostgreSQL**:
   - 下载地址: https://get.enterprisedb.com/postgresql/postgresql-15.4-1-windows-x64-binaries.zip
   - 解压到 `C:\postgresql` (或任意目录)

2. **初始化数据库**:
   ```powershell
   # 进入PostgreSQL目录
   cd C:\postgresql\pgsql\bin
   
   # 初始化数据库集群
   .\initdb.exe -D C:\postgresql\data -U postgres
   
   # 启动PostgreSQL服务
   .\pg_ctl.exe -D C:\postgresql\data -l C:\postgresql\logfile start
   ```

3. **创建项目数据库**:
   ```powershell
   # 连接PostgreSQL
   .\psql.exe -U postgres -h localhost
   
   # 在psql中执行以下SQL:
   CREATE USER ketu_user WITH PASSWORD 'ketu_password';
   CREATE DATABASE ketu_live_score;
   GRANT ALL PRIVILEGES ON DATABASE ketu_live_score TO ketu_user;
   \c ketu_live_score
   GRANT ALL ON SCHEMA public TO ketu_user;
   \q
   ```

4. **初始化项目数据表**:
   ```powershell
   # 在项目backend目录下
   C:\postgresql\pgsql\bin\psql.exe -U ketu_user -d ketu_live_score -f init.sql
   ```

### 选项2: 使用Docker (如果Docker可用)

```bash
# 启动PostgreSQL容器
docker run --name ketu-postgres -e POSTGRES_DB=ketu_live_score -e POSTGRES_USER=ketu_user -e POSTGRES_PASSWORD=ketu_password -p 5432:5432 -d postgres:15

# 等待容器启动后初始化数据表
docker exec -i ketu-postgres psql -U ketu_user -d ketu_live_score < backend/init.sql
```

### 选项3: 在线PostgreSQL服务 (临时测试)

可以使用免费的在线PostgreSQL服务如 ElephantSQL 或 Supabase:

1. 注册获取连接字符串
2. 修改 `backend/src/db/index.js` 中的连接配置
3. 在线服务的控制台中执行 `backend/init.sql`

## 🏃‍♂️ 启动项目

### 手动启动:
```bash
# 终端1: 启动后端
cd backend
npm install
npm run dev

# 终端2: 启动前端
cd frontend  
npm install
npm run dev
```

### 使用启动脚本:
```bash
# Windows
start-local.bat

# macOS/Linux
./start-local.sh
```

## 🔍 验证安装

1. 后端服务: http://localhost:5555
2. 前端应用: http://localhost:5173
3. 测试登录:
   - 邮箱: `admin@163.com`
   - 密码: `password`

## 📊 功能确认

登录后可以:
- ✅ 查看主播管理页面
- ✅ 添加新主播 (会保存到数据库)
- ✅ 上传主播头像
- ✅ 主播排班 (拖拽功能)
- ✅ 数据与用户账户绑定

## 🐛 故障排除

### 数据库连接失败:
```bash
# 测试数据库连接
cd backend
npm run test-db
```

### 端口冲突:
- 后端默认端口: 5555
- 前端默认端口: 5173
- 如果冲突，可以在启动时指定其他端口

### PostgreSQL服务未启动:
```bash
# Windows便携版启动命令
C:\postgresql\pgsql\bin\pg_ctl.exe -D C:\postgresql\data start
```

## 📝 注意事项

- **数据持久化**: 所有数据保存在PostgreSQL中，重启后数据不会丢失
- **用户隔离**: 每个用户只能看到和管理自己的数据
- **JWT认证**: 登录状态会保持，直到主动退出
- **文件上传**: 头像文件保存在 `backend/uploads/` 目录 