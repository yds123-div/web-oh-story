# 03 — 节点画布·工具与打组

**What to build:** 在已可交互的节点画布上补齐专业工具层：工具栏 12+ 功能（视频/图片/音频/文本/智能剪辑/三视图/九宫格/灯光/高清扩图/逐帧拉片/片段重拍 TAKE/打组复用）纯 UI + toast 反馈；支持框选成组、组面板、模板重新执行。完成后节点画布整页对照 demo `node.html` 达到全量还原。

**Blocked by:** 02 — 节点画布·画布与连线

**Status:** ready-for-agent

- [ ] 工具栏 12+ 功能项，视觉与 demo 对齐，点击出 toast（演示阶段，不实现真实处理）
- [ ] 框选成组，组面板显示组内容
- [ ] 打组复用：模板重新执行（toast 反馈）
- [ ] 节点画布整页与 demo `node.html` 并排肉眼比对通过

## Comments

- 2026-09-20 code-review 发现：issue 文字写「框选成组」，但 demo `node.html:285` 本身只支持 Ctrl+点击多选（无 marquee 框选）。按 spec D1「demo 为验收标准」，实现采用 Ctrl+点击多选，与 demo 一致；组面板在 demo 计数基础上额外列出成员节点名，满足「显示组内容」。
