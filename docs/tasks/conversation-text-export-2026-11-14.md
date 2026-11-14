# 单个对话的可读文本导出

日期：2026-11-14；源码基准：`e62f29d`（实施阶段为 `7e17ff2` + 工作区）。Windows / Node v22.22.1 / pnpm 10.9.0，现有本地依赖，无依赖或锁文件变更。沿用本会话既有推送部署授权交付用户对上一轮的澄清。

## 目标与结果

用户需要方便阅读的核心文本对话。历史列表同一下载按钮现导出 UTF-8 TXT，以“我 / 问知轩”标注双方正文、提问和实际作答。下载去掉 JSON 字段、内部 ID、工具参数、图示源代码、思考、候选项/档位及 Markdown 排版标记；程序在下一轮重复的作答摘要跳过。普通教学代码及数学运算符保留。跳过问题记为“跳过”，待答问题仅保留问题正文。

`conversationText.js` 定义独立阅读投影；已有 `react-markdown` 同步实现和 `remark-gfm` 解析后读取元素文本，不挂载 DOM，不为导出加载图片或请求模型。v2 保持正文片段次序并合并同一流片段；旧 v1 优先 UI 消息，保留实际答案卡的回答，缺 UI 则读旧 user/assistant 消息。历史抽屉角色/提示中英文齐备。

设置的完整 JSON 备份及导入保持，旧单条 JSON 文件仍可导入；TXT 不用于会话恢复。历史列表原 JSON 下载语义已被用户本次澄清取代，详细替代关系记于 [ADR-002](../decisions/ADR-002-data-backup.md)。当前会话保存检查、运行中禁用当前导出/仍可导出其他会话的行为保持。

## 验证

| 命令 / 动作 | 结果与限制 |
| --- | --- |
| `node --test "src/utils/__tests__/conversationText.test.js" "src/utils/__tests__/dataBackup.test.js"` | 25/25 通过：新增文本 7 项、既有备份 18 项；受控数据，无真实模型 |
| `node --test "src/agent/__tests__/*.test.js" "src/utils/__tests__/*.test.js"` | 220 项，213 通过、0 断言失败、7 取消，退出 1；既有候选服务 timeout 保活问题维持 |
| `pnpm exec eslint src/utils/conversationText.js src/utils/downloadBackup.js src/utils/__tests__/conversationText.test.js src/utils/__tests__/dataBackup.test.js src/pages/AgentChatPage/useConversationHistory.js src/pages/AgentChatPage/AgentChatPage.jsx` | 6 个新增/修改 JS/JSX 文件通过 |
| `pnpm exec vite build` | 成功；Browserslist 陈旧、大 chunk 提示保持 |
| `git diff --check` | 通过 |

文本测试覆盖 Markdown/表格/列表去排版而保留代码、运算符和字符含义；正文+问题+答案按角色输出且不重复摘要；过滤内部数据与思考；合并流片段；待答、跳过和失败部分正文；v1 UI/旧消息、旧协议标签、无问题记录的回答和中英文角色。既有单条 JSON 结构化读取测试继续保留，历史 hook 的对外导出断言已改为正文 TXT。

浏览器用独立端口 5193 及模拟数据验证：实际点击新会话下载，文件名以 `.txt` 结尾，MIME 为 `text/plain;charset=utf-8`；Blob 正文只有标题和双方对话，实际答案只出现一次，无 expert 档位、候选项、图示源代码或 JSON 字段。旧 v1 下载同为可读 TXT，未切换当前会话。再从设置点击完整备份，文件仍为 `.json`、MIME `application/json;charset=utf-8`、format 为 `wenzhixuan-backup`。

测试未操作生产用户数据、未发真实模型请求；只确认浏览器发起下载与 Blob 内容，未核实最终下载目录。临时测试历史/页面及 Vite 进程在收尾清理。实际设备和用户阅读验收由用户完成。

## 发布

功能提交 `e62f29d1c2b5bf2d40b2e738074689c0a6d84fe8` 已普通推送 main；[Vercel 部署](https://vercel.com/2413250743-qqcoms-projects/wenzhixuan-public/7TWFVDndP8xXc5Mq7RcDs4DiPsDe) 的 GitHub 状态为 success。

生产域名 `https://wenzhixuan.com/` 和新资源 `/assets/index-CV4LsUpQ.js` 均为 HTTP 200。bundle 已包含“导出对话文本”、“易读的 TXT 对话”和 `text/plain`，确认新功能资源已提供；未对生产用户数据执行下载或模型请求。原有 `dev-preview.cmd`、`dist-verify/` 保留，不纳入提交。

## 同日补充：保留图示代码

用户追加“图示代码可以保留”，替代前述过滤图示源码的范围。基准 `1c3443d` + 本轮工作区，环境不变。已完成 explain_card/visualize 结果的 SVG/HTML 源码按原讲解位置输出；正文代码块、原始 SVG/HTML、Mermaid 和旧 v1 图示片段保留。代码在 Markdown 处理前以占位保护，提取文字后原样恢复；工具 ID、未知载荷、失败输入/运行中预览与思考仍不纳入，不更改模型或持久化。

- 文本 + 备份专项：26/26（文本 8 项、备份 18 项）。新增覆盖成功图示源代码次序、缩进/空行和代码字面标记精确保留，过滤失败/未完成/未知工具数据；原过滤图示用例已按新要求替换。
- 完整命令 `node --test "src/agent/__tests__/*.test.js" "src/utils/__tests__/*.test.js"`：221 项，214 通过、0 断言失败、7 取消，退出 1；既有超时保活问题不变。
- `pnpm exec eslint src/utils/conversationText.js src/utils/__tests__/conversationText.test.js` 通过；`pnpm exec vite build` 成功，Browserslist 与大 chunk 提示保留；`git diff --check` 通过。
- Chrome 独立端口 5195 模拟会话实际点击下载：`.txt` / `text/plain;charset=utf-8`，Blob 内 SVG/HTML 与原始输入逐字相同（含缩进和连续空行），顺序为讲解 → SVG → 讲解 → HTML。没有操作生产用户数据或真实模型。
- 临时浏览器页、模拟历史和 Vite 在收尾清理；与前次相同，未核实最终下载目录。按本会话既有授权推 main 后核对 Vercel 和生产资源，最终证据见当前交接。
