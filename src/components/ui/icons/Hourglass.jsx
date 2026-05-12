import PropTypes from 'prop-types';
import { cn } from '../cn';
import { baseSvgProps } from './svgProps';

/**
 * Hourglass — "时间快到了 / 字数接近上限" 状态插画
 *
 * 替代冷冰冰的字数计数。沙已经流到下半部，暗示"剩下不多"。
 */
function Hourglass({ size = 24, className, ...rest }) {
  return (
    <svg
      {...baseSvgProps}
      width={size}
      height={size}
      aria-hidden="true"
      className={cn('text-ink-500 shrink-0', className)}
      {...rest}
    >
      <line x1="6" y1="3" x2="18" y2="3" />
      <line x1="6" y1="21" x2="18" y2="21" />
      <path d="M7 3 V6 L12 12 L17 6 V3" />
      <path d="M7 21 V18 L12 12 L17 18 V21" />
      <path d="M9 19 H15 L12 14 Z" fill="currentColor" fillOpacity="0.4" />
    </svg>
  );
}

Hourglass.propTypes = {
  size: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  className: PropTypes.string,
};

export default Hourglass;
