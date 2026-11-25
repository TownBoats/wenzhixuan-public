/**
 * 学习 plan 探针：在真实端点上验证「plan + 图 + 提问」四工具教学是否可行。
 *
 * 用现行教学指令加 plan 草案指令，跑两个主题、每个 4 轮脚本化学生输入，观察：
 * 步数、耗时、是否并行调用、plan 是否先于提问、约定是否保留、证据是否伪造、context 是否填写。
 * 只用于验证方案，plan 工具是草案，不作产品代码复用。副模型不参与（提问直接返回就绪）。
 *
 * 用法（三个变量缺一即退出）：
 *   PROBE_BASE_URL=https://api.deepseek.com/v1
 *   PROBE_API_KEY=<你的 key>
 *   PROBE_MODEL=<主模型名>
 *   node scripts/probe-plan-tool.mjs
 *
 * 可选变量：
 *   PROBE_TOPICS   只跑部分主题，逗号分隔（默认 binary,bayes）
 *
 * 完整结果写入 scripts/probe-plan-tool.output.json（含对话内容，不含端点与密钥）。
 * 退出码：0 = 跑完（是否可行看判据）；1 = 配置缺失或全部轮次失败。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jsonSchema, stepCountIs, tool } from 'ai';

import { runModelTurn } from '../src/agent/modelAdapter.js';
import { ASK_QUESTION_DESCRIPTION, ASK_QUESTION_INPUT_SCHEMA, validateAskQuestionInput } from '../src/agent/tools/askQuestion.js';
import { createExplainCardTool } from '../src/agent/tools/explainCard.js';
import { createVisualizeTool } from '../src/agent/tools/visualize.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(HERE, 'probe-plan-tool.output.json');

const BASE_URL = (process.env.PROBE_BASE_URL || '').trim();
const API_KEY = (process.env.PROBE_API_KEY || '').trim();
const MODEL = (process.env.PROBE_MODEL || '').trim();

if (!BASE_URL || !API_KEY || !MODEL) {
  console.error('缺少环境变量。需要 PROBE_BASE_URL / PROBE_API_KEY / PROBE_MODEL 三个都设置。');
  process.exit(1);
}

// SDK 默认会打印原始错误（可能含端点与密钥）；这里只输出脱敏后的错误
console.error = () => {};

/** 放宽步数以观察真实需要；产品现值为 3，提议 5。 */
const OBSERVED_STEP_LIMIT = 8;
const TURN_TIMEOUT_MS = 120_000;
const STATUSES = ['unknown', 'gap', 'claimed', 'verified'];

const TOPICS = {
  binary: [
    '教我二分查找。约定：所有数组下标从 1 开始，区间左闭右开。',
    '我只知道每次砍掉一半，不知道区间应该怎么更新',
    '拿中间的数和目标比，中间的数比目标小，目标就只能在右边，因为数组是从小到大排好的',
    '先不学这个了，我想改成学怎么找第一个大于等于目标的位置',
  ],
  bayes: [
    '教我贝叶斯公式，全程用疾病检测的例子，患病率固定为 1%。',
    '条件概率我没学过，不知道竖线是什么意思',
    '就是只看检测阳性的那群人，在这群人里面数真正生病的占多少',
    '我觉得我全懂了',
  ],
};

const selected = (process.env.PROBE_TOPICS || Object.keys(TOPICS).join(','))
  .split(',')
  .map((item) => item.trim())
  .filter((item) => TOPICS[item]);
if (selected.length === 0) {
  console.error(`PROBE_TOPICS 无效，可选：${Object.keys(TOPICS).join(', ')}`);
  process.exit(1);
}

const PLAN_INSTRUCTIONS = `

## 学习计划

- 学生提出新主题时，**先调用 update_learning_plan 建立计划，再讲解或提问**：写清目标、从前置到目标的概念清单（3–8 个）和前置关系。
- 之后只在情况变化时更新，每轮最多一次，只传变化的部分：发现学生缺某个前置概念、进入下一个概念、学生展示了理解、或学生改了目标。
- 概念状态：unknown（还不知道）、gap（已暴露出缺口）、claimed（学生自称会）、verified（已验证）。
- 只有学生用自己的话说出了正确的理由或推断，才能标 verified，并在 evidence 里**逐字引用**他的原话。「懂了」「会了」只能标 claimed。
- 贯穿全程的约定（符号、编号、例子参数）登记到 conventions；变更时传完整的新列表。
- 先补缺口，再往后讲。不要向学生复述计划本身。
- 更新计划可以和讲解、提问在同一轮完成，不要因为更新了计划就停下。`;

