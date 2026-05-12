import { forwardRef } from 'react';
import PropTypes from 'prop-types';
import { cn } from './cn';

/**
 * Textarea — 问知轩原子多行输入框
 *
 * 与 Input 同色板，但默认不可手动 resize（避免破坏布局），
 * 高度通过 rows 控制，调用方可自行覆盖 className 实现自适应。
 *
 * @example
 *   <Textarea rows={3} placeholder="今天想学点什么？" />
 */
const Textarea = forwardRef(function Textarea(
  { className, error = false, rows = 3, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={error || undefined}
      className={cn(
        'w-full rounded-sm border bg-paper-50 px-4 py-2',
        'text-body text-ink-900 caret-sage-500 leading-6',
        'placeholder:italic placeholder:text-ink-300',
        'transition-colors duration-fast ease-soft resize-none',
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

Textarea.propTypes = {
  className: PropTypes.string,
  error: PropTypes.bool,
  rows: PropTypes.number,
};

export default Textarea;
