# 01 — 导航骨架 + 路由空壳（prefactor）

**What to build:** SideNav 从 3 项扩到 6 项（首页/创意/创作/画布/资产/团队），三个新路由（画布管理、资产广场、创意对话）先出占位页，团队项点击 toast「团队功能即将上线」。此后所有页面 ticket 往既有壳里填肉，不再碰 `App.tsx` 和 `SideNav.tsx`。

**Blocked by:** None — can start immediately.

**Status:** completed

- [x] SideNav 6 项：首页(个人空间) / 创意 / 创作 / 画布 / 资产 / 团队，视觉与 demo 对齐
- [x] 路由 `/canvas`、`/plaza`、`/creative` 存在且渲染占位页
- [x] 团队导航项点击弹 toast「团队功能即将上线」（与 demo 行为一致）
- [x] 明暗双主题下导航无破相
