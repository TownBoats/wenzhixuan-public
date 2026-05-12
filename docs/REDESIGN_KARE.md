# 问知轩 / WisClick · Susan Kare 风重设计方案 v1

> 设计基调：**像一本你愿意翻开的笔记本——纸是暖的，字是有人格的，每个图标都长得像它代表的东西，每个错误都有人替你说一句"没事"。**

本文档基于 2026-05-12 对 `/workspace` 仓库的视觉审计撰写，目标是为整个产品 UI 给出一份**分层、可实施、可分阶段提交**的重设计规格。

---

## 整体框架

```
Layer 0  设计哲学（Why）        — Susan Kare 原则映射到问知轩
Layer 1  设计 Token（What）     — 颜色 / 字体 / 圆角 / 阴影 / 间距 / 动效
Layer 2  原子组件（Atoms）      — 按钮 / 输入框 / 图标 / 标签 / Tooltip
Layer 3  业务组件（Molecules）  — 5 档答案 / 问题卡 / 消息气泡 / 思考块
Layer 4  页面与布局             — 欢迎页 / 聊天页 / 设置 / 侧栏
Layer 5  文案与人格             — 语气、空状态、错误、彩蛋
Layer 6  动效编排               — 进入、反馈、状态、奖励
Layer 7  实施 Roadmap 与风险
```

---

## Layer 0 · 设计哲学：Susan Kare 八条 → 问知轩八条

| Kare 原则 | 在本项目的具体诠释 |
|---|---|
| **1. 图标即路标** | 五档答案、设置项、消息状态都必须有"一眼看懂"的图形，不依赖中英文文字 |
| **2. 像素诚实** | 不要伪 3D、不要玻璃拟物、不要过度阴影。所有视觉效果都得"配得上一像素"的存在 |
| **3. 圆润即友好** | 全站 8px / 12px / 16px / 24px 四档圆角，**禁用直角 0px** |
| **4. 字体即人格** | 衬线（思考） + 圆体无衬线（操作） + 等宽（代码）三套人格化分工 |
| **5. 温度藏在细节** | 加载、空状态、首次启动这些"被忽视的瞬间"放小笑脸 / 小动效，绝不留白屏 |
| **6. 比喻来自生活** | 五档答案不是冷冰冰的 none/heard/basic，要换成"种子 / 嫩芽 / 小树 / 大树 / 森林"这种**可被父母看懂**的隐喻 |
| **7. 克制的强调色** | 60% 暖中性 + 30% 主色 + 10% 强调色，不再有 cyan/blue/amber/cyan-50/cyan-200 同框打架 |
| **8. 鼓励而非考核** | 文案、动效、声音都站在"陪伴"一侧，不站在"评分"一侧。**没有红色错误，只有橙色提醒** |

---

## Layer 1 · 设计 Token（重写 `tailwind.config.js`）

### 1.1 配色：彻底替换 `tech-*`，建立"问知轩 / WisClick"自有色板

**取消的**：`tech-primary #0A192F`、`tech-accent #64FFDA`、所有 cyan/amber/slate 混用、`tech-warning/tech-success` 这两个未定义 token、`AnswerCard` 里 6 个硬编码 hex 圆点。

**新增的**（命名按"角色 + 纸"的 Kare 风）：

```js
// tailwind.config.js → theme.extend.colors
ink: {                       // 文字与轮廓
  900: '#1F2330',            // 标题，几乎不用纯黑
  700: '#3F4554',            // 正文
  500: '#6B7280',            // 次级
  300: '#C4C9D2',            // 边框
},
paper: {                     // 暖中性底色 (60%)
  50:  '#FBF8F3',            // 应用底
  100: '#F4EFE6',            // 助手气泡（替代当前 #F5F1EA，更暖）
  200: '#E9E2D2',            // 分隔线、Hover
  900: '#1C1B1F',            // 暗模式底（带紫的暖黑）
},
sage: {                      // 主色 (30%)：雾蓝灰，亲和但仍专业
  50:  '#EEF2F1',
  300: '#A7BFC0',
  500: '#6B8E8C',            // 主色
  700: '#4F6D7A',
  900: '#2C3E45',
},
sun: {                       // 强调色 (10%)：温暖的橙黄
  300: '#F4C28A',
  500: '#E8A87C',            // CTA、选中态
  700: '#C97D4A',
},
// 五档答案专属色（不参与全局调色，避免污染）
level: {
  seed:    '#D9D2C5',  // 没听过 = 种子
  sprout:  '#A7C4A0',  // 听过 = 嫩芽
  sapling: '#7FA99B',  // 一般 = 小树
  tree:    '#4F8A8B',  // 熟悉 = 大树
  forest:  '#2E5E5C',  // 精通 = 森林
},
state: {                     // 不用 red / green，避免"考试感"
  good:   '#7FA99B',         // 成功 = 嫩芽绿
  warn:   '#E8A87C',         // 提醒 = 暖橙
  alert:  '#C77B68',         // 错误 = 砖红（不饱和）
  info:   '#6B8E8C',
}
```

