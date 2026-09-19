# 前端框架选型调研报告：AI 短剧创作工坊

> 调研日期：2026-09-18  
> 项目：dsh-story / Hogee 风格 AI 短剧创作工坊  
> 调研目标：为新产品选择合适的前端框架（React / Vue / Svelte）

---

## TL;DR

**主选推荐：React 19 + Vite + React Flow + Ant Design / shadcn/ui。**

核心理由：
1. **存量复用成本最低** — 现有 `ui-oh-story` 插件体系完全基于 React（peerDependencies: react/react-dom），选 React 可零成本复用全部插件组件，避免跨框架桥接的复杂度和性能损耗。
2. **节点画布生态最强** — React Flow（@xyflow/react）是当前节点编辑器领域的事实标准，生态最成熟、文档最全、社区最活跃；Vue Flow 是其 Vue 移植版，功能有差距。
3. **AI 工具链最成熟** — React 的训练语料、Stack Overflow 问答、组件库生态数量均显著领先，AI agent 维护代码的效率最高。
4. **中文 AI 工具风格组件库选择多** — Ant Design 5.x + Pro Components 是国内 AI 产品（即梦、可灵等）的主流选择，shadcn/ui 提供高定制自由度。

**备选：Vue 3 + Vue Flow + Naive UI / Element Plus。**  
如果团队已有深厚 Vue 技术栈积累且愿意承担跨框架集成成本，可以选 Vue。但需要为 ui-oh-story 插件体系设计 Web Components 包装层或微前端方案，预计增加 2-3 周集成工作量和长期维护成本。

**不推荐 Svelte 5** — 生态太小，节点画布库仅有 Svelte Flow（同 xyflow 团队出品但社区更小），组件库和中文资料少，AI 维护语料不足，风险最高。

---

## 1. 项目需求盘点

基于 Hogee 原型（`hogee-demo-assets/`）提炼的核心需求：

### 1.1 页面结构
- **多页面**：首页、创意、创作（三步工作流）、画布、资产、空间、节点编辑器等约 10+ 页面
- **布局模式**：左侧固定导航（78px 图标栏）+ 顶部栏（积分系统、通知、主题切换、用户头像）+ 主内容区
- **双模式入口**：向导模式（三步工作流）+ 自由模式（节点画布）

### 1.2 核心技术难点
| 需求 | 复杂度 | 说明 |
|------|--------|------|
| 无限节点画布 | 🔴 高 | 五种基础节点（文本/图片/视频/音频/脚本）自由连线、缩放平移、小地图、右键菜单、打组复用、选中节点调用 12+ 专业功能 |
| 资产管理 | 🟡 中 | 角色/场景/道具卡片网格、图片瀑布流、视频预览、一致性锁定 |
| 引导式工作流 | 🟡 中 | 多步骤表单、智能体进度展示、AI 生成状态追踪 |
| 视频播放器 + 时间轴 | 🟡 中 | 片段缩略图时间轴、逐帧检视、合成导出进度 |
| 主题系统 | 🟢 低 | 明暗主题切换、CSS 变量驱动 |
| 积分系统 | 🟢 低 | 顶栏积分展示、消耗记录 |

### 1.3 技术约束
- 后端/插件生态：TypeScript + ESM
- 现有插件体系：`ui-oh-story` 基于 React + @deepseek-ai/cordis 等 workspace 包
- UI 语言：中文
- 设计风格：AI 工具风（类即梦 / LibLib / 可灵），深色为主

---

## 2. 框架对比

### 2.1 总览对比表

