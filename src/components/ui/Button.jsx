import { forwardRef } from 'react';
import PropTypes from 'prop-types';
import { cn } from './cn';
import { buttonVariants } from './Button.variants';

/**
 * Button — 问知轩原子按钮（Susan Kare 触感）
 *
 * 设计规格见 docs/REDESIGN_KARE.md §2.1：
 *   - 4 种意图：primary / secondary / ghost / accent
 *   - 3 种尺寸：sm (32) / md (36) / lg (44)
 *   - 按下态：scale 0.98 + 1px 下沉位移，模仿物理按键
 *   - 默认带 :focus-visible 2px sage 描边，可访问性优先
 *
 * @example
 *   <Button intent="primary" size="md" onClick={...}>发送</Button>
 *   <Button intent="ghost" size="sm" iconOnly aria-label="设置">
 *     <Icon name="Settings" />
 *   </Button>
 */
const Button = forwardRef(function Button(
  { intent, size, iconOnly, className, type = 'button', children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ intent, size, iconOnly }), className)}
      {...rest}
    >
      {children}
    </button>
  );
});

Button.propTypes = {
  intent: PropTypes.oneOf(['primary', 'secondary', 'ghost', 'accent']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  iconOnly: PropTypes.bool,
  className: PropTypes.string,
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
  children: PropTypes.node,
};

export default Button;
