import PropTypes from 'prop-types';
import { cn } from '../cn';
import { baseSvgProps } from './svgProps';

/**
 * Key — "需要 API Key" 状态插画
 *
 * 圆环把手 + 两齿钥匙身。在欢迎页配置引导和"Key 缺失"
 * 文案旁出现，把抽象的 BYOK 概念具象化。
 */
function Key({ size = 24, className, ...rest }) {
  return (
    <svg
      {...baseSvgProps}
      width={size}
      height={size}
      aria-hidden="true"
      className={cn('text-sun-700 shrink-0', className)}
      {...rest}
    >
      <circle cx="7" cy="12" r="3.5" fill="currentColor" fillOpacity="0.18" />
      <circle cx="7" cy="12" r="1.2" />
      <line x1="10.5" y1="12" x2="20" y2="12" />
      <line x1="16" y1="12" x2="16" y2="15.5" />
      <line x1="19" y1="12" x2="19" y2="14.5" />
    </svg>
  );
}

Key.propTypes = {
  size: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  className: PropTypes.string,
};

export default Key;
