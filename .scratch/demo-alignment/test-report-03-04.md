# 手动测试报告 — Issue 03（节点画布·工具与打组）& 04（画布管理）

- **测试日期**：2026-09-20
- **测试方式**：Playwright 真实驱动浏览器（点击/拖拽/输入/右键/键盘），dev server `localhost:5173`（MSW mock 数据），demo 静态服务 `localhost:8899`
- **比对基准**：`hogee-demo-assets/node.html`、`canvas.html`（含 `shared.js`），严格逐字逐细节标准
- **视口**：主比对 1920×1080，响应式 1366×768；明暗双主题
- **结论**：❌ **两个 issue 均不建议验收**。发现 **P0 ×1、P1 ×6、P2 ×16**，另有 demo 固有项 3 条。

---

## 一、总体结论

| 模块 | 结论 | 说明 |
|---|---|---|
| Issue 04 画布管理 | ⚠️ 基本可用但有多处偏差 | 列表/进画布/弹窗主流程通；封面图裂、搜索是死控件、chips 数据未打标导致 4 个分类全空 |
| Issue 03 节点画布 | ❌ 核心链路阻断 | **节点选中状态在真实点击后约 80ms 自动丢失**，导致 11 个工具按钮和打组功能在真实 UI 上永远走不到"选中后"分支 |

---

## 二、P0 — 功能阻断

### P0-1　节点选中即被清空，工具栏 12 个功能在真实 UI 上全部不可用（Issue 03）

**复现**：`/canvas/1` → 真实鼠标点击任意节点 → 节点边框短暂高亮 → 约 80ms 后高亮相关的工具栏 hot 态消失 → 点击任意工具按钮（如🎥视频生成）。

**实测结果**：
- 通过 fiber hooks 采样确认 `selectedNodes` 状态变化：`[] → ["script"] → []`（选中被设置后立即清空）。
- 真实点击节点后点「视频生成」：toast = **「请先点击选中一个节点，再调用该功能」**，节点数 14→14，无子节点生成。
- 点节点还会关闭右键菜单（说明 `onPaneClick` 在节点点击时被触发）。
- 合成 `mousedown` 事件（不产生后续 click 重定向）选中正常，hot 工具样式出现——进一步证明是事件流问题而非状态管理本身。

**根因（代码级定位）**：
1. `NodeCanvasPage.tsx:703` `nodeTypes = useMemo(..., [handleNodeAction])`，而 `handleNodeAction`（`:356`）的 useCallback 依赖了 `nodes`（`:387`）。**每次节点选中导致 `nodes` 变更 → nodeTypes 对象 identity 变化 → ReactFlow 把全部自定义节点组件 remount**（已实测：一次点击后节点 thumb DOM 被整体替换，见探针结果）。
2. mousedown 的原始目标在 click 发生前已被 remount 销毁，浏览器把后续 pointerup/click 重定向到 `.react-flow__pane`（实测 pane 的 React onClick 被调用，`event.target === pane`）。
3. `NodeCanvasPage.tsx:802` 的 `onPaneClick={() => { setSelectedNodes([]); closeContextMenu(); }}` 无条件执行 → 选中被清空。

**影响范围（验收清单）**：
- ❌ 12 工具"选中后"行为（视频/图片/音频/文本生成子节点、三视图、九宫格、灯光、高清扩图、逐帧、重拍 TAKE、智能剪辑）真实 UI **全部无法触发**。
- ❌ Ctrl+点击多选 → 打组：清除是无条件的，多选同样无法保持，**组面板/打组/模板重新执行无法通过 UI 验证**（代码存在，见下文"因 P0 未验证项"）。
- 节点拖拽本身可用（d3-drag 绑定在 wrapper 上，实测剧本节点可拖动 70px）。
- 复制/删除节点按钮多数情况下可用（onClick 路径），但与 remount 竞争，偶发不生效。

