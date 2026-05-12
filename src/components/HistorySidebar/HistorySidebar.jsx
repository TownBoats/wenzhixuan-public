import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import ChatHistory from '../ChatHistory/ChatHistory';
import { Button, Icon, cn } from '@/components/ui';

/**
 * HistorySidebar — 右侧历史会话抽屉（P3g Susan Kare 重设计版）
 *
 * 视觉迁移自旧版：
 *   - bg-white/80 + slate border-l        → bg-paper-50/85 + paper-200
 *   - 标题字号 sm + slate                  → h2 衬线 + ink-900
 *   - 关闭按钮内联 SVG + slate hover       → ui Button(ghost) + lucide X
 *   - 旧滚动条类（slate-400/20）            → 复用 .scrollbar-custom 工具类
 *
 * Props 接口与旧版完全一致。
 */
const HistorySidebar = ({
  showRightSidebar,
  setShowRightSidebar,
  histories,
  currentChatId,
  handleSelectHistory,
  handleDeleteHistory,
  handleUpdateTitle,
}) => {
  const { t } = useTranslation();

  if (!showRightSidebar) return null;

  return (
    <div
      className={cn(
        'fixed right-0 top-0 h-full',
        'bg-paper-50/90 backdrop-blur-sm',
        'border-l border-paper-200 shadow-lift',
        'transition-all duration-base ease-soft',
      )}
      style={{ width: '320px', top: '72px', height: 'calc(100% - 72px)' }}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-paper-200 px-4 py-3">
          <h2 className="text-h2 font-serif text-ink-900">
            {t('HistorySidebar.title')}
          </h2>
          <Button
            intent="ghost"
            size="sm"
            iconOnly
            onClick={() => setShowRightSidebar(false)}
            aria-label={t('HistorySidebar.close', { defaultValue: '关闭' })}
          >
            <Icon name="X" size={16} />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-custom">
          <div className="p-4">
            <ChatHistory
              histories={histories}
              currentChatId={currentChatId}
              onSelectHistory={handleSelectHistory}
              onDeleteHistory={handleDeleteHistory}
              onUpdateTitle={handleUpdateTitle}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

HistorySidebar.propTypes = {
  showRightSidebar: PropTypes.bool.isRequired,
  setShowRightSidebar: PropTypes.func.isRequired,
  histories: PropTypes.array.isRequired,
  currentChatId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  handleSelectHistory: PropTypes.func.isRequired,
  handleDeleteHistory: PropTypes.func.isRequired,
  handleUpdateTitle: PropTypes.func.isRequired,
};

export default HistorySidebar;
