import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  levelSelectToSubmission,
  toAnswerCardModel,
  toQuestionCardModel,
} from '../../pages/AgentChatPage/questionAdapter.js';

describe('toQuestionCardModel', () => {
  it('待答 + 候选就绪：可点击、显示已完成、已取到候选答案', () => {
    const model = toQuestionCardModel({
      id: 'q_1',
      text: '什么是闭包？',
      optionsStatus: 'ready',
      state: 'pending',
    });
    assert.equal(model.id, 'q_1');
    assert.equal(model.question, '什么是闭包？');
    assert.equal(model.status, 'completed');
    assert.equal(model.isAnswered, false);
    assert.equal(model.isProcessing, false);
    assert.equal(model.hasFetchedAnswer, true);
  });

  // D8 修复回归：候选不可用时原来给 'responding'，运行结束后标签会永远转「AI 回答中...」；
  // D-6 起改用专用状态 'unavailable' → 标签「可以点击回答」，不再谎称「AI 回答完毕！」
  it('待答 + 候选不可用：专用状态、可点击作答、不显示为错误', () => {
    const model = toQuestionCardModel({ id: 'q_2', text: 't', optionsStatus: 'unavailable', state: 'pending' });
    assert.equal(model.status, 'unavailable');
    assert.equal(model.isAnswered, false);
    assert.equal(model.hasFetchedAnswer, false);
  });

  it('已答 / 已跳过都算已处理', () => {
    for (const state of ['answered', 'skipped']) {
      const model = toQuestionCardModel({ id: 'q_3', text: 't', optionsStatus: 'ready', state });
      assert.equal(model.isAnswered, true);
      assert.equal(model.status, 'completed');
    }
  });

  it('非法输入返回 null', () => {
    assert.equal(toQuestionCardModel(null), null);
    assert.equal(toQuestionCardModel('x'), null);
  });
});

describe('toAnswerCardModel', () => {
  it('options 数组转为 ContentParser 形状（按档位为键、每档是带 content 的数组）', () => {
    const model = toAnswerCardModel({
      id: 'q_1',
      text: '问题',
      options: [
        { level: 'basic', text: '大概懂' },
        { level: 'expert', text: '能讲清' },
      ],
    });
    assert.deepEqual(model.answer, {
      basic: [{ content: '大概懂' }],
      expert: [{ content: '能讲清' }],
    });
    assert.equal(model.question, '问题');
  });

  it('缺档只保留实际存在的档位（B-10：不得硬编码 5 行）', () => {
    const model = toAnswerCardModel({ id: 'q_1', text: 't', options: [{ level: 'heard', text: '听过' }] });
    assert.deepEqual(Object.keys(model.answer), ['heard']);
  });

  it('同档只留首条；无 options 得空对象', () => {
    const model = toAnswerCardModel({
      id: 'q_1',
      text: 't',
      options: [
        { level: 'basic', text: '首条' },
        { level: 'basic', text: '重复' },
      ],
    });
    assert.equal(model.answer.basic[0].content, '首条');
    assert.equal(model.answer.basic.length, 1);
    assert.deepEqual(toAnswerCardModel({ id: 'q', text: 't' }).answer, {});
  });

  // D8 修复回归：空 answer + 声明「已结束」→ 旧组件才会把自定义输入框放出来
  it('始终声明 answerSettled，空候选答案时也要能自定义作答', () => {
    for (const options of [[], undefined]) {
      const model = toAnswerCardModel({ id: 'q_1', text: 't', options });
      assert.deepEqual(model.answer, {});
      assert.equal(model.answerSettled, true);
    }
    assert.equal(
      toAnswerCardModel({ id: 'q_2', text: 't', options: [{ level: 'basic', text: '懂' }] }).answerSettled,
      true,
    );
  });
});

describe('levelSelectToSubmission', () => {
  it('自定义输入路径不带 selectedLevel', () => {
    assert.deepEqual(levelSelectToSubmission('q_1', 'custom', '我自己的回答'), {
      questionId: 'q_1',
      answer: '我自己的回答',
    });
  });

  it('选项作答路径带 selectedLevel', () => {
    assert.deepEqual(levelSelectToSubmission('q_1', 'familiar', '档位文本'), {
      questionId: 'q_1',
      answer: '档位文本',
      selectedLevel: 'familiar',
    });
  });
});