**配色约束**：禁止 JSX 直接写 `#xxxxxx` 或 `cyan-*/blue-*/amber-*/slate-*`，统一走上面 token，用 ESLint 自定义规则或 Stylelint 加 `tailwindcss/no-arbitrary-value` 锁定。

### 1.2 字体：三套人格

```js
fontFamily: {
  sans:    ['"Inter Variable"', '"PingFang SC"', '"HarmonyOS Sans"', 'system-ui'],
  serif:   ['"Source Serif Variable"', '"Noto Serif SC"', 'Georgia', 'serif'],
  mono:    ['"JetBrains Mono Variable"', 'Menlo', 'monospace'],
  display: ['"Fraunces"', '"Noto Serif SC"', 'serif'], // 品牌、标题、引言
},
fontSize: {
  // 自上而下减一档，避免现在 text-2xl 标题压迫感
  'display': ['28px', { lineHeight: '36px', letterSpacing: '-0.01em' }],
  'h1':      ['22px', { lineHeight: '30px' }],
  'h2':      ['18px', { lineHeight: '26px' }],
  'body':    ['15px', { lineHeight: '24px' }],   // 正文
  'small':   ['13px', { lineHeight: '20px' }],
  'caption': ['11px', { lineHeight: '16px' }],
},
```

**字体角色分工**：

- **Display / 衬线**：欢迎页标题、AnswerCard 倒计时（保留现"思考即渡舟"的文言美感）、品牌 logo
- **Sans / 无衬线**：所有 UI 操作元素（按钮、输入、菜单）
- **Mono / 等宽**：代码块、API 配置里的 URL/Key 输入（mono 让"工程感"集中在该出现的地方）

### 1.3 圆角：四档枚举，禁止任意值

```js
borderRadius: {
  'xs': '4px',    // tag、badge、code-inline
  'sm': '8px',    // 按钮、输入框、tooltip
  'md': '12px',   // 卡片、消息气泡
  'lg': '20px',   // 浮层、模态框
  'pill': '9999px',
}
```

**重要规则**：圆角向上取大不向下取小。当前 `rounded-3xl (24px)` 在引导 modal 上偏过，统一收敛到 `rounded-lg (20px)`。

### 1.4 阴影：拒绝硬阴影，采用"双层柔光"

```js
boxShadow: {
  // 取消所有 shadow-md / shadow-xl 的硬阴影
  'soft':   '0 1px 2px rgba(31,35,48,0.04), 0 2px 8px rgba(31,35,48,0.04)',
  'lift':   '0 2px 6px rgba(31,35,48,0.06), 0 12px 32px rgba(31,35,48,0.08)',
  'float':  '0 8px 24px rgba(31,35,48,0.10), 0 24px 64px rgba(31,35,48,0.12)',
  'inset':  'inset 0 1px 0 rgba(255,255,255,0.6)', // 给浅色按钮加一点"瓷"质感
}
```

### 1.5 间距：8px 网格

所有 padding/gap 落在 `4 / 8 / 12 / 16 / 24 / 32 / 48` 中选一档。当前 `p-5 px-2.5 gap-y-3` 这种半档值要清退，`Tailwind` 用 `safelist` 锁住 `p-1/p-2/p-3/p-4/p-6/p-8` 等。

### 1.6 动效曲线：两条曲线打天下

