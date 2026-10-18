/**
 * D4 适配层：新协议 question → 旧组件 props（纯函数，无副作用）
 *
 * 新协议（`conversationState.js` / `projectTurns` 投影）：
 *   { id, toolCallId, text, options: [{level,text}], optionsStatus, answer, selectedLevel, state }
 *
 * 旧组件（QuestionCard / AnswerCard）吃的是另一套字段名与结构，
 * 这里做一次性翻译，旧组件一行不改（`cancelLabel` 是新增的可选 prop，默认行为不变）。
 */

/** 新 question → QuestionCard 的 `question` prop。 */
export function toQuestionCardModel(question) {
  if (!question || typeof question !== 'object') return null;
  const isPending = question.state === 'pending';
  return {
    id: question.id,
    question: question.text ?? '',
    // 旧组件的 status 只驱动状态标签；`responding` 只应表示「还在生成」，而问题卡的
    // 候选答案在该问题进入待答时就已经定型——D8 修复前这里给 `responding`，会让
    // 已结束的这一轮永远转「AI 回答中...」。
    // 候选答案不可用时给专用状态 `unavailable`：标签显示「可以点击回答」，
    // 既不是「AI 回答完毕！」（假陈述）也不打警告色（D-6，细化 D-1 决策 3）。
    status: question.optionsStatus === 'unavailable' ? 'unavailable' : 'completed',
    isAnswered: !isPending,
    isProcessing: false,
    hasFetchedAnswer: question.optionsStatus === 'ready',
  };
}

/**
 * 新 question → AnswerCard 的 `question` prop。
 * 旧 AnswerCard 吃的 `answer` 是 ContentParser 的形状——按档位为键、
 * 每档是数组、元素带 `.content`（`AnswerCard.jsx:156-161,281-290` 依赖
 * `Array.isArray` 与 `answerArray[0].content`，给字符串会导致档位行全部不渲染）。
 */
export function toAnswerCardModel(question) {
  if (!question || typeof question !== 'object') return null;
  const answer = {};
  for (const option of Array.isArray(question.options) ? question.options : []) {
    if (option && typeof option.level === 'string' && !(option.level in answer)) {
      answer[option.level] = [{ content: option.text ?? '' }];
    }
  }
  return {
    id: question.id,
    question: question.text ?? '',
    answer,
    // D8 修复：候选答案为空（副模型失败/未配置）时 `answer` 是 `{}`，旧组件把空对象
    // 判成「还在等」而不渲染自定义输入框，学生只能跳过此题。问题卡只在待答状态下
    // 打开，此时候选答案已定型，因此显式声明「这一轮已结束」（旧路径不传此 prop）。
    answerSettled: true,
  };
}

/**
 * AnswerCard 的 `onLevelSelect(level, content)` → `submitAnswer` 的参数。
 * `level === 'custom'` 是自定义输入路径，不带 selectedLevel（协议 §5）。
 */
export function levelSelectToSubmission(questionId, level, content) {
  if (level === 'custom') {
    return { questionId, answer: content };
  }
  return { questionId, answer: content, selectedLevel: level };
}
