# DeepSFV 前端项目 Spec

> 版本：1.0 · 2026-09-18
> 状态：已与产品负责人达成共识，可开工
> 参考原型：`hogee-demo-assets/`（纯静态高保真原型，本项目为工程化重写）
> 技术选型依据：`frontend-framework-choice.md`

---

## 1. 项目定位

**DeepSFV**（中文副标题「AI 短剧创作工坊」）——AI 短剧创作工具的正式前端工程。以三步工作流（剧本大纲 → 资产 → 分集视频）为核心主线的桌面端 Web 应用。

关键背景：

- **后端未定人选、未选型**。前端先行，以 OpenAPI 契约作为前后端唯一接口真相。
- 原型中所有「AI 处理」均为伪造（`setInterval` 进度条），真实系统中这些全部是**长时间异步任务**。
- 原型 UI 上所有「Hogee」字样替换为「DeepSFV」。

## 2. 技术栈（已锁定）

| 项 | 决定 | 备注 |
|---|---|---|
| 框架 | React 19 + Vite 5 | 路由级代码分割 |
| 语言 | TypeScript 严格模式 | |
| 路由 | React Router | SPA |
| 状态管理 | Zustand | 高频更新场景（进度轮询） |
| 组件库 | Ant Design 5 | 暗色主题为默认，保留明暗切换（CSS 变量 + ConfigProvider） |
| 画布 | React Flow（@xyflow/react） | **二期才引入依赖**，v1 不装 |
| 包管理 | ppm，单包，不搭 workspace | |
| 项目位置 | `D:\Shenlan\web-oh-story\frontend\` | 包名 `deepsfv-frontend` |
| 浏览器目标 | 桌面 Chrome/Edge 最新两个大版本 | 仅保证 ≥1280px 不白屏，不做移动适配 |
| ui-oh-story 插件 | 暂不复用，保持 React 架构兼容 | 未来可零成本接入 |
| Mock 层 | MSW (Mock Service Worker) | 与契约一一对应，可整体关闭切换真后端 |

## 3. v1 页面范围

侧栏导航 v1 仅三项：**首页（项目）/ 创意 / 创作**。左侧固定图标栏（78px）+ 顶部栏（积分展示、通知、主题切换、用户头像占位）的布局沿用原型。

### 3.1 首页 = 项目列表（改造自 space.html）

- 路由：`/`（项目卡片列表）
- 功能：项目卡（封面、名称、更新时间、进度状态）、新建项目（弹窗：名称 + 可选模板）、打开项目 → 进入该项目工作流、重命名、存储用量展示
- 「画布」概念整体留给二期，v1 一律叫「项目」

### 3.2 创意市场（缩水版，改造自 idea.html）

- 路由：`/idea`
- v1 只保留「官方示例模板」：模板卡片列表 → 点击「套用」→ 以该模板预填数据进入创作入口
- 砍掉：爆款拆解、风格库、创意对话入口（后两者 UI 结构不实现）

### 3.3 创作入口（create.html）

- 路由：`/create?projectId=xxx`
- 剧本模式：上传 txt/pdf/doc/docx/md（≤30 万字，前端校验大小/格式）、粘贴文本
- 小说模式：≤10 万字，章节切分 → 编剧 Agent 改编（= 提交异步任务）
- 套用官方示例模板（来自创意市场）
- 提交扣 ◆32 → 跳转 STEP1（v1 积分为展示+占位，见 §5.4）

### 3.4 STEP1 剧本大纲（outline.html）

- 路由：`/project/:id/outline`
- 内容：编剧智能体解读（= 任务进度展示）、整体设定、剧本摘要、资产提取清单（角色/场景/道具预提取）、剧本定稿按钮
- 定稿后解锁 STEP2

### 3.5 STEP2 资产库（assets.html）

- 路由：`/project/:id/assets`
- 内容：角色卡（形象生成 = 异步任务，含一致性锁定开关）、场景卡、道具/素材管理、统计筛选
- 完成后解锁 STEP3

### 3.6 STEP3 分集管理（episodes.html）

- 路由：`/project/:id/episodes`
- 内容：导演智能体拆分决策（任务）、分集卡列表（片段数/时长）
- 点击分集 → 片段编辑器

### 3.7 片段编辑器（studio.html，最重页面）

- 路由：`/project/:id/episode/:episodeId`
- 内容：
  - 片段列表 + 分镜提示词编辑（含 @引用资产 chip 内嵌缩略图）
  - 分镜详情：时长/景别/运镜/表演/台词/语音标注
  - 模型选择（Seedance 2.5 / Minimax H3 Max / Wan 3.0，契约中的模型常量表）
  - 生成（扣费展示 ◆1300 / 再次生成 ◆406）→ 异步任务 + 进度
  - 视频预览播放、片段缩略图时间轴
  - 合成导出（异步任务 + 进度弹窗）、成片下载

### 3.8 二期范围（本期不实现，架构不为其预留额外复杂度）

节点画布（React Flow、五种节点、12+ 专业功能）、画布管理、创意对话（届时契约加 SSE 端点）、资产广场（公开瀑布流）、工作台首页升级、真实登录页。

## 4. 前后端协作约定（核心）

### 4.1 契约先行

- 产出 OpenAPI 3.1 文档：`frontend/docs/api/openapi.yaml`，框架中立 REST + JSON
- 该文档是后端开发者的任务说明书；接口变更必须先改契约再改代码
- 后端选型完全开放，不预设语言/框架

### 4.2 统一异步任务模式

大纲解读、生图、生视频、合成导出**全部**走同一模式：

```
POST /api/{resource}/tasks        → { taskId }        # 提交任务
GET  /api/tasks/{taskId}          → TaskStatus        # 前端每 2-3s 轮询
```

`TaskStatus`：`{ status: pending | running | succeeded | failed, progress: 0-100, result?, error? }`

- **v1 无 SSE、无 WebSocket**。创意对话（二期）届时单独加流式端点
- 前端把轮询封装为统一 hook（如 `useTask(taskId)`），将来升级 SSE 只改传输层

### 4.3 鉴权占位

- 请求层统一携带 `Authorization: Bearer <token>` 头位 + 401 统一拦截处理
- v1 不实现登录页；MSW 对所有请求放行
- 后端加鉴权时前端零结构改动

### 4.4 积分只读

- 契约仅 `GET /api/credits`（余额 + 流水）
- 扣费规则由后端实现（防绕过），前端纯展示；顶栏余额来自该接口

### 4.5 切换真后端

- MSW handler 与契约逐接口一一对应
- 后端就绪后：关闭 MSW、Vite dev proxy `/api` 指向后端地址，业务代码零改动
- Vite 配置中预留 proxy 占位（默认指向 `http://localhost:8080`，可 env 覆盖）

