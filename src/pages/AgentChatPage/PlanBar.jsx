import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Button, Icon, Textarea, cn } from '@/components/ui';

/**
 * PlanBar：页头下的学习计划常驻行，点击展开浮层查看全部概念并提出调整。
 *
 * 没有计划时不显示；浮层覆盖正文，不推动布局。只展示投影并调用页面回调。
 */

const STATUS_META = {
  unknown: { icon: 'Circle', className: 'text-ink-300' },
  gap: { icon: 'CircleAlert', className: 'text-sun-700' },
  claimed: { icon: 'CircleDashed', className: 'text-sage-500' },
  verified: { icon: 'CircleCheck', className: 'text-sage-700' },
};

const REQUEST_MAX_LENGTH = 500;

function ConceptRow({ concept, names, isCurrent }) {
  const { t } = useTranslation();
  const meta = STATUS_META[concept.status] ?? STATUS_META.unknown;
  return (
    <li className={cn('rounded-sm px-2 py-1.5', isCurrent && 'bg-sage-50')} aria-current={isCurrent ? 'step' : undefined}>
      <div className="flex items-start gap-2">
        <Icon name={meta.icon} size={14} className={cn('mt-0.5 shrink-0', meta.className)} />
        <span className="min-w-0 flex-1 break-words text-small text-ink-900">{concept.name}</span>
        <span className="shrink-0 text-caption text-ink-500">{t(`AgentChat.plan.status.${concept.status}`)}</span>
      </div>
      {concept.requires.length > 0 && (
        <p className="ml-6 mt-0.5 break-words text-caption text-ink-500">
          {t('AgentChat.plan.requires', { names: concept.requires.map((id) => names.get(id) ?? id).join('、') })}
        </p>
      )}
      {concept.evidence && (
        <p className="ml-6 mt-0.5 break-words text-caption text-ink-500">
          {t('AgentChat.plan.evidence', { text: concept.evidence })}
        </p>
      )}
    </li>
  );
}

ConceptRow.propTypes = {
  concept: PropTypes.object.isRequired,
  names: PropTypes.instanceOf(Map).isRequired,
  isCurrent: PropTypes.bool.isRequired,
};

function PlanBar({ plan, running, onRequestChange }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState('');
  const rootRef = useRef(null);
  const toggleRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [open]);

  if (!plan) return null;

  const names = new Map(plan.concepts.map((item) => [item.id, item.name]));
  const verified = plan.concepts.filter((item) => item.status === 'verified').length;
  const currentName = names.get(plan.currentConceptId);

  const submit = (event) => {
    event.preventDefault();
    const text = request.trim();
    if (!text || running) return;
    setRequest('');
    setOpen(false);
    onRequestChange(text);
  };

  return (
    <div ref={rootRef} className="relative border-y border-paper-200/60 bg-paper-50">
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls="learning-plan-panel"
        aria-label={t('AgentChat.plan.toggle')}
        onClick={() => setOpen((value) => !value)}
        className="mx-auto flex w-full max-w-3xl items-center gap-2 px-4 py-1.5 text-left text-caption text-ink-700 transition-colors duration-fast hover:bg-paper-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sage-500/30 sm:px-6"
      >
        <Icon name="Map" size={14} className="shrink-0 text-sage-700" />
        <span className="hidden min-w-0 flex-1 truncate sm:block">{plan.goal}</span>
        {currentName && (
          <span className="min-w-0 flex-1 truncate font-medium text-ink-900 sm:max-w-[40%] sm:flex-none">
            {t('AgentChat.plan.current', { name: currentName })}
          </span>
        )}
        {!currentName && <span className="min-w-0 flex-1 truncate sm:hidden">{plan.goal}</span>}
        <span className="shrink-0 tabular-nums text-ink-500">
          {t('AgentChat.plan.progress', { done: verified, total: plan.concepts.length })}
        </span>
        <Icon
          name="ChevronDown"
          size={14}
          className={cn('shrink-0 text-ink-300 transition-transform duration-fast', open && 'rotate-180')}
        />
      </button>

      {open && (
        <section
          id="learning-plan-panel"
          aria-label={t('AgentChat.plan.title')}
          className="absolute inset-x-0 top-full z-30 mx-auto max-h-[70vh] w-full max-w-3xl overflow-y-auto border border-t-0 border-paper-200 bg-white px-4 py-3 shadow-lift scrollbar-custom sm:rounded-b-lg sm:px-6"
        >
          <p className="break-words text-small font-semibold text-ink-900">{plan.goal}</p>
          {plan.nextStep && (
            <p className="mt-1 break-words text-caption text-ink-500">
              {t('AgentChat.plan.nextStep', { text: plan.nextStep })}
            </p>
          )}

          {plan.conventions.length > 0 && (
            <div className="mt-3">
              <h3 className="text-caption font-semibold text-ink-700">{t('AgentChat.plan.conventions')}</h3>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-small text-ink-700 marker:text-sage-300">
                {plan.conventions.map((item) => (
                  <li key={item} className="break-words">{item}</li>
                ))}
              </ul>
            </div>
          )}

          <h3 className="mt-3 text-caption font-semibold text-ink-700">{t('AgentChat.plan.concepts')}</h3>
          <ul className="mt-1 space-y-0.5">
            {plan.concepts.map((concept) => (
              <ConceptRow
                key={concept.id}
                concept={concept}
                names={names}
                isCurrent={concept.id === plan.currentConceptId}
              />
            ))}
          </ul>
          {plan.concepts.some((item) => item.status === 'claimed') && (
            <p className="mt-1 px-2 text-caption text-ink-500">{t('AgentChat.plan.claimedHint')}</p>
          )}

          <form onSubmit={submit} className="mt-3 border-t border-paper-200/70 pt-3">
            <label htmlFor="plan-request" className="text-caption font-semibold text-ink-700">
              {t('AgentChat.plan.adjustLabel')}
            </label>
            <Textarea
              id="plan-request"
              rows={2}
              maxLength={REQUEST_MAX_LENGTH}
              value={request}
              onChange={(event) => setRequest(event.target.value)}
              placeholder={t('AgentChat.plan.adjustPlaceholder')}
              className="mt-1"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-caption text-ink-500">
                {t(running ? 'AgentChat.plan.adjustRunning' : 'AgentChat.plan.adjustHint')}
              </span>
              <Button type="submit" intent="primary" size="sm" disabled={running || !request.trim()}>
                {t('AgentChat.plan.adjustSubmit')}
              </Button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}

PlanBar.propTypes = {
  plan: PropTypes.object,
  running: PropTypes.bool.isRequired,
  onRequestChange: PropTypes.func.isRequired,
};

export default PlanBar;
