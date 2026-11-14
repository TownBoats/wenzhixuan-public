# 单个对话导出

日期：2026-11-14；源码基准：`690d2ff`（实施阶段为 `c18eeee` + 本轮工作区）。Windows / Node v22.22.1 / pnpm 10.9.0，沿用现有依赖。用户在全量备份上线后要求增加单个对话导出，沿用本会话既有推送部署授权交付。

## 实施与判据

- 历史抽屉逐条提供下载按钮，使用具体会话标题作为 aria-label，并显示下载/失败提示。
- 导出的 JSON 沿用备份 v1 协议，可从设置“数据备份与迁移”导入。
- 仅含选中 ID 的一条会话，v2 优先；v1 保留原始结构。正文、回答/待答问题、图示随会话导出，不附带其他会话、设置或模型配置。
- 当前会话导出前检查保存；生成中禁用当前会话导出，其他会话仍可导出且不切换当前会话、不取消运行。
- 全量与单个导出共用 `downloadBackupFile`，Blob 下载后清理链接和 URL；文件名前缀固定，避免使用用户输入的文件路径字符。
- 不改存储键、导入合并策略、运行协议或依赖；没有批量迁移或删除业务数据。

## 验证

| 命令 / 动作 | 结果与限制 |
| --- | --- |
| `node --test "src/utils/__tests__/dataBackup.test.js"` | 18/18 通过，其中单对话新增 5 项；受控存储及真实 React 历史 hook |
| `node --test "src/agent/__tests__/*.test.js" "src/utils/__tests__/*.test.js"` | 213 项，206 通过、0 断言失败、7 取消；旧 timeout 测试保活问题不变，退出 1，不称完整通过 |
| `pnpm exec eslint src/utils/dataBackup.js src/utils/downloadBackup.js src/utils/__tests__/dataBackup.test.js src/pages/AgentChatPage/DataBackupSection.jsx src/pages/AgentChatPage/useConversationHistory.js src/pages/AgentChatPage/HistoryDrawer.jsx src/pages/AgentChatPage/AgentChatPage.jsx` | 7 个新增/改动 JS/JSX 文件通过 |
| `pnpm exec vite build` | 成功；保留 Browserslist 陈旧及 chunk 大小提示 |
| `git diff --check` | 通过 |

新增行为验证覆盖：只导出目标且 v2 优先；v1 原文往返及空 v2 兼容；不访问配置键、无关坏条目不阻断；缺失/损坏/读失败明确返回；导出当前最新会话及运行中其他会话不受影响、不切换当前会话。

Chrome DevTools 使用独立测试端口 5191 的两套 origin 存储和模拟数据，无真实模型请求。桌面实际点击历史列表三个下载按钮：分别校验所选另一 v2、旧 v1 和当前 v2 的下载 Blob 只有目标一条，不附带配置，下载其他会话未切换当前页面。目标 origin 用 File/DataTransfer 触发真实导入 input，预览新增 1 条、0 项设置且未写入；确认后只恢复目标 ID，正文/待答题保留，模型配置仍为空。

390×844 移动模拟：document 宽 390，抽屉宽 320，三条记录的下载按钮均在可视范围，无横向溢出；不是实体设备验收。测试页已关闭，模拟历史已清理，临时 Vite 进程已结束。未核实浏览器下载最终落盘目录，也未在真实生产数据中执行导入。

## 发布

完成本地验证后，功能提交 `690d2ff186cefe16520709bd45dea469de1d3429` 已普通推送 main；[Vercel 部署](https://vercel.com/2413250743-qqcoms-projects/wenzhixuan-public/CG469Qzh7qr8H5iPe2sugh2V7Kup) 的 GitHub 状态为 success。

`https://wenzhixuan.com/` 与新生产资源 `/assets/index-q4TE1NvI.js` 均返回 HTTP 200；bundle 含 `wenzhixuan-conversation`、`导出对话：`、`点击下载图标可导出单个对话`，确认新功能资源已提供。此证据不等于在真实生产数据中执行过下载/导入。原有 `dev-preview.cmd`、`dist-verify/` 保留，不随本轮提交。
