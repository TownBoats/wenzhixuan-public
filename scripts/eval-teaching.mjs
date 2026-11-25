/**
 * 教学评估：用产品代码（会话 reducer + 运行层 + 副模型）在真实端点上跑多主题、脚本化学生输入。
 * 与 probe-plan-tool 的区别：不使用草案工具和指令，副模型真实参与。
 *
 * 用法（三个变量缺一即退出，凭据只从环境变量读）：
 *   PROBE_BASE_URL / PROBE_API_KEY / PROBE_MODEL
 *   node scripts/eval-teaching.mjs
 *
 * 可选：PROBE_OPTION_MODEL 副模型名（默认同主模型）；PROBE_TOPICS 逗号分隔的主题。
 *
 * 对话写入 scripts/eval-teaching.output.json（已被 Git 忽略，不含端点与密钥），供人工评判。
 * 程序只统计结构指标；教学质量由人判断。退出码：0 = 跑完；1 = 配置缺失或全部轮次失败。
 */
import { readFileSync, writeFileSync } from 'node:fs';

import { createModes, getMode } from '../src/agent/modes.js';
import { contextToolDefinitions } from '../src/agent/contextSchemas.js';
import { runTeachingAgent } from '../src/agent/runTeachingAgent.js';
import { estimateContextTokens } from '../src/utils/contextWindow.js';
import {
  buildModelContext,
  collectStudentTexts,
  createInitialState,
  projectLearningPlan,
  projectReferences,
  reduceSession,
} from '../src/utils/conversationState.js';

const BASE_URL = (process.env.PROBE_BASE_URL || '').trim();
const API_KEY = (process.env.PROBE_API_KEY || '').trim();
const MODEL = (process.env.PROBE_MODEL || '').trim();
const OPTION_MODEL = (process.env.PROBE_OPTION_MODEL || MODEL).trim();
if (!BASE_URL || !API_KEY || !MODEL) {
  console.error('缺少环境变量。需要 PROBE_BASE_URL / PROBE_API_KEY / PROBE_MODEL 三个都设置。');
  process.exit(1);
}

// SDK 默认会打印原始错误（可能含端点与密钥）；这里只输出脱敏后的错误
console.error = () => {};
const safe = (text) => String(text ?? '').split(API_KEY).join('***').split(BASE_URL).join('<endpoint>').slice(0, 200);

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const modes = createModes({ normal: read('../src/agent/skills/normal.md'), socratic: read('../src/agent/skills/socratic.md') });
const mode = getMode(modes, 'socratic');
const optionSystemPrompt = JSON.parse(read('../src/locales/zh/translation.json')).SystemPrompts.optionAiMode;

/** 学生动作：字符串 = 手写；pick = 点选最高档候选；explain = 直接讲给我；plan = 调整计划。 */
const pick = { pick: true };
const explain = { explain: true };
const TOPICS = {
  binary: [
    '教我二分查找。约定：所有数组下标从 1 开始，区间左闭右开。',
    '我只知道每次砍掉一半，不知道区间应该怎么更新',
    '中间的数比目标小，目标就只能在右边，因为数组是从小到大排好的',
    pick,
    explain,
    '我觉得我全懂了',
  ],
  bayes: [
    '教我贝叶斯公式，全程用疾病检测的例子，患病率固定为 1%。请画一张树状图并根据图提问。',
    '条件概率我没学过，不知道竖线是什么意思',
    '就是只看检测阳性的那群人，在这群人里面数真正生病的占多少',
    pick,
    { plan: '我想先多看一个具体数字的例子，再学公式' },
    '我忘了，回到之前那张树状图再给我讲一下',
  ],
  closure: [
    '教我 JavaScript 的闭包，我会写基本的函数。',
    '作用域就是变量能被用到的范围',
    pick,
    explain,
    '内层函数记住了外层的变量本身，所以外层返回之后还能继续改它',
    '我懂了，下一个',
  ],
  derivative: [
    '教我导数是什么，我是高一学生。',
    '斜率我会，就是上升的高度除以走过的水平距离',
    '我不知道为什么可以除以一个趋近于 0 的数',
    explain,
    pick,
    '因为两个点越来越近的时候，割线的斜率会越来越接近一个固定的数',
  ],
  inflation: [
    '教我什么是通货膨胀，为什么会发生。',
    '就是东西变贵了',
    pick,
    '钱变多了但是东西没有变多，所以每样东西要用更多的钱才能买到',
    { plan: '我只想弄懂原因，不需要讲怎么治理' },
    explain,
  ],
};

const selected = (process.env.PROBE_TOPICS || Object.keys(TOPICS).join(','))
  .split(',').map((item) => item.trim()).filter((item) => TOPICS[item]);