```js
transitionTimingFunction: {
  'soft':  'cubic-bezier(0.32, 0.72, 0.24, 1)',     // 进入、移动（"棉花糖"曲线）
  'snap':  'cubic-bezier(0.18, 0.89, 0.32, 1.28)',  // 反馈、点击（带一点回弹）
}
transitionDuration: {
  'fast':   '120ms',     // 按钮 hover、focus
  'base':   '220ms',     // 一般状态切换
  'slow':   '420ms',     // 浮层、布局
  'theatre':'800ms',     // 答题揭示、首次启动彩蛋
}
```

---

## Layer 2 · 原子组件

下面每个原子组件给出 **"形态规范 + 默认/Hover/Active/Disabled 态 + 一行 Tailwind 引用"**。

### 2.1 Button（替换现散落各处的裸 `<button>`）

四种意图（intent）× 三种尺寸（sm / md / lg）。新建 `src/components/ui/Button.jsx`。

| Intent | 默认 | Hover | Active | 用途 |
|---|---|---|---|---|
| `primary` | `bg-sage-500 text-white shadow-soft` | `bg-sage-700 shadow-lift` | `scale-[0.98]` | 发送、保存、确认 |
| `secondary` | `bg-paper-100 text-ink-700 border border-paper-200` | `bg-paper-200` | `scale-[0.98]` | 取消、次级 |
| `ghost` | `text-ink-500 hover:bg-paper-100` | — | — | 顶栏图标按钮 |
| `accent` | `bg-sun-500 text-white` | `bg-sun-700` | — | 一次性强调，全站不超过 1 个 |

**形态**：`rounded-sm`、`h-9 (md) / h-8 (sm) / h-11 (lg)`、字体 `font-sans font-medium`、过渡 `transition-all duration-fast ease-snap`。**所有 button 都自带 `:focus-visible` 2px sage 描边**，可访问性默认开。

**Kare 触感**：按下时不只是变色，还要 **有 2px 下沉位移 + scale 0.98**，模仿物理按键。

### 2.2 Input / Textarea

替换 `UserInput`、`ModelConfigPanel` 里 `border-2 border-slate-200 focus:border-cyan-500` 风格。

```
默认：bg-paper-50 border border-paper-200 rounded-sm
聚焦：border-sage-500 ring-2 ring-sage-500/20
错误：border-state-alert ring-2 ring-state-alert/20
禁用：bg-paper-100 text-ink-500
高度：h-10（单行） / 自适应 56–160px（textarea）
内边距：px-4 py-2
字体：font-sans text-body
```

**Kare 触感**：聚焦时光标颜色 = `sage-500`（不是浏览器默认黑）。Placeholder 用 `text-ink-300 italic`，让占位文字一眼能区分。

### 2.3 Icon 系统：抛弃内联 SVG 大杂烩

**当前问题**：每个组件自己写 SVG，FA 只在着陆页用，`lucide-react` 装了不用。

**方案**：全站统一到 **`lucide-react`**（已经在依赖里）。

- 组件包装：`<Icon name="..." size={16|20|24} weight="regular|bold" />`
- 默认尺寸：行内 16px，按钮内 18px，独立 20px
- 颜色：默认 `text-ink-500`，主动态 `text-sage-500`
- 删除依赖：`@radix-ui/react-icons`、Font Awesome CDN（landing 页一并迁移）

**Kare 式自定义图标**（用 SVG 自绘，不用 lucide 替代的 7 个）：

1. **品牌 logo**：一个戴方框眼镜的小笑脸（"问"+"知"的拟人化）
2. **思考状态 icon**：托腮小人，眨一只眼睛
3. **种子/嫩芽/小树/大树/森林**：五档答案专用插画（线稿 + 单色填充）
4. **空状态插画**：空对话 = 一只趴在桌上打盹的猫；空历史 = 一本翻开的笔记本
5. **加载 icon**：小指针表（分针走动），代替现在的 spinner
6. **错误 icon**：一只举着小旗的小人（"等一下"），而不是惊叹号
7. **设置 icon**：一把手工螺丝刀

这 7 个由设计师/Figma 出 1x SVG，体积控制在每个 < 2KB。

### 2.4 Tag / Badge / Chip

