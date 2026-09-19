# 06 — 创意对话

**What to build:** `/creative` 创意对话整页，对照 demo `creative.html`：历史会话侧栏（localStorage 持久化）、图片/视频生成切换、提示词输入 → 参数确认弹窗（模型/画质/比例/数量/积分）→ 走 MSW 假任务流生成 → 结果卡内嵌编辑工具（toast）+ 重新生成/下载/加入项目。

**Blocked by:** 01 — 导航骨架 + 路由空壳

**Status:** ready-for-agent

- [ ] 历史会话侧栏，localStorage 持久化（刷新不丢）
- [ ] 生成类型切换：图片 / 视频
- [ ] 参数确认弹窗：模型/画质/比例/数量/积分
- [ ] 生成走 MSW 假任务流（复用 useTask），完成后展示结果卡
- [ ] 结果卡：编辑工具（toast）、重新生成、下载、加入项目
- [ ] lib 层 localStorage 历史管理补 vitest 单测
