import { useCallback, useState } from 'react';

/**
 * 调试记录：保存最近的模型请求，供调试抽屉查看。
 *
 * 记录只在内存中，不进会话历史、备份或导出；关闭调试即清空。
 * 开关沿用已有的 `developerMode` 存储键。
 */
export const DEBUG_STORAGE_KEY = 'developerMode';
export const DEBUG_MAX_RECORDS = 40;

function readEnabled() {
  try {
    return localStorage.getItem(DEBUG_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** 同 id 合并（请求开始与结束各推一次），超出上限丢弃最旧的。 */
export function upsertRecord(records, record) {
  if (!record?.id) return records;
  const index = records.findIndex((item) => item.id === record.id);
  if (index >= 0) {
    return records.map((item, i) => (i === index ? { ...item, ...record } : item));
  }
  return [...records, record].slice(-DEBUG_MAX_RECORDS);
}

export function useDebugLog() {
  const [enabled, setEnabledState] = useState(readEnabled);
  const [records, setRecords] = useState([]);

  const push = useCallback((record) => setRecords((list) => upsertRecord(list, record)), []);
  const clear = useCallback(() => setRecords([]), []);

  const setEnabled = useCallback((next) => {
    try {
      localStorage.setItem(DEBUG_STORAGE_KEY, String(next));
    } catch {
      // 存储不可用时只在本次页面内生效
    }
    setEnabledState(next);
    if (!next) setRecords([]);
  }, []);

  return { enabled, setEnabled, refresh: () => setEnabledState(readEnabled()), records, push, clear };
}
