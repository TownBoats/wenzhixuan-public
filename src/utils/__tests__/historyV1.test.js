/**
 * v1 只读适配单测（阶段 E · 任务 E4）
 *
 * 断言对应 `决策记录.md` E-2 的投影规则：`messages` 主线、答案卡摊平成文本、
 * 旧摘要标 `source:'answer'`、失败轮不进上下文、旧记录只读。
 * 纯函数：不联网、不渲染、不碰 storage。
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { answerCardToText, projectV1Record, uiMessageToText } from '../historyV1.js';

const GATE = '\u200B';

/** 一条「开场欢迎 + 一轮两问 + 作答摘要 + 追问 + 失败」的旧记录。 */
function makeLegacyRecord() {
  return {
    id: 'chat_1700000000000',
    title: `旧会话${GATE}标题`,
    timestamp: 1700000000000,
    messages: [
      { id: 'm0', role: 'assistant', content: '欢迎使用', status: 'completed', error: null },
      { id: 'm1', role: 'user', content: `什么是闭包？${GATE}`, status: 'completed', error: null },
      { id: 'm2', role: 'assistant', content: '闭包是函数加上它的词法环境。', status: 'completed', error: null },
      {
        id: 'm3',
        role: 'user',
        content:
          '问题 1：你觉得闭包记住了什么？\r\n回答：外层变量\r\n\r\n问题 2：第二问\r\n回答：不知道',
        status: 'completed',
        error: null,
      },
      { id: 'm4', role: 'assistant', content: '很好，你抓到了要点。', status: 'completed', error: null },
      { id: 'm5', role: 'user', content: '再问一个', status: 'completed', error: null },
      {
        id: 'm6',
        role: 'assistant',
        content: '请求失败，请检查模型配置后重试。',
        status: 'error',
        error: { message: 'boom https://example.invalid' },
      },
    ],
    uiMessages: [
      { id: 'm0', sourceMessageId: 'm0', role: 'assistant', status: 'completed', content: [{ type: 'response', value: '欢迎使用' }] },
      { id: 'm1', sourceMessageId: 'm1', role: 'user', status: 'completed', content: [{ type: 'response', value: `什么是闭包？${GATE}` }] },
      {
        id: 'm2',
        sourceMessageId: 'm2',
        role: 'assistant',
        status: 'completed',
        content: [
          { type: 'thinking', value: '这是不该复活的推理原文' },
          { type: 'code', value: 'function f(){}\n' },
          { type: 'response', value: '闭包是函数加上它的词法环境。' },
          {
            type: 'question',
            value: [
              { question: '你觉得闭包记住了什么？', options: [{ text: '外层变量' }, { text: '函数本身' }] },
              '第二问',
            ],
          },
        ],
      },
      {
        id: 'ui_a1',
        sourceMessageId: null,
        role: 'user',
        status: 'completed',
        content: [{ type: 'answer-card', value: { question: '你觉得闭包记住了什么？', level: 'familiar', answer: '外层变量' } }],
      },
      {
        id: 'ui_a2',
        sourceMessageId: null,
        role: 'user',
        status: 'completed',
        content: [{ type: 'answer-card', value: { question: '第二问', level: 'basic', answer: '不知道' } }],
      },
      { id: 'm4', sourceMessageId: 'm4', role: 'assistant', status: 'completed', content: [{ type: 'response', value: '很好，你抓到了要点。' }] },
      { id: 'm5', sourceMessageId: 'm5', role: 'user', status: 'completed', content: [{ type: 'response', value: '再问一个' }] },
      { id: 'm6', sourceMessageId: 'm6', role: 'assistant', status: 'error', content: [{ type: 'response', value: '请求失败，请检查模型配置后重试。' }] },
    ],
  };
}

