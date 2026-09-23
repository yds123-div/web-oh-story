# 01 — 连接地基：静默登录 + 信封解包 + 代理切换

**Parent spec:** `spec.md`（同目录）

**What to build:** 应用启动时无感完成认证并直连真实后端。启动即用默认账号调登录接口换取真实 token 存入现有 localStorage 键；请求层解包后端信封；开发代理指向后端真实端口；MSW 从应用默认链路退下、但完整保留给测试。完成后打开任意页面请求不再被 401 拦截，业务失败与后端不可达都有明确提示。

**Blocked by:** None — can start immediately

**Status**: done

原型已确认的契约要点（来自 `frontend/prototype-integration-flow.html`）：

- 登录：`POST /api/login/login`，body `{username, password}`，信封 data 为 `{token, name, id}`；注意后端返回的 token 带 `Bearer ` 前缀，入库前需剥掉
- 信封：所有业务响应 HTTP 恒为 200，成败看 `{code, data, message}`；`code===200` 取 data，否则抛携带 message 的错误
- 后端参数校验失败返回的是 HTTP 400 + `{message, errors}`（非信封），需兼容处理

- [x] 应用启动时静默自动登录（默认账号），真实 token 写入现有 localStorage 键（`deepsfv-token`），失败时给出可见错误而非白屏
- [x] 请求层增加信封解包：`code=200` 返回 data；`code≠200` 抛出携带 message 的错误对象
- [x] 兼容非信封响应：后端参数校验的 HTTP 400、404 与错误处理路径
- [x] 401 沿用现有全局提示机制（unauthorizedHandler）
- [x] 网络错误 / 后端不可达时有区别于业务失败的明确提示
- [x] 开发环境默认配置切换：MSW 不在应用启动、开发代理开启并指向 `http://localhost:10588`
- [x] MSW 体系保留在代码库且现有测试不经改动仍可运行（node 模式）
- [x] 请求层单元测试覆盖：信封成功、信封失败（code≠200）、非信封 HTTP 错误三种响应

## Comments

- 2026-09-23 实现完成（commit 507574e + 修复 2e673ac）。端到端已验证：本地起后端 10588 + 前端 dev，启动即静默登录，真实 JWT（已剥 Bearer 前缀）写入 `deepsfv-token`，无 401。
- 默认值落在代码里（MSW 改为 `VITE_ENABLE_MSW=true` 显式开启、代理默认开启且 `loadEnv` 读 `.env`）；`.env` 因含 API key 被 gitignore，克隆方靠代码默认值即可连通。
- 遗留：`handlers.test.ts` 有 2 个改动前就存在的状态泄漏失败（outline/episodes 契约），与本次无关，待另行处理。
