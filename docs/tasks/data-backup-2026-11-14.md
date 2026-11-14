# 完整数据导出与迁移验证

日期：2026-11-14；基准：功能提交 `86efe5e`（实施阶段为 `db6fd18` + 本轮工作区）。环境：Windows、Node v22.22.1、pnpm 10.9.0、现有本地依赖；未改依赖、锁文件或安装布局。

## 实施

- `src/utils/dataBackup.js`：版本化白名单快照、旧文件兼容、校验、预览、较新记录合并、写失败回退。
- `DataBackupSection.jsx`：设置顶部的完整/不含连接凭据导出、文件预览、合并确认及结果提示；中英文文案。
- `useConversationHistory`：转移前保存检查与失败重试、标题保留、导入后重读会话命令。
- `ConfigPanel` / `AgentChatPage`：刷新配置、当前会话和历史；重建模型表单及偏好，避免导入后旧 UI 覆盖新数据。
- 格式、兼容、凭据及冲突策略见 [ADR-002](../decisions/ADR-002-data-backup.md)。

## 自动验证

| 命令 | 结果与限制 |
| --- | --- |
| `node --test "src/utils/__tests__/dataBackup.test.js"` | 13/13 通过；纯存储、现有 reducer/上下文与 React 历史 hook 的受控验证 |
| `node --test "src/agent/__tests__/*.test.js" "src/utils/__tests__/*.test.js"` | 208 项，201 通过、0 断言失败、7 取消，退出 1；已有候选服务 timeout 测试保活问题继续存在 |
| `node scripts/session-loop.mjs` | 17/17 判据通过；假运行层，无模型请求 |
| `pnpm exec eslint src/utils/dataBackup.js src/utils/__tests__/dataBackup.test.js src/pages/AgentChatPage/DataBackupSection.jsx src/pages/AgentChatPage/ConfigPanel.jsx src/pages/AgentChatPage/AgentChatPage.jsx src/pages/AgentChatPage/useConversationHistory.js` | 6 个新增/改动 JS/JSX 文件通过 |
| `pnpm exec vite build` | 成功；Browserslist 陈旧、大 chunk 提示保留，不临时升级依赖 |
| `git diff --check` | 通过 |

新增测试覆盖：v1/v2/配置/图示/已答与待答问题/偏好/退役学习记录往返；预览零写入；重复导入与 ID 冲突；BOM 旧文件；凭据排除和目标凭据保留；坏版本/未知键/坏记录/超大文件；坏本机存储阻断但可原样备份；读失败；写入失败回退与回退失败；v2 存储投影；保存失败重试与标题保留；导入后重新打开当前会话。

7 项取消与交接中 V-01 相同，错误为 `Promise resolution is still pending but the event loop has already resolved`。本轮未更改无关超时测试；取消不算通过，也不算业务断言失败。

## 浏览器验证

Chrome DevTools、本地 Vite 独立端口 5187。源为 `127.0.0.1:5187`，目标为 `localhost:5187`，两者 origin 存储隔离；只注入模拟会话与假 key，未向模型发送请求。不是实体跨设备验收。

1. 源包含 v2 待答会话和 v1 旧会话、假模型配置及等待偏好；从设置点击真实导出按钮，校验下载 Blob 的格式与 7 项存储键，触发下载。未核实浏览器下载管理器最终落盘路径。
2. 目标通过 File/DataTransfer 触发实际文件 input 的 change，看到新增 2 条记录的预览；确认前本机无历史写入。
3. 确认后显示成功：当前页面展示完整正文、待答题恢复 pending；配置快照、10000 上下文容量、等待偏好 7 秒生效，未发送草稿保留。
4. 同一文件再次导入显示保留 2 条；将模型名改成新值导入，表单与存储均立即显示新模型名。这一步发现并修复 ModelConfigPanel 的本地状态残留（导入后按 revision 重建）。
5. 选择坏 JSON 显示拒绝提示，历史/配置不变；取消包含凭据后导出，Blob 不含模型配置的 apiKey/baseURL，模型名保留。
6. 390×844 移动模拟：document 宽 390，无横向溢出；备份卡、复选框、全宽按钮与页脚布局可用，截图人工查看通过。桌面也完成实际导入交互。

移动模拟/热更新期间记录到一条 `MutationObserver.observe` 非 Node 错误；未能由工具返回定位来源，页面后续交互正常，不能据此声称浏览器控制台零错误。

测试端口上的模拟历史/假配置在收尾清理；原有 5175/线上站点的数据未修改。没有通过 CUA 操作原生应用，没有真实模型或云同步验证。

## 交付状态

实现、自动验证和部署已完成，待用户实际设备验收。用户于 2026-11-14 追加“推送部署”授权，功能提交 `86efe5e786e31bb66dc528b4d8f6929b19a3fb3e` 已普通推送 main。原有 `dev-preview.cmd` 和 `dist-verify/` 保留；未把模拟备份或本机日志放入公共仓库。

- Vercel GitHub commit status：`success`；[部署记录](https://vercel.com/2413250743-qqcoms-projects/wenzhixuan-public/7fZZpGyYVgmVrLi2XCSRQxevBnCS)。
- `https://wenzhixuan.com/` HTTP 200；生产资源 `/assets/index-DzkParkH.js` HTTP 200，包含 `wenzhixuan-backup`、`数据备份与迁移`、`确认合并导入`。
- 此证据确认生产已提供新功能资源，不表示在真实生产数据中执行过导入或模型请求；测试取消和实际设备验收限制维持上述记录。