describe('projectV1Record · 结构', () => {
  it('三轮：问答 / 作答摘要 / 追问', () => {
    const projected = projectV1Record(makeLegacyRecord());
    assert.equal(projected.turns.length, 3);
    assert.equal(projected.id, 'chat_1700000000000');
    assert.equal(projected.timestamp, 1700000000000);
    assert.equal(projected.mode, null);
    assert.equal(projected.turns[0].userMessage.source, 'input');
    assert.equal(projected.turns[1].userMessage.source, 'answer');
    assert.equal(projected.turns[2].userMessage.source, 'input');
  });

  it('turn id 确定性拼装，runId / modeSnapshot 为 null', () => {
    const projected = projectV1Record(makeLegacyRecord());
    projected.turns.forEach((turn, index) => {
      assert.equal(turn.id, `v1_chat_1700000000000_${index}`);
      assert.equal(turn.runId, null);
      assert.equal(turn.modeSnapshot, null);
    });
  });

  it('前导欢迎语被丢弃（没有前驱 user 的 assistant）', () => {
    const projected = projectV1Record(makeLegacyRecord());
    assert.equal(JSON.stringify(projected).includes('欢迎使用'), false);
  });
});

describe('projectV1Record · 展示片段', () => {
  it('正文 / 代码 / 问题按顺序拼成一个文本片段', () => {
    const [first] = projectV1Record(makeLegacyRecord()).turns;
    assert.equal(first.parts.length, 3);
    assert.equal(first.parts[0].type, 'text');
    assert.equal(first.parts[0].runId, null);
    assert.equal(first.parts[0].text.includes('```'), true);
    assert.equal(first.parts[0].text.includes('闭包是函数加上它的词法环境。'), true);
    assert.equal(first.parts[0].text.includes('选项：外层变量 / 函数本身'), true);
    assert.equal(first.parts[0].text.includes('第二问'), true);
  });

  it('答案卡摊平成「问题 / 我的回答 / 档位」，且不生成 questions', () => {
    const [first] = projectV1Record(makeLegacyRecord()).turns;
    const cardTexts = first.parts.map((part) => part.text).filter((text) => text.startsWith('问题：'));
    assert.equal(cardTexts.length, 2);
    assert.equal(cardTexts[0].includes('我的回答：外层变量'), true);
    assert.equal(cardTexts[0].includes('档位：familiar'), true);
    assert.equal(cardTexts[1].includes('档位：basic'), true);
    assert.deepEqual(first.questions, []);
  });

  it('thinking 片段不复活、不出现 [object Object]', () => {
    const projected = projectV1Record(makeLegacyRecord());
    const json = JSON.stringify(projected);
    assert.equal(json.includes('不该复活的推理原文'), false);
    assert.equal(json.includes('[object Object]'), false);
  });
});

describe('projectV1Record · 上下文与状态', () => {
  it('modelMessages 只有 assistant 纯文本', () => {
    const [first, summary] = projectV1Record(makeLegacyRecord()).turns;

    // 一条旧 assistant 消息 → 一个纯文本 content（代码围栏与题面也在里面，它们本来就是
    // 模型说过的话），不是结构化片段、更不是 tool-call
    assert.equal(first.modelMessages.length, 1);
    assert.equal(first.modelMessages[0].role, 'assistant');
    assert.equal(typeof first.modelMessages[0].content, 'string');
    assert.equal(first.modelMessages[0].content.includes('闭包是函数加上它的词法环境。'), true);
    assert.equal(first.modelMessages[0].content.includes('```'), true);
    assert.equal(first.modelMessages[0].content.includes('你觉得闭包记住了什么？'), true);

    assert.deepEqual(summary.modelMessages, [{ role: 'assistant', content: '很好，你抓到了要点。' }]);
    assert.equal(summary.userMessage.text.startsWith('问题 1：'), true);
  });

  it('失败轮 interrupted：正文保留、不进上下文', () => {
    const failed = projectV1Record(makeLegacyRecord()).turns[2];
    assert.equal(failed.status, 'interrupted');
    assert.deepEqual(failed.modelMessages, []);
    assert.equal(failed.parts.some((part) => part.text.includes('请求失败')), true);
    assert.equal(failed.error, null);
  });

  it('不搬 error 对象（避免端点信息进界面）', () => {
    assert.equal(JSON.stringify(projectV1Record(makeLegacyRecord())).includes('example.invalid'), false);
  });
});