```
基础：inline-flex h-6 px-2 rounded-xs text-caption font-medium
中性：bg-paper-200 text-ink-700
主动：bg-sage-50 text-sage-700
警示：bg-sun-300/40 text-sun-700
```

替换当前 `QuestionCard` 状态标签里 cyan/green/red 各一套的混乱。

### 2.5 Tooltip

```
bg-ink-900 text-paper-50 text-caption rounded-xs px-2 py-1 shadow-lift
进入动画：opacity 0→1 + translateY(4px→0)，duration-base ease-soft
延迟：500ms（避免误触）
```

去掉当前 `Tooltip` 里 `border-slate-200` 白底——白底 tooltip 在白页面上像 ghost。

---

## Layer 3 · 业务组件

### 3.1 QuestionCard：从"待办项"变成"门把手"

**Kare 思路**：每张问题卡都是一扇可推开的门。门把手就是 hover 时浮起的一个小手指图标 + 卡片边缘"翘起 1px"的动效。

**形态**：

- 容器：`bg-paper-50 rounded-md p-4 border border-paper-200`
- Hover：`shadow-lift translate-y-[-1px]`，右侧浮出"轻推一下"的小手指 icon
- 状态色（替换 cyan/green/red）：
  - 请求中 = 左侧 `border-l-4 border-l-sage-300` + 小指针表 icon 转动
  - 流式中 = `border-l-sage-500` + 跳动光标
  - 完成 = `border-l-state-good` + 嫩芽 icon
  - 失败 = `border-l-state-alert` + 小旗 icon + "再试一次" 行内按钮
- 顶部 caption：`text-caption text-ink-500 font-mono`（用等宽体显示"问题 #3"序号，让信息密度有秩序）
- 主文案：`text-body font-serif text-ink-900`（正文用衬线，让"问题"有"被认真问出"的分量感）

### 3.2 AnswerCard：五档答案 = 一棵树的五个生长阶段

**这是整套设计里最重要的隐喻替换**。当前的 `none / heard / basic / familiar / expert` 是抽象英文标签，新方案：

| 旧档 | 新隐喻 | icon | 色 | 中文 |
|---|---|---|---|---|
| none | 种子 | 自绘 | `level-seed` | 第一次听说 |
| heard | 嫩芽 | 自绘 | `level-sprout` | 听过一点 |
| basic | 小树 | 自绘 | `level-sapling` | 大致了解 |
| familiar | 大树 | 自绘 | `level-tree` | 比较熟悉 |
| expert | 森林 | 自绘 | `level-forest` | 可以教别人 |

**布局重构**：

- 五个档位**横向排成一棵成长链**，档位之间有一条淡淡的虚线（`border-dashed border-paper-200`），暗示"成长路径"
- 选中时：那一档卡片**轻微弹起 + 虚线断开 + 当前档插画"发光"（`animate-pulse-soft`）**
- 倒计时：保留现"思考即渡舟"文言文案，但放在卡片中央，**字号从 4xl 收到 2xl**，配上一只缓缓划过的小船 SVG（呼应文案）
- 自定义输入：放在最右，icon 是一支铅笔 → 给"自己写答案"一个"我要亲笔回答"的仪式感
- **最大可用面积**：当前 65–75% 视口偏挤，改成 `min(960px, 90vw) × min(640px, 85vh)`
- **关闭交互**：右上 X 按钮 + ESC 键 + 点击外部蒙层。鼠标悬停外部蒙层时光标变成"点击关闭"的小手指

**Kare 触感**：

- 卡片入场：从屏幕底部 80% 位置上浮到中心，duration-slow ease-soft
- 选档：被选中的插画**眨一下眼**（每张档位插画都有一帧"眨眼"状态）
- 提交后：五档插画**整体淡出 + 一片小叶子从屏幕飞过**（duration-theatre）

### 3.3 MessageBubble：对话双方都"有头像"

**当前**：用户 cyan-50 气泡、助手米色气泡、错误红气泡——三套色不统一。

**新方案**：

