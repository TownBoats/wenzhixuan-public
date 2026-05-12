import PropTypes from 'prop-types';
import { cn } from '../cn';
import { baseSvgProps } from './svgProps';

/**
 * Screwdriver — "调试 / 设置" Tab 插画
 *
 * 设置 Tab 的"工程感"靠它一个人扛，避免全站都用 lucide Cog 的工业冷感。
 */
function Screwdriver({ size = 24, className, ...rest }) {
  return (
    <svg
      {...baseSvgProps}
      width={size}
      height={size}
      aria-hidden="true"
      className={cn('text-ink-500 shrink-0', className)}
      {...rest}
    >
      <rect x="3" y="9" width="7" height="6" rx="1.2" fill="currentColor" fillOpacity="0.18" />
      <line x1="3" y1="11" x2="10" y2="11" opacity="0.6" />
      <line x1="3" y1="13" x2="10" y2="13" opacity="0.6" />
      <line x1="10" y1="12" x2="18" y2="12" />
      <rect x="18" y="10.5" width="3" height="3" rx="0.4" fill="currentColor" />
    </svg>
  );
}

Screwdriver.propTypes = {
  size: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  className: PropTypes.string,
};

export default Screwdriver;
