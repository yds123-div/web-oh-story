# DeepSFV 后端对接说明书

> 契约源：`docs/api/openapi.yaml`（OpenAPI 3.1）  
> 前端请求前缀：`/api`  
> 鉴权：所有接口携带 `Authorization: Bearer <token>`；v1 无登录页，MSW 放行。

## 1. 异步任务（轮询，无 SSE / WebSocket）

长任务统一两步：

1. `POST /api/{resource}/tasks` → `202 { "taskId": "task-..." }`
2. 前端每 2–3s `GET /api/tasks/{taskId}`，直到终止态

`TaskStatus`：

```json
{
  "taskId": "task-...",
  "status": "pending | running | succeeded | failed",
  "progress": 0,
  "result": {},
  "error": "失败原因"
}
```

规则：

- `pending` → `running`（`progress` 0–100 递增）→ `succeeded` / `failed`
- 成功时 `progress` 为 100，并带 `result`
- 失败时带 `error` 字符串
- 前端封装为 `useTask(taskId)`；升级 SSE 时只改传输层

各任务 `result` 形状：

| 任务 | 提交 | result |
|---|---|---|
| 大纲解读 | `POST /api/projects/{id}/outline-tasks` | `{ projectId }` |
| 资产生图 | `POST /api/assets/{id}/image-tasks` | `{ assetId, imageUrl }` |
| 分集拆分 | `POST /api/projects/{id}/episode-split-tasks` | `{ projectId, episodeCount }` |
| 片段生视频 | `POST /api/segments/{id}/video-tasks` body `{ model }` | `{ segmentId, videoUrl, model }` |
| 整集导出 | `POST /api/episodes/{episodeId}/export-tasks` | `{ downloadUrl, fileName }` |

生视频 `model` 必须是常量表之一：`seedance-2.5` / `minimax-h3-max` / `wan-3.0`。

## 2. 错误码约定

| HTTP | 含义 | 前端处理 |
|---|---|---|
| 400 | 请求体无效或前置步骤未完成 | 展示接口 `message` |
| 401 | 未授权 | 请求层统一拦截，提示重新获取令牌 |
| 404 | 资源不存在 | 提示并回到安全页 |

响应体建议：`{ "message": "人类可读原因" }`。

## 3. 接口清单

只读：

- `GET /api/projects` 项目列表 + 存储用量
- `GET /api/credits` 积分余额（扣费由后端执行，前端只展示 ◆1300 / ◆406 / ◆32 等）
- `GET /api/projects/{id}/outline`
- `GET /api/projects/{id}/workflow`
- `GET /api/projects/{id}/assets`
- `GET /api/projects/{id}/episodes`
- `GET /api/episodes/{episodeId}`
- `GET /api/episodes/{episodeId}/segments`
- `GET /api/models`
- `GET /api/templates`
- `GET /api/notifications`
- `GET /api/tasks/{taskId}`

写入 / 任务：

- `POST /api/projects` 新建（可选 `templateId`）
- `PATCH /api/projects/{id}` 重命名
- `POST /api/projects/{id}/outline-tasks`
- `POST /api/projects/{id}/outline/finalize` 定稿，解锁 STEP2
- `PATCH /api/assets/{id}` `{ consistencyLocked }`
- `POST /api/assets/{id}/image-tasks`
- `POST /api/projects/{id}/assets/complete` 解锁 STEP3
- `POST /api/projects/{id}/episode-split-tasks`
- `PATCH /api/segments/{id}` 保存提示词（`@[assetId]`）与分镜详情
- `POST /api/segments/{id}/video-tasks`
- `POST /api/episodes/{episodeId}/export-tasks`

工作流：`unlockedStep` 为 `1 | 2 | 3`。未定稿访问 STEP2、未完成资产访问 STEP3，前端会重定向。

## 4. 切换真后端（关闭 MSW）

1. 实现与 `openapi.yaml` 一致的 REST 服务（建议本地 `http://localhost:8080`）。
2. 关闭 mock 并指向后端：

```bash
VITE_ENABLE_MSW=false VITE_API_PROXY=http://localhost:8080 pnpm dev
```

3. Vite 已预留 `/api` proxy。业务代码与 `src/lib/api.ts` **零改动**。
4. 生产构建同样用网关把 `/api` 反代到后端；不要把 MSW worker 打进生产包（`VITE_ENABLE_MSW=false`）。

Mock 数据在 `src/mocks/db.ts`，演示素材在 `public/demo-assets/`（`clip1.mp4` / `clip2.mp4` / `clip3.mp4`、`linwan.png`、`itachi.png`、`corridor.jpg`）。
