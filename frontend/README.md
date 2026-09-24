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

## 主线走查（对接真实后端）

领域映射：**剧本即分集** —— 后端没有"集"实体，一个剧本就是一集。

1. 打开 `/`，看到后端真实项目卡（角色数 / 剧本数 / 视频数 / 分镜数来自统计接口）。
2. **创作** `/create`：粘贴剧本文本 → 保存为后端剧本。
3. **STEP1** `/project/:id/scripts`：剧本列表，可编辑 / 删除 / 触发 AI 提取资产。
4. **STEP2** `/project/:id/assets`：资产工坊，真实资产的增删改 + 图片上传 + AI 润色 / 生图。
5. **STEP3** `/project/:id/episodes`：分集视频，每个剧本一张卡，显示分镜数与总时长。
6. **分镜工作区** `/project/:id/episode/:scriptId`：分镜列表（缩略图 / 描述 / 时长 / 关联资产），
   新建 / 编辑 / 单删 / 批量删全部走后端分镜接口；批量生成分镜图片（轮询到终态、可预览拼图 /
   下载拼图、失败原因内联可重试）；单分镜生成 / 编辑视频提示词、提交视频生成。
7. **工作台** `/project/:id/episode/:scriptId/bench`：视频轨道总览（轨道与分镜一一对应），
   批量生成提示词 / 批量生成视频，成片版本的选择、切换与删除。

## 模型配置（生图 / 生视频的前提）

`o_project.imageModel` / `videoModel` 必须是 `<供应商id>:<模型名>`，后端按冒号切分去查
`o_vendorConfig`；裸名（如 `Seedream-4.0`）会直接报「未找到供应商配置 id=X」。
表单选项见 `src/config/project.ts`，两边都别写裸名。

自建图像服务（Z-Image-Turbo）的适配器在 `backend/data/vendor/dp.ts`，密钥只落在
后端运行库 `o_vendorConfig`（sqlite，不进 git）。
