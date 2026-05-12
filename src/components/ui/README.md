# `src/components/ui/` — 问知轩原子组件层

> 设计规格：[../../../docs/REDESIGN_KARE.md](../../../docs/REDESIGN_KARE.md) Layer 2
>
> 实施背景：[../../../docs/REDESIGN_KARE_FEASIBILITY.md](../../../docs/REDESIGN_KARE_FEASIBILITY.md)

---

## 设计原则

1. **Token-only**：本目录由 ESLint 严格守门，**禁止**使用 hex 字面量或旧 Tailwind 色家族 (`cyan/blue/amber/slate/...`)。任何 `text-cyan-500` 这类写法都是 build error。
2. **零业务耦合**：原子组件不依赖任何应用状态、hook、i18n。
3. **Susan Kare 触感**：圆润、克制、可访问性优先。所有交互组件默认带 `:focus-visible`。
4. **PropTypes 强制**：所有 prop 都必须声明类型与（可选）默认值。

---

## 组件清单

| 组件 | 用途 | 关键 prop |
|---|---|---|
| `<Button>` | 4 意图 × 3 尺寸 + iconOnly | `intent`, `size`, `iconOnly` |
| `<Input>` | 单行输入 | `error`, 标准 input 属性 |
| `<Textarea>` | 多行输入 | `error`, `rows` |
| `<Icon>` | lucide-react 包装 | `name`, `size`, `strokeWidth` |
| `<Tag>` | 标签 / 徽章 | `variant` (5 种) |
| `<Tooltip>` | 深色提示气泡 | `content`, `side`, `delayMs` |
| `cn(...)` | className 合并工具 | clsx + tailwind-merge |

---

## 使用范例

### Button

```jsx
import { Button, Icon } from '@/components/ui';

// 主按钮（CTA）
<Button intent="primary" size="md" onClick={handleSend}>
  发送
</Button>

// 次按钮
<Button intent="secondary" size="md" onClick={handleCancel}>
  取消
</Button>

// 顶栏图标按钮
<Button intent="ghost" size="sm" iconOnly aria-label="设置">
  <Icon name="Settings" />
</Button>

// 强调按钮（全站 ≤ 1 个）
<Button intent="accent" size="lg">
  开始 7 天免费试用
</Button>
```

### Input / Textarea

```jsx
import { Input, Textarea } from '@/components/ui';

<Input
  value={apiKey}
  onChange={(e) => setApiKey(e.target.value)}
  placeholder="把 API Key 给我看一眼"
/>

<Input
  error={!isValid}
  value={url}
  onChange={(e) => setUrl(e.target.value)}
/>

<Textarea
  rows={4}
  placeholder="今天想学点什么？"
  value={text}
  onChange={(e) => setText(e.target.value)}
/>
```

### Icon

```jsx
import { Icon } from '@/components/ui';

<Icon name="Settings" />                      // 默认 18px
<Icon name="Send" size={20} className="text-sage-500" />
<Icon name="MessageCircle" size={24} strokeWidth={2} />
```

`name` 取自 [lucide-react 图标列表](https://lucide.dev/icons/)的 PascalCase 名。

### Tag

```jsx
import { Tag } from '@/components/ui';

<Tag variant="active">流式中</Tag>
<Tag variant="good">完成</Tag>
<Tag variant="warn">提醒</Tag>
<Tag variant="alert">出错</Tag>
<Tag variant="neutral">问题 #3</Tag>
```

### Tooltip

```jsx
import { Tooltip, Button, Icon } from '@/components/ui';

<Tooltip content="清空所有对话">
  <Button intent="ghost" iconOnly aria-label="清空">
    <Icon name="Trash2" />
  </Button>
</Tooltip>

<Tooltip content="保存配置" side="bottom" delayMs={300}>
  <Button intent="primary">保存</Button>
</Tooltip>
```

---

## ESLint 守门规则

本目录适用 `eslint.config.js` 中的 `src/components/ui/**` 块：

| 违规 | 等级 | 例子 |
|---|---|---|
| 内联 hex 颜色 | 🔴 error | `className="bg-[#0A192F]"` |
| 旧色家族 | 🔴 error | `className="text-cyan-500"`、`bg-amber-50` |
| 设计 token | ✅ 通过 | `className="bg-sage-500 text-ink-700"` |

**新组件提交前**先跑 `pnpm lint` 确认本目录零 error。

---

## 自绘图标层 `icons/`

P2 阶段补齐的产品专属插画，与 lucide-react 通道并存：

| 类别 | 组件 | 默认色 | 用途 |
|---|---|---|---|
| 品牌 | `<BrandLogo>` | `text-ink-900` | 顶栏 / 助手头像，4 种表情 (default / thinking / error / happy) |
| 五档生长 | `<LevelSeed>` `<LevelSprout>` `<LevelSapling>` `<LevelTree>` `<LevelForest>` | `text-level-*` | AnswerCard 答案档位 |
| 五档调度 | `<LevelIcon level="..." />` | 同上 | 按 name 分发；兼容旧 key (`none`/`heard`/`basic`/`familiar`/`expert`) |
| 状态 | `<CoffeeCup>` | `text-ink-700` | "思考中…" |
| 状态 | `<Flag>` | `text-state-warn` | 等一下 / 出错 |
| 状态 | `<Key>` | `text-sun-700` | API Key 相关 |
| 状态 | `<Hourglass>` | `text-ink-500` | 字数 / 时间临界 |
| 状态 | `<Screwdriver>` | `text-ink-500` | 设置 / 调试 Tab |

### 使用范例

```jsx
import { BrandLogo, LevelIcon, CoffeeCup, Key, Flag } from '@/components/ui';

// 助手头像
<BrandLogo size={32} expression="thinking" />

// 五档答案
<LevelIcon level="sprout" size={48} />
<LevelIcon level="heard"  size={48} />  // 旧 key 自动映射为 sprout

// 状态插画
<CoffeeCup size={20} />
<Flag size={16} className="text-state-alert" />  // 错误场景换色
```

### 设计约束

- 所有自绘图标都用 24×24 viewBox + `currentColor`，保证 lucide 与自绘可在同一行无缝混排。
- 描边宽度统一 `1.5`，比 lucide 默认 `2` 略细，与衬线正文呼应。
- 体积控制：单个组件 < 60 行 SVG path，gzip 后约 1KB。
- 后续若有设计师产出更精致的资产，**直接替换同名组件**即可，调用方 0 改动。

## 后续扩展（不在 P2 范围）

- **业务组件迁移** (P3)：`MessageBubble` / `AnswerCard` / `QuestionCard` 改为使用本层
- **复合组件层** (`src/components/ui/composite/` 待建)：`IconButton` / `Field` / `Toolbar` 等
- **暗色模式适配**：等 P3 业务组件落地后统一在所有原子组件加 `dark:` 前缀
