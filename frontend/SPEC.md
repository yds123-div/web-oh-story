# Frontend 对齐 hogee-demo-assets 还原规格书（SPEC）

> 版本：v1.0（2026-09-19）
> 状态：已与用户达成共识，待按阶段执行
> 适用范围：`D:\Shenlan\web-oh-story\frontend`

---

## 1. 背景与目标

`frontend`（React 19 + Vite + antd 5 + zustand + react-router 7 + MSW）与 `hogee-demo-assets`（12 个静态 HTML demo 页 + shared.css/shared.js）存在显著差距：5 个整页缺失、8 处页面内功能缺口。

本规格书定义将 frontend 对齐 demo 的完整工作范围、技术决策与验收标准。

**验收原则**：以 `hogee-demo-assets` 为验收标准，逐页忠实还原；已确认的例外见 §2。

---

## 2. 已确认的关键决策

| # | 决策点 | 结论 |
|---|--------|------|
| D1 | demo 的地位 | **忠实还原**（验收标准），非仅风格参考 |
| D2 | 修复优先级 | 先补 A 类整页，再补 B 类页面内缺口 |
| D3 | 技术栈 | 保留 React 技术栈迭代，**不**以 demo HTML 为底子重写 |
| D4 | 后端耦合 | 当前为**静态界面阶段**，mock 驱动（MSW + openapi.yaml 契约先行，随改动同步更新） |
| D5 | 范围 | 4 个整页：节点画布、画布管理、资产广场、创意对话；**不做** demo 的总览首页 |
| D6 | 首页 | 保持现状：`/` = 个人空间页（对应 demo 的 space.html），不改为 demo 的 index.html 总览页 |
| D7 | 品牌 | **DeepSFV**（"D" logo），demo 的 Hogee 仅为占位 |
| D8 | 节点画布技术 | 引入 **React Flow**（@xyflow/react），唯一新依赖 |
| D9 | 静态阶段还原深度 | 生成类操作走 MSW 假任务流（复用 useTask）；编辑类工具纯 UI + toast |
| D10 | B 类修复顺序 | studio → create → idea → outline → assets → 空间导出记录表 |
| D11 | SideNav 结构 | 首页(个人空间) / 创意 / 创作 / 画布 / 资产 / 团队(占位 toast)，共 6 项 |
| D12 | 创意对话历史 | localStorage 持久化（与 demo shared.js 同款心智） |
| D13 | 验收方式 | 差距表 checklist 逐项打勾 |

**不动的部分**：frontend 已反超 demo 的能力保持不变——真实任务轮询（useTask + MSW）、分镜可编辑（时长/景别/运镜/台词/语音标注）、@提及插入菜单、工作流门控（zustand store）、真实文件校验、明暗主题持久化、单元测试。这些是资产，改造时不得回退。

**数据源**：新页面统一复用 `public/demo-assets/` 已有媒体（clip1-3.mp4、corridor.jpg、itachi.png、linwan.png）。

---

## 3. 信息架构与路由（目标态）

```
/                          首页 = 个人空间（现状保留，补导出记录表）
/idea                      创意灵感市场（补齐三块缺失板块）
/create                    创作页（补小说模式 + 参数）
/project/:id/outline       STEP1 剧本工作台（补分集 tab + 编辑模式）
/project/:id/assets        STEP2 资产工坊（补多形象/详情弹窗/库管理）   [工作流门控]
/project/:id/episodes      STEP3 分集列表（现状已达标）                [工作流门控]
/project/:id/episode/:eid  StudioPage 分镜工作台（补 8 项功能）       [工作流门控]
/canvas                    画布管理（新增）
/canvas/:id                节点画布（新增，React Flow）
/plaza                     资产广场（新增）
/creative                  创意对话（新增）
（团队导航项：占位，点击 toast「团队功能即将上线」）
```

SideNav：首页 / 创意 / 创作 / 画布 / 资产 / 团队(占位)。

---

## 4. 阶段一：A 类整页

### A1. 节点画布 `/canvas/:id`（旗舰页面）

还原 demo `node.html`（LibTV 风格无限画布）。

**技术**：@xyflow/react（React Flow）。节点 UI、业务状态自研；平移/缩放/连线/minimap 用库能力。

**验收要点**：
- [ ] 预置 21 条边的完整管线图（与 demo 初始拓扑一致）
- [ ] 画布拖拽平移 / 滚轮缩放 / minimap
- [ ] SVG 贝塞尔连线，hover 显示删除标记，点删除断开
- [ ] 端口拖拽连接节点（连线校验：仅合法端口可连）
- [ ] 右键上下文菜单：10 种节点类型可添加
- [ ] 工具栏 12+ 功能（视频/图片/音频/文本/智能剪辑/三视图/九宫格/灯光/高清扩图/逐帧拉片/片段重拍 TAKE/打组复用）——纯 UI + toast（D9）
- [ ] 节点卡操作：预览 / 复制 / 删除
- [ ] 打组：框选成组，组面板，模板重新执行（toast）

### A2. 画布管理 `/canvas`

还原 demo `canvas.html`。

