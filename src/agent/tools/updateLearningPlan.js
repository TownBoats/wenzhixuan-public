/**
 * `update_learning_plan` 工具：建立或增量更新学习计划，返回最新全量快照，不打断运行。
 *
 * - 先前计划与学生原话由上层传入，不读存储
 * - 每轮一个实例，按 toolCallId 幂等；异常不回传原文
 */
import { jsonSchema, tool } from 'ai';

import { CONCEPT_STATUSES, PLAN_LIMITS, PLAN_TOOL_NAME, mergePlan } from '../learningPlan.js';

export const UPDATE_LEARNING_PLAN_TOOL_NAME = PLAN_TOOL_NAME;

export const REJECT_INVALID_INPUT = 'invalid_input';
export const REJECT_INTERNAL_ERROR = 'internal_error';

export const UPDATE_LEARNING_PLAN_DESCRIPTION =
  '建立或更新这次学习的计划：目标、约定、概念与前置关系、学生掌握情况、当前位置。' +
  '只传变化的部分，程序会合并并返回完整计划。学生能看到计划；调用它不会打断本轮。';

export const UPDATE_LEARNING_PLAN_INPUT_SCHEMA = jsonSchema({
  type: 'object',
  properties: {
    goal: { type: 'string', description: `学习目标，一句话（≤${PLAN_LIMITS.goal} 字），首次必填` },
    conventions: {
      type: 'array',
      items: { type: 'string' },
      description:
        '贯穿全程、之后每道题都要遵守的约定：符号、编号方式、例子的固定参数，例如「数组下标从 1 开始」。' +
        `不要写目标、结论或推导出的规则。传入即整体替换，至多 ${PLAN_LIMITS.conventions} 条、每条 ≤${PLAN_LIMITS.convention} 字`,
    },
    concepts: {
      type: 'array',
      description: '新增或变化的概念；未提及的保持不变',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '短英文标识，之后不变，如 loop_invariant' },
          name: { type: 'string', description: `概念名，≤${PLAN_LIMITS.name} 字；新概念必填` },
          status: {
            type: 'string',
            enum: [...CONCEPT_STATUSES],
            description:
              'unknown 还不知道；gap 学生已暴露出缺口；claimed 学生自称会；verified 学生用自己的话说出了正确的理由或推断',
          },
          requires: { type: 'array', items: { type: 'string' }, description: '前置概念的 id' },
          evidence: {
            type: 'string',
            description: '仅 verified 需要：逐字引用学生自己写的话。点选的候选答案和「懂了」这类自评不算',
          },
        },
        required: ['id'],
        additionalProperties: false,
      },
    },
    removedConceptIds: {
      type: 'array',
      items: { type: 'string' },
      description: '不再需要的概念 id，例如学生换了目标',
    },
    currentConceptId: { type: 'string', description: '正在教的概念 id' },
    nextStep: { type: 'string', description: `接下来要做什么，一句话（≤${PLAN_LIMITS.nextStep} 字）` },
  },
  additionalProperties: false,
});

/**
 * @param {Object} params
 * @param {Object|null} [params.initialPlan] 本轮开始时的计划
 * @param {string[]} [params.studentTexts]   学生手写的原文，用于证据校验
 * @param {(plan: Object) => void} [params.onPlan] 计划更新后的通知（供同轮其他工具使用）
 * @returns {Object} AI SDK 工具对象
 */
export function createUpdateLearningPlanTool({ initialPlan = null, studentTexts = [], onPlan } = {}) {
  const resultsByCallId = new Map();
  let plan = initialPlan;
  let corrected = false;

  /** 证据不合格的通知；同一轮只提示更正一次，避免模型反复尝试耗尽步数。 */
  function downgradeNotice(downgraded) {
    const detail = downgraded.map(({ id, reason }) => `${id}（${reason}）`).join('、');
    const advice = corrected
      ? '本轮不要再重试，继续教学。'
      : '如果学生手写过正确理由，只是引用有误，请逐字引用后再更新一次；没有手写过就不要重试，请他用自己的话说明理由。';
    corrected = true;
    return `以下概念的证据不合格，已记为 claimed：${detail}。${advice}`;
  }

  async function execute(input, options = {}) {
    const { toolCallId } = options || {};
    if (toolCallId && resultsByCallId.has(toolCallId)) return resultsByCallId.get(toolCallId);

    let result;
    try {
      const merged = mergePlan(plan, input, studentTexts);
      if (merged.ok) {
        plan = merged.plan;
        onPlan?.(plan);
        result = {
          status: 'ready',
          plan,
          ...(merged.downgraded.length > 0
            ? { notice: downgradeNotice(merged.downgraded) }
            : {}),
        };
      } else {
        result = { status: 'rejected', reason: REJECT_INVALID_INPUT, message: merged.message };
      }
    } catch {
      result = {
        status: 'rejected',
        reason: REJECT_INTERNAL_ERROR,
        message: '工具内部错误，请继续教学',
      };
    }
    if (toolCallId) resultsByCallId.set(toolCallId, result);
    return result;
  }

  return tool({
    description: UPDATE_LEARNING_PLAN_DESCRIPTION,
    inputSchema: UPDATE_LEARNING_PLAN_INPUT_SCHEMA,
    execute,
  });
}

export default createUpdateLearningPlanTool;