if (selected.length === 0) {
  console.log(`PROBE_TOPICS 无效，可选：${Object.keys(TOPICS).join(', ')}`);
  process.exit(1);
}

const EVENT_ACTION_TYPES = {
  'run-started': 'RUN_STARTED', 'text-delta': 'TEXT_DELTA', 'reasoning-delta': 'REASONING_DELTA',
  'tool-started': 'TOOL_STARTED', 'tool-input-started': 'TOOL_INPUT_STARTED', 'tool-input-delta': 'TOOL_INPUT_DELTA',
  'tool-completed': 'TOOL_COMPLETED', 'tool-failed': 'TOOL_FAILED',
};

/** 与 useChatSession 的 contextForRun 同构。 */
function contextForRun(state) {
  const text = state.turns.at(-1).userMessage.text;
  return [...buildModelContext(state.turns), { role: 'user', content: text }];
}

/** 把学生动作变成下一轮；返回 null 表示当前状态做不了这个动作。 */
function nextTurn(state, action, id) {
  const ids = { turnId: `t${id}`, runId: `r${id}`, mode: 'socratic' };
  const pending = (state.turns.at(-1)?.questions ?? []).filter((item) => item.state === 'pending');
  if (action.plan) return reduceSession(state, { type: 'REQUEST_PLAN_CHANGE', text: action.plan, ...ids });
  if (pending.length === 0) {
    const text = typeof action === 'string' ? action : action.explain ? '这一点我想不出来，直接讲给我' : '继续';
    return reduceSession(state, { type: 'SEND_MESSAGE', conversationId: 'eval', text, ...ids });
  }
  if (action.explain) return reduceSession(state, { type: 'EXPLAIN_QUESTION', questionId: pending[0].id, ...ids });
  let next = state;
  for (const question of pending) {
    const option = action.pick ? question.options.at(-1) : null;
    next = reduceSession(next, {
      type: 'SUBMIT_ANSWER', questionId: question.id, ...ids,
      answer: option ? option.text : typeof action === 'string' ? action : '不确定',
      selectedLevel: option?.level,
    });
  }
  return next;
}

async function run(state, runMode = mode) {
  const turn = state.turns.at(-1);
  const option = [];
  const started = Date.now();
  let next = state;
  const config = { endpoint: BASE_URL, apiKey: API_KEY, model: MODEL };
  const messages = contextForRun(state);
  const estimate = estimateContextTokens({ turns: state.turns.slice(0, -1), system: mode.teaching, tools: contextToolDefinitions(mode), draft: turn.userMessage.text }).tokens;
  const result = await runTeachingAgent({
    conversationId: 'eval', turnId: turn.id, runId: turn.runId, mode: runMode, config, messages,
    studentTexts: collectStudentTexts(state.turns),
    optionConfig: { ...config, model: OPTION_MODEL }, optionSystemPrompt,
    onEvent: (event) => {
      const type = EVENT_ACTION_TYPES[event.type];
      if (type) next = reduceSession(next, { ...event, type });
    },
    onDebug: (record) => {
      if (record.kind === 'option' || String(record.id).startsWith('option:')) option.push(record);
    },
  });
  next = reduceSession(next, {
    type: 'RUN_FINISHED', runId: turn.runId, reason: result.reason, responseMessages: result.responseMessages,
    error: result.error ? safe(result.error.message) : null, errorKind: result.endedBy,
    contextUsage: result.contextUsage, usageModel: MODEL,
  });
  return { state: next, result, option, estimate, durationMs: Date.now() - started };
}

