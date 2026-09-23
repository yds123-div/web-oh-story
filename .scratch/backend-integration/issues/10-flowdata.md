# 10 — FlowData 整体存取

**Parent spec:** `spec.md`（同目录）

**What to build:** 工作室页的编辑状态能整体保存和恢复：走后端 FlowData 聚合接口（剧本 + 资产 + 分镜 + 工作数据的整体存取），刷新或重进页面后工作室恢复到离开时的状态。

**Blocked by:** 08 — 分镜 CRUD

**Status:** ready-for-agent

契约要点：`/api/production/getFlowData`（projectId/episodesId，聚合返回，**无存档时返回后端默认 FlowData**——页面必须能以默认数据正常工作）、`/api/production/saveFlowData`。后端文件/图片路径直接使用其返回值。

- [ ] 工作室页加载时通过 FlowData 接口恢复整体状态（剧本/资产/分镜/编辑状态）
- [ ] 无存档时使用后端返回的默认 FlowData，页面正常可用不白屏
- [ ] 编辑状态整体保存（自动或显式触发），刷新后恢复
- [ ] FlowData 中的图片/文件路径直接使用后端返回的静态托管路径
- [ ] 翻译逻辑收敛在 API client 内；MSW node 模式按后端契约模拟（含无存档默认返回），断言请求形状与返回翻译
- [ ] 本地真实后端演示：进入工作室→编辑→刷新→状态恢复，全程无 mock
