import PropTypes from 'prop-types';
import { cn } from '../cn';
import { baseSvgProps } from './svgProps';

/**
 * CoffeeCup — "思考中…" 状态插画
 *
 * 杯身 + 把手 + 三道飘动的热气线。
 * 业务侧可叠加 framer-motion 让热气循环上浮（设计规格 §6.3）。
 */
function CoffeeCup({ size = 24, className, ...rest }) {
  return (
    <svg
      {...baseSvgProps}
      width={size}
      height={size}
      aria-hidden="true"
      className={cn('text-ink-700 shrink-0', className)}
      {...rest}
    >
      <path d="M5 11 H17 V18 Q17 20 15 20 H7 Q5 20 5 18 Z" fill="currentColor" fillOpacity="0.08" />
      <path d="M17 12 Q20 12 20 14.5 Q20 17 17 17" />
      <path d="M5 22 H19" />
      <path d="M8 8 Q9 6 8 4"   opacity="0.6" />
      <path d="M12 8 Q13 6 12 4" opacity="0.6" />
      <path d="M14 8 Q15 6 14 4" opacity="0.6" />
    </svg>
  );
}

CoffeeCup.propTypes = {
  size: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  className: PropTypes.string,
};

export default CoffeeCup;
