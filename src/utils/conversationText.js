import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const blockTags = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'blockquote', 'ul', 'ol', 'table']);

/** Read the synchronous Markdown renderer's element tree without mounting a DOM. */
export function plainText(value) {
  if (typeof value !== 'string') return '';
  const codes = [];
  let prefix = 'WzxExportCodeToken';
  while (value.includes(prefix)) prefix += 'X';
  const protect = (code) => {
    const token = `${prefix}${codes.length}End`;
    codes.push([token, code]);
    return token;
  };
  // Preserve source verbatim before parsing prose, including indentation and blank lines.
  const source = value.replace(/\u200B/g, '')
    .replace(/^(`{3,}|~{3,})[^\n]*\n([\s\S]*?)^\1[ \t]*$/gm,
      (_match, _fence, code) => protect(code.replace(/\n$/, '')))
    .replace(/<(svg|html|script|style|iframe)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, (code) => protect(code))
    .replace(/<(think|thinking|reasoning)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(?:think|thinking|reasoning)\b[^>]*>[\s\S]*$/gi, '')
    .replace(/〖(?:thinking|reasoning)〗[\s\S]*?〖\/(?:thinking|reasoning)〗/gi, '')
    .replace(/〖\/?(?:response|question|summary)〗/gi, '');
  const read = (node) => {
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(read).join('');
    if (!node?.props) return '';
    const { type, props } = node;
    if (['img', 'input', 'hr'].includes(type)) return '';
    if (type === 'br') return '\n';
    if (type === 'code') return protect(String(props.children).replace(/\n$/, ''));
    const text = read(props.children);
    if (['td', 'th'].includes(type)) return `${text}\t`;
    if (['li', 'tr'].includes(type)) return `${text.trim()}\n`;
    return blockTags.has(type) ? `${text.trim()}\n\n` : text;
  };
  let text = read(Markdown({ children: source, remarkPlugins: [remarkGfm], skipHtml: false }))
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  for (const [token, code] of codes) text = text.split(token).join(code);
  return text;
}

function codeBlock(code) {
  const length = (code.match(/`+/g) ?? []).reduce((max, run) => Math.max(max, run.length + 1), 3);
  const fence = '`'.repeat(length);
  return `\n\n${fence}\n${code}\n${fence}\n\n`;
}

function readableLegacyContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map((part) => {
    if (typeof part === 'string') return part;
    if (!part) return '';
    const value = part.value ?? part.text;
    if (['visualize', 'explain_card', 'explain-card', 'svg', 'html'].includes(part.type)) {
      const code = typeof value === 'string' ? value : value?.svg ?? value?.html;
      return typeof code === 'string' ? codeBlock(code) : '';
    }
    if (!['response', 'text', 'question', 'code'].includes(part.type)) return '';
    if (part.type === 'code') return typeof value === 'string' ? codeBlock(value) : '';
    if (Array.isArray(value)) return value.map((item) => typeof item === 'string' ? item : item?.question ?? item?.text ?? '').join('\n\n');
    return typeof value === 'string' ? value : '';
  }).filter(Boolean).join('\n\n');
}

/** A reading projection of dialogue and ready diagram sources, without configuration or protocol metadata. */
export function formatConversationText(record, { user = '我', assistant = '问知轩', skipped = '跳过', untitled = '对话记录' } = {}) {
  const blocks = [];
  const say = (role, value) => {
    const text = plainText(value);
    if (text) blocks.push(`${role}：\n${text}`);
  };
  if (Array.isArray(record?.turns)) {
    record.turns.forEach((turn, index) => {
      const previousQuestions = record.turns[index - 1]?.questions ?? [];
      const isRepeatedSummary = turn?.userMessage?.source === 'answer' && previousQuestions.length > 0
        && previousQuestions.every((question) => ['answered', 'skipped'].includes(question?.state));
      if (!isRepeatedSummary) {
        const value = turn?.userMessage?.text;
        say(user, turn?.userMessage?.source === 'answer' && typeof value === 'string'
          ? value.replace(/\n?[（(]来自选项[：:][^）)\n]*[）)]/g, '') : value);
      }
      const chunks = [];
      let previousPart = null;
      for (const part of turn?.parts ?? []) {
        if (part?.type === 'text') {
          if (previousPart?.type === 'text' && previousPart.partId === part.partId && previousPart.runId === part.runId) {
            chunks[chunks.length - 1] += part.text ?? '';
          } else chunks.push(part.text ?? '');
        } else if (part?.type === 'tool' && part.status === 'completed' && part.output?.status !== 'rejected') {
          const code = part.toolName === 'explain_card' ? part.output?.svg
            : part.toolName === 'visualize' ? part.output?.html : null;
          if (typeof code === 'string' && code.trim()) {
            chunks.push([plainText(part.output?.title), codeBlock(code)].filter(Boolean).join('\n'));
          }
        }
        previousPart = part;
      }
      say(assistant, chunks.join('\n\n'));
      for (const question of turn?.questions ?? []) {
        say(assistant, question?.text);
        if (question?.state === 'answered') say(user, question.answer);
        if (question?.state === 'skipped') say(user, skipped);
      }
    });
  } else {
    // Old UI messages contain actual selected answers; model-only summaries duplicate them.
    const messages = Array.isArray(record?.uiMessages) && record.uiMessages.length ? record.uiMessages : record?.messages ?? [];
    for (const message of messages) {
      if (!['user', 'assistant'].includes(message?.role)) continue;
      if (message.role === 'assistant' && message.status === 'error') continue;
      const role = message.role === 'user' ? user : assistant;
      say(role, readableLegacyContent(message.content));
      if (message.role === 'user' && Array.isArray(message.content)) {
        for (const part of message.content) {
          if (part?.type === 'answer-card') {
            const question = plainText(part.value?.question);
            if (question && !blocks.some((block) => block.includes(question))) say(assistant, question);
            say(user, part.value?.answer);
          }
        }
      }
    }
  }
  return [plainText(record?.title) || untitled, ...blocks].join('\n\n') + '\n';
}

export function conversationBackupToText(backup, labels) {
  const raw = backup.data.chat_histories_v2 ?? backup.data.chat_histories;
  return formatConversationText(JSON.parse(raw)[0], labels);
}