**修复方向提示**（仅供参考，未改动代码）：稳定 `nodeTypes`（把 `handleNodeAction` 移出依赖或用 ref/稳定回调，使 nodeTypes 全生命周期只创建一次）；自定义选中态建议直接用 ReactFlow 的 `onSelectionChange`/节点 `selected`，不要在 `onPaneClick` 里无条件清空一份独立 state。

---

## 三、P1 — 功能缺失 / 与 demo 不符

### P1-1　节点画布全部媒体资源裂图（6 图 + 3 视频）
`/canvas/1` 实测：`linwan.png`、`itachi.png`、4× `corridor.jpg`、`clip1~3.mp4` 全部加载失败（`naturalWidth=0` / `videoWidth=0`）。
原因：`INITIAL_NODES` 与各工具分支里写的是裸文件名（`corridor.jpg`、`clip1.mp4`），实际资源在 `/demo-assets/` 下。`/corridor.jpg` 被 SPA fallback 返回 `text/html`，所以控制台甚至不报 404，只显示裂图。
对比 demo：同样的节点图里林晚立绘、鼬立绘、长廊场景、三段视频帧全部正常显示（见 `demo-node-canvas-dark-*.png`）。

### P1-2　画布管理页「逆命木叶」封面裂图
`CanvasPage.tsx:154` `<img src={canvas.cover}>`，cover 值为 `corridor.jpg`（同样缺 `/demo-assets/` 前缀）。demo 卡片有 55% 透明度的真实剧照，app 是白/裂图占位（见 `app-canvas-dark-full-*.png` vs `demo-canvas-dark-full-*.png`）。

### P1-3　「↻ 重排」「🧹 清空」是死按钮
`NodeCanvasPage.tsx:785-790` 两个按钮 `onClick={() => {}}`，无任何反馈。demo 分别执行重排（toast「已按剧情重排管线布局」）和清空（toast「画布已清空，恢复快速入口」+ 回到快速入口）。Issue 03 明确要求纯 UI + toast 反馈。

### P1-4　工坊模板「用此创作」不跳转
demo：点「用此创作」跳转 `create.html`（`canvas.html:57` 等 4 处）。app（`CanvasPage.tsx:222-230`）只弹「演示：复制他人画布到我的项目」，URL 停留在 `/canvas`。点卡片本身弹该 toast 倒是与 demo 一致 ✓。

### P1-5　分类 chips 筛选：4/5 个分类点完画廊全空
筛选逻辑本身工作（实测「精选画布」「教育生活」→ 0 张卡片，无空状态文案）。根因：`sharedCanvases` 四条数据都没有打分类 tag（`CanvasPage.tsx:50-84`），而筛选是精确匹配分类名。demo 里 chips 是纯静态摆设（无 onclick，点了连高亮都不变）。Issue 04 验收要求"分类 chips 筛选 + 搜索"——app 选择做成真筛选，就需要把分类数据补齐；当前表现比 demo 的"假筛选"更差（黑屏无反馈）。

### P1-6　搜索框是不可输入的死控件
`CanvasPage.tsx:200-202` `.searchBox` 是纯 `<div>`，无法聚焦输入，无任何搜索逻辑。demo 同样是假输入框（固有项），但 issue 验收清单明确写了"搜索"，按验收标准记 P1。

---

## 四、P2 — 观感 / 逐细节不一致

### Issue 04（画布管理）

