# 当前交接

更新时间：2026-11-03。当前分支 `dev`。
源码基准：整条撤销 `eab0f12`，产品源码恢复到父提交 `0711273`。
本页和现行知识另补撤销状态与验证记录，最终提交哈希以 Git 日志为准。

## 1. 当前状态

- 用户本轮目标：撤销“学习链路”相关 commit，并检查当前分支。
- 全部分支提交标题中仅找到 `eab0f12 feat(agent): 学习链路旁路提取与内嵌链路图`。
- 开始时 `dev` 与本地 `origin/dev` 跟踪引用均为 `eab0f12`。
- 本地 `main` 与 `origin/main` 跟踪引用均为父提交 `0711273`。
- 新增 revert 提交保留历史，不 reset、不强推、不切换分支。
- 学习链路 UI、调度、提取器、提示词、存储、专用测试和翻译整体撤销。
- 该提交捆绑的 `.npmrc` 与候选服务超时测试保活修复也随之撤销。
- 没有更改依赖版本或锁文件，没有重装现有 `node_modules`。
- 浏览器会话与模型配置不迁移、不清空；残留学习记录键不再读写，也未清除。
- A–F 与 G 阶段历史验收保持历史事实，不代表本次撤销已经人工验收。
- 旧阶段串行流程、文件白名单和七节追加日志已退役，根 `AGENTS.md` 为共享规则正文。

## 2. 分支、工作区和下一步

本轮仅生成本地撤销提交，未推送，也未集成到 `main`。
`origin/*` 是本地跟踪引用；本轮 `git ls-remote origin refs/heads/dev refs/heads/main` 失败，远端实时状态未确认。
原始错误：`Failed to connect to github.com port 443`。

工作区原有未跟踪文件保留，并排除在提交之外：

- `dev-preview.cmd`
- `dist-verify/`

此前交接记载计划任务 `wzx-vite-preview` 使用该脚本和 5174 端口；本轮未核验或操作任务。
旧 `dist-verify/` 不代表本轮源码的构建制品；继续使用旧预览前应核对其源码或制品。
后续推送、分支集成、发布由用户另行授权，不因完成撤销自动执行。
独立依赖布局配置或超时测试保活修复如需重新引入，应作为单独的小修复处理。

## 3. 本轮验证

日期：2026-11-03；环境：Windows / Node v22.22.1 / pnpm 10.9.0，现有本地依赖。
基准：`eab0f12` 的整条逆向补丁（产品源码与 `0711273` 相同），附本轮文档更新。
未使用真实模型，没有验证模型端点、浏览器交互或移动端。

| 命令 / 动作 | 结果与限制 |
| --- | --- |
| `node --test "src/agent/__tests__/*.test.js" "src/utils/__tests__/*.test.js"` | 189 项：182 通过，0 断言失败，7 取消；退出码 1，不能称完整通过 |
| `node --test --test-reporter=spec src/agent/__tests__/generateAnswerOptions.test.js` | 单文件复核：8 通过、7 取消；超时用例先触发事件循环退出，后续用例连带取消 |
| `node scripts/session-loop.mjs` | 17/17 通过；受控运行层，不代表真实模型 |
| 4 个改动且仍存在的 JS/JSX 文件 ESLint | 无报错；范围见下方命令 |
| `pnpm exec vite build` | 成功，44.66s；提示 Browserslist 数据陈旧与大于 500 kB 的 chunk，未升级依赖 |
| `git diff --cached --check` / `git diff --check` | 逆向补丁与文档更新检查通过 |
| 搜索学习链路源码引用 | `src` 中无残留匹配；现行知识保留撤销与数据边界说明 |

Lint 命令：`pnpm exec eslint src/agent/__tests__/generateAnswerOptions.test.js src/agent/modePrompts.js src/pages/AgentChatPage/AgentChatPage.jsx src/pages/AgentChatPage/useConversationHistory.js`。
取消错误原文：`Promise resolution is still pending but the event loop has already resolved`。
原因与被撤销提交内的测试修复吻合：`AbortSignal.timeout` 不保活，挂起 mock 没有其他活跃句柄。
为保持整条提交撤销，本轮未重新引入该修复，也没有将取消计作通过。

## 4. 未关闭事项

| ID | 事实与影响 | 下一动作 / 解除条件 |
| --- | --- | --- |
| V-01 超时测试 | 整条撤销恢复旧测试保活问题，7 项取消；依赖加载未受阻 | 如需完整绿灯，独立恢复测试保活修复后重跑 |
| V-02 工具质量 | 三工具、结构化副模型与流式预览的历史记录不覆盖本次真实端点行为 | 按现行知识安排范围化验证 |
| V-03 配置闭环 | 历史 G-1 用假 key；用户已接受，未补具体端点范围 | 需要时单独验证真实配置保存与发送 |
| P-01 文案 | migrationNotice 仍描述旧入口；AnswerCard.send 缺翻译键等 | 小修复时核对中英文及无障碍文案 |
| P-02 重试语义 | 重试后旧 pending 问题仍可作答，是历史接受行为 | 改变前明确产品决定，见业务知识 §7 |
| C-01 旧代码 | 旧 ChatPage 和专用链无主入口，仍保留 | 按静态引用候选另行清理，保留共享组件和 v1 兼容 |
| C-02 兼容数据 | 历史会话和模型配置仍使用；学习记录键可能残留 | 不随源码回退删除用户数据 |
| S-01 生成内容 | sandbox、CSP、来源校验存在；visualize 允许部分外部资源 | 不声称安全审计已完成 |
| G-01 本机产物 | 两项未跟踪路径和旧预览任务未处理 | 如需清理，单独核对范围 |
| G-02 远端状态 | 网络连接失败，只有本地跟踪引用证据 | 网络恢复后查询；本轮不推送 |

## 5. 知识和历史入口

- [文档导航](README.md)
- [Harness 方法](harness/README.md)、[模板](harness/TEMPLATES.md)、[复盘](harness/RETROSPECTIVE.md)
- [现行业务与架构](knowledge/agent-upgrade.md)、[阶段总结](knowledge/agent-upgrade-summary.md)
- [历史索引与勘误](archive/agent-upgrade-2026-11-01/README.md)
- [归档清单](archive/agent-upgrade-2026-11-01/manifest.json)、[阶段交付记录](archive/agent-upgrade-2026-11-01/CLOSEOUT.md)

学习链路 ADR、实施和当时验证证据仍在提交 `eab0f12` 中，可由 Git 历史查阅。
该提交的已接受状态与待验收计划已被本次撤销取代，不能作为当前功能说明。
此前阶段归档、历史测试数和人工验收不等于当前提交已重新验证。

## 6. 维护方式

开始任务先核对本页和 Git，再按影响范围读现行知识。
用户最新明确授权优先于旧下一步；提交、集成、推送和发布分别执行。
收尾覆盖当前状态、下一动作、未关闭问题、证据与知识入口，不追加全部会话日志。
稳定结论进入知识文档；本地配置、凭据与完整环境日志不入公共仓库。
