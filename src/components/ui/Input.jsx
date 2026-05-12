import { forwardRef } from 'react';
import PropTypes from 'prop-types';
import { cn } from './cn';

/**
 * Input — 问知轩原子单行输入框
 *
 * 设计规格见 docs/REDESIGN_KARE.md §2.2：
 *   - 默认：bg-paper-50 + 1px paper-200 描边
 *   - 聚焦：sage-500 描边 + sage 半透光环；光标颜色 = sage-500
 *   - 错误：state-alert 描边 + 半透光环
 *   - placeholder 用 italic + ink-300，与正文有视觉差
 *
 * @example
 *   <Input value={v} onChange={...} placeholder="把 API Key 给我看一眼" />
 *   <Input error helperText="格式不太对" />
 */
const Input = forwardRef(function Input(
  { className, error = false, type = 'text', ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      aria-invalid={error || undefined}
      className={cn(
        'h-10 w-full rounded-sm border bg-paper-50 px-4 py-2',
        'text-body text-ink-900 caret-sage-500',
        'placeholder:italic placeholder:text-ink-300',
        'transition-colors duration-fast ease-soft',
        'focus:outline-none focus:ring-2',
        'disabled:bg-paper-100 disabled:text-ink-500 disabled:cursor-not-allowed',
        error
          ? 'border-state-alert ring-state-alert/20 focus:border-state-alert focus:ring-state-alert/20'
          : 'border-paper-200 focus:border-sage-500 focus:ring-sage-500/20',
        className,
      )}
      {...rest}
    />
  );
});

Input.propTypes = {
  className: PropTypes.string,
  error: PropTypes.bool,
  type: PropTypes.string,
};

export default Input;
