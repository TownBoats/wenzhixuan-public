import { useContext } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Icon, cn } from '@/components/ui';
import { refFromHref } from '../../agent/references.js';
import { ReferenceContext } from './referenceContext';

function labelOf(target, t) {
  return target.kind === 'figure'
    ? t('AgentChat.references.figure', { number: target.number, title: target.title })
    : t('AgentChat.references.concept', { title: target.title });
}

/** 正文里的引用：有效时是页内跳转按钮，失效时是普通文字。 */
export function ReferenceLink({ href, children }) {
  const { t } = useTranslation();
  const { references, jump } = useContext(ReferenceContext);
  const target = references.get(refFromHref(href));
  if (!target || !jump) return <span>{children}</span>;
  return (
    <button
      type="button"
      title={t('AgentChat.references.jump', { name: labelOf(target, t) })}
      onClick={(event) => {
        event.stopPropagation();
        jump(target, event.currentTarget);
      }}
      className="inline text-left font-medium text-sage-700 underline decoration-sage-300 decoration-dotted underline-offset-2 hover:text-sage-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500/30"
    >
      {children}
    </button>
  );
}

ReferenceLink.propTypes = { href: PropTypes.string, children: PropTypes.node };

/** 题目引用的图与讲解入口；失效的引用不显示。 */
export function ReferenceChips({ refs, className }) {
  const { t } = useTranslation();
  const { references, jump } = useContext(ReferenceContext);
  const targets = (Array.isArray(refs) ? refs : []).map((ref) => references.get(ref)).filter(Boolean);
  if (targets.length === 0 || !jump) return null;
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {targets.map((target) => {
        const label = labelOf(target, t);
        return (
          <button
            key={target.ref}
            type="button"
            title={t('AgentChat.references.jump', { name: label })}
            onClick={(event) => {
              event.stopPropagation();
              jump(target, event.currentTarget);
            }}
            className="inline-flex max-w-full items-center gap-1 rounded-pill border border-sage-300/50 bg-white px-2 py-0.5 text-caption text-sage-700 transition-colors duration-fast hover:bg-sage-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500/30"
          >
            <Icon name={target.kind === 'figure' ? 'Image' : 'BookOpen'} size={12} className="text-current" />
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

ReferenceChips.propTypes = { refs: PropTypes.arrayOf(PropTypes.string), className: PropTypes.string };