| 维度 | React 19 | Vue 3 | Svelte 5 |
|------|----------|-------|----------|
| **与现有 React 插件集成** | ✅ 零成本，直接使用 | ⚠️ 需 Web Components / 微前端桥接 | ⚠️ 需包装层，方案不成熟 |
| **节点画布生态** | 🌟 React Flow（最强） | ✅ Vue Flow（移植版） | ✅ Svelte Flow（同团队但社区小） |
| **中文组件库选择** | 🌟 Ant Design + shadcn/ui + Arco | ✅ Element Plus + Naive UI + Arco Vue | ⚠️ 选择极少 |
| **TypeScript 支持** | 🌟 一流（函数式 + 泛型 JSX） | ✅ 一流（SFC + Volar） | ✅ 良好（runes + 编译期推导） |
| **性能（运行时）** | ✅ 良好（VDOM + 并发模式） | ✅ 良好（响应式 + VDOM） | 🌟 最优（无运行时编译） |
| **构建速度** | ✅ Vite 下良好 | ✅ Vite 下优秀 | 🌟 最快 |
| **包体积** | 🟡 较大（react-dom ~40KB gzip） | 🟡 中等（vue ~34KB gzip） | 🌟 最小（编译器输出） |
| **生态规模（npm 下载量）** | 🌟 最大 | ✅ 第二 | ⚠️ 最小 |
| **AI 训练语料丰富度** | 🌟 最多 | ✅ 丰富 | ⚠️ 较少 |
| **学习曲线** | 🟡 中等（Hooks + 心智模型） | 🟢 平缓（模板语法直观） | 🟢 平缓（runes 语法简洁） |
| **长期维护风险** | 🟢 Meta 背书，最稳定 | 🟢 尤雨溪团队，稳定 | 🟡 团队小，Svelte 5 刚发布 |

### 2.2 与现有 React 存量的集成成本

这是本项目最重要的决策因子。现有 `ui-oh-story` 包的 peerDependencies 包含完整的 React 生态（react、react-dom、@deepseek-ai/dsh-client-ui-* 系列）。

#### 方案 A：选 React — 零成本
- 直接 import 现有组件，无桥接层
- 状态共享、Context、事件系统原生一致
- TypeScript 类型直接贯通
- **代价**：无

#### 方案 B：选 Vue — 需要跨框架桥接

**方案 B1：Web Components 包装**

将 React 组件打包为 Custom Elements，在 Vue 中以原生 HTML 标签方式使用。

