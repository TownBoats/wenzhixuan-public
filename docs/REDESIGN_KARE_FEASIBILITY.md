# Susan Kare 风重设计 · 实施难度审评

> 配套文档：[REDESIGN_KARE.md](./REDESIGN_KARE.md)
>
> 本文把方案里的所有改动按"实施成本"切分成三档：
>
> - 🟢 **易**：纯代码改动，单人短时间可独立完成，不需要外部资源、不需要架构调整。
> - 🟡 **需外部资源**：依赖设计稿 / 字体文件 / 插画 / 文案审校 / 第三方资源。代码本身不复杂，但人力或资产是瓶颈。
> - 🔴 **复杂 UI 改动**：涉及多个组件联动、布局重构、状态/动效编排，或牵动业务逻辑。技术风险中到高。
>
> 每条都给出：所在层级 / 涉及文件 / 是否阻塞下一步 / 建议起手顺序。

---

## 一、🟢 易（纯代码、低风险，可立刻动手）

这一档共 **18 项**。整体特征：改 token、加配置、删死代码、ESLint 规则、统一裸标签写法。强烈建议先打一个 P0 PR 把这些一次性扫掉，立刻就能让全站视觉收敛 60% 以上。

| # | 改动 | 涉及文件 | 阻塞性 | 备注 |
|---|---|---|---|---|
| E1 | 在 `tailwind.config.js` 注入 `ink/paper/sage/sun/level/state` 6 个 token namespace | `tailwind.config.js` | 是后续一切的基础 | 与旧 `tech-*` 共存，软迁移 |
| E2 | 注入新的 `borderRadius` 五档（xs/sm/md/lg/pill） | `tailwind.config.js` | 与新组件配套 | 旧 `rounded-2xl/3xl` 暂保留 |
| E3 | 注入新的 `boxShadow`：soft / lift / float / inset | `tailwind.config.js` | — | 直接覆盖默认 shadow 用法 |
| E4 | 注入新的 `transitionTimingFunction` (soft/snap) 与 `transitionDuration` | `tailwind.config.js` | — | 全站动效统一 |
| E5 | 注入新的 `fontSize` 语义档（display/h1/h2/body/small/caption） | `tailwind.config.js` | — | 不破坏旧 text-xl 等 |
| E6 | 删除 `tailwind.config.js` 里**未使用**的 `blob`、`border-flow` 动画 | `tailwind.config.js` | — | 一行删除即可 |
| E7 | 在 `index.html` **去掉 Font Awesome CDN**、`particles.js` CDN（如未用） | `index.html` | 视 LandingPage 重构进度 | 影响着陆页，需配套 P3 |
| E8 | `App.jsx` 删除残留的 `useState(0)` / `count` 死代码 | `src/App.jsx` | — | 顺手清理 |
| E9 | `main.jsx` 包一层 `<StrictMode>`（已 import 未启用） | `src/main.jsx` | — | 1 行改动 |
| E10 | 删除/卸载未使用依赖：`@radix-ui/react-icons`、`styled-components`、（评估）`react-beautiful-dnd` | `package.json` | — | `pnpm rm` 即可 |
| E11 | 增加 Vite path alias `@ → /src` | `vite.config.js` | 后续重构时降低相对路径噪声 | 配套 jsconfig.json |
| E12 | 锁包管理器：删 `package-lock.json`，`.gitignore` 加上它 | `package-lock.json`、`.gitignore` | — | 与 `CLAUDE.md` 对齐 |
| E13 | 删除 `AnswerMessageCard` 里引用的未定义 token `tech-warning` / `tech-success`（替换为 `state-warn` / `state-good`） | `src/components/AnswerMessageCard/AnswerMessageCard.jsx` | — | 修补技术债 |
| E14 | `LanguageSwitcher` 改造：从裸 button 改成 pill toggle | `src/components/LanguageSwitcher/...` | — | 单组件、纯样式 |
| E15 | `Tooltip` 改深底浅字（`bg-ink-900 text-paper-50`），加 500ms 进入延迟 | `src/components/Tooltip/...` | — | 单组件、纯样式 |
| E16 | `MarkdownRenderer` 把"每次挂载注入 KaTeX `<link>`"挪到 `index.html` 一次性预加载 | `src/components/MarkdownRenderer/...`、`index.html` | — | 性能小优化，顺手做 |
| E17 | `UserInput` placeholder 改为"随机文案池"实现 | `src/components/UserInput/...` | — | 仅状态 + 文案 |
| E18 | 在 `eslint.config.js` 加规则：禁止 JSX 中出现 `#xxxxxx` 任意色 + 禁止 `cyan-/blue-/amber-/slate-` 等旧色家族 | `eslint.config.js` | — | 用 `eslint-plugin-tailwindcss` 或自写规则 |

