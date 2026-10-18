/**
 * 保存签名单测（阶段 E · 任务 E4）
 *
 * `buildSaveSignature` 决定「什么时候该落盘」：四个保存点（发送 / 工具完成 /
 * 作答提交 / 运行结束）必须命中，流式正文与思考增量必须**不**命中
 * （`决策记录.md` E-3 结论 2）。
 *
 * 被测函数住在页面的存储 hook 里（纯函数，可被 Node 直接 import）；测试文件仍放在
 * `src/utils/__tests__/`，不渲染、不联网（`决策记录.md` E4 决策 A）。
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  SAVE_FAILURE_KEYS,
  buildSaveSignature,
} from '../../pages/AgentChatPage/useConversationHistory.js';

function baseTurn(overrides = {}) {
  return {
    id: 't1',
    status: 'streaming',
    parts: [{ type: 'text', partId: 'p1', runId: 'r1', text: '正文' }],
    questions: [],
    modelMessages: [],
    error: null,
    ...overrides,
  };
}

describe('buildSaveSignature · 基本形状', () => {
  it('同一份数据两次签名相同；空 turns / 缺 id 不抛', () => {
    const turns = [baseTurn()];
    assert.equal(buildSaveSignature('c1', turns), buildSaveSignature('c1', turns));

    const empty = buildSaveSignature(null, []);
    assert.equal(typeof empty, 'string');
    assert.equal(buildSaveSignature(null, undefined), buildSaveSignature(null, []));
    assert.notEqual(buildSaveSignature('c1', []), empty);
  });

  it('换会话 id → 签名变化', () => {
    assert.notEqual(buildSaveSignature('c1', [baseTurn()]), buildSaveSignature('c2', [baseTurn()]));
  });

  it('新增一轮（用户发送）→ 签名变化', () => {
    const one = [baseTurn()];
    const two = [baseTurn(), baseTurn({ id: 't2' })];
    assert.notEqual(buildSaveSignature('c1', one), buildSaveSignature('c1', two));
  });
});

describe('buildSaveSignature · 流式增量不该触发保存', () => {
  it('正文变长 / 片段变多 → 签名不变', () => {
    const before = buildSaveSignature('c1', [baseTurn()]);
    const longer = buildSaveSignature('c1', [
      baseTurn({
        parts: [
          { type: 'text', partId: 'p1', runId: 'r1', text: '正文变长了' },
          { type: 'text', partId: 'p2', runId: 'r1', text: '新的一段' },
        ],
      }),
    ]);
    assert.equal(longer, before);
  });

  it('reasoning 变长 → 签名不变', () => {
    const before = buildSaveSignature('c1', [baseTurn()]);
    const withReasoning = buildSaveSignature('c1', [
      baseTurn({
        parts: [
          { type: 'reasoning', partId: 'r', runId: 'r1', text: '思考中' },
          { type: 'text', partId: 'p1', runId: 'r1', text: '正文' },
        ],
      }),
    ]);
    assert.equal(withReasoning, before);
  });

  it('新增一个「运行中」工具卡会变（工具卡数量属于结构变化）', () => {
    const before = buildSaveSignature('c1', [baseTurn()]);
    const withRunningTool = buildSaveSignature('c1', [
      baseTurn({
        parts: [
          ...baseTurn().parts,
          { type: 'tool', toolCallId: 'call_1', status: 'running', input: {}, output: null },
        ],
      }),
    ]);
    assert.notEqual(withRunningTool, before);
  });
});

describe('buildSaveSignature · 四个保存点', () => {
  it('工具卡 running → completed → 签名变化', () => {
    const running = buildSaveSignature('c1', [
      baseTurn({ parts: [{ type: 'tool', toolCallId: 'call_1', status: 'running' }] }),
    ]);
    const completed = buildSaveSignature('c1', [
      baseTurn({ parts: [{ type: 'tool', toolCallId: 'call_1', status: 'completed' }] }),
    ]);
    assert.notEqual(completed, running);
  });

  it('问题 pending → answered → 签名变化', () => {
    const pending = buildSaveSignature('c1', [
      baseTurn({ status: 'awaiting_user', questions: [{ id: 'q1', state: 'pending' }] }),
    ]);
    const answered = buildSaveSignature('c1', [
      baseTurn({ status: 'awaiting_user', questions: [{ id: 'q1', state: 'answered' }] }),
    ]);
    assert.notEqual(answered, pending);
  });

  it('运行结束（status + modelMessages）→ 签名变化', () => {
    const streaming = buildSaveSignature('c1', [baseTurn()]);
    const finished = buildSaveSignature('c1', [
      baseTurn({
        status: 'completed',
        modelMessages: [{ role: 'assistant', content: '回答' }],
      }),
    ]);
    assert.notEqual(finished, streaming);

    const sameStatusMoreMessages = buildSaveSignature('c1', [
      baseTurn({
        status: 'completed',
        modelMessages: [
          { role: 'assistant', content: '回答' },
          { role: 'assistant', content: '补充' },
        ],
      }),
    ]);
    assert.notEqual(sameStatusMoreMessages, finished);
  });

  it('出现 error → 签名变化', () => {
    const ok = buildSaveSignature('c1', [baseTurn({ status: 'completed' })]);
    const failed = buildSaveSignature('c1', [baseTurn({ status: 'failed', error: 'boom' })]);
    assert.notEqual(failed, ok);
  });
});

describe('SAVE_FAILURE_KEYS', () => {
  it('四种存储失败原因各有文案键，彼此不重复', () => {
    const keys = Object.values(SAVE_FAILURE_KEYS);
    assert.deepEqual(Object.keys(SAVE_FAILURE_KEYS).sort(), [
      'corrupt',
      'invalid',
      'quota',
      'unavailable',
    ]);
    assert.equal(new Set(keys).size, keys.length);
    for (const key of keys) assert.equal(key.startsWith('AgentChat.history.'), true);
  });
});
