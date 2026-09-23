# 08 — 分镜 CRUD（片段工作室）

**Parent spec:** `spec.md`（同目录）

**What to build:** 片段工作室里的分镜数据真实化：分镜列表来自后端分镜接口（含缩略图路径与关联角色资产），分镜的增、改、删走后端接口真实持久化。每个分镜对应一条视频轨道的准备工作就绪（轨道本身的操作在 09 接）。

**Blocked by:** 04 — 剧本链路；05 — 资产工坊真实化

**Status:** ready-for-agent

领域映射：前端"片段/分镜" ↔ 后端分镜（`o_storyboard`）。契约要点：取分镜 `/api/production/getStoryboardData`（scriptId/projectId，返回分镜数组，含 filePath 缩略图与 characters 关联资产）；新增 `/api/production/storyboard/addStoryboard`（同时创建 o_videoTrack，返回 id）、编辑 `editStoryboardInfo`、批量增 `batchAddStoryboardInfo`、批量删 `batchDelete`、删帧 `removeFrame`。

- [ ] 工作室页分镜列表来自后端，进入页面即加载当前剧本的真实分镜
- [ ] 新增分镜（描述/景别/运镜/时长等）立即持久化，刷新不丢
- [ ] 编辑分镜信息立即持久化
- [ ] 删除分镜（含批量）立即持久化
- [ ] 分镜与关联角色资产（characters）正确展示
- [ ] 分镜缩略图使用后端返回的静态路径展示；无图时显示占位而非报错
- [ ] 翻译逻辑收敛在 API client 内；MSW node 模式按后端契约模拟分镜接口，断言请求形状与返回翻译
- [ ] 本地真实后端演示：对已提交剧本建分镜→改→删，全程无 mock
