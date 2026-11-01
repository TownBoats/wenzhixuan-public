import { useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Route } from 'lucide-react';
import { cn } from '@/components/ui';

const DOT_STYLES = {
  stuck: 'border-sun-700 bg-paper-50',
  misconception: 'border-sun-500 bg-sun-500',
  breakthrough: 'border-sage-700 bg-sage-700',
  verified: 'border-sage-900 bg-sage-900',
  residual: 'border-ink-300 bg-paper-50',
  goal_change: 'border-sage-300 bg-paper-50',
};

const TONE_STYLES = {
  stuck: 'text-sun-700',
  misconception: 'text-sun-700',
  breakthrough: 'text-sage-700',
  verified: 'text-sage-900',
  residual: 'text-ink-500',
  goal_change: 'text-sage-700',
};

function ChainNode({ node, above }) {
  const { t } = useTranslation();
  const label = (
    <div className={cn('w-full px-1.5', above ? 'pb-3' : 'pt-3')}>
      <p className="text-small font-medium leading-snug text-ink-900">{node.topic}</p>
      <p className={cn('mt-0.5 text-caption', TONE_STYLES[node.type] ?? 'text-ink-500')}>
        {t(`AgentChat.review.types.${node.type}`)}
      </p>
      <ul className="mt-1.5 space-y-0.5 text-caption leading-snug text-ink-700">
        {node.points.map((point) => (
          <li key={point} className="flex gap-1">
            <span aria-hidden="true">·</span>
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <li className="flex flex-col items-center">
      <div className="flex h-28 w-full items-end justify-center">{above ? label : null}</div>
      <span
        className={cn(
          'relative z-10 h-2 w-2 shrink-0 rounded-full border-2',
          DOT_STYLES[node.type] ?? 'border-ink-300 bg-paper-50',
        )}
        aria-hidden="true"
      />
      <div className="flex h-28 w-full items-start justify-center">{above ? null : label}</div>
    </li>
  );
}

ChainNode.propTypes = {
  node: PropTypes.shape({
    topic: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
    points: PropTypes.arrayOf(PropTypes.string).isRequired,
  }).isRequired,
  above: PropTypes.bool.isRequired,
};

/** 状态行的文案：只在展开后出现，收起时保持一行淡字。 */
function StatusLine({ state }) {
  const { t } = useTranslation();
  const key =
    state === 'extracting'
      ? 'extracting'
      : state === 'unavailable'
        ? 'unavailable'
        : state === 'failed'
          ? 'failed'
          : 'empty';

  return <p className="mt-4 text-caption text-ink-500">{t(`AgentChat.review.state.${key}`)}</p>;
}

StatusLine.propTypes = {
  state: PropTypes.string.isRequired,
};

export default function LearningChain({ state = 'empty', goal = '', nodes = [], onRequest }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    // 首次展开才请求生成：打开旧会话本身不消耗副模型
    if (next) onRequest?.();
  };

  return (
    <section className="pt-1">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="learning-chain-body"
        className="inline-flex items-center gap-1 rounded-sm text-caption text-ink-500 transition-colors duration-fast hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500"
      >
        <Route size={12} aria-hidden="true" />
        <span>{t('AgentChat.review.title')}</span>
        <ChevronDown
          size={12}
          aria-hidden="true"
          className={cn('transition-transform duration-base ease-soft', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div id="learning-chain-body" className="mt-4">
          {state === 'ready' ? (
            <>
              {goal && <p className="text-caption text-ink-500">{goal}</p>}
              <div className="mt-6 overflow-x-auto pb-1">
                <ol className="relative grid min-w-[34rem] auto-cols-fr grid-flow-col">
                  <span
                    className="absolute inset-x-3 top-1/2 h-px -translate-y-1/2 bg-paper-200"
                    aria-hidden="true"
                  />
                  {nodes.map((node, index) => (
                    <ChainNode key={`${node.type}-${index}`} node={node} above={index % 2 === 1} />
                  ))}
                </ol>
              </div>
            </>
          ) : (
            <StatusLine state={state} />
          )}
        </div>
      )}
    </section>
  );
}

LearningChain.propTypes = {
  state: PropTypes.oneOf(['empty', 'extracting', 'unavailable', 'failed', 'ready']),
  goal: PropTypes.string,
  nodes: PropTypes.arrayOf(
    PropTypes.shape({
      topic: PropTypes.string.isRequired,
      type: PropTypes.string.isRequired,
      points: PropTypes.arrayOf(PropTypes.string).isRequired,
    }),
  ),
  onRequest: PropTypes.func,
};
