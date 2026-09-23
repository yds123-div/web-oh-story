# 04 — 剧本链路：提交与剧本列表（剧本即分集）

**Parent spec:** `spec.md`（同目录）

**What to build:** 在创作页粘贴剧本文本并提交后，剧本被真实保存到后端；原"分集列表"改造为展示后端剧本列表的形态（概念映射：每个剧本就是一集），可编辑、可删除。大纲工作台的数据源改为剧本。三步工作流门控按后端真实状态字段重新映射（已与用户确认此方案）。

**Blocked by:** 03 — 项目管理真实化

**Status:** ready-for-agent

领域映射：前端"剧本大纲" ↔ 后端剧本（`o_script`）；前端"分集" ↔ 剧本即分集。代表性接口：列表 `/api/script/getScrptApi`（返回 id/name/content/extractState/errorReason/createTime）、新增 `/api/script/addScript`（name/content/projectId）、更新 `/api/script/updateScript`、删除 `/api/script/delScript`。门控映射：去掉"大纲定稿"等后端无对应的概念，改为按后端真实状态判断（有剧本→资产可进，有资产→分镜可进）。

- [ ] 创作页（仅剧本模式）提交剧本文本后真实保存为后端剧本，刷新不丢
- [ ] 剧本列表页展示当前项目的真实剧本，显示保存状态与字数等真实信息
- [ ] 剧本可编辑、可删除，变更立即持久化
- [ ] 大纲工作台的数据源改为后端剧本（不再依赖 mock 大纲概念）
- [ ] WorkflowGate 三步门控按后端真实状态字段重映射，去掉"大纲定稿"等无对应概念的状态
- [ ] 提交/编辑/删除的调用翻译（REST→POST、字段映射、id 转换）收敛在 API client 内，页面组件调用方式尽量不变
- [ ] MSW node 模式按后端契约模拟剧本接口，断言请求形状与返回翻译
- [ ] 本地真实后端演示：提交剧本 → 列表可见 → 编辑 → 删除，全程无 mock
