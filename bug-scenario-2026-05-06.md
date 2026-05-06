# React 事件处理函数参数透传导致 [object Object]

> 生成时间：2026-05-06  
> 任务类型：调试  
> 技术栈：React 18.x, Vite 6.x, JavaScript

---

## 前置上下文（粘贴到下次对话开头）

> 本节是本文件最重要的部分。  
> 用于在下次 AI 会话开始时提供 AI 无法从代码推断的关键上下文。

1. 当 React 组件中 `onClick={fn}` 直接传递函数引用时，React 会将 SyntheticEvent 作为第一个参数传入。如果 `fn` 接受可选参数（如 `overrideText`），事件对象会被当作该参数使用，经 `String()` 转换后变为 `"[object Object]"`。
2. 对比同一组件内的 Enter 键处理（无参调用）和按钮点击处理（直接引用），可快速定位此类不一致 bug。
3. 任何接受可选参数的回调函数，作为事件处理器时必须用箭头函数包裹：`onClick={() => fn()}`。

---

## 问题类型分布

| 类型 | 数量 | 占比 |
|---|---|---|
| 集成边界 | 1 | 100% |
| 状态 | 0 | 0% |
| 规格空白 | 0 | 0% |
| 环境 | 0 | 0% |

**主导类型**：集成边界 — React 事件系统与自定义回调函数之间的接口约定不匹配。

---

## 可复用规律（L3）

### 规律 1：可选参数函数不可直接用作事件处理器

- **规律**：当一个函数的第一个参数是可选的（有默认值或用于 override），绝不能将其直接赋值给 `onClick`/`onSubmit` 等事件属性，否则事件对象会被当作该参数。
- **触发条件**：看到 `onClick={someHandler}` 且 `someHandler` 的签名包含可选参数时。
- **验证方式**：检查 handler 函数定义，确认第一个参数是否会被事件对象"污染"；或在 handler 入口打印 `typeof arguments[0]`。
- **本次实例**：`handleSendMessage(overrideText)` 被直接传给 `onClick`，导致 `overrideText = SyntheticEvent`，最终显示为 `[object Object]`。

### 规律 2：同一组件内对比调用方式可快速暴露不一致

- **规律**：当同一个 handler 在组件内有多个调用点（键盘事件 vs 点击事件），对比它们的调用方式是最快的排查路径。
- **触发条件**：Bug 表现为"某种操作正常、另一种操作异常"时。
- **验证方式**：在组件中搜索 handler 名称，逐一比对调用签名。
- **本次实例**：`handleKeyPress` 中 `handleSendMessage()` 无参调用（正常），`onClick={handleSendMessage}` 有参调用（异常）。

---

## Bug 记录（L1）

> 本节服务于溯源，不用于传递给 AI。

### Bug 1：粘贴文字后点击发送按钮显示 [object Object]

| 字段 | 内容 |
|---|---|
| 症状 | 在对话开始前，复制粘贴内容到输入框后点击发送，消息内容显示为 `[object Object]` |
| L2 类型 | 集成边界 |
| 根本原因 | `src/components/UserInput/UserInput.jsx` 第30行 `onClick={handleSendMessage}` 将 React SyntheticEvent 透传给 `handleSendMessage(overrideText)` 参数 |
| 修复方式 | 改为 `onClick={() => handleSendMessage()}`，阻止事件对象传入 |
| 提前发现方式 | ESLint 规则或 TypeScript 类型检查可在编译期捕获参数类型不匹配 |
| 是否可自动化防御 | [x] 是（方式：使用 TypeScript 严格模式，handler 参数类型为 `string \| undefined` 时无法接受 `SyntheticEvent`） |

---

## 知识状态对比

| 假设 | 实现前以为 | 实现后确认 |
|---|---|---|
| `onClick={fn}` 的行为 | 直接调用 fn() 无参数 | React 将事件对象作为第一个参数传入 fn(event) |
| Enter 和按钮发送行为一致 | 两者等价 | Enter 无参调用正常，按钮传入事件对象导致异常 |

> 这张表越长，说明本次任务越不适合完全交由 AI 自主完成。
