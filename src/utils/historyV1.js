/**
 * v1 历史只读适配（阶段 E · 任务 E2）
 *
 * 旧键 `chat_histories` 里的记录是另一套结构：
 *   { id, title, timestamp, messages: [{id, role, content, status, error}],
 *     uiMessages: [{id, sourceMessageId, role, content: [{type, value}], status, error}] }
 * 本文件把它**在内存里**投影成协议 §5 的 turns，交给 `openConversation(record)` 显示与续聊。
 *
 * 三条硬约束（`E-历史存储与恢复.md` §2.2 / `E-开发指导.md` E2）：
 *   1. **只读**：不接收 storage、不写任何键，调用前后旧记录对象与旧键字符串都必须逐字节不变。
 *   2. **上下文只取纯文本**：旧记录里 `messages` 与 `uiMessages` 已经分叉（摘要进了 messages
 *      没进 uiMessages，`answer-card` 进了 uiMessages 没进 messages），从分叉的数据里还原
 *      「当时到底说了什么」没有唯一答案，所以只搬纯文本，不搬标签、不搬卡片结构。
 *   3. **纯函数**：不 import React、不碰宿主对象、不读时间、不产生随机 ID。
 *
 * 两个已拍板的取舍（`决策记录.md` **E-1** 的补充 / E2 开工说明）：
 *   - turn 以 **`messages` 为主线**切分（一条 user 开一轮，assistant 并入），因为 `messages`
 *     才是旧路径真正发给模型的序列，含「一轮多题的作答摘要」；`uiMessages` 只用来取展示文本。
 *   - 旧 `answer-card` 投影成**文本片段**（`问题：…／我的回答：…／档位：…`），不塞进
 *     `turn.questions`——那会被 `QuestionGroup` 渲染成可点卡片，而历史不可作答。
 */

const GATE_MARKER = '\u200B';

/** 旧思考块不进历史：协议 §7 禁止 reasoning 原文入库，也不该在恢复时复活。 */
const DROPPED_UI_TYPES = new Set(['thinking', 'answer-card']);

