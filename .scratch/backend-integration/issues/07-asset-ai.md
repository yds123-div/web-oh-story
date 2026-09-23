# 07 — 资产 AI 能力：提取、润色与生图

**Parent spec:** `spec.md`（同目录）

**What to build:** 对剧本执行 AI 提取资产：提交异步任务、轮询提取状态，完成后角色与场景自动出现在资产工坊，失败时能看到原因。资产提示词 AI 润色真实可用（文本模型）。资产 AI 生图接口接好——图像 key 到位前调用会失败，但失败态清晰（原因展示、可重试、不阻塞页面），key 一配好无需改代码即可用。

**Blocked by:** 04 — 剧本链路；05 — 资产工坊真实化

**Status:** done

前置条件：本 ticket 开始时用户提供文本模型供应商名与 key，通过后端供应商配置体系写入（不做设置页面，直接经后端配置体系/API 写入）。图像 key 未到位属预期。

契约要点：提取 `/api/script/extractAssets`（scriptIds/projectId，异步立即返回）、轮询 `/api/script/pollScriptAssets`（ids，返回 extractState/errorReason）；润色 `/api/assetsGenerate/polishAssetsPrompt` 与批量 `batchPolishAssetsPrompt`；生图 `/api/assetsGenerate/generateAssets`（可取消 `/api/assetsGenerate/cancelGenerate`）。原型已确认的交互形态：提取中显示进行中态（"AI 正在通读剧本，提取角色与场景…"），资产卡在图像 key 未到位时显示"待生成"徽标，点击生成给出明确提示而非静默失败。

- [x] 剧本列表/资产页可发起 AI 提取资产，提交后显示进行中状态
- [x] 轮询提取状态直到成功或失败，成功后资产（角色/场景）出现在资产工坊
- [x] 提取失败时展示后端返回的失败原因，可重新发起
- [x] 单个与批量润色资产提示词真实可用（文本模型），结果持久化
- [x] 资产生图接口接通：无图像 key 时调用失败，失败原因清晰展示
- [x] 生图失败可重试、不阻塞页面其他操作
- [x] 翻译逻辑（含异步任务提交/轮询模型适配）收敛在 API client 内
- [x] MSW node 模式按后端契约模拟（含异步轮询的多次响应），断言请求形状与轮询行为
- [x] 本地真实后端 + 已配置文本模型 key 演示：提取 → 轮询 → 资产出现 → 润色，全程无 mock；生图展示预期失败态

## 实施备注（2026-09-23）

**做了什么**

- API client（`lib/api.ts`）：新增 `polishAssetPrompt`、`batchPolishAssetPrompts`、`pollAssetPromptsUntilSettled`（批量润色轮询编排，读模型=资产列表，终态/超时/取消收敛在此）、`generateAssetImage`、`cancelAssetImageGeneration`；`toAsset` 翻译新增 promptState/promptErrorReason/imageId/imageState。
- 状态翻译表 `lib/assetGenState.ts`：后端 o_assets.promptState 与 o_image.state 的中文文案 → 命名状态只此一份（后端两种失败文案「失败」/「生成失败」都归 failed）。
- AssetsPage：资产卡新增「✨ 润色提示词」「🎨 生成形象/重新生成形象」「取消生成」、润色/生图状态徽标、提示词摘要行、生图失败原因内联展示；工具栏新增「✨ 批量润色提示词」（受理即置润色中 → 轮询 → 终态重查）；空态可在本页就地发起 AI 提取并显示「AI 正在通读剧本…」横幅（复用 pollExtractionUntilDone）。
- MSW：`backendDb` 新增润色/生图状态机与图像供应商开关（默认未配 key=必失败），`handlers` 新增 4 个按后端 zod 契约的 handler。

**演示记录（真实后端 10588 + DeepSeek deepseek-v4-flash）**

新建项目「Issue07演示·真实AI」（风格 3D_anime_render）→ 提交 336 字剧本 → 提取成功（角色 3 / 场景 2 / 道具 1，描述为模型产出）→ 单个润色成功 → 批量润色 3 个角色全部完成（刷新后仍在，持久化确认）→ 生图失败态：`生成失败：未找到供应商配置 id=Seedream-4.0`，可重试、不影响其他卡片。

**遗留 / 已知问题**

1. **项目风格值必须是后端目录名**：后端视觉手册按 `data/skills/art_skills/<目录名>` 查找，前端表单原先发中文（「赛博朋克电影」）会得到「视觉手册未定义」。本次已把 `config/project.ts` 的 ART_STYLE_OPTIONS 与 CreatePage 风格下拉改为 11 个真实目录名（label 仍中文）。**已有项目的 artStyle 是中文旧值，需重新选择风格才能润色。**
2. **图像模型值需带供应商前缀**：后端 `u.Ai.Image(model)` 期望 `vendorId:modelName`（如 `deepseek:deepseek-v4-flash`），而项目表单的 imageModel 是「Seedream-4.0」这种裸模型名。生图失败原因已如实透出，但「图像 key 配好后无需改代码即可用」还需设置系统（供应商/模型映射，P2）提供带前缀的可选模型列表。
3. 后端父资产查询不返回 o_image.errorReason，故**页面刷新后生图失败原因会丢失**（只剩「生成失败」徽标）；本次会话内触发的失败原因会内联保留。
