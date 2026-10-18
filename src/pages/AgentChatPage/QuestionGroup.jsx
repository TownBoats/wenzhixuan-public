import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import QuestionCard from '../../components/QuestionCard/QuestionCard';
import { toQuestionCardModel } from './questionAdapter';

/**
 * QuestionGroup — 本轮问题卡组（D4）
 *
 * 渲染一轮的全部问题（按模型调用顺序，协议 §5）：卡片数＝问题数。
 * 小卡沿用旧 QuestionCard 的交互：点击打开答案卡（只对待答问题开放），
 * ✕ 按钮语义为「跳过此题」（经 `cancelLabel` 提示，映射到 skipQuestion）。
 * `optionsStatus === 'unavailable'` 的提示放在答案卡区域（AgentChatPage），
 * 小卡上不标错误——问题仍可手动作答（D-1 决策 3 的口径）。
 */
function QuestionGroup({ questions, onOpen, onSkip }) {
  const { t } = useTranslation();
  if (!Array.isArray(questions) || questions.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-small text-ink-500">
        {t('AgentChat.questionGroup.title', { count: questions.length })}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {questions.map((question) => {
          const model = toQuestionCardModel(question);
          if (!model) return null;
          return (
            <QuestionCard
              key={question.id}
              question={model}
              cancelLabel={t('AgentChat.questionGroup.skip')}
              onClick={() => {
                if (question.state === 'pending') onOpen(question.id);
              }}
              onCancel={() => onSkip(question.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

QuestionGroup.propTypes = {
  questions: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      text: PropTypes.string,
      optionsStatus: PropTypes.string,
      state: PropTypes.string,
    }),
  ),
  onOpen: PropTypes.func.isRequired,
  onSkip: PropTypes.func.isRequired,
};

export default QuestionGroup;
