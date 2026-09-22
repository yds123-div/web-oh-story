# DeepSFV 后端迁移说明

## 迁移完成情况

### ✅ 已完成
1. **项目结构迁移**
   - Toonflow 后端代码已迁移到 `D:\Shenlan\web-oh-story\backend`
   - 采用 monorepo 结构（backend 和 frontend 并列）

2. **依赖清理**
   - 移除了 Electron 相关依赖
   - 移除了 Electron 构建脚本
   - 保留了所有 AI 模型供应商配置

3. **代码适配**
   - 修改了 `src/utils/getPath.ts` - 移除 Electron 特定代码
   - 修改了 `src/env.ts` - 简化为 Web 环境
   - 修改了 `src/app.ts` - 移除 Electron 权限检查和对话框

4. **服务启动**
   - 后端服务成功启动在 `http://localhost:10588`
   - 数据库初始化完成（SQLite）
   - WebSocket 命名空间注册成功

### 🔧 技术栈
- **运行时**: Node.js 18+
- **框架**: Express + TypeScript
- **数据库**: SQLite (本地文件)
- **实时通信**: Socket.io
- **AI SDK**: 多个 AI 模型供应商（OpenAI、DeepSeek、Volcengine 等）

### 📁 目录结构
```
D:\Shenlan\web-oh-story\
├── backend/           # Toonflow 后端迁移
│   ├── src/          # 源代码
│   ├── data/         # 数据文件（数据库、OSS、技能等）
│   ├── package.json  # 后端依赖
│   └── tsconfig.json # TypeScript 配置
└── frontend/         # 现有 React 前端
```

### 🚀 运行命令
```bash
# 开发模式
cd backend
yarn dev

# 生产模式
cd backend
yarn start
```

### 🔌 API 服务
- **基础 URL**: `http://localhost:10588`
- **登录接口**: `POST /api/login/login`
- **静态资源**: 
  - `/oss` - 图片、视频等资产
  - `/skills` - 技能文件
  - `/assets` - 资产文件
- **WebSocket**: `/api/socket/productionAgent`, `/api/socket/scriptAgent`

### ⚠️ 注意事项
1. **API 兼容性**: web-oh-story 前端需要适配 Toonflow 后端的 API 接口
2. **认证机制**: 后端使用 JWT token 认证，需要在请求 header 中携带
3. **数据库位置**: SQLite 数据库文件在 `backend/data/db2.sqlite`
4. **文件存储**: 所有用户文件存储在 `backend/data/` 目录下

### 📋 下一步工作
1. **前端适配**: 修改 web-oh-story 前端以适配 Toonflow 后端 API
2. **接口测试**: 完整测试所有 API 接口
3. **用户认证**: 实现前端登录流程
4. **WebSocket 集成**: 前端集成实时通信功能
5. **错误处理**: 完善前后端错误处理机制

### 🐛 已知问题
- 初始登录可能需要创建用户数据
- 部分接口可能需要配置 AI 模型 API keys
- 文件上传功能需要测试

### 📝 配置文件
- **数据库**: `backend/data/db2.sqlite`
- **技能文件**: `backend/data/skills/`
- **AI 模型配置**: `backend/data/vendor/`
- **静态资源**: `backend/data/oss/`, `backend/data/assets/`

## 迁移日期
2026-09-22