describe('projectV1Record · 边界与只读', () => {
  it('messages 缺失 → 退回按 uiMessages 切分', () => {
    const projected = projectV1Record({
      id: 'chat_ui_only',
      messages: [],
      uiMessages: [
        { id: 'u1', role: 'user', content: [{ type: 'response', value: '只有 uiMessages' }], status: 'completed' },
        { id: 'u2', role: 'assistant', content: [{ type: 'response', value: '照样能读' }], status: 'completed' },
      ],
    });
    assert.equal(projected.turns.length, 1);
    assert.equal(projected.turns[0].status, 'completed');
    assert.equal(projected.turns[0].modelMessages[0].content, '照样能读');
  });

  it('尾部答案卡挂到上一轮；孤立答案卡自成一轮', () => {
    const tail = projectV1Record({
      id: 'chat_tail',
      messages: [{ id: 'x1', role: 'user', content: '问题', status: 'completed' }],
      uiMessages: [
        { id: 'x1', role: 'user', content: [{ type: 'response', value: '问题' }], status: 'completed' },
        { id: 'xa', role: 'user', content: [{ type: 'answer-card', value: { question: 'q', level: 'basic', answer: 'a' } }] },
      ],
    });
    assert.equal(tail.turns.length, 1);
    assert.equal(tail.turns[0].parts.some((part) => part.text.includes('我的回答：a')), true);

    const orphan = projectV1Record({
      id: 'chat_orphan',
      messages: [],
      uiMessages: [
        { id: 'ya', role: 'user', content: [{ type: 'answer-card', value: { question: '孤立卡', level: 'basic', answer: 'a' } }] },
      ],
    });
    assert.equal(orphan.turns.length, 1);
    assert.equal(orphan.turns[0].userMessage.source, 'answer');
  });

  it('空记录 → turns: []；非对象 / 缺 id → null', () => {
    assert.deepEqual(projectV1Record({ id: 'chat_empty' }).turns, []);
    assert.equal(projectV1Record(null), null);
    assert.equal(projectV1Record({ turns: [] }), null);
    assert.equal(projectV1Record({ id: '   ' }), null);
  });

  it('确定性：两次投影结果一致', () => {
    const record = makeLegacyRecord();
    assert.equal(JSON.stringify(projectV1Record(record)), JSON.stringify(projectV1Record(record)));
  });

  it('只读：调用前后旧记录逐字节相同，且全量无 U+200B', () => {
    const record = makeLegacyRecord();
    const before = JSON.stringify(record);
    const projected = projectV1Record(record);
    assert.equal(JSON.stringify(record), before);
    assert.equal(JSON.stringify(projected).includes(GATE), false);
    assert.equal(projected.title, '旧会话标题');
  });
});

describe('导出的小函数', () => {
  it('answerCardToText 空值安全，缺字段时只输出存在的行', () => {
    assert.equal(answerCardToText(null), '');
    assert.equal(answerCardToText({}), '');
    assert.equal(answerCardToText({ answer: '只有答案' }), '我的回答：只有答案');
    assert.equal(
      answerCardToText({ question: '题', level: 'basic', answer: '答' }),
      '问题：题\n我的回答：答\n档位：basic',
    );
  });

  it('uiMessageToText 支持字符串 content 与未知类型', () => {
    assert.equal(uiMessageToText({ content: '纯文本' }), '纯文本');
    assert.equal(uiMessageToText({ content: [{ type: 'mystery', value: '未知类型也照文本读' }] }), '未知类型也照文本读');
    assert.equal(uiMessageToText({ content: [{ type: 'thinking', value: '丢掉' }] }), '');
  });
});