**组合建议**：E1–E6 + E8–E12 + E18 合成 **P0 PR**（"基础设施 + 死代码清理"），约 200 行 diff，无业务逻辑变更。

---

## 二、🟡 需外部资源（代码不难，但等资产/人）

这一档共 **9 项**。它们卡在"不是程序员一个人能搞定"——需要设计师、文案、字体授权、母语校对。建议**并行启动资源采购**，资产到位后再合 PR。

| # | 改动 | 缺什么 | 涉及文件 | 优先级 |
|---|---|---|---|---|
| R1 | **品牌 logo（戴方框眼镜小笑脸）** | 需要设计师出 SVG（建议 24×24、48×48 两套，含 4 种表情：默认 / 思考 / 报错 / 庆祝） | `src/assets/brand/`、`index.html`、各处 logo 引用 | 高 |
| R2 | **五档答案插画**：种子 / 嫩芽 / 小树 / 大树 / 森林 | 5 张线稿 SVG + 每张配一帧"眨眼"状态（共 10 个文件） | `src/assets/levels/`、`AnswerCard.jsx`、`AnswerMessageCard.jsx` | 高（决定 AnswerCard 重构） |
| R3 | **状态/空状态插画**：咖啡杯 / 翻开笔记本 / 打盹小猫 / 钥匙 / 举旗小人 / 折断羽毛笔 / 沙漏 / 螺丝刀 / 大脑 / 卷轴 / 调色盘 / 纸飞机 / 羽毛笔（约 13 张） | 设计师批量出图，每张 ≤ 2KB SVG | `src/assets/illustrations/`、多个组件 | 中 |
| R4 | **可变字体本地化**：Inter Variable、Source Serif Variable、JetBrains Mono Variable、Fraunces | 字体文件 + woff2 子集化（中文 3500 常用字 + 拉丁基础） | `public/fonts/`、`src/index.css` 注入 `@font-face` | 高（决定排版人格） |
| R5 | **i18n 中文文案重写**（约 80–120 条） | 文案/产品同学按 Layer 5 语气准则重写；保留旧 key 做 A/B | `src/locales/zh/translation.json` | 中 |
| R6 | **i18n 英文文案重写** | 英文母语者校对"亲和但不幼稚" | `src/locales/en/translation.json` | 低（可后置） |
| R7 | **AnswerCard 倒计时配套小船 SVG + 飘叶子 SVG** | 设计师额外提供 2 个动效素材 | `src/assets/motion/` | 中 |
| R8 | **彩蛋资产**：庆祝叶片 / 生日帽 / 凌晨星空 icon / "OK" 表情包 | 设计师额外 4 张 | `src/assets/easter/` | 低 |
| R9 | **"经典黑蓝"皮肤兼容**（保留 `tech-*` token 作为可选主题） | 决策：是否保留？需产品同意 | `tailwind.config.js`、`SettingsPanel` 外观页 | 中 |

**建议**：R1 → R2 → R4 三件最关键，没有它们 P3 业务组件改造无法完整落地。R5/R6 可以 Cloud Agent 起一稿，再交给文案审。

---

## 三、🔴 复杂 UI 改动（多组件联动 / 布局重构 / 动效编排）

这一档共 **11 项**。每一项都建议**单独成 PR**，且配 Playwright 截图回归。

