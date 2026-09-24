# 09 — 分镜图片与工作台视频链路

**Parent spec:** `spec.md`（同目录）

**What to build:** 分镜画面与视频生成全链路接通。分镜图片的批量生成、轮询、预览、下载走后端接口；工作台视频轨道的创建/删除/列表接通；用文本 AI 生成视频提示词（单个与批量）真实可用；视频生成接口接好——视频 key 到位前调用会失败，失败态清晰可重试，key 一配好无需改代码即可产出成片；生成成功后能在轨道上选择/切换满意的版本。

**Blocked by:** 08 — 分镜 CRUD

**Status:** done

本 ticket 覆盖三条接口族（均 POST + 信封）：

- 分镜图片：`/api/production/storyboard/batchGenerateImage`、`pollingImage`、`previewImage`、`downPreviewImage`
- 工作台轨道：`addTrack`、`deleteTrack`、`getVideoList`（projectId/scriptId）、`selectVideo`、`delVideo`、`checkVideoStateList`
- 提示词与视频：`generateVideoPrompt`、`batchGeneratePrompt`、`updateVideoPrompt`、`updateVideoDuration`、`generateVideo`、`batchGenerateVideo`

前置条件：文本模型 key 已配置（07 已完成）；图像/视频 key 未到位属预期，所有生成接口必须有"接好但会失败"的形态。

- [x] 分镜图片批量生成可提交，轮询进度直到成功/失败，预览与下载可用
- [x] 图片生成失败（无 key）时原因清晰、可重试、不阻塞页面
- [x] 工作台视频轨道的创建/删除/列表走真实接口，与分镜关联正确
- [x] 单个分镜轨道可 AI 生成视频提示词（文本模型真实可用），结果持久化可编辑
- [x] 批量生成提示词可用
- [x] 视频生成可提交：无视频 key 时失败态清晰（原因、重试），不阻塞页面
- [x] 视频生成成功后（key 到位验证或模拟）可在轨道上选择/切换生成的视频版本
- [x] 翻译逻辑（含批量与轮询模型适配）收敛在 API client 内
- [x] MSW node 模式按后端契约模拟三条接口族，断言请求形状、轮询行为与返回翻译
- [x] 本地真实后端 + 文本模型 key 演示：轨道列表→生成提示词（成功）→生成图片（真出图）→生成视频（**key 到位后真出片**），全程无 mock

## 实施备注（2026-09-24）

**做了什么**

- **API client（`lib/api.ts`）**：三条接口族全部收敛在这一层——分镜图片（`generateStoryboardImages` /
  `pollStoryboardImages` / `previewStoryboardImages` / `downloadStoryboardPreview`）、工作台轨道
  （`fetchWorkbench` / `createVideoTrack` / `deleteVideoTrack` / `listTrackVideos` / `selectTrackVideo` /
  `deleteTrackVideo` / `pollVideoStates`）、提示词与视频（`generateTrackVideoPrompt` /
  `batchGenerateTrackVideoPrompts` / `pollVideoPrompts` / `updateTrackVideoPrompt` /
  `updateTrackVideoDuration` / `generateTrackVideo` / `batchGenerateTrackVideos`）。
  轮询编排（间隔 / 超时 / 终态判定 / 取消）也在这里，新增内部通用件 `pollUntilAllPresent`。
- **状态翻译表 `lib/videoGenState.ts`**：`o_storyboard.state` / `o_videoTrack.state` / `o_video.state`
  三套中文文案 → 命名状态，API 层与 MSW mock 共用。没有复用 `assetGenState.ts` 的表：文案虽同，
  但落在不同的表上，且 NONE 语义不同（o_image 用 NULL、o_storyboard 用「未生成」字面量）。
- **`lib/http.ts`**：抽出 `send()`，新增 `apiFetchBlob`（拼图下载是 PNG 附件，没有信封）。
- **后端 vendor 适配器 `backend/data/vendor/dp.ts`**：Z-Image-Turbo 文生图。
  `size`(1K/2K/4K/1080P) 定长边、`aspectRatio` 算短边、两端夹到 [256,2048]（端点上限就是 2048）；
  180s 超时、不自动重试；服务端失败体 `{"detail":...}` 提取出来当原因。
