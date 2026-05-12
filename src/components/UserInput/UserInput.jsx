import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Icon, cn } from '@/components/ui';

/**
 * UserInput — 输入条（P3b Susan Kare 重设计版）
 *
 * 视觉迁移自旧版：
 *   - bg-white/80 + slate 边框 + cyan 聚焦      → bg-paper-50 + paper-200 边框
 *                                                  + sage-500 聚焦环（focus-within）
 *   - rounded-xl 直接套在 textarea               → 整体「信纸感」外壳，textarea 透明
 *   - 浮在右下角的 cyan 纸飞机                    → 底部独立 toolbar：左侧键盘提示，
 *                                                  右侧 sage-500 圆形按钮 + 倾斜
 *                                                  纸飞机（hover 时微微"起飞"）
 *
 * Props 接口与旧版完全一致。Enter 发送 / Shift+Enter 换行行为不变。
 */
const UserInput = ({
  inputText,
  setInputText,
  handleSendMessage,
  isLoading,
  centered = false,
}) => {
  const { t } = useTranslation();

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const canSend = !isLoading && inputText.trim().length > 0;

  return (
    <div
      className={cn(
        'mx-auto w-full transition-all duration-slow ease-soft',
        centered ? 'max-w-2xl' : 'max-w-[48rem]',
      )}
    >
      <div
        className={cn(
          'group rounded-lg border border-paper-200 bg-paper-50 shadow-soft',
          'transition-all duration-base ease-soft',
          'focus-within:border-sage-500 focus-within:ring-2 focus-within:ring-sage-500/20',
          'focus-within:shadow-lift',
        )}
      >
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('UserInput.placeholder')}
          rows={1}
          className={cn(
            'block w-full resize-none rounded-t-lg bg-transparent',
            'min-h-[56px] max-h-32',
            'px-4 pt-3 pb-2',
            'text-body text-ink-900 caret-sage-500',
            'placeholder:italic placeholder:text-ink-300',
            'outline-none border-0 ring-0 focus:ring-0 focus:outline-none',
          )}
        />

        <div className="flex items-center justify-between gap-3 border-t border-paper-200 px-3 py-2">
          <span className="hidden sm:inline text-caption font-mono text-ink-300">
            <kbd className="rounded-xs border border-paper-200 bg-paper-100 px-1.5 py-0.5 text-ink-500">↵</kbd>
            {' '}发送 ·{' '}
            <kbd className="rounded-xs border border-paper-200 bg-paper-100 px-1.5 py-0.5 text-ink-500">⇧↵</kbd>
            {' '}换行
          </span>
          <span className="sm:hidden text-caption font-mono text-ink-300">↵ 发送</span>

          <button
            type="button"
            onClick={() => handleSendMessage()}
            disabled={!canSend}
            aria-label={t('UserInput.placeholder')}
            className={cn(
              'inline-flex h-9 w-9 items-center justify-center rounded-pill shrink-0',
              'transition-all duration-fast ease-snap',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500/40',
              canSend
                ? 'bg-sage-500 text-white shadow-soft hover:bg-sage-700 hover:shadow-lift active:scale-95'
                : 'bg-paper-200 text-ink-300 cursor-not-allowed',
            )}
          >
            <Icon
              name="Send"
              size={16}
              className={cn(
                'text-current -rotate-12 transition-transform duration-fast ease-snap',
                canSend && 'group-focus-within:rotate-0',
              )}
            />
          </button>
        </div>
      </div>
    </div>
  );
};

UserInput.propTypes = {
  inputText: PropTypes.string.isRequired,
  setInputText: PropTypes.func.isRequired,
  handleSendMessage: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
  centered: PropTypes.bool,
};

export default UserInput;