| # | 改动 | 难度构成 | 涉及文件 | 建议拆解 |
|---|---|---|---|---|
| C1 | **`ChatPage.jsx` 骨架重写**（顶栏 56px / 720px 居中列 / 浮动输入框） | 牵动 `ChatLayout`、`ChatWindow`、`UserInput` 三处定位与滚动；同时要先做"上帝组件拆分"（`useConversationTurn` / `useAutoFollowUp`） | `src/pages/ChatPage/ChatPage.jsx`、`ChatLayout`、`ChatWindow` | 先拆 hooks（独立 PR），再改布局 |
| C2 | **AnswerCard 五档生长链布局** | 横向布局 + 虚线连接 + 选中时虚线断开 + 插画发光 + 入场上浮 + 倒计时小船动画 + 拖拽缩放兼容 | `src/components/AnswerCard/AnswerCard.jsx`（556 行） | 分 3 步：1) 静态结构 2) 选中态动画 3) 倒计时小船 |
| C3 | **MessageBubble 头像变脸系统** | 4 种头像状态切换 + 状态机（普通/思考/报错/感谢检测）+ 触发时机与气泡入场动画解耦 | `src/components/MessageBubble/...`、新文件 `useAssistantAvatar.js` | 先静态 4 帧上线，再加状态机 |
| C4 | **ThinkingBlock 咖啡杯 + 文案池 + 衬线斜体** | SVG path 循环动画（热气）+ 文案池随机 + framer-motion 折叠交互改造 | `src/components/ThinkingBlock/...` | 中等，主要是动效调试 |
| C5 | **SettingsPanel 工具抽屉化**（Tab 改 240px 列 + 6 个 icon Tab + 选中态左竖线） | Tab 系统重写 + framer-motion `layoutId` 重新编排 + 危险操作提示样式 | `src/components/SettingsPanel/...` | 静态布局 + 动效迁移 |
| C6 | **HistorySidebar 日记本化**（日期/标题/摘要三层 + hover 三按钮浮出） | 摘要截取逻辑 + hover 动画群 + 选中态 + 日期 i18n 格式化 | `src/components/HistorySidebar/...` | 中 |
| C7 | **WelcomeScreen 重构**（logo + 副标题 + 居中输入 + 2×2 QuickPrompts 卡片） | 与 R1/R3 强耦合（要等插画）；首次配置 modal 文案重写 | `src/components/WelcomeScreen/...`、`QuickPrompts` | 等 R1+R3 |
| C8 | **LandingPage 接回路由 + 视觉同源** | `main.jsx` 引入 `BrowserRouter`；着陆页配色/字体替换；粒子背景 → 飘叶子 SVG | `src/main.jsx`、`src/App.jsx`、`LandingPage.jsx`、`LandingPage.css` | 路由先合（独立小 PR），视觉重构后置 |
| C9 | **暗色模式全站落地** | 所有 token 在 `dark:` 前缀下补一份；KaTeX 暗色 patch；本地存储与系统偏好检测 | `tailwind.config.js`、`src/index.css`、`SettingsPanel` 外观页、所有组件 | 必须在 P3 业务组件改造**全部完成后**做 |
| C10 | **彩蛋系统**（连续答对 / 凌晨问候 / 第 100 条 / 开发者模式触发动画） | 需要新增 `useEasterEggs.js`，监听消息计数、时间、答题状态；庆祝动效用 framer-motion；与 `useDeveloperMode` 集成 | `src/utils/easterEggs.js`（新）、`src/hooks/useEasterEggs.js`（新）、多组件挂钩 | 最后做，纯加分项 |
| C11 | **Playwright 视觉回归**（5 条核心场景截图基线） | 引入 Playwright + 配置 + 5 个 spec + CI 集成 + 像素阈值调参 | `tests/visual/`、`playwright.config.ts`、CI 配置 | **必做**，否则后续所有 🔴 项都没有验证手段 |

---

## 四、推荐起手顺序（最大化 ROI）

