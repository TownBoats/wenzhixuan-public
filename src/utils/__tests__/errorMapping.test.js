/**
 * 失败分类 `classifyTurnError`。
 * 超时与取消原文相同，没有 errorKind 时不得猜成超时。
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

test('端点不支持工具：沿用粗判并保留整句建议（textKey 为空）', () => {
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
