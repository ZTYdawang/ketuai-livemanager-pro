# Ketu Live Score 本地开发环境设置

## 环境要求

- Node.js 18+ 
- PostgreSQL 14+
- Git

## 1. 安装 PostgreSQL

### Windows:
1. 下载并安装 PostgreSQL: https://www.postgresql.org/download/windows/
2. 安装过程中记住设置的密码（通常是用户 `postgres` 的密码）
3. 默认端口为 5432

### macOS:
```bash
# 使用 Homebrew
brew install postgresql
brew services start postgresql
```

### Linux (Ubuntu/Debian):
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

## 2. 创建数据库和用户

连接到 PostgreSQL:
```bash
# Windows: 使用 pgAdmin 或者命令行
psql -U postgres

# macOS/Linux:
sudo -u postgres psql
```

在 PostgreSQL 中执行:
```sql
-- 创建用户
CREATE USER ketu_user WITH PASSWORD 'ketu_password';

-- 创建数据库
CREATE DATABASE ketu_live_score;

-- 授权用户访问数据库
GRANT ALL PRIVILEGES ON DATABASE ketu_live_score TO ketu_user;

-- 切换到数据库并授权
\c ketu_live_score
GRANT ALL ON SCHEMA public TO ketu_user;
```

## 3. 配置后端环境

1. 进入后端目录:
```bash
cd backend
```

2. 复制环境配置文件:
```bash
# Windows
copy env.example .env

# macOS/Linux  
cp env.example .env
```

3. 编辑 `.env` 文件，根据你的 PostgreSQL 配置调整连接字符串。

4. 初始化数据库:
```bash
# 方法1: 直接执行 SQL 文件
psql -U ketu_user -d ketu_live_score -f init.sql

# 方法2: 或者手动执行
psql -U ketu_user -d ketu_live_score
\i init.sql
```

5. 安装依赖并启动后端:
```bash
npm install
npm run dev
```

## 4. 启动前端

1. 进入前端目录:
```bash
cd ../frontend
```

2. 安装依赖并启动:
```bash
npm install
npm run dev
```

## 5. 验证安装

1. 后端应该运行在: http://localhost:5555
2. 前端应该运行在: http://localhost:5173
3. 使用测试账户登录:
   - 邮箱: admin@163.com
   - 密码: password

## 常见问题

### PostgreSQL 连接问题:
- 确认 PostgreSQL 服务正在运行
- 检查端口是否为 5432
- 确认用户名密码正确
- Windows 防火墙可能需要允许 PostgreSQL

### 端口冲突:
- 如果 5555 端口被占用，修改 `.env` 文件中的 PORT
- 同时记得更新前端中的 API 地址

### Node.js 版本问题:
- 确保使用 Node.js 18 或更高版本
- 可以使用 `node --version` 检查版本 