```
Week 0  ─ 立刻开干 ─────────────────────────────
  P0 PR：E1–E6 + E8–E12 + E18    （🟢 全部易项的"地基"）
  并行：联系设计师启动 R1/R2/R4 资产采购

Week 1 ─ 等资产到位的同时 ─────────────────────
  P1 PR：新建 src/components/ui/ 原子组件 (Button/Input/Icon/Tag/Tooltip)
        E13/E14/E15/E16/E17 顺带做掉
  P0.5 PR：C11 引入 Playwright + 5 条空 spec（先有架子）

Week 2 ─ 资产到位后 ───────────────────────────
  P2 PR：C8 LandingPage 路由接回（小，先合）
  P3a PR：C3 MessageBubble 头像变脸（最容易出彩、风险最低的业务组件）
  P3b PR：C4 ThinkingBlock 咖啡杯
  P3c PR：UserInput 重构（与 C7 WelcomeScreen 配套）

Week 3 ─ 重头戏 ──────────────────────────────
  P4a PR：C2 AnswerCard 五档生长链（最重，单独一个 PR）
  P4b PR：C5 SettingsPanel 工具抽屉化
  P4c PR：C6 HistorySidebar 日记本化

Week 4 ─ 收尾 ────────────────────────────────
  P5 PR：C1 ChatPage 骨架重写（依赖前面所有组件改造完成）
  P6 PR：R5 中文文案 + Layer 5 文案重写
  P7 PR：C9 暗色模式全站落地
  P8 PR：C10 彩蛋系统 + R8 彩蛋资产
```

> **注**：上面以 PR 数量给出节奏感，并非时间承诺。每个 PR 控制在 800–1500 行 diff，独立可回滚。

---

## 五、阻塞关系与关键路径

```
        ┌──────────────┐
        │ P0 token 地基 │  ← 阻塞所有后续
        └──────┬───────┘
               │
       ┌───────┴────────┐
       ▼                ▼
  ┌─────────┐     ┌──────────┐
  │ P1 原子   │     │ R1/R2/R4  │  ← 资产采购 (并行)
  │ 组件      │     │ 设计资产   │
  └────┬─────┘     └─────┬─────┘
       └──────┬──────────┘
              ▼
      ┌────────────────┐
      │ P3 业务组件改造  │  ← AnswerCard 是关键路径上最重的一个节点
      └───────┬────────┘
              ▼
      ┌────────────────┐
      │ P5 ChatPage 布局│  ← 必须等 P3 完成
      └───────┬────────┘
              ▼
      ┌────────────────┐
      │ P7 暗色模式      │  ← 必须等所有业务组件就位才能补 dark: 类
      └────────────────┘
```

**关键路径**：`P0 → P1 → R1/R2/R4 → AnswerCard (C2) → ChatPage (C1) → 暗色模式 (C9)`。

任何在这条链上的延期都会推迟整套发布。

---

## 六、给云端 Agent 的"立即可做清单"

如果你想让我（云端 Agent）今天就动手，**不需要任何外部资源**就可以独立完成：

1. ✅ E1–E6（Tailwind token 注入，完全增量、不破旧类）
2. ✅ E8（删 App.jsx 死代码）
3. ✅ E9（启用 StrictMode）
4. ✅ E11（加 Vite alias）
5. ✅ E13（修 AnswerMessageCard 未定义 token）
6. ✅ E18（加 ESLint 颜色封禁规则）
7. ✅ P1 原子组件骨架（Button/Input/Icon/Tag/Tooltip）— 用 lucide-react 替代自绘 icon，先把组件写出来等资产替换

这一组打包成一个 PR，约 400–800 行 diff，可以做到：

- 不影响任何现有 UI 渲染
- 为后续所有改造铺好"地基"
- 立刻可以在 Storybook / 单测里看到原子组件的样子（如果你想，我可以一并引入 vitest + @storybook/vite，但那是另一个 P0.5 PR）

需要我开干就回复"做"，我会立刻新开 `cursor/redesign-p0-foundation-49ca` 分支动手。
