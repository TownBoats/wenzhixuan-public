import PropTypes from 'prop-types';
import { cn } from '../cn';
import { baseSvgProps } from './svgProps';

/**
 * 五档生长 3/5 — 小树（"大致了解"）。
 *
 * 直立细干 + 一组三角形冠层。
 */
function LevelSapling({ size = 24, className, ...rest }) {
  return (
    <svg
      {...baseSvgProps}
      width={size}
      height={size}
      aria-hidden="true"
      className={cn('text-level-sapling shrink-0', className)}
      {...rest}
    >
      <line x1="3" y1="21" x2="21" y2="21" strokeDasharray="2 2" opacity="0.5" />
      <line x1="12" y1="21" x2="12" y2="13" />
      <path d="M12 4 L7 12 H17 Z"   fill="currentColor" fillOpacity="0.18" />
      <path d="M12 8 L8.5 14 H15.5 Z" fill="currentColor" fillOpacity="0.18" />
    </svg>
  );
}

LevelSapling.propTypes = {
  size: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  className: PropTypes.string,
};

export default LevelSapling;