- [ ] 我的画布：列表卡片，进入节点画布
- [ ] 新建画布弹窗：名称 + 画面比例选择器
- [ ] 创作工坊：共享画布画廊，分类 chips 筛选 + 搜索

### A3. 资产广场 `/plaza`

还原 demo `asset.html`。

- [ ] 分类 chips + 搜索
- [ ] 瀑布流（masonry）网格：图片 + 视频缩略（复用 demo-assets 媒体）
- [ ] AI生成 标签
- [ ] 预览弹窗 + 豆包风格编辑工具（AI抠图/擦除/标记改图/扩图/变清晰）——纯 UI + toast（D9）
- [ ] 真实文件上传（50MB 上限 + 校验）
- [ ] 「加入项目」弹窗（选择项目，写入选中项目的素材库）

### A4. 创意对话 `/creative`

还原 demo `creative.html`。

- [ ] 历史会话侧栏（localStorage 持久化，D12）
- [ ] 生成类型切换：图片 / 视频
- [ ] 提示词输入 → 参数确认弹窗（模型/画质/比例/数量/积分）
- [ ] 生成结果卡：走 MSW 假任务流（D9），完成后内嵌编辑工具（toast）
- [ ] 重新生成 / 下载 / 加入项目

---

## 5. 阶段二：B 类页面内补洞（按 D10 顺序）

### B1. StudioPage（对照 `studio.html`，缺口最多）

- [ ] 头部补：风格库 / 画面比例 / 清晰度 三个下拉
- [ ] 音画同出面板：波形条动画、生成配音按钮及合成状态
- [ ] 时间轴：拖拽排序
- [ ] 时间轴：多选 + 批量操作（批量重新生成 / 批量删除 / 批量导出）
- [ ] 新建片段按钮
- [ ] 分集切换下拉（在 studio 内直接切集）
- [ ] 导出弹窗补：分辨率 / 格式 / 水印 选项
- [ ] 生成进度六阶段文案（当前只有 pending/running）
- [ ] 预览 meta 不再硬编码 9:16·720P，随参数联动

### B2. CreatePage（对照 `create.html`）

- [ ] 小说模式：≤10 万字上传/粘贴 → 小说转剧本 4 步进度（MSW 假任务流）
- [ ] 创作参数：分类 / 风格库 / 视频比例 / 场景比例 / 生图质量（9 积分/张）
- [ ] 校验 chips（格式 ✓ / 大小 ✓ / 字数 ✓）

### B3. IdeaPage（对照 `idea.html`）

- [ ] 爆款拆解板块 + 拆解弹窗（爆点密度条形图）
- [ ] 模板市场：tag 筛选 + 搜索
- [ ] 风格库：6 张风格卡
- [ ] 创意对话入口（跳 `/creative`）

### B4. OutlinePage（对照 `outline.html`）

- [ ] 分集 tab（第1集 正式 / 第2集 草稿 切换）
- [ ] 剧本编辑模式（✎ 编辑 → 保存）
- [ ] agent 聊天逐条入场动画（staggered）+「解读中」动态文案

### B5. AssetsPage（对照 `assets.html`）

- [ ] 角色多形象：默认形象 / 和服·雨夜湿发 版本切换
- [ ] 资产详情弹窗：被引用分镜、生成新形象 v+1、解锁一致性
- [ ] 道具/素材库管理弹窗：新增道具占位卡 / 上传素材
- [ ] 全部重新生成

### B6. 首页/个人空间（对照 `space.html`）

- [ ] 成片导出记录表：任务/范围/规格/状态/时间/下载/重新合成

---

## 6. 技术约定

1. **新依赖**：仅 `@xyflow/react`。其余用现有 antd 5 / zustand / MSW 体系。
2. **主题**：新页面沿用 `src/theme.ts` 的 token 映射 + `overrides.css` 的 ds-* 体系，明暗双主题下均需验收（demo shared.css 是 dark-first，light 模式不能破相）。
3. **任务流**：A4/B2 的生成类走现有 useTask + MSW handler，openapi.yaml 契约随加随更。
4. **路由门控**：新增页面不加工作流门控（画布/广场/创意是独立入口）；既有 project 内页面维持门控不变。
5. **测试**：新增 lib 逻辑（localStorage 历史管理、连线校验等）补 vitest 单测；纯 UI 页面不强制。
6. **验收流程**：每完成一个 checklist 项即打勾；每完成一个页面，与 demo 对应 HTML 并排肉眼比对一次视觉还原度。

---

## 7. 里程碑

| 里程碑 | 内容 | 出口条件 |
|--------|------|----------|
| M1 | A1 节点画布 + A2 画布管理 + SideNav 改版 | checklist 全勾 |
| M2 | A3 资产广场 + A4 创意对话 | checklist 全勾 |
| M3 | B1 StudioPage 八项补洞 | checklist 全勾 |
| M4 | B2–B6 其余页面补洞 | checklist 全勾 |
| M5 | 终验：全页面与 demo 并排比对 + 明暗主题回归 + 测试通过 | 本 SPEC §4–§5 全部勾选 |

执行顺序：M1 → M5，串行推进。
