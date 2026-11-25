import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Icon, cn } from '@/components/ui';

/**
 * HistoryDrawer：会话历史抽屉，支持打开、重命名、二次确认删除和导出。
 *
 * - 列表由 `historyStore.listForSidebar()` 合并新旧键后给出，界面不区分新旧
 * - 只展示并调用页面回调，不读存储、不改会话状态
 * - 运行中禁用「打开」与「删除当前会话」：打开会中止运行并丢失未落盘内容
 */

/** 时间：今天只显示时分，今年显示月日，更早显示年月日；格式化失败退回 ISO 日期。 */
function formatTimestamp(timestamp, language) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const sameYear = date.getFullYear() === now.getFullYear();

  const options = sameDay
    ? { hour: '2-digit', minute: '2-digit' }
    : sameYear
      ? { month: '2-digit', day: '2-digit' }
      : { year: 'numeric', month: '2-digit', day: '2-digit' };

  try {
    return new Intl.DateTimeFormat(language || undefined, options).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function HistoryDrawer({
  open,
  items,
  currentId,
  errorText,
  running = false,
  onClose,
  onOpen,
  onRename,
  onDelete,
  onExport,
  onDismissError,
}) {
  const { t, i18n } = useTranslation();
  const [editingId, setEditingId] = useState(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [confirmingId, setConfirmingId] = useState(null);
  const [exportNotice, setExportNotice] = useState(null);

  // Esc 关闭；编辑中先退出编辑，避免一次按键连丢两层状态
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (editingId) {
        setEditingId(null);
        setDraftTitle('');
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, editingId, onClose]);

  // 关闭时清掉临时状态，下次打开是干净的
  useEffect(() => {
    if (!open) {
      setEditingId(null);
      setDraftTitle('');
      setConfirmingId(null);
      setExportNotice(null);
    }
  }, [open]);

  // 「确认删除」3 秒后自动退回普通状态
  useEffect(() => {
    if (!confirmingId) return undefined;
    const timer = setTimeout(() => setConfirmingId(null), 3000);
    return () => clearTimeout(timer);
  }, [confirmingId]);

  if (!open) return null;

  const startEdit = (item) => {
    setEditingId(item.id);
    setDraftTitle(item.title ?? '');
    setConfirmingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftTitle('');
  };

  const commitEdit = () => {
    if (!editingId) return;
    const targetId = editingId;
    setEditingId(null);
    setDraftTitle('');
    onRename(targetId, draftTitle);
  };

  return (
    <div className="fixed inset-0 z-[70] flex justify-end">
      {/* 遮罩：点击关闭（纯视觉层，不参与键盘焦点） */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-ink-900/20"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t('AgentChat.history.title')}
        className="relative flex h-full w-full max-w-[320px] flex-col border-l border-paper-200 bg-paper-50 shadow-lift"
      >
        <header className="flex items-center justify-between border-b border-paper-200 px-4 py-3">
          <span className="text-small text-ink-700">{t('AgentChat.history.title')}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('AgentChat.history.close')}
            className="rounded-sm p-1 text-ink-500 transition-colors duration-fast hover:bg-paper-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500/20"
          >
            <Icon name="X" size={16} />
          </button>
        </header>

        {errorText && (
          <div className="flex items-start justify-between gap-2 border-b border-paper-200 bg-sun-300/15 px-4 py-2 text-small text-ink-700">
            <span>{errorText}</span>
            <button
              type="button"
              onClick={onDismissError}
              aria-label={t('AgentChat.page.dismissHint')}
              className="shrink-0 rounded-sm p-1 text-ink-500 transition-colors duration-fast hover:bg-paper-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500/20"
            >
              <Icon name="X" size={14} />
            </button>
          </div>
        )}

        {running && (
          <p className="border-b border-paper-200 bg-sun-300/15 px-4 py-2 text-small text-ink-700">
            {t('AgentChat.history.runningHint')}
          </p>
        )}

        <p className="border-b border-paper-200 px-4 py-2 text-caption leading-relaxed text-ink-500">
          {t('AgentChat.history.exportHint')}
        </p>
        {exportNotice && (
          <p role={exportNotice.error ? 'alert' : 'status'} className={cn(
            'border-b border-paper-200 px-4 py-2 text-small leading-relaxed',
            exportNotice.error ? 'text-state-alert' : 'text-sage-700',
          )}>{exportNotice.text}</p>
        )}

        <div className="flex-1 overflow-y-auto p-2">
          {items.length === 0 ? (
            <p className="p-3 text-small text-ink-500">{t('AgentChat.history.empty')}</p>
          ) : (
            <ul className="space-y-1">
              {items.map((item) => {
                const isCurrent = item.id === currentId;
                const isEditing = editingId === item.id;
                const isConfirming = confirmingId === item.id;

                return (
                  <li
                    key={item.id}
                    className={cn(
                      'rounded-sm px-2 py-2 transition-colors duration-fast',
                      isCurrent ? 'bg-sage-50 ring-1 ring-inset ring-sage-500/30' : 'hover:bg-paper-100',
                    )}
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input
                          autoFocus
                          value={draftTitle}
                          onChange={(event) => setDraftTitle(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              commitEdit();
                            }
                            if (event.key === 'Escape') {
                              event.preventDefault();
                              event.stopPropagation();
                              cancelEdit();
                            }
                          }}
                          aria-label={t('AgentChat.history.rename')}
                          className="min-w-0 flex-1 rounded-sm border border-paper-200 bg-paper-50 px-2 py-1 font-sans text-small text-ink-900 outline-none focus:border-sage-500 focus:ring-2 focus:ring-sage-500/20"
                        />
                        <button
                          type="button"
                          onClick={commitEdit}
                          aria-label={t('AgentChat.history.saveRename')}
                          title={t('AgentChat.history.saveRename')}
                          className="rounded-sm p-1 text-sage-700 transition-colors duration-fast hover:bg-paper-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500/20"
                        >
                          <Icon name="Check" size={14} className="text-sage-700" />
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          aria-label={t('AgentChat.history.cancelRename')}
                          title={t('AgentChat.history.cancelRename')}
                          className="rounded-sm p-1 text-ink-500 transition-colors duration-fast hover:bg-paper-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500/20"
                        >
                          <Icon name="X" size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-start gap-1">
                        <button
                          type="button"
                          onClick={() => onOpen(item.id)}
                          disabled={running}
                          title={running ? t('AgentChat.history.runningHint') : undefined}
                          className={cn(
                            'flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500/20',
                            running && 'cursor-not-allowed opacity-60',
                          )}
                        >
                          <span
                            className={cn(
                              'w-full truncate text-small',
                              isCurrent ? 'font-medium text-ink-900' : 'text-ink-700',
                            )}
                          >
                            {item.title || t('AgentChat.history.untitled')}
                          </span>
                          <span className="text-caption tabular-nums text-ink-500">
                            {formatTimestamp(item.timestamp, i18n.language)}
                          </span>
                        </button>

                        <button
                          type="button"
                          disabled={running && isCurrent}
                          onClick={() => {
                            setConfirmingId(null);
                            const result = onExport(item.id);
                            const reason = result.reason;
                            setExportNotice(result.ok
                              ? { text: t('AgentChat.history.exported', { title: item.title || t('AgentChat.history.untitled') }) }
                              : { error: true, text: t(reason === 'not_found'
                                ? 'AgentChat.history.exportNotFound'
                                : `AgentChat.backup.errors.${['busy', 'quota', 'corrupt', 'invalid'].includes(reason) ? reason : 'unavailable'}`) });
                          }}
                          aria-label={t('AgentChat.history.exportConversation', { title: item.title || t('AgentChat.history.untitled') })}
                          title={t(running && isCurrent ? 'AgentChat.backup.running' : 'AgentChat.history.export')}
                          className="rounded-sm p-1 text-ink-500 transition-colors duration-fast hover:bg-paper-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Icon name="Download" size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          aria-label={t('AgentChat.history.rename')}
                          title={t('AgentChat.history.rename')}
                          className="rounded-sm p-1 text-ink-500 transition-colors duration-fast hover:bg-paper-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500/20"
                        >
                          <Icon name="Pencil" size={14} />
                        </button>
                        <button
                          type="button"
                          disabled={running && isCurrent}
                          onClick={() => {
                            setEditingId(null);
                            if (isConfirming) {
                              setConfirmingId(null);
                              onDelete(item.id);
                            } else {
                              setConfirmingId(item.id);
                            }
                          }}
                          aria-label={
                            isConfirming
                              ? t('AgentChat.history.confirmDelete')
                              : t('AgentChat.history.delete')
                          }
                          title={
                            running && isCurrent
                              ? t('AgentChat.history.runningHint')
                              : isConfirming
                                ? t('AgentChat.history.confirmDelete')
                                : t('AgentChat.history.delete')
                          }
                          className={cn(
                            'rounded-sm p-1 transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500/20',
                            isConfirming
                              ? 'bg-sun-300/30 text-state-warn'
                              : 'text-ink-500 hover:bg-paper-50',
                            running && isCurrent && 'cursor-not-allowed opacity-60',
                          )}
                        >
                          <Icon
                            name={isConfirming ? 'Check' : 'Trash2'}
                            size={14}
                            className={isConfirming ? 'text-state-warn' : undefined}
                          />
                        </button>
                      </div>
                    )}

                    {isConfirming && (
                      <p className="mt-1 text-caption text-state-warn">
                        {t('AgentChat.history.confirmDelete')}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}

HistoryDrawer.propTypes = {
  open: PropTypes.bool.isRequired,
  items: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      title: PropTypes.string,
      timestamp: PropTypes.number,
      source: PropTypes.string,
    }),
  ).isRequired,
  currentId: PropTypes.string,
  errorText: PropTypes.string,
  running: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  onOpen: PropTypes.func.isRequired,
  onRename: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onExport: PropTypes.func.isRequired,
  onDismissError: PropTypes.func.isRequired,
};

export default HistoryDrawer;
