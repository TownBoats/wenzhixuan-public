import PropTypes from 'prop-types';
import { cn } from '../cn';
import { baseSvgProps } from './svgProps';

/**
 * 五档生长 5/5 — 森林（"可以教别人"）。
 *
 * 三棵高低错落的树，传达"知识形成体系"的群落感。
 */
function LevelForest({ size = 24, className, ...rest }) {
  return (
    <svg
      {...baseSvgProps}
      width={size}
      height={size}
      aria-hidden="true"
      className={cn('text-level-forest shrink-0', className)}
      {...rest}
    >
      <line x1="2" y1="21" x2="22" y2="21" strokeDasharray="2 2" opacity="0.5" />
      {/* 左：小树 */}
      <line x1="6" y1="21" x2="6" y2="16" />
      <path d="M6 9 L3 16 H9 Z" fill="currentColor" fillOpacity="0.18" />
      {/* 中：高树 */}
      <line x1="12" y1="21" x2="12" y2="14" />
      <path d="M12 4 L8 14 H16 Z" fill="currentColor" fillOpacity="0.18" />
      <path d="M12 8 L9.5 13 H14.5 Z" fill="currentColor" fillOpacity="0.18" />
      {/* 右：中树 */}
      <line x1="18" y1="21" x2="18" y2="15" />
      <path d="M18 7 L15 15 H21 Z" fill="currentColor" fillOpacity="0.18" />
    </svg>
  );
}

LevelForest.propTypes = {
  size: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  className: PropTypes.string,
};

export default LevelForest;