- **StudioPage（分镜工作区）**：批量生成图片（+「只补未出图的」）/ 预览拼图 / 下载拼图；
  失败原因内联在卡片上、可重试；单分镜生成 / 编辑视频提示词、提交视频生成。图片与提示词操作
  在批量勾选模式下作用于选中项，否则作用于全部。
- **WorkbenchPage（工作台，新增）**：轨道总览 + 统计（轨道数 / 提示词已生成 / 已有成片）、
  批量生成提示词、批量生成视频、成片版本的选择与切换（每版成功视频直接给
  `<video controls>`，挑版本得先看得见）、孤立轨道清理。路由
  `/project/:id/episode/:episodeId/bench`，门控 `WorkflowPage` 加 `workbench`。
  两页共用的展示件抽到 `components/VideoTrackTags.tsx`（提示词 / 版本徽标）与
  `components/VideoPromptModal.tsx`（提示词编辑弹窗），共用常量在 `config/project.ts`
  （`VIDEO_RESOLUTION` / `DEFAULT_VIDEO_DURATION_SEC`）。
- **MSW**：`backendDb` 新增 `o_videoTrack` / `o_video` 内存表与三个状态机（生图 / 提示词 / 视频），
  `addBackendStoryboard` 改为同事务建轨（对齐后端）；`handlers` 新增三条接口族共 18 个 handler，
  按后端 zod 镜像校验（含 storyboard 族特有的 HTTP 500/400 + 信封形状）。
- **前端配置 `config/project.ts`**：模型选项改成带前缀的真实值、画质收敛成 1K/2K、新增
  `VIDEO_RESOLUTION`。

**与工单字面要求的偏离（均已与用户确认）**

1. **新增了一个后端文件**。spec 的 Out of Scope 写着「后端任何业务代码修改」，而
   `backend/data/vendor/dp.ts` 确实在 git 里被跟踪。这是唯一可行路径：
   `u.Ai.Image(key)` 的链路是 `getVendorTemplateFn` → 读 `data/vendor/<id>.ts`，且
   `referenceList2imageBase642()` 会调 `u.vendor.getVendor(id).version`，**文件缺失时直接抛
   TypeError**，所以只往 `o_vendorConfig` 加一行走不通。判断依据：`data/vendor/` 是后端设计出来
   给外部扩的插件位（有 `writeCode` / `updateVendor` / `vendor.json` 注册机制，其余 11 个 vendor
   都是这么来的），不是业务逻辑。供应商行通过 `setting/vendorConfig/addVendor` +
   `updateVendorInputs` + `enableVendor` 三个真实接口建立，**密钥只落在 `db2.sqlite`（已 gitignore），
   `dp.ts` 里 `apiKey` 是空串**。
2. **分镜生图的 `compulsory` 恒为 `true`**。实测：`addStoryboard` 写
   `shouldGenerateImage: src ? 1 : 0`，UI 建分镜时 `src=null` → `0`；而 `batchGenerateImage` 在
   `compulsory=false` 时会把 `shouldGenerateImage===0` 的整行**跳过**（只置 `state='未生成'`，
   一张都不生成）。所以客户端恒发 `true`，界面上的「只补未出图的」由前端过滤 `storyboardIds`
   表达。handler 契约测试里留了一条直连 handler、缺省 compulsory 的用例作为证据。
3. **参考图被丢弃**。Z-Image-Turbo 是纯文生图，没有图生图入口，后端为角色一致性准备的
   `referenceList`（分镜关联资产的形象图）用不上，`dp.ts` 的 model `mode` 也只声明 `"text"`。
   这是能力降级而非缺陷，界面上加了一句常驻说明（不写死模型名）。
