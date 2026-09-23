# 06 — 任务中心页

**Parent spec:** `spec.md`（同目录）

**What to build:** 新增任务中心页，展示后端任务表里的真实任务：分类、项目归属、状态（进行中/成功/失败）、失败原因，支持分页与筛选。前端原有的"提交任务→轮询 getTask"模型适配为后端任务体系（数字 id、state/taskClass 字段）。

**Blocked by:** 01 — 连接地基

**Status:** ready-for-agent

契约要点：任务表 `o_tasks`，数字 id。接口：列表 `/api/task/getTaskApi`（state/taskClass/projectId/page/limit，返回 `{data, total}`，leftJoin 项目）、详情 `/api/task/taskDetails`、分类 `/api/task/getTaskCategories`、项目下拉 `/api/task/getProject`。异步任务的实际进度轮询走各业务自带轮询接口（如剧本提取的 pollScriptAssets），任务中心只做展示。

- [ ] 任务中心页展示后端真实任务列表（含状态、分类、所属项目）
- [ ] 分页正常；可按状态与分类筛选；分类选项来自后端接口
- [ ] 失败任务展示失败原因
- [ ] 任务详情可查看
- [ ] 前端任务模型（字符串 id、pending/running/succeeded/failed）与后端（数字 id、state/taskClass）的适配收敛在 API client 内
- [ ] 提供从导航到任务中心页的入口
- [ ] 空任务时显示空状态
- [ ] MSW node 模式按后端契约模拟任务接口，断言请求形状与返回翻译
- [ ] 本地真实后端演示：产生一条真实任务（可配合已有业务）后在任务中心看到它
