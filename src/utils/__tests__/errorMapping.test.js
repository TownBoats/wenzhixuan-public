/**
 * F3 · 失败文案分类（`F-取消重试与验收.md` §4 的五种情况）
 *
 * 被测对象是展示层的纯函数 `classifyTurnError`：它只决定「显示哪一句可读文案」，
 * 不生成文案、不碰状态。这里只验证分类，不渲染页面。
 *
 * 关键背景：超时与取消在传输层是同一个 `AbortError`（原文都是「运行已中断」），
 * 唯一区别是运行层打的 `errorKind`。所以「没有 errorKind 时不得猜成超时」必须有用例守住。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ERROR_KIND,
  ERROR_TEXT_KEYS,
  TOOL_UNSUPPORTED_PATTERN,
  classifyTurnError,
} from '../../pages/AgentChatPage/errorAdapter.js';

test('取消：没有 error 就不出任何分类（不显示为错误）', () => {
  const info = classifyTurnError({ error: null, errorKind: null });
  assert.equal(info.kind, null);
  assert.equal(info.textKey, null);
  assert.equal(info.detail, '');
});

test('超时：errorKind=timeout 优先，即使原文与取消一模一样', () => {
  const info = classifyTurnError({ error: '运行已中断', errorKind: 'timeout' });
  assert.equal(info.kind, ERROR_KIND.TIMEOUT);
  assert.equal(info.textKey, ERROR_TEXT_KEYS.timeout);
  assert.equal(info.detail, '运行已中断');
});

test('同样的原文但没有 timeout 类别 → 归普通失败，不猜成超时', () => {
  const info = classifyTurnError({ error: '运行已中断', errorKind: 'failed' });
  assert.equal(info.kind, ERROR_KIND.FAILED);
  assert.equal(info.textKey, ERROR_TEXT_KEYS.failed);
});

test('网络失败：浏览器 Failed to fetch 与 Node 的 ECONNREFUSED 都归网络', () => {
  for (const detail of [
    'Failed to fetch',
    'fetch failed',
    'connect ECONNREFUSED 127.0.0.1:9',
    'getaddrinfo ENOTFOUND example.invalid',
  ]) {
    const info = classifyTurnError({ error: detail, errorKind: 'failed' });
    assert.equal(info.kind, ERROR_KIND.NETWORK, `${detail} 应归网络`);
    assert.equal(info.textKey, ERROR_TEXT_KEYS.network);
  }
});

test('端点不支持工具：沿用 D-2 的粗判并保留整句建议（textKey 为空）', () => {
  const info = classifyTurnError({
    error: 'AI_APICallError: tools is not supported by this endpoint',
    errorKind: 'failed',
  });
  assert.equal(info.kind, ERROR_KIND.TOOL_UNSUPPORTED);
  assert.equal(info.textKey, null);
  assert.equal(TOOL_UNSUPPORTED_PATTERN.test('HTTP 400 Bad Request'), true);
});

test('其它失败：归普通失败；原文原样保留供排查', () => {
  const info = classifyTurnError({ error: 'synthetic failure for retry test', errorKind: 'failed' });
  assert.equal(info.kind, ERROR_KIND.FAILED);
  assert.equal(info.textKey, ERROR_TEXT_KEYS.failed);
  assert.equal(info.detail, 'synthetic failure for retry test');
});

test('分类结果里只有文案键与原文，不含任何配置字段（apiKey 不可能被带出）', () => {
  const info = classifyTurnError({ error: 'Failed to fetch', errorKind: 'failed' });
  assert.deepEqual(Object.keys(info).sort(), ['detail', 'kind', 'textKey']);
  assert.equal(JSON.stringify(info).includes('apiKey'), false);
});
