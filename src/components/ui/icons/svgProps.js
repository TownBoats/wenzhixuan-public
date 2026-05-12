/**
 * 自绘 SVG 图标的共享基础属性。
 *
 * 设计约束（docs/REDESIGN_KARE.md §2.3）：
 *   - 24x24 viewBox（与 lucide-react 一致，方便混排）
 *   - stroke=currentColor，调用方通过 className 控色
 *   - strokeWidth=1.5（比 lucide 默认 2 略细，与衬线正文呼应）
 *   - 圆头线帽 + 圆角连接，保持 Susan Kare 风的"温润几何"
 *
 * 使用方式：
 *   <svg {...baseSvgProps} width={size} height={size} className={...}>
 *     ...path...
 *   </svg>
 */
export const baseSvgProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

/**
 * 标准 PropTypes 模板（在每个 icon 组件中引入并扩展）。
 */
export const baseIconShape = {
  size: 'number-or-string',
  className: 'string',
};