1. **「火影乱斗」归档卡片语义不符**：demo 为次要样式「打开画布」(toast 演示) +「已归档」(toast「该画布已归档」)；app 渲染成与进行中卡片完全一样的主按钮「打开画布」(实际跳转) +「三步工作流」。
2. **逆命木叶卡片缺副标题**：demo 有「第1集 · 异世囚笼」换行副标题，app 只有「3 片段 · 00:37 · 9:16」。
3. **工坊四张卡片配色全部相同**：demo 分别为蓝/金棕/酒红/青绿四种渐变；app 四张全是同一蓝色渐变。
4. **空名称校验与 demo 不一致**：app 名称为空时点创建 → toast「请输入画布名称」并拦截（`CanvasPage.tsx:89-91`）；demo 不拦截，默认命名「未命名画布」并照常创建。严格还原标准下为差异（app 行为更合理，见固有项）。
5. **创建成功 toast ✓**：「画布「测试画布A」已创建（16:9）」与 demo 逐字一致，卡片插入位置、默认 9:16 选中态、弹窗布局均一致（`app-canvas-create-modal-*.png` vs `demo-canvas-create-modal-*.png`，弹窗视觉高度一致）。唯「创建」按钮 app 为紫色实心，demo 为白色实心。
6. **超长名称无截断**：30+ 字的画布名横向溢出卡片边界，无省略号/换行处理。

### Issue 03（节点画布）

7. **缺模型选择器**：demo 工具栏标题后有「模型 Seedance 2.5 ▾」选择器（点击有弹层 + 切换 toast），app 完全没有。
8. **4 条无选中 toast 文案与 demo 不符**（严格逐字标准）：demo 视频/图片/音频/文本为「请先点击选中一个节点，再调用「视频生成」」（**带工具名**，`node.html:289`），app 统一是「请先点击选中一个节点，再调用该功能」。其余 7 条（三视图/九宫格/灯光/扩图/重拍/剪辑/拉片/打组提示）文案逐字一致 ✓。
9. **预览形态完全不同**：demo 是光标旁 ~250px 的小浮窗（miniPrev）；app 是全屏暗色遮罩 + 超大裂图（`app-node-preview-modal-*.png` vs `demo-node-preview-*.png`）。
10. **复制/删除节点无 toast**：demo 有「节点已复制：X」「节点已删除：X」；`handleNodeAction` 两个 case 均无 `showToast`。（注：测试早期曾短暂看到复制 toast，系 dev server HMR 旧模块残留，刷新后与磁盘代码一致：无 toast。）
11. **缺打组框视觉**：demo 打组后在画布上画一个带「📦 组 N · n 节点 · 已存为模板」标签的矩形框；app 只在角落渲染组面板，画布上无组框。
12. **缺快速入口/引导**：demo 首屏为 5 张快速入口卡 +「✨ 根据剧情生成画布」按钮 + 顶部操作提示条（canvasTip），点击后才生成 14 节点 21 连线；app 进页面直接展示完整图，三者均无。
13. **缩放交互差异**：demo 左下 ＋/−/⟲ 按钮，缩放有「画布缩放 xx%」toast，⟲ = 清空；app 用 ReactFlow 默认 Controls（＋/−/适应窗口/锁定），无缩放 toast；右下小地图 demo 有「MINIMAP」标题且可点击定位，app 无标题。
14. **连线视觉与交互**：demo 为紫色贝塞尔曲线 + 中置 ✕（点击删除并 toast「连线已删除：X ✕ Y」）；app 为 ReactFlow smoothstep 折线箭头，点击仅选中、不能删除（属 issue 02 回归范围，整页比对发现）。
15. **节点描边偏重**：app 每个节点有整条亮色类型色描边，demo 只有顶部一条细色条，整体 app 更"花"。
16. **toast 无 ✦ 前缀**：demo toast 统一「✦ 」开头、2.4s；app 无前缀、3s（位置和胶囊样式接近）。

### 主题 / 响应式

17. **主题选择刷新后不保留**：app 点 ☀️ 切亮色立即生效（列表页与节点页外壳都会变亮，见 `app-canvas-light-*` / `app-node-light2-*`），但整页刷新后回到暗色；demo 通过 `localStorage("hogee-theme")` 持久化并在加载时恢复（`shared.js:9,13`）。另外亮色模式下 app 右下角小地图仍是深色底，demo 的小地图会随主题变浅（见 `demo-node-light-*`）。
18. **1366×768 顶部栏互相重叠**：开通会员按钮与 ◆940 积分 chip、铃铛挤压重叠（demo 同尺寸不重叠）。
19. **1366×768 节点工具栏裁剪**：12 个工具按钮不换行，「打组复用」被裁掉一半，「重排/清空」完全挤出屏幕（1280 宽下同样裁剪，见 `app-node-light2-*`）。

