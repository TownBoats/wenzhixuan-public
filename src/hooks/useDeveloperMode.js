import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 开发者模式与标题连点彩蛋逻辑 Hook
 * 暴露：developerMode, titleStyle, onHeaderClick, onTitleClick, toggleDevPanel
 */
const useDeveloperMode = ({ t, showDebugPanel, setShowDebugPanel }) => {
  const [developerMode, setDeveloperMode] = useState(() => {
    return localStorage.getItem('developerMode') === 'true';
  });

  const [titleClickCount, setTitleClickCount] = useState(0);
  const titleClickTimerRef = useRef(null);
  const [titleStyle, setTitleStyle] = useState({});

  const onTitleClick = useCallback((e) => {
    setTitleClickCount((prevCount) => {
      const newCount = prevCount + 1;

      if (titleClickTimerRef.current) {
        clearTimeout(titleClickTimerRef.current);
      }

      if (newCount >= 7) {
        setTitleStyle({
          textShadow: `0 0 ${newCount - 6}px #3b82f6`,
          color: newCount >= 9 ? '#3b82f6' : ''
        });
      } else {
        setTitleStyle({});
      }

      if (newCount === 10) {
        const newDeveloperMode = !developerMode;
        setDeveloperMode(newDeveloperMode);
        localStorage.setItem('developerMode', String(newDeveloperMode));

        if (typeof alert === 'function' && typeof t === 'function') {
          const message = newDeveloperMode ? t('ChatPage.developerModeOn') : t('ChatPage.developerModeOff');
          alert(message);
        }

        setTitleStyle({});
        return 0;
      }

      titleClickTimerRef.current = setTimeout(() => {
        setTitleClickCount(0);
        setTitleStyle({});
      }, 3000);

      return newCount;
    });
  }, [developerMode, t]);

  const onHeaderClick = useCallback((e) => {
    if (e?.target?.closest && e.target.closest('button')) return;
    onTitleClick(e);
  }, [onTitleClick]);

  const toggleDevPanel = useCallback(() => {
    if (!setShowDebugPanel) return;
    if (!developerMode) return;
    setShowDebugPanel((prev) => !prev);
  }, [developerMode, setShowDebugPanel]);

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'developerMode') {
        const next = e.newValue === 'true';
        setDeveloperMode(next);
        if (!next && showDebugPanel && setShowDebugPanel) {
          setShowDebugPanel(false);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    const interval = setInterval(() => {
      const currentValue = localStorage.getItem('developerMode') === 'true';
      if (currentValue !== developerMode) {
        setDeveloperMode(currentValue);
        if (!currentValue && showDebugPanel && setShowDebugPanel) {
          setShowDebugPanel(false);
        }
      }
    }, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
      if (titleClickTimerRef.current) {
        clearTimeout(titleClickTimerRef.current);
      }
    };
  }, [developerMode, showDebugPanel, setShowDebugPanel]);

  return {
    developerMode,
    titleStyle,
    onHeaderClick,
    onTitleClick,
    toggleDevPanel,
  };
};

export default useDeveloperMode;