- 用户气泡：`bg-sage-50 text-ink-900 rounded-md`（去 border，让色块说话），尾巴朝右下
- 助手气泡：`bg-paper-100 text-ink-900 rounded-md` + **左侧 32×32 圆形头像**（戴眼镜小笑脸 logo）
- 错误：不用红色气泡，而是**助手气泡 + 一个举着小旗的图标 + 浅 sun-300 背景条**，文案换成"我这边出了点小状况，要不要再试一次？"
- 时间戳：hover 才显示，`text-caption text-ink-500 font-mono`，避免界面噪声
- 复制按钮：当前 `animate-fade-in-out` 改为"打勾 icon 弹出 0.4s 然后回到复制 icon"（更像 macOS Finder 复制反馈）

**助手头像随状态变脸**（Kare 经典手法）：

- 普通：戴眼镜小笑脸
- 思考中：眼睛闭着、上方一个"…"
- 报错：一只眼睛眨着，下方一面小旗
- 接收到用户感谢类消息（"谢谢"）：开心眯眼 + 小红晕

### 3.4 ThinkingBlock：从"日志面板"变成"咖啡杯"

**当前**：左侧 amber 竖线 + stone 正文 + blink 光标 = 像编译器输出。

**新方案**：

- 容器：`bg-paper-50 rounded-md border border-paper-200 p-4`
- 左上角：一只**冒热气的咖啡杯 SVG**（热气是循环 SVG path 动画，duration-theatre 无限循环）
- 标题文案：当前可能是"思考中…"，改为 **"让我想一下…"** / **"翻一翻笔记…"**（多种文案随机）
- 折叠/展开按钮：放在右上，icon 是一本翻页的书
- 内部正文：`text-small font-serif text-ink-700 italic`（衬线斜体强化"内心独白"感）

### 3.5 UserInput：从"工具栏"变成"信纸"

**当前**：`border-2 border-slate-200 focus:border-cyan-500 min-h-[56px]`，工程感强。

**新方案**：

- 容器：底部居中，宽 `min(720px, 90vw)`，`bg-paper-50 rounded-lg shadow-soft border border-paper-200`
- 内部：上方 textarea + 下方一行 toolbar（左：附件占位 / 模型快切 / 右：发送）
- 发送按钮：圆形 `pill`、`bg-sage-500`、内嵌一只**纸飞机 icon**，hover 时纸飞机微微抖一下
- Placeholder：每次刷新换一句，从 prompt 池里随机：
  - "今天想学点什么？"
  - "把你最近卡住的问题告诉我吧"
  - "我们从一个小问题聊起？"
- 字数限制：达到 80% 时右下角出现一个**沙漏 icon**（不是冷冰冰的字数计数）

### 3.6 WelcomeScreen：从"产品着陆页"变成"开门见山"

**新版结构**：

1. **顶部**：品牌 logo（戴眼镜小笑脸）+ "你好，我是问知"，衬线 display 字体
2. **副标题**：`text-body text-ink-500 font-serif`，文案"我会用提问陪你思考。请告诉我你想理解的事情。"
3. **居中输入框**：复用 3.5 的 UserInput，宽度 `720px`
4. **下方 QuickPrompts**：4 张卡片排成 2×2 网格而不是横向 chip。每张卡有：
   - 一张小插画（书 / 望远镜 / 烧杯 / 地球）
   - 主题标题（衬线）
   - 一句示例问题（无衬线 caption）
5. **底部**：极小的 `text-caption text-ink-300`，"你的对话只保存在浏览器里。"——把隐私承诺写进欢迎页是 Kare 式"说人话"。

**首次配置 modal**：

- 当前 `rounded-3xl backdrop-blur` 已经很好，**保留**，只把 `amber pill badge` 换成 sun-300 + 一个小钥匙 icon
- 文案改成对话式：**"在我们聊天前，请把你的 API Key 给我看一眼。它只会存在你的浏览器里，我不会偷看。"**

### 3.7 SettingsPanel：从"控制台"变成"工具抽屉"

**当前**：`max-w-4xl h-[80vh] rounded-2xl`，左侧 Tab `bg-gray-800 白字` 像 IDE。

**新方案**：

- **整体形态**：`max-w-3xl h-[78vh] rounded-lg`，左侧 Tab 列表 240px 宽
- **Tab 项**：`text-body` + 左侧 20px 自绘 icon（每个 Tab 一个生活意象）
  - 模型 = 大脑
  - 提示词 = 卷轴
  - 外观 = 调色盘
  - 历史 = 笔记本
  - 调试 = 螺丝刀
  - 关于 = 戴眼镜的小笑脸
