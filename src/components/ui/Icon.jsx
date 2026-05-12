import * as LucideIcons from 'lucide-react';
import PropTypes from 'prop-types';
import { cn } from './cn';

/**
 * Icon — 全站统一 lucide-react 包装器
 *
 * 设计规格见 docs/REDESIGN_KARE.md §2.3：
 *   - 默认尺寸 18（按钮内）；行内文字旁 16；独立场景 20/24
 *   - 默认描边 1.75（比 lucide 默认 2 略细，与衬线正文呼应）
 *   - 默认色 ink-500，主动态可 className 覆盖为 sage-500 等
 *   - 默认 aria-hidden（图标作纯装饰），需要语义时调用方自行覆盖
 *
 * @example
 *   <Icon name="Settings" size={20} />
 *   <Icon name="Send" className="text-sage-500" />
 *
 * 后续 P2 阶段会补 7 张自绘 SVG（品牌 logo / 五档生长 / 状态插画），
 * 那部分以独立组件形态存在，与本 lucide 通道并存。
 */
function Icon({ name, size = 18, strokeWidth = 1.75, className, ...rest }) {
  const LucideIcon = LucideIcons[name];

  if (!LucideIcon) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(`<Icon name="${name}"/> not found in lucide-react`);
    }
    return null;
  }

  return (
    <LucideIcon
      size={size}
      strokeWidth={strokeWidth}
      aria-hidden="true"
      className={cn('text-ink-500 shrink-0', className)}
      {...rest}
    />
  );
}

Icon.propTypes = {
  name: PropTypes.string.isRequired,
  size: PropTypes.oneOf([12, 14, 16, 18, 20, 24, 32, 40, 48]),
  strokeWidth: PropTypes.number,
  className: PropTypes.string,
};

export default Icon;
