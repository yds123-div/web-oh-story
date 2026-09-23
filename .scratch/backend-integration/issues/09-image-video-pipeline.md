# 09 — 分镜图片与工作台视频链路

**Parent spec:** `spec.md`（同目录）

**What to build:** 分镜画面与视频生成全链路接通。分镜图片的批量生成、轮询、预览、下载走后端接口；工作台视频轨道的创建/删除/列表接通；用文本 AI 生成视频提示词（单个与批量）真实可用；视频生成接口接好——视频 key 到位前调用会失败，失败态清晰可重试，key 一配好无需改代码即可产出成片；生成成功后能在轨道上选择/切换满意的版本。

**Blocked by:** 08 — 分镜 CRUD

**Status:** ready-for-agent

本 ticket 覆盖三条接口族（均 POST + 信封）：

- 分镜图片：`/api/production/storyboard/batchGenerateImage`、`pollingImage`、`previewImage`、`downPreviewImage`
- 工作台轨道：`addTrack`、`deleteTrack`、`getVideoList`（projectId/scriptId）、`selectVideo`、`delVideo`、`checkVideoStateList`
- 提示词与视频：`generateVideoPrompt`、`batchGeneratePrompt`、`updateVideoPrompt`、`updateVideoDuration`、`generateVideo`、`batchGenerateVideo`

前置条件：文本模型 key 已配置（07 已完成）；图像/视频 key 未到位属预期，所有生成接口必须有"接好但会失败"的形态。

- [ ] 分镜图片批量生成可提交，轮询进度直到成功/失败，预览与下载可用
- [ ] 图片生成失败（无 key）时原因清晰、可重试、不阻塞页面
- [ ] 工作台视频轨道的创建/删除/列表走真实接口，与分镜关联正确
- [ ] 单个分镜轨道可 AI 生成视频提示词（文本模型真实可用），结果持久化可编辑
- [ ] 批量生成提示词可用
- [ ] 视频生成可提交：无视频 key 时失败态清晰（原因、重试），不阻塞页面
- [ ] 视频生成成功后（key 到位验证或模拟）可在轨道上选择/切换生成的视频版本
- [ ] 翻译逻辑（含批量与轮询模型适配）收敛在 API client 内
- [ ] MSW node 模式按后端契约模拟三条接口族，断言请求形状、轮询行为与返回翻译
- [ ] 本地真实后端 + 文本模型 key 演示：轨道列表→生成提示词（成功）→生成图片/视频（预期失败态可重试），全程无 mock
