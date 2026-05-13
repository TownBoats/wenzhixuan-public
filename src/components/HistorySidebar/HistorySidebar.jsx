import { useEffect } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import ChatHistory from '../ChatHistory/ChatHistory';
import { Button, Icon, cn } from '@/components/ui';

/**
 * HistorySidebar — 右侧历史会话抽屉
 *
 * 响应式策略：
 *   - mobile (< md)   ：100vw 全宽 + 半透明蒙层 + 蒙层 / ESC 关闭
 *                       从右滑入（这里直接渲染，过渡留给 mount 动画）
 *   - desktop (≥ md)  ：320px 宽，从顶部 72px 起（避开顶栏）
 *
 * 行为完全保留：propTypes 一致；点击蒙层 / ESC 关闭是新增辅助。
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

  useEffect(() => {
    if (!showRightSidebar) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setShowRightSidebar(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showRightSidebar, setShowRightSidebar]);

  if (!showRightSidebar) return null;

  return (
    <>
      {/* 蒙层（仅 mobile，点击关闭） */}
      <button
        type="button"
        aria-label="关闭历史抽屉"
        className="fixed inset-0 z-40 bg-ink-900/15 backdrop-blur-[1px] md:hidden"
        onClick={() => setShowRightSidebar(false)}
      />

      <div
        className={cn(
          'fixed right-0 top-[56px] z-50 flex h-[calc(100%-56px)] flex-col',
          'w-full md:w-[320px] md:top-[72px] md:h-[calc(100%-72px)]',
          'border-l border-paper-200 bg-paper-50/95 shadow-lift backdrop-blur-sm',
          'transition-transform duration-base ease-soft',
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-paper-200 px-4 py-3">
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
              onSelectHistory={(id) => {
                handleSelectHistory(id);
                // 移动端选完自动关掉抽屉，让用户看到选中的会话
                if (typeof window !== 'undefined' && window.innerWidth < 768) {
                  setShowRightSidebar(false);
                }
              }}
              onDeleteHistory={handleDeleteHistory}
              onUpdateTitle={handleUpdateTitle}
            />
          </div>
        </div>
      </div>
    </>
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
