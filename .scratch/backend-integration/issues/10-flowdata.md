# 10 — FlowData 整体存取

**Parent spec:** `spec.md`（同目录）

**What to build:** 工作室页的编辑状态能整体保存和恢复：走后端 FlowData 聚合接口（剧本 + 资产 + 分镜 + 工作数据的整体存取），刷新或重进页面后工作室恢复到离开时的状态。

**Blocked by:** 08 — 分镜 CRUD

**Status:** done

契约要点：`/api/production/getFlowData`（projectId/episodesId，聚合返回，**无存档时返回后端默认 FlowData**——页面必须能以默认数据正常工作）、`/api/production/saveFlowData`。后端文件/图片路径直接使用其返回值。

- [x] 工作室页加载时通过 FlowData 接口恢复整体状态（剧本/资产/分镜/编辑状态）
- [x] 无存档时使用后端返回的默认 FlowData，页面正常可用不白屏
- [x] 编辑状态整体保存（自动或显式触发），刷新后恢复
- [x] FlowData 中的图片/文件路径直接使用后端返回的静态托管路径
- [x] 翻译逻辑收敛在 API client 内；MSW node 模式按后端契约模拟（含无存档默认返回），断言请求形状与返回翻译
- [x] 本地真实后端演示：进入工作室→编辑→刷新→状态恢复，全程无 mock

## Comments

**做成什么**

工作室页（分镜工作区）新增「工作区存档」：折叠面板展示**剧本原文**（只读，来自 FlowData.script）+
两个可编辑文本区**拍摄计划**（scriptPlan）与**分镜表**（storyboardTable），分镜卡上新增 ▲▼ 调整
**分镜顺序**，页头「💾 保存存档」把所有编辑状态**整体**提交，刷新/重进页面后恢复。

**后端契约的三个硬事实（决定了这个功能只能这么做，均已实测）**

1. `getFlowData` 读侧会**用真实表数据实时覆盖** `script`（← o_script.content）、`assets`（← o_assets）、
   `storyboard`（← o_storyboard）；`saveFlowData` 只是把整个 JSON 塞进 `o_agentWorkData.data`。
   → **写进存档的 script/assets 是读不回来的**，能真正往返的只有 `scriptPlan`、`storyboardTable`
   与 `storyboard` 的**数组顺序**。所以「编辑状态」= 这两个文本 + 分镜顺序，剧本原文只做只读展示。
2. `saveFlowData` 的副作用是**按 `data.storyboard` 的数组下标回写 `o_storyboard.index`**，且仅当
   数组里每条都带真实 id 时才做（任一缺 id 整步跳过）；而 getStoryboardData 按 index 升序读。
   这就是「分镜顺序」得以持久化并能刷新还原的机制。
3. **无存档分支的 `storyboard` 恒为空数组**（哪怕库里已有分镜）。→ 分镜面板**不能**拿 FlowData 当
   数据源，仍走 getStoryboardData；FlowData 只提供存档字段与顺序的写入口。工单 checklist 第 1 条
   的「分镜」因此是「顺序与存档段」层面的恢复，不是面板数据源。

**与工单字面要求的偏离（1 处，已与用户确认）**

- 「工作室页加载时通过 FlowData 恢复整体状态（剧本/资产/分镜/编辑状态）」里的**分镜面板**仍读
  `getStoryboardData`：后端无存档时 FlowData 的分镜段恒为空（见上第 3 点），若以它为准，工作室在
  未存过档时会显示「没有分镜」而库里其实有——属于会当场被证伪的实现。资产段同理不用于展示
  （它被读侧实时覆盖，且页面没有资产位），但**整体保存时原样回传**，不掏空 AI 工作区文档。
- 保存时机按用户选择做**显式按钮**（工单允许「自动或显式」），改动后按钮显示「（未保存）」；
  分镜增删改后也标记未保存（存档里的分镜段与顺序随之过期）。

