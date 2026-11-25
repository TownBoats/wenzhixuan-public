import { useCallback, useRef, useState } from 'react';

const HIGHLIGHT_CLASSES = ['ring-2', 'ring-sage-500', 'ring-offset-4', 'ring-offset-paper-50'];
const HIGHLIGHT_MS = 2400;

/**
 * 引用跳转：滚动、高亮、移动焦点，并能回到原处。
 *
 * 只在页面内查找带 `data-ref-target` 的元素并逐个比对，不把引用拼进选择器或地址。
 */
export function useReferenceJump(scrollRef) {
  const originRef = useRef(null);
  const highlightRef = useRef(null);
  const [active, setActive] = useState(false);

  const clearHighlight = useCallback(() => {
    if (!highlightRef.current) return;
    clearTimeout(highlightRef.current.timer);
    highlightRef.current.element.classList.remove(...HIGHLIGHT_CLASSES);
    highlightRef.current = null;
  }, []);

  const jump = useCallback(
    (target, source) => {
      const root = scrollRef.current;
      const element = [...(root?.querySelectorAll('[data-ref-target]') ?? [])].find(
        (item) => item.dataset.refTarget === target.anchor,
      );
      if (!element) return;
      // 连续跳转时保留最初的位置
      if (!originRef.current) originRef.current = { top: root.scrollTop, source };
      setActive(true);
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      element.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
      element.focus({ preventScroll: true });
      clearHighlight();
      element.classList.add(...HIGHLIGHT_CLASSES);
      highlightRef.current = { element, timer: setTimeout(clearHighlight, HIGHLIGHT_MS) };
    },
    [clearHighlight, scrollRef],
  );

  const reset = useCallback(() => {
    originRef.current = null;
    setActive(false);
  }, []);

  const goBack = useCallback(() => {
    const origin = originRef.current;
    reset();
    clearHighlight();
    if (!origin) return;
    if (scrollRef.current) scrollRef.current.scrollTop = origin.top;
    // 等被隐藏的答题卡重新显示后再还焦点
    setTimeout(() => {
      if (origin.source?.isConnected) origin.source.focus({ preventScroll: true });
    }, 0);
  }, [clearHighlight, reset, scrollRef]);

  return { active, jump, goBack, reset };
}
