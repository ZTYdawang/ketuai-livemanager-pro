# Ketu Live Score - 项目说明文档

本文档旨在详细说明 “Ketu Live Score - 直播间监控系统” 的项目结构、核心功能、技术栈及 API 接口，为后续的维护和二次开发提供清晰的指引。

---

## 1. 项目概览

Ketu Live Score 是一个全栈的直播间监控与管理平台。它允许用户添加、管理和监控多个直播间，并提供主播排班、屏幕录制等高级功能。项目采用前后端分离架构。

*   **前端 (Frontend)**: 基于 React 和 Ant Design 构建的现代化用户界面，负责用户交互和数据展示。
*   **后端 (Backend)**: 基于 Node.js 和 Express 的 API 服务，负责处理业务逻辑、数据存储和与 Puppeteer 的交互。

---

## 2. 项目结构

项目的核心代码分为 `backend` 和 `frontend` 两个主目录。

```
.
├── backend/                  # 后端项目
│   ├── data/                 # (Git忽略) 存放数据库文件等
│   ├── recordings/           # (Git忽略) 存放录制的视频文件
│   ├── src/                  # 后端源代码
│   │   ├── db/               # 数据库连接与初始化逻辑
│   │   ├── middleware/       # Express 中间件 (如: 身份验证)
│   │   ├── routes/           # API 路由定义
│   │   └── services/         # 核心服务 (如: 录制服务)
│   ├── Dockerfile
│   ├── package.json
│   └── ...
├── frontend/                 # 前端项目
│   ├── public/               # 静态资源
│   ├── src/                  # 前端源代码
│   │   ├── assets/           # 图片、样式等资源
│   │   ├── components/       # 可复用的 React 组件
│   │   ├── pages/            # 页面级组件
│   │   ├── services/         # API 请求服务
│   │   └── App.tsx           # 应用主组件
│   ├── Dockerfile
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── .gitignore                # Git 忽略配置
├── docker-compose.yml        # Docker 编排文件
└── README.md
```

---

## 3. 技术栈 (Technology Stack)

**后端 (Backend):**

*   **运行环境**: Node.js
*   **Web 框架**: Express.js
*   **数据库**: PostgreSQL (通过 `pg` 库连接)
*   **身份认证**: JWT (JSON Web Tokens)
*   **密码加密**: bcrypt.js
*   **核心功能库**:
    *   **Puppeteer**: 用于模拟浏览器行为，抓取直播流信息。
    *   **fluent-ffmpeg**: 用于处理视频流和录制。
    *   **Multer**: 用于处理文件上传。
*   **开发工具**: Nodemon (用于开发环境下的热重载)

**前端 (Frontend):**

*   **核心框架**: React
*   **UI 库**: Ant Design
*   **构建工具**: Vite
*   **编程语言**: TypeScript
*   **路由管理**: React Router
*   **视频播放**:
    *   `flv.js`: 用于播放 FLV 格式的直播流。
    *   `hls.js`: 用于播放 HLS 格式的直播流。
*   **拖拽功能**: `@dnd-kit`

---

## 4. API 接口文档

所有 API 的基础路径为 `/api`。需要身份认证的接口都由 `authMiddleware` 保护。

### 4.1 认证 (Auth) - `/api/auth`

*   **`POST /register`**: 用户注册
    *   **Body**: `{ username, email, password, phoneNumber? }`
    *   **Response**: 成功或失败信息。
*   **`POST /login`**: 用户登录
    *   **Body**: `{ account, password }` (account 可以是邮箱或手机号)
    *   **Response**: 成功后返回 `token` 和用户信息。

### 4.2 主播管理 (Anchors) - `/api/anchors`

*   **`GET /`**: 获取当前用户的所有主播列表。
*   **`POST /`**: 添加一个新主播。
    *   **Body**: `{ name, avatar?, gender, age?, rating }`
*   **`PUT /:id`**: 更新指定 ID 的主播信息。
*   **`DELETE /:id`**: 删除指定 ID 的主播。

### 4.3 直播间管理 (Rooms) - `/api/rooms`

*   **`GET /`**: 获取用户的所有直播间，并附带当天的排班信息。
*   **`POST /`**: 添加一个新直播间。
    *   **Body**: `{ title, url, streamer?, platform?, description? }`
*   **`POST /batch`**: 批量添加直播间。
    *   **Body**: `{ rooms: [...] }`
*   **`PUT /:id`**: 更新指定 ID 的直播间信息。
*   **`PUT /:id/monitor`**: 更新直播间的监控状态。
    *   **Body**: `{ is_monitored: boolean }`
*   **`DELETE /:id`**: 删除指定 ID 的直播间。

### 4.4 排班管理 (Schedules) - `/api/schedules`

*   **`GET /`**: 获取排班数据。
    *   **Query Params**: `?date=...` (可选), `?roomId=...` (可选)
*   **`POST /`**: 创建或更新一个排班。
    *   **Body**: `{ anchorId, date, timeSlot, roomId }`
*   **`DELETE /`**: 删除指定排班。
    *   **Body**: `{ anchorId, date, timeSlot, roomId? }`
*   **`GET /conflicts`**: 检查指定主播在某天某时段是否有排班冲突。
    *   **Query Params**: `?anchorId=...&date=...&timeSlot=...`

### 4.5 直播流监控 (Stream Monitor) - `/api/stream-monitor`

*   **`GET /rooms`**: 获取所有被监控的直播间列表。
*   **`POST /rooms`**: 添加一个新的直播间到监控列表。
    *   **Body**: `{ url, title, streamer, category }`
*   **`PUT /rooms/:id/status`**: 更新直播间状态。
*   **`DELETE /rooms/:id`**: 从监控列表中删除一个直播间。
*   **`POST /rooms/:id/recording/start`**: 开始录制。
*   **`POST /rooms/:id/recording/stop`**: 停止录制。
*   **`POST /check-stream`**: 检查指定 URL 的直播流状态（核心功能）。
    *   **Body**: `{ url }`

### 4.6 文件上传 (Upload) - `/api/upload`

*   **`POST /avatar`**: 上传主播头像。
    *   **Body**: `FormData` 中包含 `avatar` 文件。
    *   **Response**: `{ url: "/uploads/filename.ext" }`

---

## 5. 后续开发建议 (TODO)

*   [ ] **完善数据库迁移**: 当前项目似乎依赖手动执行 SQL 或同步模型。建议引入一个迁移工具（如 `node-pg-migrate`）来更规范地管理数据库结构变更。
*   [ ] **增强错误处理和日志**: 对关键的业务逻辑（特别是 `streamMonitor`）添加更详细的日志和更健壮的错误处理机制。
*   [ ] **单元测试与集成测试**: 为核心的 API 端点和服务编写测试用例，确保代码质量和未来的重构安全。
*   [ ] **优化 Puppeteer 使用**:
    *   考虑将 Puppeteer 实例池化，避免频繁启动和关闭浏览器带来的性能开销。
    *   研究目标直播平台的 API，看是否能直接通过 API 获取直播流地址，以减少对 Puppeteer 的依赖。
*   [ ] **前端性能优化**:
    *   对大型列表（如历史记录）使用虚拟滚动或分页加载。
    *   使用 `React.memo` 和 `useCallback` 等 Hook 优化不必要的组件重渲染。
*   [ ] **安全加固**:
    *   对所有用户输入进行更严格的校验。
    *   考虑为 API 请求添加速率限制，防止恶意攻击。
    *   定期更新 `JWT_SECRET`，并将其存储在更安全的环境变量管理服务中。
---
*文档最后更新于: 2025年7月12日*