---

## 五、Demo 固有问题（忠实还原了 demo 的缺陷，单列供决策）

1. demo 的分类 chips 与搜索框都是**纯假控件**（无筛选/输入逻辑）。app 把 chips 做成了真筛选但数据没跟上（P1-5）；搜索保持了假控件（P1-6）。建议数据补齐 + 搜索接 filter，比 demo 更进一步。
2. demo 空画布名直接用「未命名画布」创建，无校验。app 加了必填校验更合理，是否保留这一偏离由产品决定。
3. demo 归档画布的「打开画布」只弹 toast 不真跳转，是演示桩行为。

---

## 六、因 P0-1 阻断、UI 上未能验证的项（已做代码审查）

以下功能代码均存在且 **toast 文案与 demo 逐字一致**，但真实 UI 走不到，建议 P0 修复后回归：

- 视频/图片/音频/文本：生成子节点 + 自动连线 + toast（`NodeCanvasPage.tsx:408-496`），位置偏移与 demo 一致（+260,+40）
- 三视图 3 节点、九宫格、灯光 3 变体、高清扩图改状态、片段重拍 TAKE（`:502-623`），文案逐字一致
- Ctrl+多选 → 打组 → 组面板 → ▶执行克隆节点/复刻连线（`:625-698`），toast 与 demo 一致；实现差异：无画布组框（P2-11）、克隆用 `setTimeout(100ms)` 补连线略 hack
- 智能剪辑/逐帧拉片带目标节点名的 toast（`:499,602`）

---

## 七、已验证正常的项 ✅

- 我的画布卡片点击 → `/canvas/:id` 真实跳转；「‹」返回 `/canvas`
- 新建弹窗：项目下拉（逆命木叶企划/默认项目）、名称输入、9:16/16:9 比例卡切换（图标/副文案/选中描边与 demo 一致）、创建后卡片插到最前、toast 逐字一致
- 右键画布空白 → 自定义节点菜单；菜单项点击放置节点
- 节点拖拽移动；复制/删除的节点增删逻辑（删除时连带清理连线）
- 无选中时 12 个按钮点击均有 toast 反馈（打组按钮提示文案与 demo 一致）
- 暗色主题下列表页/节点页整体布局、卡片、小地图彩色节点块与 demo 高度接近
- 控制台无 JS 报错（仅 1 条资源 404 记录；裂图因 SPA fallback 表现为 200 HTML 而非 404）

---

## 八、截图索引（`.scratch/demo-alignment/screenshots/`）

| 文件 | 内容 |
|---|---|
| `demo-canvas-dark-full-*` / `app-canvas-dark-full-*` | 画布管理页暗色整页对比 |
| `demo-canvas-light-*` / `app-canvas-light-*` | 亮色对比（封面裂图、卡片配色差异） |
| `demo-canvas-create-modal-*` / `app-canvas-create-modal-*` | 新建画布弹窗对比 |
| `app-canvas-created-169-*` | 创建成功卡片+toast |
| `app-canvas-validation-toast-*` | 空名称校验 toast |
| `app-canvas-chip-filter-*` | chips 筛选后空画廊（P1-5） |
| `app-canvas-1366-*` | 1366 顶栏重叠（P2-18） |
| `demo-node-canvas-dark-*` / `app-node-canvas-dark-*` | 节点画布暗色整页对比（媒体裂图、缺模型选择器） |
| `demo-node-light-*` / `app-node-light2-*` | 节点画布亮色对比（小地图深浅差异、主题持久化 P2-17） |
| `demo-node-preview-*` / `app-node-preview-modal-*` | 预览浮窗 vs 全屏遮罩（P2-9） |