- **选中态**：不用 `bg-gray-800` 反差，而是 `bg-paper-100 text-ink-900` + 左侧 3px sage 竖线
- **每页内容**：
  - 段落标题用 h2 衬线，描述用 small 灰
  - 每个设置项独占一行：左标题 + 右控件，中间一根 `border-paper-200` 虚线
  - 危险操作（清空历史）：`bg-state-alert/10 text-state-alert` 而不是红底白字，文案"清空所有对话（无法恢复）"
- **关闭**：右上 X + ESC + 点击外部

### 3.8 HistorySidebar：从"文件夹"变成"日记本"

- 抽屉宽 `360px`（比当前 320 略宽给标题呼吸感）
- 每条历史卡：
  - 顶部一行 `text-caption font-mono text-ink-500`：日期，如 `5 月 12 日`
  - 主标题 `text-body font-serif`：会话标题
  - 副 `text-small text-ink-500`：截取首条用户问题前 40 字
  - hover：右侧浮出三个小图标（编辑笔 / 复制 / 垃圾桶），间距 12px，垃圾桶 hover 变 `state-alert`
- 选中态：左侧 3px sage 竖线 + `bg-paper-50`
- 顶部"新对话"按钮：full width、`bg-sage-500 text-white rounded-md`、内含羽毛笔 icon

### 3.9 LanguageSwitcher / HeaderButtons / DebugPanel

- **LanguageSwitcher**：当前几乎裸 button，改成 pill 风：`bg-paper-100 rounded-pill p-1`，内部两个 `中` / `EN` 文字 toggle，选中态 `bg-paper-50 shadow-soft`
- **HeaderButtons**：所有图标按钮统一用 2.1 的 `ghost` Button + 2.3 lucide icon，hover `bg-paper-100`
- **DebugPanel**：开发者面板**保留工程感**（这是它的本职），但圆角和字体跟全局对齐，用 `font-mono text-caption`

---

## Layer 4 · 页面与布局

### 4.1 ChatPage 整体骨架

```
┌─────────────────────────────────────────────────────────┐
│ TopBar  56px  bg-paper-50/80 backdrop-blur border-b     │
│ [logo + 标题]               [模型芯片] [设置] [历史] [中/En]│
├─────────────────────────────────────────────────────────┤
│                                                         │
│   ┌─ 左侧浮窗 280px ─┐    ChatWindow (max-w 720px)      │
│   │ 待回答问题 (3)    │                                  │
│   │ ─────────────    │    [助手头像] 你好…               │
│   │ • Q1 (嫩芽中)     │                                  │
│   │ • Q2 (思考中)     │              我想理解 X [用户]    │
│   │ • Q3 (待答)       │                                  │
│   └─────────────────┘    [助手头像] 那我们一起想…         │
│                                                         │
│   ┌────── UserInput (居中, 720px) ──────┐                │
│   │ [textarea]                          │ [送]           │
│   └────────────────────────────────────┘                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**关键变化**：

- 顶栏从 `p-4` 收到 56px 固定高，title 字号收到 h2
- 左侧问题抽屉从 `w-64` 加宽到 280px，用半透明 + backdrop-blur 浮在主区上
- 主对话内容区从全屏滚动改为**居中 720px 滚动列**，左右留白让阅读视线收敛
- 输入框**永远居中浮于底部**（不依附边缘），底部有 32px gap 与窗口边

### 4.2 LandingPage：保留古典气质，但与产品视觉同源

当前 `LandingPage.css` 自成一套（`#3a5b99` / `#c19540` / `Ma Shan Zheng`），与产品页割裂。

**方案**：

- 配色用同一套 token：把着陆页 `--primary` → `sage-500`，`--accent` → `sun-500`，`--bg-cream` → `paper-50`
- 字体保留 Noto Serif SC（合衬线人格分工）；删除 Ma Shan Zheng（手写体过于"传统文化"，与产品克制感冲突）
- 粒子背景 → 替换成**5 张缓慢飘落的叶子 SVG**（呼应"森林/嫩芽"成长隐喻），用 `framer-motion` 控制
- CTA 按钮：复用 Layer 2 的 `primary` Button
- **挂回路由**：`main.jsx` 加 `<BrowserRouter>`，`/` 给 `LandingPage`，`/chat` 给 `ChatPage`（同时解决之前提的孤岛问题）