async function runTopic(key) {
  let state = createInitialState({ conversationId: 'eval', mode: 'socratic' });
  const turns = [];
  for (const [index, action] of TOPICS[key].entries()) {
    const advanced = nextTurn(state, action, `${key}${index}`);
    if (!advanced || advanced === state) {
      turns.push({ action, skipped: true });
      break;
    }
    const done = await run(advanced);
    state = done.state;
    const turn = state.turns.at(-1);
    const tools = turn.parts.filter((part) => part.type === 'tool');
    const plans = tools.filter((part) => part.toolName === 'update_learning_plan');
    turns.push({
      action,
      reason: done.result.reason,
      error: turn.error,
      steps: done.result.stepCount,
      durationMs: done.durationMs,
      estimate: done.estimate,
      usage: done.result.contextUsage,
      tools: tools.map((part) => ({ name: part.toolName, status: part.output?.status ?? part.status, notice: part.output?.notice, message: part.output?.message, refId: part.output?.refId })),
      planUpdates: plans.length,
      text: turn.parts.filter((part) => part.type === 'text').map((part) => part.text).join(''),
      questions: turn.questions.map((item) => ({ text: item.text, refs: item.refs ?? [], options: item.options, optionsStatus: item.optionsStatus })),
      answers: tools.filter((part) => part.toolName === 'ask_question').map((part) => part.input?.answer ?? null),
      context: tools.filter((part) => part.toolName === 'ask_question').map((part) => part.input?.context ?? null),
      optionErrors: done.option.filter((item) => item.errorCode).map((item) => safe(item.errorCode)),
      plan: projectLearningPlan(state.turns),
    });
    const last = turns.at(-1);
    console.log(`[${key}] 第 ${index + 1} 轮：${last.reason} 步数=${last.steps} ${(last.durationMs / 1000).toFixed(1)}s 工具=${last.tools.map((item) => `${item.name}:${item.status}`).join(',')}${last.error ? ` 错误=${last.error}` : ''}`);
    if (!['completed', 'awaiting_user'].includes(last.reason)) break;
  }

  // 回退兼容：旧代码没有计划工具，续聊时历史里仍有它的调用，端点能否接受
  let rollback = null;
  if (key === selected[0]) {
    const advanced = nextTurn(state, '继续', `${key}old`);
    if (advanced && advanced !== state) {
      const oldMode = { ...mode, toolNames: mode.toolNames.filter((name) => name !== 'update_learning_plan') };
      const { result } = await run(advanced, oldMode);
      rollback = { reason: result.reason, error: result.error ? safe(result.error.message) : null };
      console.log(`[${key}] 未注册计划工具续聊：${rollback.reason}${rollback.error ? ` ${rollback.error}` : ''}`);
    }
  }

  const references = projectReferences(state.turns);
  const links = turns.flatMap((turn) => [...(turn.text ?? '').matchAll(/\]\(#((?:ref|concept):[^)\s]*)\)/g)].map((match) => match[1].replace(/^ref:/, '')));
  return { key, turns, rollback, links, brokenLinks: links.filter((ref) => !references.has(ref)) };
}

const topics = [];
for (const key of selected) topics.push(await runTopic(key));

const all = topics.flatMap((topic) => topic.turns).filter((turn) => !turn.skipped);
const ok = all.filter((turn) => ['completed', 'awaiting_user'].includes(turn.reason));
const rate = (list, test) => `${list.filter(test).length}/${list.length}`;
const tools = all.flatMap((turn) => turn.tools);
const plans = tools.filter((item) => item.name === 'update_learning_plan');
const questions = all.flatMap((turn) => turn.questions);
const withUsage = ok.filter((turn) => turn.usage?.inputTokens > 0 && turn.steps === 1);

const summary = {
  日期: new Date().toISOString(),
  主模型: MODEL,
  副模型: OPTION_MODEL,
  主题数: topics.length,
  轮次完成: rate(all, (turn) => ok.includes(turn)),
  首轮建立计划: rate(topics.map((topic) => topic.turns[0]), (turn) => Boolean(turn?.plan)),
  最大步数: Math.max(0, ...ok.map((turn) => turn.steps)),
  最长耗时秒: Math.max(0, ...all.map((turn) => turn.durationMs)) / 1000,
  工具被拒: rate(tools, (item) => item.status === 'rejected'),
  计划更新: plans.length,
  一轮多次更新: all.filter((turn) => turn.planUpdates > 1).length,
  证据被降级: plans.filter((item) => item.notice).length,
  最终已验证概念: topics.map((topic) => `${topic.key}:${(topic.turns.filter((turn) => turn.plan).at(-1)?.plan.concepts ?? []).filter((item) => item.status === 'verified').length}`).join(' '),
  候选答案可用: rate(questions, (item) => item.optionsStatus === 'ready'),
  漏写context: rate(all.flatMap((turn) => turn.context), (item) => !String(item ?? '').trim()),
  漏写参考答案: rate(all.flatMap((turn) => turn.answers), (item) => !String(item ?? '').trim()),
  图: tools.filter((item) => item.refId).length,
  题目带引用: rate(questions, (item) => item.refs.length > 0),
  正文引用: `${topics.reduce((sum, topic) => sum + topic.links.length, 0)}（失效 ${topics.reduce((sum, topic) => sum + topic.brokenLinks.length, 0)}）`,
  '占用估算/接口用量（仅单步轮）': withUsage.map((turn) => `${turn.estimate}/${turn.usage.inputTokens}`).join(' ') || '无',
  未注册工具续聊: topics[0]?.rollback ?? '未跑',
};
console.log(JSON.stringify(summary, null, 2));
writeFileSync(new URL('./eval-teaching.output.json', import.meta.url), JSON.stringify({ summary, topics }, null, 2).split(API_KEY).join('***').split(BASE_URL).join('<endpoint>'));
process.exit(ok.length > 0 ? 0 : 1);
