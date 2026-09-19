# PROTOTYPE（throwaway）— AntD 5 主题定制成本测量

> **这是抛弃式原型，不进 `frontend/` 正式工程。** 它只回答一个问题：
> **AntD 5 能以多大的定制成本还原 `hogee-demo-assets` 的视觉风格？**
> 结论见 [FINDINGS.md](./FINDINGS.md)（已折回 `plans/deepsfv-frontend.md` 阶段 1）。

## 运行

```bash
pnpm install
pnpm dev        # http://localhost:5301
```

> 若 `pnpm install` 提示 `Ignored build scripts: esbuild` 且 vite 起不来：
> 已在 package.json 配置 `pnpm.onlyBuiltDependencies: ["esbuild"]`，重装即可；
> 或手动执行 `node node_modules/.pnpm/esbuild@*/node_modules/esbuild/install.js`。

对比截图需要原版 demo 时（可选）：

```bash
node serve-demo-assets.cjs   # http://localhost:5302/space.html
```

## 三个变体（底部浮动条或 ←/→ 方向键切换）

| URL | 策略 | 测什么 |
|---|---|---|
| `?variant=A` | 纯 token，零自定义 CSS | 成本下限：AntD 免费给到多少观感 |
| `?variant=B` | token + 定向 CSS（推荐） | 甜点位：46 行 CSS 到 95%+ |
| `?variant=C` | demo CSS 原样移植 | 成本上限 / 视觉 ground truth |

底部浮动条实时显示当前变体的自定义 CSS 行数（从 `?raw` 导入统计）。
对比截图在 `screenshots/`（含原版 `demo-original.png`）。

## 结构

```
src/theme.ts              # ★ 核心产出：demo 变量 → AntD token 映射（阶段 1 直接复用）
src/variants/VariantA.tsx # 纯 token
src/variants/VariantB.tsx # token + custom-b.css
src/variants/VariantC.tsx # demo 标记 + demo-c.css（shared.css 本屏子集）
src/PrototypeSwitcher.tsx # 浮动切换条 + CSS 行数实时统计
```

## 已知杂项

- 本机 5199/5200 端口曾被先前 dev server 进程占用，故端口定为 5301/5302。
- 侧栏只放 v1 spec 的三项（首页/创意/创作），非 demo 的七项。
