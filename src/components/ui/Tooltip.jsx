import { useState, useRef, useId, useEffect } from 'react';
import PropTypes from 'prop-types';
import { cn } from './cn';

const SHOW_DELAY_MS = 500;

const sideClasses = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-1',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-1',
  left: 'right-full top-1/2 -translate-y-1/2 mr-1',
  right: 'left-full top-1/2 -translate-y-1/2 ml-1',
};

/**
 * Tooltip — 问知轩原子提示
 *
 * 设计规格见 docs/REDESIGN_KARE.md §2.5：
 *   - 深底浅字 (ink-900 / paper-50)，与全站浅色页面拉开层次
 *   - 500ms 进入延迟，避免误触发
 *   - 悬停 + 键盘聚焦双触发，可访问性默认开
 *   - 透传 aria-describedby 到内层包装，让屏幕阅读器读出 tip
 *
 * @example
 *   <Tooltip content="清空所有对话">
 *     <Button intent="ghost" iconOnly aria-label="清空">
 *       <Icon name="Trash2" />
 *     </Button>
 *   </Tooltip>
 */
function Tooltip({ content, side = 'top', delayMs = SHOW_DELAY_MS, children, className }) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef(null);
  const id = useId();

  const show = () => {
    timerRef.current = setTimeout(() => setOpen(true), delayMs);
  };

  const hide = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setOpen(false);
  };

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      aria-describedby={open ? id : undefined}
    >
      {children}
      {open && content ? (
        <span
          id={id}
          role="tooltip"
          className={cn(
            'absolute z-50 whitespace-nowrap pointer-events-none',
            'rounded-xs bg-ink-900 px-2 py-1',
            'text-caption text-paper-50 shadow-lift',
            sideClasses[side],
            className,
          )}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}

Tooltip.propTypes = {
  content: PropTypes.node.isRequired,
  side: PropTypes.oneOf(['top', 'bottom', 'left', 'right']),
  delayMs: PropTypes.number,
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};

export default Tooltip;
