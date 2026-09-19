# 计划：DeepSFV 前端（v1）

> 来源 PRD：`frontend-spec.md`（2026-09-18，已与产品负责人确认）

## 架构决策

适用于所有阶段的持久性决策：

- **路由**：`/`（项目列表）、`/idea`、`/create?projectId=`、`/project/:id/outline`、`/project/:id/assets`、`/project/:id/episodes`、`/project/:id/episode/:episodeId`；React Router，路由级代码分割
- **技术栈**：React 19 + Vite 5 + TypeScript 严格模式 + Zustand + Ant Design 5（暗色为默认，CSS 变量 + ConfigProvider 明暗切换）
- **API 契约**：`docs/api/openapi.yaml`，OpenAPI 3.1，REST + JSON，统一前缀 `/api`；异步任务统一 `TaskStatus` 模型（`status: pending | running | succeeded | failed` + `progress: 0-100` + `result`/`error`），提交 `POST /api/{resource}/tasks` → 轮询 `GET /api/tasks/{taskId}`；前端统一 `useTask(taskId)` hook，2–3s 轮询；**v1 无 SSE/WebSocket**
- **数据模型**：Project、Outline、Asset（角色/场景/道具）、Episode、Segment（分镜）、Task、Credit、Model（常量表：Seedance 2.5 / Minimax H3 Max / Wan 3.0）、Template
- **鉴权**：请求层 Bearer token 占位 + 401 统一拦截，v1 无登录页
- **积分**：只读，契约仅 `GET /api/credits`，扣费纯展示（后端职责）
- **Mock**：MSW 与契约逐接口一一对应；素材复制自 `hogee-demo-assets/` 到 `public/demo-assets/`；业务数据一律走请求层，localStorage 仅存主题等 UI 状态
- **契约同步演进**：每个切片把该片的接口追加进 `openapi.yaml` + 对应 MSW handler，不写一次性大契约
- **工程位置**：`D:\Shenlan\web-oh-story\frontend\`，包名 `deepsfv-frontend`，pnpm 单包；切片 1 时 `git init`
- **浏览器**：桌面 Chrome/Edge 最新两个大版本，≥1280px

---

## 阶段 1：工程骨架 + 项目列表打通

**用户故事**：作为创作者，我打开应用能看到我的项目列表，并切换明暗主题。

### 构建内容

从零到第一条完整垂直路径：git init、Vite + React 19 + TS 严格模式脚手架、AntD 暗色主题配置、应用布局（78px 左侧图标栏 + 顶栏 + 主内容区）、路由壳（7 条路由先占位空页）、请求层（fetch 封装 + Bearer token 占位 + 401 拦截）、MSW 接入。契约写入第一条 `GET /api/projects`，首页渲染《逆命木叶》等 mock 项目卡（封面、名称、更新时间、进度状态）。

> **主题方案已定（2026-09-18 原型验证）**：AntD token + 46 行定向 CSS 可还原 demo 观感 ~95%，定制成本评估为「中」。`prototype/src/theme.ts` 直接拷入作 `frontend/src/theme.ts`；公共部分抽 `src/styles/overrides.css`；侧栏导航自写轻量组件（不用 AntD Menu）；React 19 需装 `@ant-design/v5-patch-for-react-19`。详见 `prototype/FINDINGS.md`。

### 验收标准

- [ ] `pnpm dev` 启动，访问 `/` 看到项目卡列表，数据来自 MSW（DevTools Network 可见 `/api/projects` 请求）
- [ ] 顶栏主题切换按钮可切明暗，刷新后保持（localStorage）
- [ ] 侧栏三项导航（首页/创意/创作）可点击跳转到占位页
- [ ] 请求层对所有请求带 `Authorization: Bearer` 头，401 有统一拦截处理路径
- [ ] `openapi.yaml` 存在且包含 `GET /api/projects` 定义

---

## 阶段 2：项目管理 + 积分顶栏

**用户故事**：作为创作者，我能新建项目、重命名项目、查看存储用量；我能在顶栏看到积分余额。

### 构建内容

项目列表页的完整 CRUD 路径：新建项目弹窗（名称 + 可选模板占位）→ `POST /api/projects`；重命名 → `PATCH /api/projects/:id`；存储用量展示；顶栏积分余额接 `GET /api/credits`（mock 初始 ◆940）。打开项目跳转 `/create?projectId=` 占位。

### 验收标准

- [ ] 新建项目后列表即时出现新卡片（数据经 MSW 往返，非本地直接塞）
- [ ] 重命名生效并持久于 mock 数据层
- [ ] 顶栏显示积分余额，来自 `/api/credits` 请求
- [ ] 存储用量区域有真实数据渲染

---

## 阶段 3：创作入口 + 首个长任务

**用户故事**：作为创作者，我能粘贴剧本或上传文件提交创作，看到 AI 处理进度，然后进入大纲步骤。

### 构建内容

create 页剧本模式端到端：粘贴文本、文件上传（txt/pdf/doc/docx/md，≤30 万字，前端格式与大小校验）、扣 ◆32 展示。提交 → `POST /api/projects/:id/outline-tasks` 返回 `taskId` → **`useTask` 轮询 hook 首次落地**（封装提交-轮询-终止态的完整生命周期）→ 完成后跳转 STEP1 占位页。MSW handler 模拟真实时序：pending → running（进度递增）→ succeeded。

### 验收标准

- [ ] 超字数/错误格式文件被前端拦截并提示
- [ ] 提交后能看到任务进度 UI（进度条按轮询结果推进），扣费展示 ◆32
- [ ] `useTask` hook 可复用：终止轮询、失败态、组件卸载时清理
- [ ] 契约含 outline-tasks 提交与 `GET /api/tasks/{taskId}` 定义
- [ ] MSW 的任务 handler 有随机时延（数秒级），进度非瞬间完成

---

## 阶段 4：STEP1 剧本大纲

**用户故事**：作为创作者，我能看到编剧智能体对我剧本的解读，确认定稿后解锁资产步骤。

### 构建内容

outline 页端到端：整体设定、剧本摘要、资产提取清单（角色/场景/道具预提取，复用 SEGS 与《逆命木叶》mock 数据）、剧本定稿按钮。定稿 → `POST /api/projects/:id/outline/finalize` → 工作流进度解锁 STEP2（Zustand 全局工作流状态，顶栏/侧栏进度指示与原型一致）。未定稿访问 STEP2 路由则重定向回。

### 验收标准

- [ ] 大纲页渲染设定/摘要/资产提取清单，数据来自 `GET /api/projects/:id/outline`
- [ ] 定稿成功后侧栏/进度指示更新，STEP2 路由可访问
- [ ] 未定稿直接访问 STEP2 被重定向

---

## 阶段 5：STEP2 资产库

**用户故事**：作为创作者，我能为角色生成形象并锁定一致性，管理场景和道具。

### 构建内容

assets 页端到端：角色卡（林晚、宇智波鼬等）形象生成（生图任务走 `useTask` + 进度 + 结果图，mock 结果用 linwan.png/itachi.png）、一致性锁定开关（`PATCH /api/assets/:id`）、场景卡（corridor.jpg）、道具/素材区、统计筛选。资产数据层落地（后续 @引用 的数据来源）。

### 验收标准

- [ ] 点生成角色形象 → 任务进度 → 图片出现在卡片上（请求往返，非本地塞数据）
- [ ] 一致性锁定开关状态经 mock 持久化
- [ ] 统计筛选（按类型）工作正常
- [ ] 资产有稳定的 id 与类型标记，可被后续阶段引用

---

## 阶段 6：STEP3 分集管理

**用户故事**：作为创作者，我能看到导演智能体的拆分决策和分集列表，进入某集的片段编辑器。

### 构建内容

episodes 页端到端：导演拆分任务（`useTask` 复用）→ 分集卡列表（第 1 集：3 片段 / 37s）→ 点击分集跳转 `/project/:id/episode/:episodeId` 占位页。STEP2 完成解锁 STEP3 的工作流状态联动。

### 验收标准

- [ ] 拆分任务进度可见，完成后分集卡渲染
- [ ] 分集卡显示片段数与总时长
- [ ] 点击分集正确跳转片段编辑器路由
- [ ] 工作流三步解锁链路（定稿→资产→分集）在导航上连续生效

---

## 阶段 7：片段编辑器 · 上：分镜与生成

**用户故事**：作为创作者，我能编辑分镜提示词、引用资产、选择模型并生成视频片段。

### 构建内容

studio 页上半端到端：片段列表（3 片段）、分镜提示词编辑（含 **@引用资产 chip 内嵌缩略图**，消费阶段 5 的资产数据层）、分镜详情（时长/景别/运镜/表演/台词/语音标注，数据复用 SEGS）、模型选择（Model 常量表三选一）、生成按钮（扣费展示 ◆1300 / 再次生成 ◆406）→ 生视频任务 + 进度。

### 验收标准

- [ ] 分镜数据完整渲染并可编辑保存（`PATCH` 经 mock 往返）
- [ ] @引用能选到 STEP2 的资产并显示缩略图 chip
- [ ] 模型切换后生成请求携带所选 model
- [ ] 生成任务进度可见，扣费数字展示正确

---

## 阶段 8：片段编辑器 · 下：预览与导出

**用户故事**：作为创作者，我能预览生成的片段、在时间轴上检视，并合成导出成片。

### 构建内容

studio 页下半端到端：视频预览播放器（mock 结果指向 `public/demo-assets/clip1.mp4` 等）、片段缩略图时间轴、合成导出（异步任务 + 进度弹窗）、成片下载（实际下载 clip mp4）。

### 验收标准

- [ ] 生成的片段可内嵌播放，时间轴与片段对应
- [ ] 合成导出任务进度弹窗完整（提交→进度→完成）
- [ ] 完成后可下载成片文件

---

## 阶段 9：创意市场（缩水）+ 通知 + 文档收尾

**用户故事**：作为创作者，我能从官方示例模板一键开始创作；我能看到系统通知；未来的后端开发者有完整的对接说明书。

### 构建内容

idea 页（仅官方示例模板）：模板卡列表（`GET /api/templates`）→「套用」→ 以模板预填数据跳转创作入口。通知中心（顶栏铃铛 + 面板，mock 数据改写为 DeepSFV 文案）。收尾：`docs/backend-guide.md`（轮询模式说明、错误码约定、接口清单、MSW 切换流程）、README、全流程走查。

### 验收标准

- [ ] 创意市场展示模板卡，套用后创作入口带入模板预填数据
- [ ] 通知中心可开合，展示通知列表
- [ ] `backend-guide.md` 覆盖契约全部接口与切换真后端流程
- [ ] 从首页新建项目到导出成片的完整流程可一次性走通

---

## 二期范围（本计划不含）

节点画布（React Flow）、画布管理、创意对话（届时加 SSE 端点）、资产广场、工作台首页升级、真实登录页。
