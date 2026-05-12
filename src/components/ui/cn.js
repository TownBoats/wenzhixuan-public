import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * className 合并工具：clsx 处理条件 + tailwind-merge 处理类名冲突。
 *
 * @example
 *   cn('p-4', condition && 'p-6')           // -> 'p-6'（后者覆盖前者）
 *   cn('text-ink-700', className)           // 合并外部 className
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
