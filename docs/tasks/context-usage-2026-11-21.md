# 测试保活与上下文实测验证

日期：2026-11-21；环境：Windows / Node v22.22.1 / pnpm 10.9.0。2026-11-24 从 HANDOFF 原文移入，未重跑。
对应提交：`3e9c746`（测试保活）、`391499b`（上下文实测）。设计说明见 [现行知识](../knowledge/agent-upgrade.md)。

## 前情

2026-11-14 的 7 项取消来自 `generateAnswerOptions.test.js` 超时保活问题。

## 修复与验证记录

2026-11-21 修复（基准 `d9bbd55` + 工作区，同一环境）：根因是 Node 中 `AbortSignal.timeout`
与测试 `hangingFetch` 兜底计时器均 unref，等待期间事件循环无活跃句柄而提前退出。
`hangingFetch` 兜底计时器改为保持 ref、abort 时清除；未改生产代码。
结果：该文件 15/15；完整回归 221/221、0 取消、退出 0；`session-loop` 17/17；改动文件 eslint 通过。
上下文实测（同日，同基准 + 工作区）：改 `contextWindow`、`tokenUsage`、指示器、页面接线与中英文案。
完整回归 226/226 退出 0；`session-loop` 17/17；改动 JS/JSX eslint 通过；`vite build` 成功（大 chunk 提示保留）。
UI 改为输入框内圆环后，用户在本地 5175 查看并认可（“还可以”）；工具侧无浏览器截图，未做真实模型验证；`reasoningTokens` 扣减依赖提供商返回明细，未经真实端点确认。