### 4.3 暗色模式（顺手做掉）

token 都准备好了：

- `paper.50 → paper.900`、`paper.100 → #2A2933`、`ink.900 → paper.50`
- `sage` 系略降饱和、提明度
- `sun-500` 在暗模式改用 `sun-300`（避免荧光感）

技术上：用 Tailwind 的 `dark:` 前缀 + `[data-theme="dark"]`，存到 localStorage `themePreference`。

---

## Layer 5 · 文案与人格

Kare 设计哲学的"人格化"在文案上比图形更关键。

### 5.1 语气准则（写进项目 README）

| 不要 | 要 |
|---|---|
| "请输入您的 API Key" | "把 API Key 给我看一眼" |
| "操作失败" | "我这边出了点小状况" |
| "无效输入" | "这个我看不太懂，能换个说法吗？" |
| "确认删除？" | "确定要把这段对话告别掉吗？" |
| "苏格拉底式启发式问答学习" | "用提问陪你思考" |

**规则**：第一人称用"我"，第二人称用"你"，不用"您"。所有功能名都先问自己 **"如果是 Susan 写这条文案，她会怎么说？"**

### 5.2 空状态、加载、错误的视觉文案对

| 场景 | 插画 | 文案 |
|---|---|---|
| 空对话历史 | 翻开的笔记本 | "还没有故事开始。先聊一句吧？" |
| 空问题列表（左侧抽屉） | 一只伸懒腰的小猫 | "暂时没有等待回答的问题。" |
| 加载中（首次发送） | 咖啡杯热气 | "让我想一下…" |
| API Key 缺失 | 一把钥匙 | "我需要一把钥匙才能开始工作。去设置里给我？" |
| 网络错误 | 举旗小人 | "信号好像跑丢了。要不要再试一次？" |
| 流式被中断 | 折断的羽毛笔 | "我刚刚说到一半…要重新说吗？" |

### 5.3 彩蛋（Kare 在初代 Mac 留笑脸的传统）

- 连续答对 3 题：底部飘过一片叶子 + 一行小字 "又长大了一点"
- 凌晨 1–5 点打开：欢迎语变成"夜深了。我陪你聊一会儿。"
- 第 100 条消息：助手头像短暂变成戴生日帽
- 标题连点 5 次（已有的"开发者模式"）：保留，但触发时屏幕中央**一只小表情包跳出来比了个 OK**

---

## Layer 6 · 动效编排

不是越多越好，**整站只有 4 类动效**，每类有明确职责。

### 6.1 进入动效（Entrance）— `duration-slow ease-soft`

- 浮层、模态框：从下 8% 上浮 + opacity 0→1
- 列表项：依次以 60ms 间隔淡入（stagger）
- 消息气泡：左/右滑入 12px + opacity 0→1

### 6.2 反馈动效（Feedback）— `duration-fast ease-snap`

- 按钮按下：scale 0.98
- 选中：背景色 + 1px translateY
- 复制成功：图标弹出后回弹

### 6.3 状态动效（Status）— 循环

- 思考中：咖啡杯热气 SVG path 循环（4s）
- 加载：指针表分针走动（每 1s 跳一格，模仿真表）
- 流式光标：blink 1s steps（**保留现有**）

### 6.4 奖励动效（Delight）— `duration-theatre ease-soft`

- 答完所有问题：一片叶子从屏幕右上飞到左下
- 选中答案档位：那张插画眨眼 + 周围出现 3 个小光点
- 首次 onboarding 完成：一束光从顶部短暂闪过

**禁止**：`animate-bounce`、`hover:scale-110` 这种过激动效。删除 `tailwind.config.js` 里未使用的 `blob` / `border-flow`。

---

## Layer 7 · 实施 Roadmap 与风险

### 7.1 分阶段提交（每阶段独立 PR，可独立回滚）

