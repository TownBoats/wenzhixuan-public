import PropTypes from 'prop-types';
import { cn } from '../cn';
import { baseSvgProps } from './svgProps';

/**
 * 五档生长 4/5 — 大树（"比较熟悉"）。
 *
 * 粗干 + 圆润云朵冠层（柔化树叶细节，强化"成熟"的体量感）。
 */
function LevelTree({ size = 24, className, ...rest }) {
  return (
    <svg
      {...baseSvgProps}
      width={size}
      height={size}
      aria-hidden="true"
      className={cn('text-level-tree shrink-0', className)}
      {...rest}
    >
      <line x1="3" y1="21" x2="21" y2="21" strokeDasharray="2 2" opacity="0.5" />
      <path d="M11 21 V13 H13 V21 Z" fill="currentColor" fillOpacity="0.18" />
      <path
        d="M12 3 Q7 4 6 8 Q3.5 9 4 12 Q3.5 15 7 15 H17 Q20.5 15 20 12 Q20.5 9 18 8 Q17 4 12 3 Z"
        fill="currentColor"
        fillOpacity="0.18"
      />
    </svg>
  );
}

LevelTree.propTypes = {
  size: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  className: PropTypes.string,
};

export default LevelTree;
