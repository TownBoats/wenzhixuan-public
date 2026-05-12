import { cva } from 'class-variance-authority';

/**
 * Button cva variant 配置
 *
 * 单独成文件以避免 react-refresh/only-export-components 警告，
 * 并便于后续 IconButton / SplitButton 等复合组件复用同一组样式。
 */
export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2',
    'rounded-sm font-sans font-medium select-none',
    'transition-all duration-fast ease-snap',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500/40',
    'disabled:pointer-events-none disabled:opacity-50',
    'active:scale-[0.98] active:translate-y-px',
  ].join(' '),
  {
    variants: {
      intent: {
        primary:
          'bg-sage-500 text-white shadow-soft hover:bg-sage-700 hover:shadow-lift',
        secondary:
          'bg-paper-100 text-ink-700 border border-paper-200 hover:bg-paper-200',
        ghost:
          'text-ink-500 hover:bg-paper-100 hover:text-ink-700',
        accent:
          'bg-sun-500 text-white shadow-soft hover:bg-sun-700',
      },
      size: {
        sm: 'h-8 px-3 text-small',
        md: 'h-9 px-4 text-body',
        lg: 'h-11 px-5 text-body',
      },
      iconOnly: {
        true: 'aspect-square px-0',
      },
    },
    defaultVariants: {
      intent: 'primary',
      size: 'md',
      iconOnly: false,
    },
  },
);