| 阶段 | 内容 | 涉及文件 | 风险 |
|---|---|---|---|
| **P0 · 基础设施** | 1) 重写 `tailwind.config.js` 的 colors/fontFamily/borderRadius/shadow/animation token<br>2) 全局加载 Inter / Source Serif / JetBrains Mono（本地化，不走 CDN）<br>3) ESLint / Stylelint 加 token 强制规则 | `tailwind.config.js`、`index.html`、`src/index.css`、`eslint.config.js` | **大量旧类名失效**，需要 codemod。可先保留 `tech-*` 别名做软迁移 |
| **P1 · 原子组件** | 新建 `src/components/ui/{Button, Input, Icon, Tag, Tooltip}.jsx`，全用新 token | 新增目录 | 低 |
| **P2 · 图标体系** | 1) 接入 lucide-react；2) 自绘 7 张专属 SVG（logo + 5 档插画 + 状态图标）；3) 卸载 FA / radix-icons | `package.json`、`index.html`、所有内联 SVG 组件 | 中。需要设计师配合出 SVG，否则 Agent 自己用 lucide 替代再迭代 |
| **P3 · 业务组件改造** | 按优先级：MessageBubble → UserInput → QuestionCard → ThinkingBlock → AnswerCard → SettingsPanel → HistorySidebar → WelcomeScreen | `src/components/*` | **AnswerCard 是最重的**，建议单独 PR |
| **P4 · 页面布局** | ChatPage 骨架重写 + LandingPage 接回路由 + 暗色模式 | `App.jsx`、`main.jsx`、`ChatPage.jsx`、`LandingPage.jsx` | 中。改动 `ChatPage` 上帝组件需配合之前提到的 `useConversationTurn` 抽离 |
| **P5 · 文案 / 彩蛋** | 重写 `locales/zh/translation.json`、`locales/en/translation.json`、加入彩蛋逻辑 | `src/locales/*`、`src/utils/easterEggs.js`（新） | 低 |
| **P6 · 视觉回归** | 引入 Playwright + 截图基线；为 5 个核心场景出截图（欢迎页、聊天中、答题中、设置、错误） | `tests/visual/` | **必做**。否则云端 Agent 改完无法验证 |

### 7.2 风险与对策

1. **品牌断裂**：旧版 `#0A192F + #64FFDA` 是部分老用户的视觉锚点。**对策**：在设置 → 外观里**保留"经典黑蓝"主题**作为可选皮肤，新主题为默认。
2. **i18n 文案重写工作量大**：英文文案要请英语母语者校对"亲和但不幼稚"。**对策**：先做中文版本上线观察，英文延后。
3. **AnswerCard 五档隐喻可能过"萌"**：成年专业用户可能觉得"种子嫩芽"幼稚。**对策**：插画走**线稿单色**而不是卡通厚涂，配色克制（已经是 sage 色系），保持"克制的可爱"。
4. **依赖体积**：换 Inter / Source Serif Variable 可能增加 ~150KB。**对策**：用 `unicode-range` 子集化，只加载汉字常用 3500 字 + 拉丁基础。
5. **暗色模式与 `MarkdownRenderer` 的 KaTeX 冲突**：KaTeX 默认 CSS 是浅色专用。**对策**：引入 `katex` 的暗色 patch CSS，并把"每次挂载都注入 link"的当前实现改为 `index.html` 一次性预加载。
6. **改动太大导致 PR 评审困难**：**对策**：严格按 P0–P6 拆 7 个 PR，每个 PR < 1500 行 diff，且 P0 必须独立合入并跑过一次完整 CI。

### 7.3 验收标准（不是"看着好看"，是可量化）

- 100% Tailwind 类来自 token 表（ESLint 通过）
- 全站圆角只出现 4px / 8px / 12px / 20px / pill 五个值
- 全站颜色只出现 ink / paper / sage / sun / level / state 六个 namespace
- 所有图标走 `<Icon>` 组件，源代码里 `<svg>` 直写归零（除自绘 7 张外）
- Lighthouse Accessibility ≥ 95
- 首屏 LCP 不退化（控制在迁移前 ±10%）
- Playwright 5 条核心截图测试通过

---

## 一句话总结

> **新的问知轩看上去应该像一本你愿意翻开的笔记本——纸是暖的，字是有人格的，每个图标都长得像它代表的东西，每个错误都有人替你说一句"没事"。**
