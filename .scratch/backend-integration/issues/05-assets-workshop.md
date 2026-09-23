# 05 — 资产工坊真实化

**Parent spec:** `spec.md`（同目录）

**What to build:** 资产工坊展示当前项目的真实资产列表（角色/场景/道具），手工新增/编辑/删除立即持久化，上传资产图片（base64 保存）后能在资产卡上看到它。AI 提取的入口在本 ticket 只需不报错（真实提取在 07 接）。

**Blocked by:** 03 — 项目管理真实化

**Status:** ready-for-agent

领域映射与契约要点：前端"资产" ↔ 后端 `o_assets`，图片走 `o_image`。类型枚举双向映射：前端（角色/场景/道具/素材）↔ 后端 `role/scene/tool`。代表性接口：列表 `/api/assets/getAssetsApi`（projectId/type/name/page/limit 分页，join 图片，返回 `{data, total}`）、新增 `/api/assets/addAssets`、更新 `/api/assets/updateAssets`、删除 `/api/assets/delAssets`（或批量 `/api/assets/batchDelete`）、保存图片 `/api/assets/saveAssets`。图片/视频 URL 直接使用后端返回的静态托管路径（/oss 等）。

- [ ] 资产列表来自后端真实接口，分页与筛选（按类型）正常工作
- [ ] 资产类型枚举双向映射正确（前端类型 ↔ role/scene/tool）
- [ ] 手工新增资产（名称/描述/类型）立即持久化
- [ ] 编辑资产（名称/描述等）立即持久化
- [ ] 删除资产立即持久化，列表即时更新
- [ ] 上传资产图片（base64）保存后在资产卡上显示
- [ ] 资产图片使用后端返回的静态托管路径正确展示
- [ ] 空资产时显示空状态（区别于加载失败）
- [ ] 翻译逻辑收敛在 API client 内；MSW node 模式按后端契约模拟资产接口，断言请求形状与返回翻译
- [ ] 页面级集成测试：资产工坊能以翻译后的真实契约渲染
- [ ] 本地真实后端演示：手工建资产→改→传图→删，全程无 mock
