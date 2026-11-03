import { useEffect, useId, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { cn } from '@/components/ui';

const compact = (number, locale) => new Intl.NumberFormat(locale, {
  notation: 'compact', maximumFractionDigits: 1,
}).format(number);

function ContextWindowIndicator({ estimate, capacity, usage, model, onConfigure }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const id = useId();
  const locale = i18n.resolvedLanguage || 'zh';
  const full = (value) => new Intl.NumberFormat(locale).format(value);
  const percent = capacity.tokens ? estimate.tokens / capacity.tokens * 100 : null;
  const percentage = percent == null ? null : new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  }).format(percent);
  const tone = percent >= 100 ? 'text-state-alert' : percent >= 80 ? 'text-sun-700' : 'text-sage-700';

  useEffect(() => {
    if (!open) return undefined;
    const dismiss = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative mt-1.5">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={t('AgentChat.context.accessible', {
          used: full(estimate.tokens), total: capacity.tokens ? full(capacity.tokens) : t('AgentChat.context.unknown'),
        })}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-9 max-w-full flex-wrap items-center gap-x-2 gap-y-0.5 rounded-sm px-2 py-1 text-caption text-ink-500 transition-colors hover:bg-paper-100 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500/30"
      >
        <svg className={cn('shrink-0', tone)} width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="7.5" className="stroke-paper-200" strokeWidth="2" />
          {percent != null && (
            <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="2" pathLength="100"
              strokeDasharray={`${Math.min(percent, 100)} 100`} strokeLinecap="round" transform="rotate(-90 10 10)" />
          )}
        </svg>
        <span>{t('AgentChat.context.label')}</span>
        <span className="tabular-nums text-ink-700">
          ≈ {compact(estimate.tokens, locale)} / {capacity.tokens ? compact(capacity.tokens, locale) : t('AgentChat.context.unset')} tokens
        </span>
        {percentage != null && <span className={cn('tabular-nums', tone)}>· {percentage}%</span>}
      </button>

      {open && (
        <section id={id} aria-label={t('AgentChat.context.details')} className="absolute bottom-full left-0 z-30 mb-2 max-h-[min(32rem,calc(100dvh-10rem))] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-paper-200 bg-paper-50 p-4 shadow-lift">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-small font-semibold text-ink-900">{t('AgentChat.context.details')}</h2>
            <span className="rounded-pill bg-paper-100 px-2 py-0.5 text-caption text-ink-500">{t('AgentChat.context.estimated')}</span>
          </div>
          <p className="mt-1 truncate text-caption text-ink-500" title={model}>{model || t('AgentChat.context.noModel')}</p>
          <p className="mt-3 break-words text-small tabular-nums text-ink-900">
            ≈ {full(estimate.tokens)} / {capacity.tokens ? full(capacity.tokens) : t('AgentChat.context.unset')} tokens
          </p>
          {capacity.tokens && (
            <div role="progressbar" aria-label={t('AgentChat.context.label')} aria-valuemin={0} aria-valuemax={100}
              aria-valuenow={Math.min(100, Math.round(percent))} aria-valuetext={t('AgentChat.context.percent', { percent: percentage })}
              className="mt-2 h-1.5 overflow-hidden rounded-pill bg-paper-200">
              <div className={cn('h-full origin-left bg-current', tone)} style={{ transform: `scaleX(${Math.min(percent, 100) / 100})` }} />
            </div>
          )}
          <dl className="mt-3 space-y-1.5 text-caption text-ink-500">
            {Object.entries(estimate.breakdown).filter(([, value]) => value > 0).map(([key, value]) => (
              <div key={key} className="flex justify-between gap-3">
                <dt>{t(`AgentChat.context.parts.${key}`)}</dt><dd className="tabular-nums">≈ {full(value)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-caption leading-relaxed text-ink-500">{t('AgentChat.context.estimateHint')}</p>
          {usage && (
            <div className="mt-3 border-t border-paper-200 pt-3 text-caption text-ink-700">
              <p className="font-medium">{t('AgentChat.context.lastRequest')}</p>
              <p className="mt-1 tabular-nums">{t('AgentChat.context.measured', { input: full(usage.inputTokens), output: full(usage.outputTokens) })}</p>
            </div>
          )}
          <p className="mt-3 text-caption text-ink-500">{t(`AgentChat.context.capacity.${capacity.source}`)}</p>
          {percent >= 80 && <p className={cn('mt-2 text-caption', tone)}>{t(percent >= 100 ? 'AgentChat.context.overLimit' : 'AgentChat.context.nearLimit')}</p>}
          <button type="button" className="mt-3 rounded-sm text-caption font-medium text-sage-700 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500/30"
            onClick={() => { setOpen(false); onConfigure(); }}>
            {t('AgentChat.context.configure')}
          </button>
        </section>
      )}
    </div>
  );
}

ContextWindowIndicator.propTypes = {
  estimate: PropTypes.shape({ tokens: PropTypes.number.isRequired, breakdown: PropTypes.object.isRequired }).isRequired,
  capacity: PropTypes.shape({ tokens: PropTypes.number, source: PropTypes.oneOf(['configured', 'catalog', 'unknown']).isRequired }).isRequired,
  usage: PropTypes.shape({ inputTokens: PropTypes.number.isRequired, outputTokens: PropTypes.number.isRequired }),
  model: PropTypes.string,
  onConfigure: PropTypes.func.isRequired,
};

export default ContextWindowIndicator;
