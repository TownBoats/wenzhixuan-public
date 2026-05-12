import { useState } from 'react';
import PropTypes from 'prop-types';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Icon, cn } from '@/components/ui';

/**
 * ChatHistory — 历史会话列表项（Susan Kare 重设计版）
 *
 * 设计规格见 docs/REDESIGN_KARE.md §3.8（"日记本化"）。
 *
 * 每条历史卡：
 *   - 标题（衬线 body）+ 时间（mono caption）+ 摘要（ink-500 small）
 *   - 选中态：左侧 3px sage 竖线 + bg-paper-50
 *   - hover：右侧浮出 编辑笔 / 垃圾桶（lucide）
 *
 * Props 接口与旧版完全一致；旧 `theme` prop 仍接收但忽略（新设计单主题）。
 */
const ChatHistory = ({
  histories,
  currentChatId,
  onSelectHistory,
  onDeleteHistory,
  onUpdateTitle,
  // eslint-disable-next-line no-unused-vars
  theme,
}) => {
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');

  const handleEditClick = (history) => {
    setEditingId(history.id);
    setEditingTitle(history.title || '未命名对话');
  };

  const handleTitleSubmit = (id) => {
    onUpdateTitle(id, editingTitle);
    setEditingId(null);
  };

  const getMessagePreview = (messages) => {
    if (!messages || !Array.isArray(messages)) return '空对话';
    const lastUserMessage = messages.find((msg) => msg.role === 'user')?.content;
    if (!lastUserMessage) {
      const firstMessage = messages[0]?.content;
      if (!firstMessage) return '空对话';
      if (Array.isArray(firstMessage)) {
        const firstTextContent = firstMessage.find(
          (item) => item.type === 'text' || item.type === 'response',
        )?.value;
        return firstTextContent ? `${firstTextContent.slice(0, 50)}...` : '空对话';
      }
      return `${String(firstMessage).slice(0, 50)}...`;
    }
    if (Array.isArray(lastUserMessage)) {
      const textContent = lastUserMessage.find(
        (item) => item.type === 'text' || item.type === 'response',
      )?.value;
      return textContent ? `${textContent.slice(0, 50)}...` : '空对话';
    }
    return `${String(lastUserMessage).slice(0, 50)}...`;
  };

  return (
    <div className="space-y-2">
      {histories.map((history) => {
        const isActive = currentChatId === history.id;
        return (
          <div
            key={history.id}
            className={cn(
              'group relative rounded-md border p-3 pl-4 transition-all duration-fast',
              isActive
                ? 'border-sage-300 bg-paper-50'
                : 'border-paper-200 bg-paper-50/60 hover:bg-paper-50 hover:border-sage-300',
            )}
          >
            {isActive && (
              <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-pill bg-sage-500" />
            )}

            <div className="flex items-start justify-between gap-2">
              <div
                className="min-w-0 flex-1 cursor-pointer"
                onClick={() => onSelectHistory(history.id)}
              >
                {editingId === history.id ? (
                  <input
                    type="text"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onBlur={() => handleTitleSubmit(history.id)}
                    onKeyDown={(e) =>
                      e.key === 'Enter' && handleTitleSubmit(history.id)
                    }
                    className={cn(
                      'w-full rounded-sm border border-sage-500 bg-paper-50 px-2 py-1',
                      'text-body text-ink-900 caret-sage-500',
                      'focus:outline-none focus:ring-2 focus:ring-sage-500/20',
                    )}
                    autoFocus
                  />
                ) : (
                  <>
                    <h4 className="truncate text-body font-serif text-ink-900">
                      {history.title || '未命名对话'}
                    </h4>
                    <p className="mt-1 text-caption font-mono text-ink-500">
                      {formatDistanceToNow(new Date(history.timestamp), {
                        addSuffix: true,
                        locale: zhCN,
                      })}
                    </p>
                    <p className="mt-1 truncate text-small font-serif text-ink-500">
                      {getMessagePreview(history.uiMessages)}
                    </p>
                  </>
                )}
              </div>

              <div
                className={cn(
                  'flex items-center gap-0.5 transition-opacity duration-fast',
                  isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                )}
              >
                <button
                  type="button"
                  onClick={() => handleEditClick(history)}
                  className="rounded-sm p-1.5 text-ink-500 transition-colors duration-fast hover:bg-paper-100 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500/30"
                  aria-label="重命名"
                >
                  <Icon name="Pencil" size={14} className="text-current" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteHistory(history.id)}
                  className="rounded-sm p-1.5 text-ink-500 transition-colors duration-fast hover:bg-state-alert/10 hover:text-state-alert focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-state-alert/30"
                  aria-label="删除"
                >
                  <Icon name="Trash2" size={14} className="text-current" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

ChatHistory.propTypes = {
  histories: PropTypes.array.isRequired,
  currentChatId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onSelectHistory: PropTypes.func.isRequired,
  onDeleteHistory: PropTypes.func.isRequired,
  onUpdateTitle: PropTypes.func.isRequired,
  theme: PropTypes.string,
};

export default ChatHistory;