/** 与产品方案一致的结构；evidence 为字符串，保持扁平。 */
const PLAN_SCHEMA = jsonSchema({
  type: 'object',
  properties: {
    goal: { type: 'string', description: '学习目标，一句话' },
    conventions: { type: 'array', items: { type: 'string' }, description: '贯穿全程的约定，传入即整体替换' },
    concepts: {
      type: 'array',
      description: '新增或变化的概念；未提及的保持不变',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '短英文标识，之后不变，如 loop_invariant' },
          name: { type: 'string', description: '概念名，2–20 字' },
          status: { type: 'string', enum: STATUSES },
          requires: { type: 'array', items: { type: 'string' }, description: '前置概念的 id' },
          evidence: { type: 'string', description: '仅 verified 需要：学生原话，一字不差' },
        },
        required: ['id'],
        additionalProperties: false,
      },
    },
    currentConceptId: { type: 'string' },
    nextStep: { type: 'string', description: '接下来要做什么，一句话' },
  },
  additionalProperties: false,
});

const PLAN_FIELDS = new Set(['goal', 'conventions', 'concepts', 'currentConceptId', 'nextStep']);
const CONCEPT_FIELDS = new Set(['id', 'name', 'status', 'requires', 'evidence']);
const normalize = (text) => String(text ?? '').replace(/[\s，。、；：！？,.;:!?'"“”‘’]/g, '');

function hasCycle(concepts) {
  const state = new Map();
  const byId = new Map(concepts.map((item) => [item.id, item]));
  const visit = (id) => {
    if (state.get(id) === 'open') return true;
    if (state.get(id) === 'done') return false;
    state.set(id, 'open');
    const cyclic = (byId.get(id)?.requires ?? []).some(visit);
    state.set(id, 'done');
    return cyclic;
  };
  return concepts.some((item) => visit(item.id));
}

/** 合并增量；非法时返回 reason，不改动原计划。 */
function mergePlan(plan, input, studentTexts) {
  const reject = (reason) => ({ ok: false, reason });
  if (!input || typeof input !== 'object') return reject('参数必须是对象');
  const unknown = Object.keys(input).filter((key) => !PLAN_FIELDS.has(key));
  if (unknown.length) return reject(`不支持的字段：${unknown.join('、')}`);

  const concepts = new Map((plan?.concepts ?? []).map((item) => [item.id, item]));
  const downgraded = [];
  const seen = new Set();
  for (const item of Array.isArray(input.concepts) ? input.concepts : []) {
    if (!item || typeof item.id !== 'string' || !item.id.trim()) return reject('概念缺少 id');
    if (seen.has(item.id)) return reject(`重复的概念 id：${item.id}`);
    seen.add(item.id);
    const extra = Object.keys(item).filter((key) => !CONCEPT_FIELDS.has(key));
    if (extra.length) return reject(`概念含不支持的字段：${extra.join('、')}`);
    if (item.status && !STATUSES.includes(item.status)) return reject(`未知状态：${item.status}`);
    const old = concepts.get(item.id) ?? { id: item.id, status: 'unknown', requires: [] };
    const next = { ...old, ...item };
    if (!next.name) return reject(`新概念缺少 name：${item.id}`);
    if (item.status === 'verified') {
      const quote = normalize(item.evidence);
      if (!quote || !studentTexts.some((text) => normalize(text).includes(quote))) {
        next.status = 'claimed';
        delete next.evidence;
        downgraded.push(item.id);
      }
    }
    concepts.set(item.id, next);
  }
  const list = [...concepts.values()];
  const missing = list.flatMap((item) => item.requires ?? []).filter((id) => !concepts.has(id));
  if (missing.length) return reject(`前置概念不存在：${[...new Set(missing)].join('、')}`);
  if (hasCycle(list)) return reject('前置关系存在循环');
  const currentConceptId = input.currentConceptId ?? plan?.currentConceptId ?? null;
  if (currentConceptId && !concepts.has(currentConceptId)) return reject(`currentConceptId 不存在：${currentConceptId}`);
  const goal = input.goal ?? plan?.goal;
  if (!goal) return reject('首次建立计划需要 goal');
  return {
    ok: true,
    downgraded,
    plan: {
      goal,
      conventions: input.conventions ?? plan?.conventions ?? [],
      currentConceptId,
      nextStep: input.nextStep ?? plan?.nextStep ?? '',
      concepts: list,
    },
  };
}

/** 错误信息里去掉密钥与端点。 */
const safe = (value) =>
  String(value ?? '').split(API_KEY).join('****').split(BASE_URL).join('<endpoint>').replace(/https?:\/\/\S+/g, '<url>');

const system = readFileSync(join(HERE, '../src/agent/skills/socratic.md'), 'utf8').trim() + PLAN_INSTRUCTIONS;

async function runTopic(key) {
  const inputs = TOPICS[key];
  const messages = [];
  const studentTexts = [];
  const turns = [];
  let plan = null;
  let pending = [];
  let callSeq = 0;

  for (let index = 0; index < inputs.length; index += 1) {
    const raw = inputs[index];
    // 自由输入只有学生原话；作答按产品模板拼接，证据只认原话
    studentTexts.push(raw);
    const userText =
      pending.length > 0
        ? pending.map((question) => `针对问题「${question}」，我的回答是：${raw}\n（来自选项：手动输入）`).join('\n\n')
        : raw;
    messages.push({ role: 'user', content: userText });
    pending = [];

    const before = plan;
    const log = [];
    const record = (name, input, output) => {
      callSeq += 1;
      log.push({ seq: callSeq, name, input, output });
      return output;
    };
    const explain = createExplainCardTool();
    const visualize = createVisualizeTool();
    const tools = {
      update_learning_plan: tool({
        description: '建立或更新学习计划。只传变化的部分，程序会合并并返回完整计划。不会打断本轮。',
        inputSchema: PLAN_SCHEMA,
        execute: async (input) => {
          const merged = mergePlan(plan, input, studentTexts);
          if (!merged.ok) return record('update_learning_plan', input, { status: 'rejected', reason: merged.reason });
          plan = merged.plan;
          return record('update_learning_plan', input, {
            status: 'ready',
            plan,
            ...(merged.downgraded.length > 0
              ? { notice: `证据不是学生原话，已降为 claimed：${merged.downgraded.join('、')}` }
              : {}),
          });
        },
      }),
      ask_question: tool({
        description: ASK_QUESTION_DESCRIPTION,
        inputSchema: ASK_QUESTION_INPUT_SCHEMA,
        execute: async (input) => {
          const checked = validateAskQuestionInput(input);
          if (!checked.ok) return record('ask_question', input, { status: 'rejected', reason: 'invalid_input', message: checked.message });
          pending.push(checked.question);
          return record('ask_question', input, {
            status: 'ready', questionId: `q${callSeq}`, question: checked.question, options: [], optionsStatus: 'unavailable', nextAction: 'await_user',
          });
        },
      }),
      explain_card: { ...explain, execute: async (input, options) => record('explain_card', { title: input?.title }, await explain.execute(input, options)) },
      visualize: { ...visualize, execute: async (input, options) => record('visualize', { title: input?.title }, await visualize.execute(input, options)) },
    };

    const started = Date.now();
    const result = await runModelTurn({
      runId: `${key}-${index}`,
      config: { endpoint: BASE_URL, apiKey: API_KEY, model: MODEL, timeoutMs: TURN_TIMEOUT_MS },
      messages: [...messages],
      tools,
      stopWhen: [
        stepCountIs(OBSERVED_STEP_LIMIT),
        ({ steps }) => (steps.at(-1)?.toolResults ?? []).some((item) => item.output?.nextAction === 'await_user'),
      ],
      system,
      onEvent: () => {},
    }).catch((error) => ({ ok: false, endedBy: 'failed', stepCount: 0, responseMessages: [], error }));
    const durationMs = Date.now() - started;
    messages.push(...result.responseMessages);

    const perStep = result.responseMessages
      .filter((message) => message.role === 'assistant' && Array.isArray(message.content))
      .map((message) => message.content.filter((part) => part.type === 'tool-call').map((part) => part.toolName));
    const plans = log.filter((item) => item.name === 'update_learning_plan');
    const questions = log.filter((item) => item.name === 'ask_question');
    const firstPlan = log.findIndex((item) => item.name === 'update_learning_plan' && item.output.status === 'ready');
    const firstQuestion = log.findIndex((item) => item.name === 'ask_question');

    const turn = {
      student: raw,
      endedBy: result.endedBy,
      error: result.error ? safe(result.error.message) : null,
      steps: result.stepCount,
      durationMs,
      perStep,
      parallel: perStep.some((names) => names.length > 1),
      planCalls: plans.length,
      planRejected: plans.filter((item) => item.output.status === 'rejected').map((item) => item.output.reason),
      downgraded: plans.filter((item) => item.output.notice).map((item) => item.output.notice),
      planBeforeQuestion: firstPlan >= 0 && (firstQuestion < 0 || firstPlan < firstQuestion),
      questions: questions.map((item) => ({ question: item.input?.question, context: item.input?.context ?? null })),
      contextMissing: questions.filter((item) => !String(item.input?.context ?? '').trim()).length,
      planChanged: plan !== before,
      plan,
      text: result.responseMessages
        .filter((message) => message.role === 'assistant')
        .flatMap((message) => (typeof message.content === 'string' ? [message.content] : message.content.filter((part) => part.type === 'text').map((part) => part.text)))
        .join('\n'),
    };
    turns.push(turn);
    console.log(
      `[${key}] 第 ${index + 1} 轮：${turn.endedBy} 步数=${turn.steps} ${(durationMs / 1000).toFixed(1)}s 工具=${JSON.stringify(perStep)}` +
        (turn.planRejected.length ? ` 拒绝=${turn.planRejected.join('；')}` : '') +
        (turn.error ? ` 错误=${turn.error}` : ''),
    );
    if (turn.endedBy !== 'finished') break;
  }
  return { key, turns };
}

const topics = [];
for (const key of selected) topics.push(await runTopic(key));

const all = topics.flatMap((topic) => topic.turns);
const finished = all.filter((turn) => turn.endedBy === 'finished');
const firstTurns = topics.map((topic) => topic.turns[0]).filter((turn) => turn?.endedBy === 'finished');
const rate = (list, test) => `${list.filter(test).length}/${list.length}`;
const planCalls = all.reduce((sum, turn) => sum + turn.planCalls, 0);
const rejected = all.reduce((sum, turn) => sum + turn.planRejected.length, 0);

const summary = {
  model: MODEL,
  date: new Date().toISOString(),
  轮次完成: rate(all, (turn) => turn.endedBy === 'finished'),
  首轮先建计划再提问: rate(firstTurns, (turn) => turn.planBeforeQuestion),
  最后以提问结束: rate(finished, (turn) => turn.questions.length > 0),
  '3 步内完成': rate(finished, (turn) => turn.steps <= 3),
  '5 步内完成': rate(finished, (turn) => turn.steps <= 5),
  最大步数: Math.max(0, ...finished.map((turn) => turn.steps)),
  最长耗时秒: Math.max(0, ...all.map((turn) => turn.durationMs)) / 1000,
  有并行调用的轮: rate(finished, (turn) => turn.parallel),
  每轮计划更新不超过一次: rate(finished, (turn) => turn.planCalls <= 1),
  计划被拒: `${rejected}/${planCalls}`,
  证据被降级: all.reduce((sum, turn) => sum + turn.downgraded.length, 0),
  提问漏写context: `${all.reduce((sum, turn) => sum + turn.contextMissing, 0)}/${all.reduce((sum, turn) => sum + turn.questions.length, 0)}`,
  约定仍在最终计划: topics.map((topic) => `${topic.key}: ${JSON.stringify(topic.turns.findLast((turn) => turn.plan)?.plan.conventions ?? [])}`),
  最终概念状态: topics.map((topic) => `${topic.key}: ${(topic.turns.findLast((turn) => turn.plan)?.plan.concepts ?? []).map((item) => `${item.name}=${item.status}`).join('，')}`),
};

console.log('\n判据：');
for (const [name, value] of Object.entries(summary)) console.log(`  ${name}：${Array.isArray(value) ? `\n    ${value.join('\n    ')}` : value}`);

writeFileSync(OUTPUT_PATH, `${JSON.stringify({ summary, topics }, null, 2)}\n`, 'utf8');
console.log('\n完整结果：scripts/probe-plan-tool.output.json');
process.exit(finished.length > 0 ? 0 : 1);
