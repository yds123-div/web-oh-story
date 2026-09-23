# 03 — 项目管理真实化（首页）

**Parent spec:** `spec.md`（同目录）

**What to build:** 打开首页看到的是后端数据库里的真实项目。项目列表、新建（表单选项与后端必填字段一一对应）、重命名、删除、统计计数全部走真实接口，刷新页面后一切变更不丢；数据库为空时看到友好的空状态引导而不是白屏。

**Blocked by:** 01 — 连接地基

**Status:** ready-for-agent

领域映射与契约要点：前端"项目" ↔ 后端 `o_project`。代表性接口（均 POST + JSON body + 信封）：项目列表 `/api/project/getProject`、新建 `/api/project/addProject`（12 个必填字段：projectType/name/intro/type/artStyle/directorManual/videoRatio/imageModel/videoModel/imageQuality/mode 等）、编辑 `/api/project/editProject`、删除 `/api/project/delProject`（级联删除剧本/资产/分镜/轨道/任务，删除需确认）、单项目 `/api/general/getSingleProject`、统计 `/api/general/generalStatistics`（角色数/剧本数/视频数/分镜数）。后端 id 为 number（Date.now()），前端类型为 string，转换收敛在 API client 内。

- [ ] 首页项目列表来自后端真实接口，字段（类型/画风/画幅/模型等）正确映射为前端类型
- [ ] 新建项目表单的选项与后端必填字段一一对应，创建后配置被完整保存，重新打开时还原
- [ ] 重命名项目立即持久化，刷新不丢
- [ ] 删除项目有确认（后端级联删），删除后列表即时更新
- [ ] 项目卡的计数（角色/剧本/视频/分镜）来自后端统计接口
- [ ] 空库首次打开有友好空状态引导（不导入种子数据）
- [ ] 页面组件的调用方式尽量不变，翻译逻辑（REST→POST、字段映射、id 转换）全部收敛在 API client 内
- [ ] MSW node 模式按后端真实契约模拟（POST 路径、body 字段名、信封、失败信封），对 API client 断言请求形状与返回值翻译
- [ ] 页面级集成测试（Vitest + Testing Library + MSW）：项目列表页能以翻译后的真实契约渲染
- [ ] 本地起真实后端演示：新建→改名→删除→计数，全程无 mock
