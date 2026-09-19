# FINDINGS — AntD 5 还原 hogee-demo 视觉风格的定制成本

> 原型日期：2026-09-18 · 状态：**throwaway，不进 frontend/**
> 问题：AntD 5 能以多大的定制成本还原 `hogee-demo-assets` 的视觉风格？
> 基准屏：`space.html` 项目列表页（78px 左侧图标栏 + 顶栏 + 项目卡片网格 + 新建弹窗）

## 结论

**定制成本：中。决策（2026-09-18，产品负责人确认）：采用变体 B 策略。**

- AntD 5 token 体系**免费覆盖约 80% 观感**（暗色底、文字层级、主色紫、语义色、圆角基线、阴影）。
- 补 **46 行定向 CSS**（+ ~50 行一次性 token 配置）即可到 **95%+**，肉眼几乎无法与 demo 区分。
- 追求像素级 100% 一致需每屏 ~75 行手工 CSS，且 **AntD 组件全部退出视觉层**（Modal/Input/Select 都得自己写）——得不偿失，不建议。

**推荐策略（变体 B）已可直接折回实施计划阶段 1：`src/theme.ts` 整文件复用 + 一个全局 `overrides.css`。**

## 测量方法

同一张屏、三条定制策略，`?variant=A|B|C` 切换（`pnpm dev` → http://localhost:5301）：

| 变体 | 策略 | 自定义 CSS* | 观感保真 | 截图 |
|---|---|---|---|---|
| A | 纯 token（ConfigProvider + 组件默认形态） | 0 行 | ~80% | `screenshots/variant-a.png` |
| B | token + 定向 CSS（**已选定**，2026-09-18） | **46 行** | ~95% | `screenshots/variant-b.png`、`variant-b-modal.png` |
| C | demo CSS 原样移植（ground truth） | 75 行/屏 | 100% | `screenshots/variant-c.png` |
| — | 原版 `space.html` | （553 行/shared.css 全量） | — | `screenshots/demo-original.png` |

\* 口径：非空、非注释行；排版约定与 `shared.css` 相同（一条规则一行），行数可直接对比。切换器底部实时显示该计数（`PrototypeSwitcher.tsx` 从 `?raw` 导入统计）。

## token 定制方案（阶段 1 直接可用）

已落地于 `src/theme.ts`，供 A、B 两个变体共用：

| demo 变量 | 值 | AntD token |
|---|---|---|
| `--bg` | `#0a0a10` | `colorBgLayout` |
| `--bg2` | `#101018` | `Layout.siderBg` / `Layout.headerBg` |
| `--panel` | `#15151f` | `colorBgContainer` |
| `--panel2` | `#1b1b28` | `colorBgElevated` |
| `--line` / `--line2` | `#2a2a3a` / `#3a3a50` | `colorBorderSecondary` / `colorBorder` |
| `--txt` / `--sub` / `--dim` | `#ececf4` / `#9a9ab2` / `#6b6b82` | `colorText` / `colorTextSecondary` / `colorTextTertiary` |
| `--acc` | `#8b5cf6` | `colorPrimary` |
| `--green` / `--red` / `--gold` / `--cyan` | — | `colorSuccess` / `colorError` / `colorWarning` / `colorInfo` |
| `--shadow` | `0 10px 30px rgba(0,0,0,.45)` | `boxShadowSecondary` |
| 圆角 | 10 / 16 | `borderRadius` / `borderRadiusLG` |
| 字体 | PingFang/YaHei 栈 | `fontFamily`（14px 与默认一致） |

组件级 token：`Layout`（headerHeight 56、headerPadding、siderBg）、`Menu`（itemSelectedBg 等，仅变体 A 用到）、`Button.primaryShadow`、`Modal.contentBg`。

配套注意点：

1. **`cssVar: true`** — spec 要求明暗切换，用 CSS 变量模式输出，明暗两套 token 走同一 ConfigProvider。
2. **React 19 必装 `@ant-design/v5-patch-for-react-19`**，在 `main.tsx` 首行导入（否则 message/Modal 静态方法等挂掉）。
3. **Modal 遮罩模糊不用写 CSS**：`styles={{ mask: { backdropFilter: 'blur(4px)' } }}` prop 即可。
4. **Progress 的 `strokeColor` 接受渐变对象** `{ from, to }`——渐变在 prop 层能表达的地方几乎只有它。

## token 到不了的边界（46 行 CSS 花在哪儿）

这 46 行全部对应 AntD token/组件**结构性表达不了**的东西，抄自 demo 数值零改动：

| # | 缺口 | 原因 | 行数 |
|---|---|---|---|
| 1 | 渐变（logo、主按钮、导航选中态、标题渐变字） | token 只接受纯色 | ~10 |
| 2 | 发光阴影组合（logo glow、按钮 glow） | `boxShadow*` token 档位有限 | 含上 |
| 3 | 竖排「图标在上 11px 文字在下」的 78px 图标导航 | AntD Menu 结构不支持，选中态也无法渐变+内描边 | ~6 |
| 4 | pill 胶囊（状态 chip、积分 chip、VIP 金） | Tag 语义色形态与「彩底彩字胶囊」不符 | ~8 |
| 5 | 卡片 hover 位移 + 悬浮操作层 + AIGC 角标 | Card 无此能力 | ~9 |
| 6 | 虚线新建卡 | Card 无 dashed 形态 | ~2 |
| 7 | 滚动条、侧栏 1px 描边 | 无 token | ~6 |

## 成本推演到 v1 全量

- **一次性**：`theme.ts` ~50 行 + 公共 overrides（滚动条/按钮/pill/导航/hover 卡）~25 行，全站复用。
- **每页增量**：本屏级别的页面约 30–50 行；v1 七个页面预估 overrides 总量 **150–250 行**，集中在一个 `overrides.css`。
- **风险点**：`studio.html` 片段编辑器（时间轴、预览器、分镜卡）AntD 覆盖率最低，预估另需 +100–150 行；`outline/assets/episodes` 以面板+卡片+表单为主，落在本屏已验证的模式内。风险可控，不改变结论。

## 给阶段 1 的落地建议

1. `prototype/src/theme.ts` → `frontend/src/theme.ts` 原样拷入。
2. 公共部分抽 `frontend/src/styles/overrides.css`（滚动条、pill、渐变按钮、图标导航、hover 卡），页面级增量随页补充。
3. **侧栏导航自写轻量组件，不用 AntD Menu**（结构不匹配，自写仅 6 条规则）。
4. 卡片用 AntD `Card` + `styles={{ body }}` 调内边距；状态用自写 pill span，不用 Tag。
5. Modal 用 AntD 组件 + `styles.mask` prop，勿走变体 C 的自写路线。

## 保真缺口清单（变体 B 仍差的那 5%）

- 顶栏未实现主题切换按钮（demo 的 `#themeBtn`），属功能非样式，阶段 1 验收里有。
- demo 侧栏有 7 项，v1 spec 只保留 3 项——范围差异非保真差异。
- 卡片 cover 的 hover 操作层已实现但截图无法呈现，浏览器里 hover 可见。
