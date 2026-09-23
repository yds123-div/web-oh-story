# 07 — 资产 AI 能力：提取、润色与生图

**Parent spec:** `spec.md`（同目录）

**What to build:** 对剧本执行 AI 提取资产：提交异步任务、轮询提取状态，完成后角色与场景自动出现在资产工坊，失败时能看到原因。资产提示词 AI 润色真实可用（文本模型）。资产 AI 生图接口接好——图像 key 到位前调用会失败，但失败态清晰（原因展示、可重试、不阻塞页面），key 一配好无需改代码即可用。

**Blocked by:** 04 — 剧本链路；05 — 资产工坊真实化

**Status:** ready-for-agent

前置条件：本 ticket 开始时用户提供文本模型供应商名与 key，通过后端供应商配置体系写入（不做设置页面，直接经后端配置体系/API 写入）。图像 key 未到位属预期。

契约要点：提取 `/api/script/extractAssets`（scriptIds/projectId，异步立即返回）、轮询 `/api/script/pollScriptAssets`（ids，返回 extractState/errorReason）；润色 `/api/assetsGenerate/polishAssetsPrompt` 与批量 `batchPolishAssetsPrompt`；生图 `/api/assetsGenerate/generateAssets`（可取消 `/api/assetsGenerate/cancelGenerate`）。原型已确认的交互形态：提取中显示进行中态（"AI 正在通读剧本，提取角色与场景…"），资产卡在图像 key 未到位时显示"待生成"徽标，点击生成给出明确提示而非静默失败。

- [ ] 剧本列表/资产页可发起 AI 提取资产，提交后显示进行中状态
- [ ] 轮询提取状态直到成功或失败，成功后资产（角色/场景）出现在资产工坊
- [ ] 提取失败时展示后端返回的失败原因，可重新发起
- [ ] 单个与批量润色资产提示词真实可用（文本模型），结果持久化
- [ ] 资产生图接口接通：无图像 key 时调用失败，失败原因清晰展示
- [ ] 生图失败可重试、不阻塞页面其他操作
- [ ] 翻译逻辑（含异步任务提交/轮询模型适配）收敛在 API client 内
- [ ] MSW node 模式按后端契约模拟（含异步轮询的多次响应），断言请求形状与轮询行为
- [ ] 本地真实后端 + 已配置文本模型 key 演示：提取 → 轮询 → 资产出现 → 润色，全程无 mock；生图展示预期失败态
