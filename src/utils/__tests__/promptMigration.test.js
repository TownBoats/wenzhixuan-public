import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import zhTranslation from '../../locales/zh/translation.json' with { type: 'json' };
import enTranslation from '../../locales/en/translation.json' with { type: 'json' };
import {
  MAIN_PROMPT_STORAGE_KEY,
  PROMPT_MIGRATION_NOTICE_DISMISSED_KEY,
  classifyMainPrompt,
  dismissMainPromptMigrationNotice,
  readMainPromptMigrationState,
} from '../promptMigration.js';

const ZH_BUILTIN = zhTranslation.SystemPrompts.learningMode;
const EN_BUILTIN = enTranslation.SystemPrompts.learningMode;
const BUILT_INS = [ZH_BUILTIN, EN_BUILTIN];

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
  };
}

describe('classifyMainPrompt', () => {
  it('未存储 / 空串 → unset', () => {
    assert.equal(classifyMainPrompt(null, BUILT_INS), 'unset');
    assert.equal(classifyMainPrompt(undefined, BUILT_INS), 'unset');
    assert.equal(classifyMainPrompt('', BUILT_INS), 'unset');
  });

  it('与中文内置原文完全相等 → builtin', () => {
    assert.equal(classifyMainPrompt(ZH_BUILTIN, BUILT_INS), 'builtin');
  });

  it('与英文内置原文完全相等 → builtin（语言切换写回的缓存同此）', () => {
    assert.equal(classifyMainPrompt(EN_BUILTIN, BUILT_INS), 'builtin');
  });

  it('只改一个词 → customized（完全相等，不模糊匹配）', () => {
    assert.equal(classifyMainPrompt(ZH_BUILTIN.replace('苏格拉底', '柏拉图'), BUILT_INS), 'customized');
  });

  it('尾部多一个换行也算 customized（宁可多提示）', () => {
    assert.equal(classifyMainPrompt(ZH_BUILTIN + '\n', BUILT_INS), 'customized');
  });
});

describe('readMainPromptMigrationState', () => {
  it('已自定义且未关闭 → shouldNotify', () => {
    const state = readMainPromptMigrationState({
      storage: fakeStorage({ [MAIN_PROMPT_STORAGE_KEY]: '用户自己写的提示词' }),
      builtIns: BUILT_INS,
    });
    assert.deepEqual(state, { status: 'customized', dismissed: false, shouldNotify: true });
  });

  it('内置值 / 未存储 → 不提示', () => {
    for (const stored of [ZH_BUILTIN, EN_BUILTIN, null]) {
      const state = readMainPromptMigrationState({
        storage: fakeStorage(stored ? { [MAIN_PROMPT_STORAGE_KEY]: stored } : {}),
        builtIns: BUILT_INS,
      });
      assert.equal(state.shouldNotify, false);
    }
  });

  it('已自定义但已关闭 → 不再提示（只出现一次）', () => {
    const state = readMainPromptMigrationState({
      storage: fakeStorage({
        [MAIN_PROMPT_STORAGE_KEY]: '用户自己写的提示词',
        [PROMPT_MIGRATION_NOTICE_DISMISSED_KEY]: 'true',
      }),
      builtIns: BUILT_INS,
    });
    assert.deepEqual(state, { status: 'customized', dismissed: true, shouldNotify: false });
  });

  it('storage 抛异常 → 静默按不提示处理', () => {
    const state = readMainPromptMigrationState({
      storage: { getItem() { throw new Error('denied'); } },
      builtIns: BUILT_INS,
    });
    assert.deepEqual(state, { status: 'unset', dismissed: true, shouldNotify: false });
  });
});

describe('dismissMainPromptMigrationNotice', () => {
  it('写入关闭标记，之后读取为 dismissed', () => {
    const storage = fakeStorage({ [MAIN_PROMPT_STORAGE_KEY]: '用户自己写的提示词' });
    dismissMainPromptMigrationNotice(storage);
    const state = readMainPromptMigrationState({ storage, builtIns: BUILT_INS });
    assert.equal(state.dismissed, true);
    assert.equal(state.shouldNotify, false);
  });

  it('写入失败静默忽略', () => {
    assert.doesNotThrow(() =>
      dismissMainPromptMigrationNotice({ setItem() { throw new Error('denied'); } }),
    );
  });
});
