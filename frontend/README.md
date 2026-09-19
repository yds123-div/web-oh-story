# DeepSFV Frontend

AI 短剧创作工坊（`deepsfv-frontend`）。契约：`docs/api/openapi.yaml`。后端对接：`docs/backend-guide.md`。

## 开发

```bash
pnpm install
pnpm dev
```

默认开启 MSW。关闭 mock、把 `/api` 代理到真后端：

```bash
VITE_ENABLE_MSW=false VITE_API_PROXY=http://localhost:8080 pnpm dev
```

## 测试

```bash
pnpm test
pnpm build
```

## 全流程走查（MSW）

1. 打开 `/`，看到《逆命木叶》等项目卡；顶栏积分来自 `GET /api/credits`，铃铛打开通知中心。
2. **创意** `/idea`：官方示例模板卡 →「套用」进入 `/create?templateId=`，创作入口预填剧本文本与名称。
3. **创作** `/create`：粘贴或上传剧本（txt/pdf/doc/docx/md，≤30 万字）→ 立即创作 ◆32 → 大纲任务进度 → STEP1。
4. **STEP1** `/project/:id/outline`：设定 / 摘要 / 资产提取 → 剧本定稿，解锁 STEP2。
5. **STEP2** `/project/:id/assets`：生成角色形象（任务进度 + 图片）→ 一致性锁定 → 进入分集。
6. **STEP3** `/project/:id/episodes`：导演拆分任务 → 第 1 集（3 片段 / 37s）→ 进入片段编辑器。
7. **片段编辑器**：编辑提示词（`@` 引用资产 chip）、切换 Seedance 2.5 / Minimax H3 Max / Wan 3.0、生成 ◆1300 / 再次生成 ◆406、预览 `clip*.mp4`、时间轴切换片段。
8. **合成导出**：⬇ 合成 → 进度弹窗 → 下载成片 mp4。
