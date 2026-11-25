import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Button, Icon, cn } from '@/components/ui';

/**
 * DebugDrawer：调试抽屉，查看主模型与候选答案模型收到的上下文。
 *
 * 只读展示调试记录，内容一律按纯文本渲染；不改会话、不发请求。
 */

const asText = (value) => (typeof value === 'string' ? value : JSON.stringify(value ?? null, null, 2));

function CopyButton({ text }) {
  const { t } = useTranslation();
  const [state, setState] = useState('idle');
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      setState('failed');
    }
    setTimeout(() => setState('idle'), 1600);
  };
  return (
    <Button intent="ghost" size="sm" onClick={handleCopy}>
      <Icon name={state === 'copied' ? 'Check' : 'Copy'} size={12} className="text-current" />
      {t(`AgentChat.debug.copy.${state}`)}
    </Button>
  );
}

CopyButton.propTypes = { text: PropTypes.string.isRequired };

/** 一段可折叠的原文；展开后才渲染内容，长历史不拖慢抽屉。 */
function Section({ title, value, defaultOpen = false }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);
  const text = asText(value);
  return (
    <div className="border-t border-paper-200/70">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="flex min-w-0 flex-1 items-center gap-1.5 py-2 text-left text-small text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500/30"
        >
          <Icon
            name="ChevronRight"
            size={14}
            className={cn('shrink-0 text-ink-300 transition-transform duration-fast', open && 'rotate-90')}
          />
          <span className="truncate font-medium">{title}</span>
          <span className="shrink-0 font-mono text-caption text-ink-500">
            {t('AgentChat.debug.chars', { count: [...text].length })}
          </span>
        </button>
        <CopyButton text={text} />
      </div>
      {open && (
        <pre className="mb-2 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-sm bg-paper-100 p-2 font-mono text-caption leading-relaxed text-ink-900">
          {text || t('AgentChat.debug.empty')}
        </pre>
      )}
    </div>
  );
}

Section.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.any,
  defaultOpen: PropTypes.bool,
};

function Record({ record }) {
  const { t } = useTranslation();
  const isOption = record.kind === 'option';
  const meta = [
    new Date(record.at).toLocaleTimeString(),
    record.model,
    record.status && t(`AgentChat.debug.status.${record.status}`),
    record.errorCode,
    Number.isFinite(record.durationMs) && `${(record.durationMs / 1000).toFixed(1)}s`,
  ].filter(Boolean);

  return (
    <article className="rounded-md border border-paper-200 bg-white px-3 pt-2.5">
      <div className="mb-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'rounded-pill px-2 py-0.5 text-caption font-medium',
              isOption ? 'bg-sage-50 text-sage-700' : 'bg-paper-200 text-ink-700',
            )}
          >
            {t(isOption ? 'AgentChat.debug.option' : 'AgentChat.debug.main')}
          </span>
          {isOption && (
            <span
              className={cn(
                'rounded-pill px-2 py-0.5 text-caption',
                record.source === 'fallback' ? 'bg-sun-300/40 text-sun-700' : 'bg-paper-100 text-ink-500',
              )}
            >
              {t(`AgentChat.debug.source.${record.source}`)}
            </span>
          )}
        </div>
        {record.question && (
          <p className="mt-1.5 break-words text-small font-medium text-ink-900">{record.question}</p>
        )}
        <p className="mt-1 break-words font-mono text-caption text-ink-500">{meta.join(' · ')}</p>
      </div>

      {isOption ? (
        <>
          <Section title={t('AgentChat.debug.modelContext')} value={record.modelContext ?? ''} defaultOpen />
          <Section title={t('AgentChat.debug.prompt')} value={record.prompt ?? ''} />
          <Section title={t('AgentChat.debug.system')} value={record.system ?? ''} />
          {record.options && <Section title={t('AgentChat.debug.options')} value={record.options} />}
        </>
      ) : (
        <>
          <Section title={t('AgentChat.debug.messages')} value={record.messages} />
          <Section title={t('AgentChat.debug.system')} value={record.system ?? ''} />
          <Section title={t('AgentChat.debug.tools')} value={(record.tools ?? []).join('\n')} />
        </>
      )}
    </article>
  );
}

Record.propTypes = { record: PropTypes.object.isRequired };

function DebugDrawer({ open, records, onClose, onClear }) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex justify-end">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-ink-900/20" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t('AgentChat.debug.title')}
        className="relative flex h-full w-full max-w-2xl flex-col bg-paper-50 shadow-lift"
      >
        <header className="flex items-center justify-between gap-2 border-b border-paper-200 px-4 py-3">
          <h2 className="truncate text-h2 font-semibold text-ink-900">{t('AgentChat.debug.title')}</h2>
          <div className="flex shrink-0 items-center gap-1">
            <Button intent="ghost" size="sm" onClick={onClear} disabled={records.length === 0}>
              {t('AgentChat.debug.clear')}
            </Button>
            <Button intent="ghost" size="sm" iconOnly onClick={onClose} aria-label={t('AgentChat.debug.close')}>
              <Icon name="X" size={16} />
            </Button>
          </div>
        </header>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 scrollbar-custom">
          <p className="text-caption leading-relaxed text-ink-500">{t('AgentChat.debug.hint')}</p>
          {records.length === 0 && (
            <p className="py-8 text-center text-small text-ink-500">{t('AgentChat.debug.noRecords')}</p>
          )}
          {[...records].reverse().map((record) => (
            <Record key={record.id} record={record} />
          ))}
        </div>
      </aside>
    </div>
  );
}

DebugDrawer.propTypes = {
  open: PropTypes.bool.isRequired,
  records: PropTypes.arrayOf(PropTypes.object).isRequired,
  onClose: PropTypes.func.isRequired,
  onClear: PropTypes.func.isRequired,
};

export default DebugDrawer;