**实现要点**

- API client：`fetchStudioFlowData` / `saveStudioFlowData`（两方向的字段翻译、id 数字↔字符串、
  生图状态文案↔命名状态、静态托管路径原样透传）+ `composeFlowStoryboards`（用「面板分镜 +
  存档旧行 + 工作台最新生图状态」拼出写回的 storyboard 数组；存档旧行保留 videoDesc /
  associateAssetsIds / flowId 这些只有存档才有的字段）。
- `assetGenState` / `videoGenState` 各补一个反向映射（命名状态 → 后端文案），与既有正向表共用
  同一组文案常量；FlowData 里 derive 的「无图」文案是「未生成」字面量（不是 o_image 的 NULL）。
- MSW：`backendDb` 新增 `o_agentWorkData` 存档、`o_scriptAssets` 关联（顺带让 getScrptApi 的
  relatedAssets 不再恒空）、`o_storyboard.index` 列与 index 升序排序；`handlers` 新增
  getFlowData / saveFlowData 两个镜像 handler（默认档、读侧覆盖、index 回写、缺 id 跳过排序全部照抄）。

**验证**

- `tsc --noEmit` 干净；**275 项测试通过**（新增 `flowDataApi.test.ts` 12 项契约测试、
  `StudioPage.test.tsx` 新增 7 项存档用例、`handlers.test.ts` 新增 5 项 FlowData 契约）。
- 真实后端 10588 无 mock 演示（Playwright 驱动真实 UI）：进入工作室 →（已存在存档时）面板直接
  显示后端存的拍摄计划/分镜表 → 改拍摄计划与分镜表 + 第 1 条分镜下移 → 点「保存存档」→
  **刷新页面** → 两段文本与分镜顺序全部还原、按钮回到「已保存」态。演示后已把该演示项目的分镜
  顺序还原为原值（`o_storyboard.index` 0/1/2）。
- 直连接口核对的实测结果：无存档档 `scriptPlan/storyboardTable` 为空串、`storyboard: []`、
  `workbench: {videoList:[]}`；保存后 `scriptPlan/storyboardTable` 读回、`script` 仍为真实表内容
  （覆盖），分镜按数组顺序拿到 index 0/1/2 且 src 为 `http://localhost:10588/oss/...?size=20`。

**未做 / 已知缺口**

- 演示在项目「Issue09 演示 · 图像视频链路」/ 剧本 12 上留下了一行真实存档（`o_agentWorkData`），
  内容即演示时填的拍摄计划与分镜表 —— 这就是本功能要持久化的东西，后端没有删除存档的接口，
  需要时可再从界面改写。
- 分镜顺序的本地改动若未保存就触发生图/视频（页面每 3s 静默重查会重读分镜列表），本地顺序会被
  后端顺序覆盖；此时按钮仍显示「未保存」，重新排序再存即可。
- **存档存过一次之后，新建的分镜会跳到列表最前面**：后端 `addStoryboard` 不写 `o_storyboard.index`，
  而 getStoryboardData 是 SQL `order by index asc`（NULL 排最前）。这不是前端引入的——前端只把它
  照实呈现，并在新建后标记「未保存」，点一次「保存存档」即按当前顺序重新归一 index。
  另外后端两个读接口的排序规则本身不一致（getFlowData 用 JS 的 `(index ?? 0) - (b.index ?? 0)`），
  即同一个新分镜在面板里排最前、在存档段里排在第一条之后；mock 已按两个真实行为分别镜像，
  并有用例锁住（`handlers.test.ts` 的「MSW FlowData 排序坑」）。issue 11 验收若看到顺序不一致，根源在此。
- 首次存档时，存档里没有的分镜拿不到 `associateAssetsIds`（面板读模型只给资产名字，没有 id），
  会写成空数组；第二次读存档即被读侧用 `o_assets2Storyboard` 覆盖自愈。