- **React 侧支持**：React 官方文档明确支持 Custom Elements，React 19 已优化属性/属性自动识别
  > "React supports all custom HTML elements...React will pass values in JSX as attributes by default, but will recognize properties defined on the custom element class."
  > 来源：[React 官方文档 - Custom HTML Elements](https://react.dev/reference/react-dom/components#custom-html-elements)

- **Vue 侧支持**：Vue 3 官方文档提供完整的 Web Components 消费指南
  > "Vue provides robust support for both consuming custom elements within Vue applications and using Vue to build and distribute custom elements."
  > 来源：[Vue 官方文档 - Web Components](https://vuejs.org/guide/extras/web-components.html)

- **局限性**：
  - 复杂对象（React Context、函数回调）通过 Custom Element 传递需额外序列化
  - 样式隔离（Shadow DOM）导致主题变量共享困难
  - TypeScript 类型需要手动声明，无法自动推导
  - 性能开销：每个 Web Component 内部有独立的 React 渲染树

- **成熟工具**：`@r2wc/react-to-web-component`（React to Web Component）

**方案 B2：微前端（qiankun / Module Federation）**

- 将 React 插件作为独立子应用加载
- 适合整页面级集成，不适合细粒度组件复用
- 复杂度高，仅建议在"整个工作台独立为 React 应用"的架构下考虑

**方案 B3：同一项目双框架（vuera / 手动包装）**

- Vue 项目中同时引入 React，用包装组件桥接
- 运行时同时加载两个框架，包体积增加 ~70KB gzip
- 状态管理、事件系统不互通
- 维护成本高，不推荐长期使用

**方案 B4：iframe 隔离**

- 最彻底的隔离，但通信成本最高
- 仅适合完全独立的大块功能（如独立的聊天窗口）
- 用户体验割裂（滚动、弹窗、主题不一致）

#### 方案 C：选 Svelte — 方案最不成熟
- Svelte 与 React 互操作的成熟方案极少
- Web Components 路径可行但社区经验少
- 不推荐

### 2.3 生态规模与 TypeScript

| 指标 | React | Vue 3 | Svelte 5 |
|------|-------|-------|----------|
| npm 周下载量（量级） | ~2000万+ | ~500万+ | ~100万+ |
| GitHub Stars（框架本体） | 22万+ | 45万+ | 7.5万+ |
| TypeScript 支持 | 原生一流 | 原生一流 | 良好（编译期） |
| 官方类型声明 | 是 | 是 | 是 |
| 模板类型检查 | 通过 TypeScript + 编辑器插件 | Volar / Vue - Official 扩展 | Svelte 语言服务器 |

> 来源：[React GitHub](https://github.com/facebook/react)、[Vue GitHub](https://github.com/vuejs/core)、[Svelte GitHub](https://github.com/sveltejs/svelte)、npm trends

### 2.4 AI 维护友好度

从"未来代码可能由 AI agent 维护"的角度：

1. **React 最友好**
   - Stack Overflow 问题数最多（约 45 万+ react 标签问题）
   - GitHub 代码库数量最多，训练语料最丰富
   - Hooks 模式已被 AI 深度理解
   - TypeScript + React 的代码生成质量最高

2. **Vue 3 友好**
   - 中文资料极丰富（国内社区活跃）
   - Composition API 已被广泛训练
   - 但英文资料量少于 React

3. **Svelte 5 最不友好**
   - Svelte 5 runes 是新 API（2024 年发布），训练数据少
   - 整体生态小，问题解决方案少
   - AI 生成 Svelte 代码的准确率低于 React/Vue

> 来源：Stack Overflow Tags 统计、GitHub 仓库搜索结果量级

---

## 3. 节点画布库专项对比

节点画布是本项目技术上最重的需求，以下是主流方案对比。

### 3.1 对比总表

| 库 | 框架 | Stars | 维护状态 | 自定义节点 | 自定义连线 | 小地图 | 分组 | 右键菜单 | 撤销重做 | 性能 | 许可证 | 推荐度 |
|----|------|-------|----------|-----------|-----------|--------|------|----------|----------|------|--------|--------|
| **React Flow** | React | ~30k+ | 🌟 活跃 | ✅ 完全 | ✅ 完全 | ✅ MiniMap | ✅ Group Node | ✅ 可实现 | ✅ useUndo | 🌟 优秀 | MIT | 🌟🌟🌟🌟🌟 |
| **Vue Flow** | Vue 3 | ~2.5k+ | ✅ 活跃 | ✅ 完全 | ✅ 完全 | ✅ MiniMap | ✅ | ✅ 可实现 | ✅ | ✅ 良好 | MIT | 🌟🌟🌟🌟 |
| **Rete.js** | 框架无关 | ~10k+ | ✅ 活跃 | ✅ 完全 | ✅ 完全 | ✅ Preset | ✅ | ✅ | ✅ | ✅ 良好 | MIT | 🌟🌟🌟🌟 |
| **tldraw** | React | ~30k+ | 🌟 活跃 | ✅ 自定义 Shape | ⚠️ 连线需绑定系统 | ✅ | ✅ | ✅ 原生 | ✅ 原生 | 🌟 优秀 | 商业（需 license） | 🌟🌟🌟 |
| **Svelte Flow** | Svelte | - | ✅ 活跃 | ✅ 完全 | ✅ 完全 | ✅ | ✅ | ✅ | ✅ | 🌟 优秀 | MIT | 🌟🌟🌟 |
| **LogicFlow** | 框架无关 | ~6k+ | ⚠️ 一般 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 中等 | Apache-2.0 | 🌟🌟 |
| **LiteGraph.js** | 原生 JS | ~6k+ | ⚠️ 维护慢 | ✅ | ✅ | ⚠️ 无原生 | ⚠️ | ✅ | ✅ | 🟡 中等 | MIT | 🌟🌟 |

### 3.2 各库详细评估

#### React Flow (@xyflow/react) — 最推荐
- **官方文档**：[reactflow.dev](https://reactflow.dev/)
- **核心功能**：
  - 无限画布、缩放、平移、框选
  - 自定义节点（标准 React 组件）— 可渲染图片、视频、任意富媒体
  - 自定义连线（Bezier、Straight、Step、SmoothStep + 完全自定义）
  - MiniMap 小地图（可缩放、可平移）
  - Controls 控制条
  - Background 背景网格
  - NodeToolbar 节点工具栏
  - NodeResizer 节点缩放
  - Group Node（带 parentId 的嵌套分组）
  - 触摸设备支持
- **性能**：虚拟渲染（onlyRenderVisibleElements），数百节点流畅
- **许可证**：MIT，免费商用；去掉底部 attribution 需要 Pro 订阅
- **架构**：节点是标准 React 组件，完全可定制，可集成 Tailwind / 任意 CSS 框架
- **来源**：[React Flow 官方文档 - Features](https://reactflow.dev/)、[xyflow GitHub](https://github.com/xyflow/xyflow)

#### Vue Flow (@vue-flow/core)
- **官方文档**：[vueflow.dev](https://vueflow.dev/)
- **核心功能**：基本对齐 React Flow（同 xyflow 生态，Vue 移植版）
  - 自定义节点（Vue SFC 组件）
  - MiniMap、Controls、Background
  - 平移、缩放、框选、多选
- **代码片段数**：760（vueflow.dev 网站文档）
- **许可证**：MIT
- **相对 React Flow 的差距**：社区更小、示例更少、第三方插件生态更薄
- **来源**：[Vue Flow 官方文档](https://vueflow.dev/)

#### Rete.js
- **官方文档**：[retejs.org](https://retejs.org/)
- **特点**：框架无关的节点编辑器框架，支持 React / Vue / Angular / Svelte / Lit 渲染插件
- **核心功能**：
  - 数据流 + 控制流双模式
  - Minimap preset
  - 连接插件、区域插件
  - TypeScript-first
- **许可证**：MIT
- **适合场景**：需要跨框架复用节点逻辑的项目
- **来源**：[Rete.js 官方文档](https://retejs.org/docs)

#### tldraw
- **官方文档**：[tldraw.dev](https://tldraw.dev/)
- **特点**：无限白板 SDK，不是专门的节点编辑器，但可通过自定义 Shape + 绑定系统实现节点连线
- **核心功能**：
  - 高性能无限画布
  - 内置绘图、文字、便签等 Shape
  - 多人协作同步
  - 自定义 Shape（CardShape 等）
  - Nodes and connections starter kit（节点 + 连线绑定系统）
- **许可证**：**商业许可证**，需要 license key
- **适合场景**：偏自由画布/白板风格，而非严格的节点工作流
- **来源**：[tldraw GitHub](https://github.com/tldraw/tldraw)、[tldraw 工作流示例](https://github.com/tldraw/tldraw/blob/main/apps/docs/content/starter-kits/workflow.mdx)

### 3.3 针对本项目的画布库推荐

**首选：React Flow**

理由：
1. **功能完美匹配**：五种基础节点 + 连线 + 小地图 + 分组 + 自定义节点渲染图片视频，全部原生支持
2. **生态最成熟**：最多的示例、最全的文档、最大的社区
3. **性能可靠**：虚拟渲染 + 仅渲染可视区域，百级节点流畅
4. **MIT 许可证**：免费商用，Pro 仅用于去水印和高级支持
5. **与 React 框架深度集成**：节点就是 React 组件，状态管理、事件处理完全自然

**如果选 Vue：Vue Flow**

- 同一团队的 Vue 版本，功能基本对齐
- 但社区资源和第三方插件少一档

---

## 4. 中文 AI 工具风格组件库对比

### 4.1 React 侧

| 库 | Stars | 组件数 | 暗色主题 | TypeScript | 中文文档 | AI 组件生态 | 定制化难度 | 适合度 |
|----|-------|--------|----------|------------|----------|-------------|------------|--------|
| **Ant Design 5** | ~90k+ | ~80+ | ✅ 内置（CSS-in-JS） | 🌟 原生 | 🌟 官方中文 | ✅ Pro Components + antd AI | 低-中 | 🌟🌟🌟🌟🌟 |
| **shadcn/ui** | ~70k+ | ~50+ | ✅ 支持 | 🌟 原生 | ⚠️ 英文为主 | ✅ 丰富的社区 AI 组件 | 低（复制粘贴） | 🌟🌟🌟🌟 |
| **Arco Design** | ~14k+ | ~60+ | ✅ 内置 | ✅ 一流 | ✅ 官方中文 | ⚠️ 较少 | 中 | 🌟🌟🌟 |
| **MUI** | ~92k+ | ~50+ | ✅ 内置 | ✅ 一流 | ⚠️ 英文为主 | ✅ MUI X 扩展 | 高 | 🌟🌟🌟 |

#### Ant Design 5.x — 最推荐
- **特点**：蚂蚁集团出品，企业级 UI 设计语言，国内 AI 产品主流选择
- **技术栈**：React + TypeScript + CSS-in-JS
- **主题定制**：通过 ConfigProvider + theme token 配置，支持明暗算法组合
  > "Ant Design 5.0 theming is powered by CSS-in-JS...enables dynamic theme switching, multiple concurrent themes, and fine-grained style customization."
  > 来源：[Ant Design 自定义主题](https://ant.design/docs/react/customize-theme)
- **Pro Components**：ProTable、ProForm、ProLayout 等高级业务组件
- **AI 相关**：Ant Design 官方有 @ant-design/x（AI 组件库），包含 Bubble、Prompts、Conversation 等组件
- **来源**：[Ant Design GitHub](https://github.com/ant-design/ant-design)、[Ant Design 官网](https://ant.design/)

#### shadcn/ui
- **特点**：不是 npm 包，而是把组件源码复制粘贴到项目中，最高自由度
- **技术栈**：React + TypeScript + Tailwind CSS + Radix UI
- **优势**：样式完全可控，没有包依赖包袱
- **劣势**：中文文档少，需要自己维护组件升级
- **来源**：[shadcn/ui GitHub](https://github.com/shadcn-ui/ui)、[shadcn/ui 官网](https://ui.shadcn.com/)

### 4.2 Vue 侧

| 库 | Stars | 组件数 | 暗色主题 | TypeScript | 中文文档 | AI 组件生态 | 定制化难度 | 适合度 |
|----|-------|--------|----------|------------|----------|-------------|------------|--------|
| **Element Plus** | ~24k+ | ~60+ | ✅ 内置（CSS Vars） | ✅ 一流 | 🌟 官方中文 | ⚠️ 较少 | 低-中 | 🌟🌟🌟🌟 |
| **Naive UI** | ~15k+ | 90+ | ✅ 内置 | 🌟 原生一流 | ✅ 官方中文 | ⚠️ 较少 | 低-中 | 🌟🌟🌟🌟 |
| **Arco Design Vue** | ~3k+ | ~60+ | ✅ 内置 | ✅ 一流 | ✅ 官方中文 | ⚠️ 较少 | 中 | 🌟🌟🌟 |
| **Ant Design Vue** | ~20k+ | ~60+ | ✅ 内置 | ✅ 一流 | ✅ 官方中文 | ⚠️ 较少 | 中 | 🌟🌟🌟 |

#### Element Plus
- **特点**：饿了么出品，Vue 3 生态最主流的组件库
- **暗色主题**：2.2.0+ 支持，基于 CSS 变量
  > "We extracted and unified all necessary variables to make it possible to implement based on CSS Vars."
  > 来源：[Element Plus 暗色模式](https://element-plus.org/zh-CN/guide/dark-mode.html)
- **来源**：[Element Plus GitHub](https://github.com/element-plus/element-plus)

#### Naive UI
- **特点**：TypeScript 原生、性能好、90+ 组件、全量 tree-shaking
  > "Naive UI is a Vue 3 component library. It includes over 90 components. All components are tree-shakable."
  > 来源：[Naive UI README](https://github.com/tusen-ai/naive-ui)
- **暗色主题**：通过 NConfigProvider + darkTheme 一键切换
- **来源**：[Naive UI GitHub](https://github.com/tusen-ai/naive-ui)

### 4.3 组件库推荐结论

| 框架 | 主选 | 备选 |
|------|------|------|
| React | **Ant Design 5 + Pro Components** | shadcn/ui + Tailwind |
| Vue | **Naive UI**（TypeScript 最友好） | Element Plus（生态最大） |

---

## 5. 架构形态建议

### 5.1 选项分析

| 形态 | 说明 | 优点 | 缺点 | 适合度 |
|------|------|------|------|--------|
| **SPA（单页应用）** | 一个 HTML 入口，前端路由切换 | 节点画布状态不丢失、交互流畅、首屏后切换快 | 首屏加载较大（可 code splitting 优化） | 🌟🌟🌟🌟🌟 |
| **MPA（多页应用）** | 每个页面独立 HTML | SEO 友好、首屏快 | 节点画布跨页面状态丢失、重复加载 | 🌟🌟 |
| **桌面端（Electron/Tauri）** | 打包为桌面应用 | 离线能力、文件系统访问、性能 | 分发复杂、体积大、开发成本高 | 🌟🌟🌟 |
| **PWA** | Web App + 离线缓存 | Web + 类原生体验 | 离线能力有限 | 🌟🌟🌟 |

### 5.2 推荐：SPA（单页应用）+ Vite 路由级代码分割

**理由**：

1. **节点画布是核心体验** — 画布状态（节点位置、连线、缩放比例）需要在页面切换时保持。如果是 MPA，每次跳转都要重新渲染画布，用户体验差。

2. **原型是多页 HTML 仅为演示方便** — 原型用多个 HTML 文件是为了快速演示和独立查看，不代表最终产品架构。原型中 `shared.css` / `shared.js` + 相同的侧边导航和顶栏结构，本质上就是 SPA 的布局模式。

3. **三步工作流需要状态传递** — 剧本大纲 → 资产 → 分集视频，每一步的产出需要作为下一步的输入。SPA 的全局状态管理（Zustand / Pinia / Redux）比 MPA 的 URL 参数 / localStorage 方案更可靠。

4. **性能可以接受** — 通过 Vite 的路由级代码分割，首屏只加载首页和布局代码（~100KB gzip），节点画布等重页面按需加载。

### 5.3 构建工具：Vite

三个框架都首选 Vite：
- React：`@vitejs/plugin-react`
- Vue：`@vitejs/plugin-vue`
- Svelte：`@sveltejs/vite-plugin-svelte`

Vite 已经是事实标准，开发体验和构建速度都最优。

### 5.4 状态管理

| 框架 | 推荐方案 |
|------|----------|
| React | Zustand（轻量）或 Redux Toolkit（大型应用） |
| Vue | Pinia（官方推荐） |
| Svelte | Svelte 5 runes（$state / $derived） |

---

## 6. 最终推荐与理由

### 6.1 主选方案：React 19 + Vite + React Flow + Ant Design

```
技术栈：
- 框架：React 19
- 构建：Vite 5+
- 路由：React Router
- 状态：Zustand（轻量优先）
- 节点画布：React Flow (@xyflow/react)
- 组件库：Ant Design 5.x + Pro Components
- 样式：CSS-in-JS（Ant Design 内置）+ 自定义 CSS 变量
- 语言：TypeScript 严格模式
- 包管理：pnpm（与现有 workspace 一致）
```

**选择理由：**

1. **存量复用零成本** — 现有 `ui-oh-story` 插件体系是 React，直接 import 使用，状态、类型、样式全部贯通。省去跨框架桥接的 2-3 周工作量和长期维护债务。

2. **节点画布最强生态** — React Flow 是节点编辑器领域的事实标准，功能完整、文档最全、社区最大。我们需要的"五种基础节点 + 图片视频渲染 + 连线 + 小地图 + 分组 + 右键菜单"全部原生支持或有标准实现路径。

3. **中文 AI 工具组件库最成熟** — Ant Design 5 + Pro Components 是国内 AI 产品（即梦、可灵、豆包等）的主流选择，暗色主题、中文文档、TypeScript 都一流。还有 @ant-design/x 的 AI 专用组件（对话、提示词等）。

4. **AI 维护最友好** — React 的训练语料最丰富，AI agent 生成和维护 React 代码的准确率最高。长期来看，AI 辅助开发的效率优势会越来越明显。

5. **风险最低** — React 生态最成熟，遇到任何问题都能快速找到解决方案。团队招聘和协作也最容易。

### 6.2 备选方案：Vue 3 + Vue Flow + Naive UI

如果团队有深厚的 Vue 技术栈积累且明确偏好 Vue，可以选择此方案，但需要清楚代价：

**需要额外付出的成本：**
- **集成成本**：为 ui-oh-story 插件体系搭建 Web Components 包装层，预计 2-3 周
- **运行时成本**：Web Components 内部独立 React 渲染树，状态共享和事件传递有额外开销
- **维护成本**：双框架知识栈，组件跨框架复用需维护包装层
- **生态差距**：Vue Flow 社区比 React Flow 小一档，遇到坑解决更慢
- **AI 辅助差距**：Vue 的 AI 训练语料少于 React

**获得的好处：**
- Vue 的模板语法更直观，上手更快
- 响应式系统比 React Hooks 心智模型更简单
- 国内 Vue 社区非常活跃，中文资料丰富

### 6.3 不推荐 Svelte 5 的原因

1. **生态太小** — 组件库选择极少，中文资料匮乏
2. **Svelte 5 runes 太新** — 2024 年才发布，训练数据和社区经验不足
3. **与现有 React 插件集成方案不成熟** — 风险最高
4. **节点画布只有 Svelte Flow** — 虽然是同团队出品，但社区最小

仅当团队有 Svelte 专家且项目规模小、不需要复用现有插件时才考虑。

### 6.4 诚实对比：选 React 付出什么 / 选 Vue 付出什么

| | 选 React 付出的代价 | 选 Vue 付出的代价 |
|---|-------------------|-------------------|
| **集成成本** | 0 | 2-3 周搭建 Web Components 包装层 |
| **运行时性能** | react-dom ~40KB gzip | vue ~34KB gzip（但要加 react-dom ~40KB 用于插件） |
| **学习曲线** | Hooks 心智模型稍陡 | 模板语法更直观 |
| **状态管理** | 需要选库（Zustand/Redux） | Pinia 官方方案，更统一 |
| **长期维护** | 单技术栈，风险低 | 双技术栈，维护成本高 |
| **生态丰富度** | 🌟 最丰富 | ✅ 丰富但略逊 |
| **AI 辅助效率** | 🌟 最高 | ✅ 良好 |
| **招聘/协作** | 🌟 最容易 | ✅ 国内也容易 |

---

## 7. 来源列表

### 框架官方文档
- React 官方文档：https://react.dev/
  - Custom HTML Elements：https://react.dev/reference/react-dom/components#custom-html-elements
- Vue 3 官方文档：https://vuejs.org/
  - Web Components：https://vuejs.org/guide/extras/web-components.html
  - TypeScript 支持：https://vuejs.org/guide/typescript/overview.html
- Svelte 官方文档：https://svelte.dev/docs
  - Svelte 5 runes：https://svelte.dev/docs/svelte/runes
  - TypeScript 支持：https://svelte.dev/docs/typescript

### 框架 GitHub
- React：https://github.com/facebook/react
- Vue：https://github.com/vuejs/core
- Svelte：https://github.com/sveltejs/svelte

### 节点画布库
- React Flow：https://reactflow.dev/ · https://github.com/xyflow/xyflow
- Vue Flow：https://vueflow.dev/ · https://github.com/bcakmakoglu/vue-flow
- Rete.js：https://retejs.org/ · https://github.com/retejs/rete
- tldraw：https://tldraw.dev/ · https://github.com/tldraw/tldraw

### 组件库
- Ant Design：https://ant.design/ · https://github.com/ant-design/ant-design
- shadcn/ui：https://ui.shadcn.com/ · https://github.com/shadcn-ui/ui
- Element Plus：https://element-plus.org/ · https://github.com/element-plus/element-plus
- Naive UI：https://www.naiveui.com/ · https://github.com/tusen-ai/naive-ui
- Arco Design：https://arco.design/

### 参考数据
- npm trends：https://npmtrends.com/
- Stack Overflow Tags：https://stackoverflow.com/tags
