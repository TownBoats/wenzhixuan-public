import PropTypes from 'prop-types';
import { cn } from '../cn';
import { baseSvgProps } from './svgProps';

/**
 * 五档生长 1/5 — 种子（"第一次听说"）。
 *
 * 一颗带细根的椭圆种子，位于地平线下，
 * 视觉重心向下，传达"未发芽"的安静感。
 */
function LevelSeed({ size = 24, className, ...rest }) {
  return (
    <svg
      {...baseSvgProps}
      width={size}
      height={size}
      aria-hidden="true"
      className={cn('text-level-seed shrink-0', className)}
      {...rest}
    >
      <line x1="3" y1="13" x2="21" y2="13" strokeDasharray="2 2" opacity="0.5" />
      <ellipse cx="12" cy="13" rx="3.5" ry="5" fill="currentColor" fillOpacity="0.18" />
      <path d="M12 17.5 V21" />
      <path d="M12 19 Q10.5 20 10 21.5" opacity="0.6" />
      <path d="M12 19 Q13.5 20 14 21.5" opacity="0.6" />
    </svg>
  );
}

LevelSeed.propTypes = {
  size: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  className: PropTypes.string,
};

export default LevelSeed;
