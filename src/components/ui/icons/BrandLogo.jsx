import PropTypes from 'prop-types';
import { cn } from '../cn';
import { baseSvgProps } from './svgProps';

/**
 * BrandLogo — 戴方框眼镜的小笑脸（"问知"拟人化）
 *
 * 是问知轩的人格化锚点。头像随对话状态变脸：
 *   - default  常态笑脸
 *   - thinking 闭眼 + 三点
 *   - error    歪嘴 + 一只眼睛眨着
 *   - happy    开心眯眼大笑
 *
 * 设计规格见 docs/REDESIGN_KARE.md §3.3 / §2 (R1 资产)。
 *
 * @example
 *   <BrandLogo size={48} />
 *   <BrandLogo size={32} expression="thinking" />
 */
const expressionPaths = {
  default: {
    leftEye:  <circle cx="8.5"  cy="11.5" r="0.6" fill="currentColor" stroke="none" />,
    rightEye: <circle cx="15.5" cy="11.5" r="0.6" fill="currentColor" stroke="none" />,
    mouth:    <path d="M9 16 Q12 18.5 15 16" />,
    extra:    null,
  },
  thinking: {
    leftEye:  <path d="M7.5 11.5 H9.5" />,
    rightEye: <path d="M14.5 11.5 H16.5" />,
    mouth:    <path d="M10 16.5 H14" />,
    extra:    <g><circle cx="10" cy="6" r="0.5" fill="currentColor" stroke="none" /><circle cx="12" cy="5" r="0.5" fill="currentColor" stroke="none" /><circle cx="14" cy="6" r="0.5" fill="currentColor" stroke="none" /></g>,
  },
  error: {
    leftEye:  <circle cx="8.5"  cy="11.5" r="0.6" fill="currentColor" stroke="none" />,
    rightEye: <path d="M14.5 11.5 H16.5" />,
    mouth:    <path d="M9 17 Q12 15.5 15 17" />,
    extra:    null,
  },
  happy: {
    leftEye:  <path d="M7.5 12 Q8.5 10.5 9.5 12" />,
    rightEye: <path d="M14.5 12 Q15.5 10.5 16.5 12" />,
    mouth:    <path d="M8.5 15 Q12 19 15.5 15" />,
    extra:    null,
  },
};

function BrandLogo({ size = 32, className, expression = 'default', title, ...rest }) {
  const expr = expressionPaths[expression] ?? expressionPaths.default;
  const labelled = Boolean(title);

  return (
    <svg
      {...baseSvgProps}
      width={size}
      height={size}
      role={labelled ? 'img' : undefined}
      aria-hidden={labelled ? undefined : 'true'}
      aria-label={title}
      className={cn('text-ink-900 shrink-0', className)}
      {...rest}
    >
      <circle cx="12" cy="12" r="9.5" />
      <rect x="5"  y="9.5" width="5" height="4" rx="1.2" />
      <rect x="14" y="9.5" width="5" height="4" rx="1.2" />
      <line x1="10" y1="11.5" x2="14" y2="11.5" />
      {expr.leftEye}
      {expr.rightEye}
      {expr.mouth}
      {expr.extra}
    </svg>
  );
}

BrandLogo.propTypes = {
  size: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  className: PropTypes.string,
  expression: PropTypes.oneOf(Object.keys(expressionPaths)),
  title: PropTypes.string,
};

export default BrandLogo;
