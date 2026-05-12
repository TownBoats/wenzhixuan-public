import PropTypes from 'prop-types';
import { cn } from './cn';

/**
 * Tag — 问知轩原子标签 / 徽章
 *
 * 设计规格见 docs/REDESIGN_KARE.md §2.4：
 *   - 高 24（h-6）+ 横向 8px 内边距 + 极小圆角 (rounded-xs)
 *   - 5 种语义：neutral / active / good / warn / alert
 *   - 字号 caption（11px）、字重 medium，font-sans
 *
 * @example
 *   <Tag variant="active">流式中</Tag>
 *   <Tag variant="good">完成</Tag>
 */
const variantClasses = {
  neutral: 'bg-paper-200 text-ink-700',
  active: 'bg-sage-50 text-sage-700',
  good: 'bg-state-good/20 text-sage-700',
  warn: 'bg-sun-300/40 text-sun-700',
  alert: 'bg-state-alert/15 text-state-alert',
};

function Tag({ variant = 'neutral', className, children, ...rest }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1 px-2',
        'rounded-xs text-caption font-medium font-sans',
        variantClasses[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}

Tag.propTypes = {
  variant: PropTypes.oneOf(Object.keys(variantClasses)),
  className: PropTypes.string,
  children: PropTypes.node,
};

export default Tag;
