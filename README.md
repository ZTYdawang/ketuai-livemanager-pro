# Ketu Live Score - 直播评分管理系统

## ✅ 已完成功能

### 🔐 用户认证系统
- 用户注册/登录 (支持邮箱和手机号)
- JWT Token认证
- 用户会话管理
- 数据用户隔离

### 👥 主播管理
- 主播信息录入 (姓名、性别、年龄、评级)
- 主播头像上传
- 主播列表展示
- 拖拽排班功能

### 🏠 直播间管理
- 直播间创建和管理
- 排班看板 (早上/下午/晚上时段)
- 可视化拖拽排班

### 💾 数据持久化
- SQLite自动初始化 (无需安装PostgreSQL)
- 所有数据与用户账户绑定
- 支持PostgreSQL (生产环境)

## 🚀 快速启动

### 1. 启动后端服务
```bash
cd backend
npm install
npm run dev
```

### 2. 启动前端服务
```bash
cd frontend
npm install
npm run dev
```

### 3. 访问应用
- 前端地址: http://localhost:5173
- 后端地址: http://localhost:5555
- 测试账户: admin@163.com / password

## 🛠 技术栈

### 后端
- Node.js + Express
- SQLite (开发) / PostgreSQL (生产)
- JWT认证
- bcrypt密码加密
- multer文件上传

### 前端
- React + TypeScript
- Ant Design UI组件
- @dnd-kit拖拽库
- Vite构建工具

## 📁 项目结构

```
ketu_live_score/
├── backend/
│   ├── src/
│   │   ├── db/           # 数据库配置
│   │   ├── routes/       # API路由
│   │   ├── middleware/   # 中间件
│   │   └── index.js      # 入口文件
│   ├── uploads/          # 文件上传目录
│   ├── init.sql          # PostgreSQL初始化脚本
│   └── ketu_live_score.db # SQLite数据库文件
├── frontend/
│   └── src/
│       ├── pages/        # 页面组件
│       ├── components/   # 通用组件
│       └── App.tsx       # 主应用
└── start-local.*         # 启动脚本
```

## 🔧 数据库切换

系统会自动检测PostgreSQL连接：
- ✅ PostgreSQL可用 → 使用PostgreSQL
- ❌ PostgreSQL不可用 → 自动切换到SQLite

### PostgreSQL设置 (可选)
如需使用PostgreSQL，请参考 `LOCAL_SETUP.md` 或 `QUICK_START.md`

## 🧪 测试数据库
```bash
cd backend
npm run test-db
```

## 🎯 下一步开发
- [ ] 直播历史记录
- [ ] 数据统计报表
- [ ] 实时状态更新
- [ ] 排班模板
- [ ] 权限管理 