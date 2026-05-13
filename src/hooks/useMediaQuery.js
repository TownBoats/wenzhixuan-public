import { useState, useEffect } from 'react';

/**
 * useMediaQuery — CSS media query 的 React 状态封装
 *
 * 设计要点：
 *   - SSR 安全：window 不存在时默认返回 false
 *   - 订阅 change 事件，窗口尺寸变化自动重新计算
 *   - 仅在 needs-JS 场景使用（如 Draggable / Resizable 行为切换），
 *     纯样式响应式请用 Tailwind `md:` / `lg:` 前缀
 *
 * @example
 *   const isDesktop = useMediaQuery('(min-width: 768px)');
 *   if (isDesktop) <DraggableThing /> else <FullScreenThing />
 */
export default function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mql = window.matchMedia(query);
    const handler = (event) => setMatches(event.matches);
    setMatches(mql.matches);

    if (mql.addEventListener) {
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }
    // Safari < 14 fallback
    mql.addListener(handler);
    return () => mql.removeListener(handler);
  }, [query]);

  return matches;
}

/** 常用断点常量，与 tailwind.config.js 保持一致 */
export const BREAKPOINTS = {
  sm: '(min-width: 640px)',
  md: '(min-width: 768px)',
  lg: '(min-width: 1024px)',
  xl: '(min-width: 1280px)',
};
