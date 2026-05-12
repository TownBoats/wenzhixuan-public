import PropTypes from 'prop-types';
import { cn } from '../cn';
import { baseSvgProps } from './svgProps';

/**
 * 五档生长 2/5 — 嫩芽（"听过一点"）。
 *
 * 短茎 + 一对对生小叶。
 */
function LevelSprout({ size = 24, className, ...rest }) {
  return (
    <svg
      {...baseSvgProps}
      width={size}
      height={size}
      aria-hidden="true"
      className={cn('text-level-sprout shrink-0', className)}
      {...rest}
    >
      <line x1="3" y1="20" x2="21" y2="20" strokeDasharray="2 2" opacity="0.5" />
      <path d="M12 20 V11" />
      <path d="M12 13 Q9 12 7.5 9.5 Q10 9 12 11" fill="currentColor" fillOpacity="0.2" />
      <path d="M12 12 Q15 11 16.5 8.5 Q14 8 12 10" fill="currentColor" fillOpacity="0.2" />
    </svg>
  );
}

LevelSprout.propTypes = {
  size: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  className: PropTypes.string,
};

export default LevelSprout;
