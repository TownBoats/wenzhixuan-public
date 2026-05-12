import PropTypes from 'prop-types';
import { cn } from '../cn';
import { baseSvgProps } from './svgProps';

/**
 * Flag — "等一下 / 出错了" 状态插画
 *
 * 替代刺眼的 ⚠️。一面随风轻摆的小三角旗。
 * 默认色 state-warn（暖橙），危险场景外覆 className="text-state-alert" 即可换色。
 */
function Flag({ size = 24, className, ...rest }) {
  return (
    <svg
      {...baseSvgProps}
      width={size}
      height={size}
      aria-hidden="true"
      className={cn('text-state-warn shrink-0', className)}
      {...rest}
    >
      <line x1="6" y1="3" x2="6" y2="21" />
      <path d="M6 4 L18 6.5 L6 9 Z" fill="currentColor" fillOpacity="0.2" />
      <line x1="3.5" y1="21" x2="9" y2="21" />
    </svg>
  );
}

Flag.propTypes = {
  size: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  className: PropTypes.string,
};

export default Flag;