## 5. Mock 策略

- MSW handler 按契约逐接口实现；长任务 handler 模拟真实时序：提交 → pending → running（进度递增）→ succeeded（带 result URL）
- 演示数据完整复用《逆命木叶》套件（从 `hogee-demo-assets/` 复制进 `frontend/public/demo-assets/`）：
  - 视频：clip1.mp4 / clip2.mp4 / clip3.mp4
  - 图片：corridor.jpg、linwan.png、itachi.png
  - 数据：SEGS 分镜数组（3 片段 / 7 分镜的提示词/台词/语音标注）、模型列表、通知列表（改写为 DeepSFV 品牌文案）
- localStorage 仅存主题、工作流进度等 UI 状态；业务数据一律走 MSW 请求层（不再像原型那样散落 localStorage）

## 6. 交付物

1. `frontend/` 完整工程（v1 全部页面，§3）
2. `frontend/docs/api/openapi.yaml` 契约文档
3. MSW handlers（与契约一一对应）
4. `frontend/docs/backend-guide.md` 后端对接说明书：轮询模式说明、错误码约定、接口清单、MSW 切换流程

## 7. 实施顺序

1. 脚手架：Vite + React 19 + TS strict + AntD 暗色主题 + 路由骨架 + 布局（侧栏/顶栏）
2. OpenAPI 契约初稿（全接口 + TaskStatus 模型）
3. MSW 层 + `useTask` 轮询 hook + 请求层（token 占位/401）
4. 页面按依赖顺序实现：首页（项目列表）→ 创作入口 → STEP1 → STEP2 → STEP3 → 片段编辑器 → 创意市场
5. 后端对接说明书收尾

---

## 附：决策记录

| 决策点 | 结论 | 日期 |
|---|---|---|
| 框架 | React 19（存量复用 + React Flow 生态 + AI 维护友好） | 2026-09-18 |
| ui-oh-story | 暂不复用，保持兼容 | 2026-09-18 |
| 后端协作 | 契约先行 + MSW，后端选型开放 | 2026-09-18 |
| 异步模式 | v1 全轮询，无 SSE/WS | 2026-09-18 |
| 鉴权 | token 占位，v1 无登录页 | 2026-09-18 |
| 积分 | 只读展示，扣费归后端 | 2026-09-18 |
| 节点画布/画布管理/创意对话/资产广场 | 二期 | 2026-09-18 |
| 首页 | 空间页改造为项目列表 | 2026-09-18 |
| 浏览器 | 仅桌面端 ≥1280px | 2026-09-18 |
| Mock 数据 | 复用《逆命木叶》素材 | 2026-09-18 |
| 品牌 | UI 显示 DeepSFV，包名 deepsfv-frontend，目录 frontend/ | 2026-09-18 |
