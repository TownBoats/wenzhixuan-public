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
  const approx = estimate.source === 'measured' ? '' : '≈ ';
  // Quiet by default; only turns warm/alert when the window is actually filling up.
  const tone = percent >= 100 ? 'text-state-alert' : percent >= 80 ? 'text-sun-700' : 'text-sage-500';
  const panelTone = percent >= 100 ? 'text-state-alert' : percent >= 80 ? 'text-sun-700' : 'text-sage-700';
  const shortValue = percentage != null ? `${percentage}%` : `${approx}${compact(estimate.tokens, locale)}`;

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
    <div ref={containerRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={t(`AgentChat.context.accessible.${estimate.source}`, {
          used: full(estimate.tokens), total: capacity.tokens ? full(capacity.tokens) : t('AgentChat.context.unknown'),
        })}
        title={t('AgentChat.context.details')}
        onClick={() => setOpen((value) => !value)}
        className="flex h-9 items-center gap-1 rounded-sm px-1.5 text-caption text-ink-500 transition-colors hover:bg-paper-100 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500/30"
      >
        <svg className={cn('shrink-0', tone)} width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="7.5" className="stroke-paper-200" strokeWidth="2.5" />
          {percent != null && (
            <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="2.5" pathLength="100"
              strokeDasharray={`${Math.min(percent, 100)} 100`} strokeLinecap="round" transform="rotate(-90 10 10)" />
          )}
        </svg>
        <span className={cn('hidden tabular-nums sm:inline', percent >= 80 && tone)}>{shortValue}</span>
      </button>

      {open && (
        <section id={id} aria-label={t('AgentChat.context.details')} className="absolute bottom-full right-0 z-30 mb-3 max-h-[min(28rem,calc(100dvh-10rem))] w-[min(18rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-paper-200 bg-paper-50 p-3.5 shadow-lift">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-small font-semibold text-ink-900">{t('AgentChat.context.details')}</h2>
            <span className="cursor-help rounded-pill bg-paper-100 px-2 py-0.5 text-caption text-ink-500" title={t(`AgentChat.context.hint.${estimate.source}`)}>
              {t(`AgentChat.context.source.${estimate.source}`)}
            </span>
          </div>
          <p className="mt-2 break-words text-small tabular-nums text-ink-900">
            {approx}{full(estimate.tokens)} / {capacity.tokens ? full(capacity.tokens) : t('AgentChat.context.unset')}
            {percentage != null && <span className={cn('ml-1.5', panelTone)}>{percentage}%</span>}
          </p>
          {capacity.tokens && (
            <div role="progressbar" aria-label={t('AgentChat.context.label')} aria-valuemin={0} aria-valuemax={100}
              aria-valuenow={Math.min(100, Math.round(percent))} aria-valuetext={t('AgentChat.context.percent', { percent: percentage })}
              className="mt-2 h-1 overflow-hidden rounded-pill bg-paper-200">
              <div className={cn('h-full origin-left bg-current', panelTone)} style={{ transform: `scaleX(${Math.min(percent, 100) / 100})` }} />
            </div>
          )}
          <dl className="mt-3 space-y-1 text-caption text-ink-500">
            {Object.entries(estimate.breakdown).filter(([, value]) => value > 0).map(([key, value]) => (
              <div key={key} className="flex justify-between gap-3">
                <dt>{t(`AgentChat.context.parts.${key}`)}</dt><dd className="tabular-nums">{key === 'measured' ? '' : '≈ '}{full(value)}</dd>
              </div>
            ))}
          </dl>
          {usage && (
            <p className="mt-3 border-t border-paper-200 pt-2.5 text-caption tabular-nums text-ink-500">
              {t('AgentChat.context.measured', { input: full(usage.inputTokens), output: full(usage.outputTokens) })}
              {usage.reasoningTokens > 0 && <> · {t('AgentChat.context.reasoning', { reasoning: full(usage.reasoningTokens) })}</>}
            </p>
          )}
          {percent >= 80 && <p className={cn('mt-2 text-caption', panelTone)}>{t(percent >= 100 ? 'AgentChat.context.overLimit' : 'AgentChat.context.nearLimit')}</p>}
          <div className="mt-3 flex items-center justify-between gap-3 text-caption">
            <span className="truncate text-ink-500" title={`${model || ''} · ${t(`AgentChat.context.capacity.${capacity.source}`)}`}>
              {model || t('AgentChat.context.noModel')}
            </span>
            <button type="button" className="shrink-0 rounded-sm font-medium text-sage-700 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500/30"
              onClick={() => { setOpen(false); onConfigure(); }}>
              {t('AgentChat.context.configure')}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

ContextWindowIndicator.propTypes = {
  estimate: PropTypes.shape({
    source: PropTypes.oneOf(['measured', 'mixed', 'estimated']).isRequired,
    tokens: PropTypes.number.isRequired,
    breakdown: PropTypes.object.isRequired,
  }).isRequired,
  capacity: PropTypes.shape({ tokens: PropTypes.number, source: PropTypes.oneOf(['configured', 'catalog', 'unknown']).isRequired }).isRequired,
  usage: PropTypes.shape({
    inputTokens: PropTypes.number.isRequired,
    outputTokens: PropTypes.number.isRequired,
    reasoningTokens: PropTypes.number,
  }),
  model: PropTypes.string,
  onConfigure: PropTypes.func.isRequired,
};

export default ContextWindowIndicator;
