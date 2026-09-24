# 08 — 分镜 CRUD（片段工作室）

**Parent spec:** `spec.md`（同目录）

**What to build:** 片段工作室里的分镜数据真实化：分镜列表来自后端分镜接口（含缩略图路径与关联角色资产），分镜的增、改、删走后端接口真实持久化。每个分镜对应一条视频轨道的准备工作就绪（轨道本身的操作在 09 接）。

**Blocked by:** 04 — 剧本链路；05 — 资产工坊真实化

**Status:** done

领域映射：前端"片段/分镜" ↔ 后端分镜（`o_storyboard`）。契约要点：取分镜 `/api/production/getStoryboardData`（scriptId/projectId，返回分镜数组，含 filePath 缩略图与 characters 关联资产）；新增 `/api/production/storyboard/addStoryboard`（同时创建 o_videoTrack，返回 id）、编辑 `editStoryboardInfo`、批量增 `batchAddStoryboardInfo`、批量删 `batchDelete`、删帧 `removeFrame`。

- [x] 工作室页分镜列表来自后端，进入页面即加载当前剧本的真实分镜
- [x] 新增分镜（描述/景别/运镜/时长等）立即持久化，刷新不丢
- [x] 编辑分镜信息立即持久化
- [x] 删除分镜（含批量）立即持久化
- [x] 分镜与关联角色资产（characters）正确展示
- [x] 分镜缩略图使用后端返回的静态路径展示；无图时显示占位而非报错
- [x] 翻译逻辑收敛在 API client 内；MSW node 模式按后端契约模拟分镜接口，断言请求形状与返回翻译
- [x] 本地真实后端演示：对已提交剧本建分镜→改→删，全程无 mock

## 实施备注（2026-09-24）

**做了什么**

- API client（`lib/api.ts`）：`listStoryboards`→getStoryboardData、`createStoryboard`→addStoryboard、
  `updateStoryboard`→editStoryboardInfo、`deleteStoryboard`→removeFrame、`deleteStoryboards`→batchDelete；
  `listEpisodes` 重写为「后端剧本 + 各剧本分镜聚合」的真实分集。
- StudioPage 按原型重写为分镜工作区：分镜卡（缩略图/占位、描述、时长、关联资产 chip）+
  新建/编辑/单删/批量删 + 空态与加载失败态；去掉无后端对应的假音轨、假导出、假模型、硬编码全局设定。
- EpisodesPage 真实化（剧本即分集）：列后端剧本并显示分镜数与总时长，点击带真实 scriptId 进工作区；
  路由 `:episodeId` 直接复用为 scriptId，不动路由表。
- MSW：`backendDb` 新增 `o_storyboard`/`o_assets2Storyboard` 内存表，`handlers` 新增 5 个镜像后端 zod
  的分镜 handler（含该接口族特有的 **HTTP 400 + 信封** 业务失败形状）。
- 清理被本 ticket 取代的旧 episode/segment/model mock 域及其测试；删除因重写失去调用方的
  `stores/workflowStore.ts`、`lib/generationCost.ts`、`lib/promptMentions.ts`。

**与工单字面要求的偏离（均已与用户确认）**

1. 后端 `o_storyboard` **没有景别/运镜列**（只有 prompt/duration/state/videoDesc/filePath/index）。
   按 spec 裁决规则二降级：表单提供景别/运镜选择器，提交时与描述**拼成 prompt 文本**一并持久化。
   因此"翻译逻辑收敛在 API client"这一条有例外——`composePrompt` 留在页面（纯 UI 文案拼装）。
2. 读模型 `getStoryboardData` **不返回 `videoDesc`**，而 `editStoryboardInfo` 要求 `prompt` 与
   `videoDesc` **同时必填、整行覆盖**。若编辑时给 videoDesc 传空串，会清掉 09 的 AI 生成视频提示词的
   核心输入。故描述**同时写入两列**，编辑时两者同值回传。
3. 工单只要求工作室页，但工作室页需要真实 scriptId 才能加载分镜（原 EpisodesPage 是纯 mock），
   故一并真实化了 EpisodesPage。

**未做 / 已知缺口**

- `batchAddStoryboardInfo`（工单"契约要点"提到、checklist 未要求）：无对应 UI，按 spec 裁决规则二
  不新增；09 的 AI 分镜生成会用到它。当前 mock 与真实后端均已验证该接口可用。
- UI 无法设置分镜的关联资产：`addStoryboard` 不接受 `associateAssetsIds`，只有
  `batchAddStoryboardInfo` 接受。characters 目前是只读展示（演示时用真实接口建了一条带关联资产的分镜验证）。
- `components/NotificationCenter.tsx` 在本 ticket 之前就已被孤立（issue 02 裁剪掉通知中心），未处理。

**验证**

- `tsc --noEmit` 干净；194 项测试通过（新增 `storyboardsApi.test.ts` 11 项契约测试、
  `StudioPage.test.tsx` 7 项、`EpisodesPage.test.tsx` 5 项、handlers 分镜契约 7 项）。
- 真实后端 10588 全程无 mock 演示：建分镜（落库并建 o_videoTrack）→ 刷新仍在 → 编辑（prompt/videoDesc
  两列同步、关联资产保留）→ 单删 → 批量删（级联清 o_assets2Storyboard）；直查 sqlite 确认。