function stripGate(value) {
  if (typeof value !== 'string') return '';
  return value.split(GATE_MARKER).join('');
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function safeText(value) {
  return stripGate(typeof value === 'string' ? value : '').trim();
}

/** 旧 `question` 片段：可能是字符串，也可能是问题对象数组（旧解析器的两种形态）。 */
function questionValueToText(value) {
  if (typeof value === 'string') return safeText(value);

  if (!Array.isArray(value)) return '';

  return value
    .map((entry) => {
      if (typeof entry === 'string') return safeText(entry);
      if (!isPlainObject(entry)) return '';

      const text = safeText(entry.question ?? entry.text ?? entry.title);
      const options = Array.isArray(entry.options)
        ? entry.options
            .map((option) =>
              typeof option === 'string'
                ? safeText(option)
                : safeText(option?.text ?? option?.content ?? option?.label),
            )
            .filter(Boolean)
        : [];

      if (options.length === 0) return text;
      return [text, `选项：${options.join(' / ')}`].filter(Boolean).join('\n');
    })
    .filter(Boolean)
    .join('\n\n');
}

/**
 * 旧答案卡 → 文本片段。
 *
 * 标签（问题 / 我的回答 / 档位）是**结构化旧数据的摊平格式**，不是界面文案：
 * 旧记录里的内容本身就是用户当时看到的中文，纯函数拿不到 i18n。若将来要全量国际化，
 * 改成由调用方传入标签表，不影响这里的投影形状。
 */
export function answerCardToText(value) {
  if (!isPlainObject(value)) return '';

  const question = safeText(value.question);
  const answer = safeText(value.answer);
  const level = safeText(value.level);

  const lines = [];
  if (question) lines.push(`问题：${question}`);
  if (answer) lines.push(`我的回答：${answer}`);
  if (level) lines.push(`档位：${level}`);
  return lines.join('\n');
}

/** 一条旧 uiMessage 的展示文本（不含答案卡，答案卡由调用方单独摊平）。 */
export function uiMessageToText(uiMessage) {
  if (!isPlainObject(uiMessage)) return '';

  const content = uiMessage.content;
  if (typeof content === 'string') return safeText(content);
  if (!Array.isArray(content)) return '';

  const blocks = [];

  for (const item of content) {
    if (!isPlainObject(item)) continue;
    if (DROPPED_UI_TYPES.has(item.type)) continue;

    if (item.type === 'code') {
      const code = stripGate(typeof item.value === 'string' ? item.value : '').replace(/\n$/, '');
      if (code.trim()) blocks.push(`\`\`\`\n${code}\n\`\`\``);
      continue;
    }

    if (item.type === 'question') {
      const text = questionValueToText(item.value);
      if (text) blocks.push(text);
      continue;
    }

    if (typeof item.value === 'string') {
      const text = safeText(item.value);
      if (text) blocks.push(text);
      continue;
    }

    // 极旧的数组形态：按顺序拼字符串，对象只取可读字段，绝不 JSON.stringify
    if (Array.isArray(item.value)) {
      const joined = item.value
        .map((entry) => {
          if (typeof entry === 'string') return entry;
          if (isPlainObject(entry)) return safeText(entry.text ?? entry.question ?? entry.value);
          return '';
        })
        .filter(Boolean)
        .join('\n');
      const text = stripGate(joined).trim();
      if (text) blocks.push(text);
    }
  }

  return blocks.join('\n\n');
}

/** 旧 `messages` 条目的纯文本；`content` 正常是字符串，极旧数据可能是片段数组。 */
function messageToText(message) {
  if (!isPlainObject(message)) return '';
  if (typeof message.content === 'string') return safeText(message.content);
  if (Array.isArray(message.content)) return uiMessageToText({ content: message.content });
  return '';
}

function answerCardTexts(uiMessage) {
  if (!isPlainObject(uiMessage) || !Array.isArray(uiMessage.content)) return [];
  return uiMessage.content
    .filter((item) => isPlainObject(item) && item.type === 'answer-card')
    .map((item) => answerCardToText(item.value))
    .filter(Boolean);
}

function makeTurn({ conversationId, index, text, source }) {
  return {
    id: `v1_${conversationId}_${index}`,
    runId: null,
    modeSnapshot: null,
    // 先记未完成；该轮的 assistant 文本到了才改成 completed（协议不变量 8：未完成不进上下文）
    status: 'interrupted',
    userMessage: { text, source },
    modelMessages: [],
    parts: [],
    questions: [],
    error: null,
  };
}

function appendTextPart(turn, text) {
  if (!turn || !text) return;
  turn.parts.push({
    type: 'text',
    partId: `v1_${turn.id}_p${turn.parts.length}`,
    runId: null,
    text,
  });
}

function isFailed(message, uiMessage) {
  return message?.status === 'error' || uiMessage?.status === 'error';
}

/** `messages` 缺失时（极旧数据）退回按 `uiMessages` 切分：user 开轮、assistant 并入。 */
function turnsFromUiMessages(uiMessages, conversationId) {
  const turns = [];
  let current = null;

  for (const uiMessage of uiMessages) {
    if (!isPlainObject(uiMessage)) continue;

    if (uiMessage.role === 'user') {
      const cards = answerCardTexts(uiMessage);
      const text = uiMessageToText(uiMessage);

      if (!text) {
        // 只有答案卡、没有正文的 user 消息：卡片挂到上一轮，不新开轮
        for (const card of cards) {
          if (current) appendTextPart(current, card);
          else {
            current = makeTurn({ conversationId, index: turns.length, text: card, source: 'answer' });
            turns.push(current);
          }
        }
        continue;
      }

      const turn = makeTurn({ conversationId, index: turns.length, text, source: 'input' });
      for (const card of cards) appendTextPart(turn, card);
      turns.push(turn);
      current = turn;
      continue;
    }

    if (uiMessage.role !== 'assistant' || !current) continue;

    const text = uiMessageToText(uiMessage);
    if (text) appendTextPart(current, text);
    if (text && !isFailed(null, uiMessage)) {
      current.modelMessages.push({ role: 'assistant', content: text });
      current.status = 'completed';
    }
  }

  return turns;
}

/**
 * 把一条 v1 记录投影成 `{ id, title, timestamp, mode, turns }`。
 *
 * `id` 不合法时返回 `null`（调用方按「读不出来」处理），其余情况一律返回结构，不抛异常。
 * 返回的 `turns` 可直接交给 `openConversation(record)`：它读 `conversationId ?? id`、
 * `mode`、`turns`。
 */
export function projectV1Record(record) {
  if (!isPlainObject(record)) return null;

  const id = safeText(record.id);
  if (!id) return null;

  const messages = Array.isArray(record.messages) ? record.messages : [];
  const uiMessages = Array.isArray(record.uiMessages) ? record.uiMessages : [];

  const base = {
    id,
    title: safeText(record.title),
    timestamp: Number.isFinite(record.timestamp) ? record.timestamp : 0,
    // 旧记录没有模式概念：交给页面用当前选择的模式，不臆造 socratic
    mode: null,
  };

  if (messages.length === 0) {
    return { ...base, turns: turnsFromUiMessages(uiMessages, id) };
  }

  const uiIndexById = new Map();
  uiMessages.forEach((uiMessage, index) => {
    if (isPlainObject(uiMessage) && typeof uiMessage.id === 'string' && !uiIndexById.has(uiMessage.id)) {
      uiIndexById.set(uiMessage.id, index);
    }
  });

  const turns = [];
  let current = null;
  let uiCursor = 0;
  /** 第一条 turn 之前出现的答案卡：等第一轮建好再补挂，避免造出空轮。 */
  const orphanCards = [];

  /**
   * 把 `uiMessages` 里 `limit` 之前的**纯展示片段**取出来。
   *
   * 只有 `answer-card` 会命中（它 `sourceMessageId` 为 null、不进 `messages`），
   * 挂到「它前面那条 assistant 消息所属的轮」——也就是问出问题的这一轮，
   * 顺序与旧页面一致；还没有任何轮时先暂存。
   */
  const flushUiUntil = (limit) => {
    while (uiCursor < limit) {
      const uiMessage = uiMessages[uiCursor];
      uiCursor += 1;
      for (const card of answerCardTexts(uiMessage)) {
        if (current) appendTextPart(current, card);
        else orphanCards.push(card);
      }
    }
  };

  /** 只在 `messages` 里出现的消息（旧版作答摘要）前面，卡片应归属上一轮。 */
  const nextKnownUiIndex = (from) => {
    for (let i = from; i < messages.length; i += 1) {
      const message = messages[i];
      const messageId = isPlainObject(message) ? message.id : null;
      if (typeof messageId === 'string' && uiIndexById.has(messageId)) {
        return uiIndexById.get(messageId);
      }
    }
    return uiMessages.length;
  };

  for (let i = 0; i < messages.length; i += 1) {
    const message = messages[i];
    if (!isPlainObject(message)) continue;

    const messageId = typeof message.id === 'string' ? message.id : '';
    const uiIndex = messageId && uiIndexById.has(messageId) ? uiIndexById.get(messageId) : -1;
    const uiMessage = uiIndex >= 0 ? uiMessages[uiIndex] : null;

    if (uiIndex >= 0) flushUiUntil(uiIndex);
    else flushUiUntil(nextKnownUiIndex(i + 1));

    if (message.role === 'user') {
      // 有同 id 的 uiMessage 才是用户真说的话；只有 messages 里有的那条是旧版「作答摘要」
      const isSummary = uiIndex < 0;
      const text = uiIndex >= 0 ? uiMessageToText(uiMessage) || messageToText(message) : messageToText(message);

      if (!text) {
        // 空 user 消息不造轮：宁可丢这一轮，也不造一个会被当成模型自说自话的空上下文
        current = null;
        continue;
      }

      const turn = makeTurn({
        conversationId: id,
        index: turns.length,
        text,
        source: isSummary ? 'answer' : 'input',
      });
      for (const card of orphanCards.splice(0)) appendTextPart(turn, card);
      turns.push(turn);
      current = turn;
      continue;
    }

    if (message.role === 'assistant') {
      // 没有前驱 user 的 assistant（旧页面的开场欢迎语、重试留下的孤儿）一律丢弃
      if (!current) continue;

      const text = uiMessageToText(uiMessage) || messageToText(message);
      if (text) appendTextPart(current, text);

      // 失败的那一轮保留展示、不进上下文（与 C 层对 failed turn 的处理一致）
      if (text && !isFailed(message, uiMessage)) {
        current.modelMessages.push({ role: 'assistant', content: text });
        current.status = 'completed';
      }
      continue;
    }
    // 其它 role（system / tool 等）旧路径不会产生，忽略
  }

  // 收尾：最后一轮之后还有答案卡（用户点完就关页面、没触发摘要）
  flushUiUntil(uiMessages.length);
  for (const card of orphanCards.splice(0)) {
    if (turns.length === 0) {
      const turn = makeTurn({ conversationId: id, index: 0, text: card, source: 'answer' });
      turns.push(turn);
    } else {
      appendTextPart(turns[turns.length - 1], card);
    }
  }

  return { ...base, turns };
}

export default projectV1Record;
