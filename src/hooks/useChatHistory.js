// src/hooks/useChatHistory.js
import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = 'chat_histories';

export default function useChatHistory({ t }) {
  const [histories, setHistories] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [currentChatId, setCurrentChatId] = useState(null);

  // 读取当前对话
  const currentHistory = useMemo(
    () => histories.find(h => h.id === currentChatId) || null,
    [histories, currentChatId]
  );

  // 创建新对话
  const newChat = useCallback(() => {
    const id = `chat_${Date.now()}`;
    setCurrentChatId(id);
    return id;
  }, []);

  // 选择对话
  const selectHistory = useCallback((historyId) => {
    setCurrentChatId(historyId);
  }, []);

  // 更新标题
  const updateTitle = useCallback((historyId, newTitle) => {
    setHistories(prev => {
      const next = prev.map(h => h.id === historyId ? { ...h, title: newTitle || t('ChatPage.newChat') } : h);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, [t]);

  // 删除
  const deleteHistory = useCallback((historyId) => {
    setHistories(prev => {
      const next = prev.filter(h => h.id !== historyId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    if (historyId === currentChatId) {
      setCurrentChatId(null);
    }
  }, [currentChatId]);

  // **唯一**的自动保存出口（把原来两处保存合并成这里一个）
  const autosave = useCallback(({ id, messages, uiMessages }) => {
    if (!id || !messages || messages.length <= 1) return;

    const firstUser = messages.find(m => m.role === 'user');
    const title = firstUser
      ? (typeof firstUser.content === 'string'
          ? firstUser.content.slice(0, 30)
          : firstUser.content[0]?.value?.slice(0, 30) || t('ChatPage.newChat'))
      : t('ChatPage.newChat');

    setHistories(prev => {
      const idx = prev.findIndex(h => h.id === id);
      const newHistory = {
        id,
        title,
        messages,
        uiMessages,
        timestamp: Date.now(),
      };
      let next;
      if (idx >= 0) {
        // 有更新：放到最前
        next = [newHistory, ...prev.filter(h => h.id !== id)];
      } else {
        next = [newHistory, ...prev];
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, [t]);

  return {
    histories,
    currentChatId,
    currentHistory,
    newChat,
    selectHistory,
    updateTitle,
    deleteHistory,
    autosave,
    setHistories, // 如果 SettingsPanel 需要直接设值
  };
}