4. **模型选项必须带 `<vendorId>:` 前缀**。`o_project.imageModel` / `videoModel` 裸名（如
   `Seedream-4.0`）会让 `u.Ai.Image/Video` 直接报「未找到供应商配置 id=X」。改了
   `IMAGE_MODEL_OPTIONS`（`dp:z-image-turbo`）与 `VIDEO_MODEL_OPTIONS`（默认
   `volcengine:doubao-seedance-2-0-260128`——该模型名命中 `seedance.*2-0`，后端会挑
   `data/modelPrompt/video/seedance2Multi-parameterMode.md` 当提示词模板，而不是回退到通用文档）。
   `IMAGE_QUALITY_OPTIONS` 从 2K/4K/1080P 收敛成 1K/2K：端点长边上限就是 2048，选 4K 会拿到
   与 2K 完全相同的图。三个选项表都只在**新建项目**时用到，存量项目不受影响。
5. **工作台是新增页面**。工单没点名页面，但「工作台视频轨道」需要落点，原型第 6 步也是独立页。
6. **孤立轨道清理按钮**。原本约定「`addTrack`/`deleteTrack` 接进 client 但 UI 不暴露」，前提是
   「不会出现无分镜的孤立轨道」。该前提被实测证伪：`removeFrame` 只在「该 track 名下只有这一条
   分镜」时才删轨道，而它按 `o_storyboard.track` 这一列（track 名）分组，`addStoryboard` 建的分镜
   这列恒为 NULL，于是 `where("track", null)` 命中该剧本下所有分镜，计数永远不等于 1 ——
   **删分镜后轨道会留下来**。故只对孤立轨道（`storyboardId == null`）开放「删除孤立轨道」，
   不是通用的建/删轨道入口。

**后续追加（同日）：视频链路接上真能出片的模型**

工单原假设「视频 key 未到位、应当失败」。用户随后提供了自建 **MiniMax-H3 图生视频**端点
（同一台机器、同一把 sk-dp 密钥），于是视频链路也变成真能出片：

- **`backend/data/vendor/dp.ts` 扩展为双能力**（Z-Image-Turbo 文生图 + MiniMax-H3 图生视频），
  版本号 2.0 → 2.1，新增 video 模型 `dp:minimax-h3`。**没有新增后端文件、没有改任何后端业务代码**
  —— vendor 文件是每次请求重读的，改完即刻生效，不用重启。
- **三步异步任务制**在 `videoRequest` 内完成（提交 → 轮询 → 下载），返回**有头 base64**
  （`data:video/mp4;base64,…`）而不是下载 URL：下载端点要鉴权，而调用方的 `urlToBase64`
  不带任何请求头，给 URL 会 401。
- **参数映射**：画幅定尺寸（竖屏 544×960 / 横屏 960×544，都是端点实测默认值，**不按
  `resolution` 放大**——放大没验证过、有 OOM 风险）；`duration` 秒 × 24fps 后**向下对齐到 32 的倍数**
  （端点实测会吸附：238→224、64→64，这里自己先对好）。
- **图生视频 ⇒ 必须先有分镜图**。后端 `generateVideo` 本来就会把分镜的 `filePath` 转 base64
  塞进 `referenceList`，正好接上；没有参考图时 vendor 抛出可读原因
  「MiniMax-H3 是图生视频：该分镜还没有画面，请先在分镜工作区生成分镜图片」，
  经 `o_video.errorReason` 走到界面的红框里。**没有在前端硬加"必须有图"的门禁**——那会把
  「图生视频」这个供应商特性写进页面，将来换回文生视频模型又要拆。
- 顺带修了一个**真实 UI 缺陷**（排查时发现的）：轨道已经挑到满意成片后，那一行还一直挂着
  「视频生成失败：…」红框。现在**只有在没有任何成功版本时才显示红框**，历史失败由版本
  chip 的「（失败）」表达。两个页面都改了，并补了回归用例。

**端点实测数据**（用于定参数）：`/video/health` 免密钥探测；提交 1–5s；**96 帧≈54s、
224 帧≈95s**；帧率约 24fps（224 帧 = 9.42s）；默认 544×960 / steps 4；291 字中文提示词
（URL 编码后 2.4KB）走查询串服务端照收；**旧 key 与新 key 通用**，所以 `o_vendorConfig` 没改。

**未做 / 已知缺口**

- `batchAddStoryboardInfo`（AI 分镜生成）仍未接，08 起就挂着。
- 分镜的关联资产（`associateAssetsIds`）UI 仍无法设置，只有 `batchAddStoryboardInfo` 接受；
  因此视频提示词里的资产参考来自分镜描述文本，不是真实关联。
- 演示项目里那 3 条提示词是**更早用 Seedance 2.0 多参模板生成的**（`@图片1` / `<主体1>` 语法），
  喂给 H3 不是最优。切到 `dp:minimax-h3` 后**重新生成**会走通用模板（模型名不命中
  `seedance.*2-0`，回退到 `o_prompt.videoPromptGeneration`），已生成的保持原样。
- 该视频能力**仅在服务端 GPU 切到 H3 模式时可用**，切走就会提交失败。

**踩到并已在代码里注释的后端契约陷阱**

- `getGenerateData` 的轨道出参里，选中版本叫 **`selectVideoId`**（表列名是 `videoId`，出参改名了），
  未选择时是 `0` 而不是 `null`；轨道 `duration` 未设置时也是 `0`（`addStoryboard` 建轨不写 duration），
  所以判空不能只用 `??`，否则视频生成会拿到 0 秒。
- `getGenerateData` 的 `videoList[].state` 用 `"已完成"` 判成功，而写侧（`generateVideo`）写的是
  `"生成成功"` —— 成功视频经那条路径会掉成「未生成」。故视频版本一律走 `getVideoList`（回原始 state）。
- 三条轮询接口（`pollingImage` / `checkVideoStateList` / `checkVideoPrompt`）的后端行为一致：
  **只回终态行，进行中的行整条省略**。所以「缺失」= 仍在生成（与资产提取轮询相反），
  必须继续等，超时是唯一兜底。
- `getGenerateData` 在项目未配置视频模型时返回 **HTTP 400 却套了成功信封**（`data` 是原因文案、
  `message` 恒为默认的「成功」）。客户端按「400 + message=='成功'」这一唯一组合翻译成可读原因。
- `getVideoList` 是从**分镜的 trackId** 出发反查 `o_video`（不是从 `o_videoTrack` 表），所以
  孤立轨道上的视频不会出现在这个接口里——mock 已按此对齐（`getBackendVideos`）。
- 分镜删除确认文案不能写「视频轨道将一并清理」：后端不会删轨道（见偏离 6），这是会被用户
  当场证伪的承诺，已改成「轨道会留在工作台变成孤立轨道，可到工作台清理」。

**验证**

- `tsc --noEmit` 干净；**250 项测试通过**（新增 `imageVideoPipelineApi.test.ts` 25 项契约测试、
  `WorkbenchPage.test.tsx` 8 项、`StudioPage.test.tsx` 新增 8 项、`handlers.test.ts` 新增 14 项）。
- 真实后端 10588 端到端演示（全程无 mock，Playwright 驱动真实 UI）：
  新建项目（`dp:z-image-turbo` + `volcengine:doubao-seedance-2-0-260128`）→ 建 3 个分镜 →
  单个分镜生成视频提示词（**5.5s 成功**，产出的是 Seedance 2.0 多参模板格式的
  `@图片1 → <主体1>` 结构化提示词并落库）→ 批量生成图片（compulsory:true，3 张 576×1024
  **真实出图**、落 OSS、卡片显示缩略图）→ 预览拼图（后端拼成带 S01/S02/S03 标号的合成图）→
  进入工作台（3 条轨道、提示词 3/3）→ 生成视频（**失败态：`缺少API Key`**，原因内联、可重试）→
  重试产出第 2 版（版本列表持久化，刷新后仍在）。
- 端点侧实测数据（用于定参数）：256²≈1.7s / 576×1024≈4s / 1024²≈6.5s / 2048²≈44s；宽高超范围
  静默夹取；缺 prompt→400 `{"detail":"prompt is required"}`；坏 key→401；不传 seed 每次出图不同、
  同 seed 完全复现（故不传 seed，让「重试」有意义）。
