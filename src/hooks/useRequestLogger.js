import { useCallback, useRef, useState } from 'react';

let _idCounter = 0;
const genId = () => `log_${Date.now()}_${(_idCounter++).toString(36)}`;

/**
 * 请求日志 Hook
 *
 * 每条 LogEntry 结构：
 * {
 *   id:              string,
 *   agent:           'main' | 'option',
 *   status:          'pending' | 'streaming' | 'success' | 'error',
 *   startTime:       number,
 *   endTime:         number | null,
 *   duration:        number | null,   // ms
 *   requestMessages: Array,
 *   questionText:    string | null,   // option agent 专用
 *   requestMeta:     Object | null,   // url, model, temperature 等
 *   responseText:    string,
 *   thinkingText:    string,
 *   statusCode:      number | null,   // HTTP 状态码
 *   responseBody:    string | null,   // 原始错误响应体
 *   error:           string | null,
 * }
 */
export default function useRequestLogger() {
  const [logs, setLogs] = useState([]);
  // 用 ref 维护最新 logs，避免 stale closure 问题
  const logsRef = useRef([]);

  const _update = useCallback((id, patcher) => {
    setLogs(prev => {
      const next = prev.map(entry =>
        entry.id === id ? { ...entry, ...patcher(entry) } : entry
      );
      logsRef.current = next;
      return next;
    });
  }, []);

  /**
   * 开始一次请求，返回 logId
   */
  const startLog = useCallback((agent, requestMessages, questionText = null, requestMeta = null) => {
    const id = genId();
    const entry = {
      id,
      agent,
      status: 'pending',
      startTime: Date.now(),
      endTime: null,
      duration: null,
      requestMessages: requestMessages ?? [],
      questionText,
      requestMeta,
      responseText: '',
      thinkingText: '',
      statusCode: null,
      responseBody: null,
      error: null,
    };
    setLogs(prev => {
      // 最多保留 100 条，避免内存无限增长
      const trimmed = prev.length >= 100 ? prev.slice(-99) : prev;
      const next = [...trimmed, entry];
      logsRef.current = next;
      return next;
    });
    return id;
  }, []);

  /** 标记进入流式阶段 */
  const markStreaming = useCallback((id) => {
    _update(id, () => ({ status: 'streaming' }));
  }, [_update]);

  /** 追加正文 chunk */
  const appendResponse = useCallback((id, chunk) => {
    _update(id, entry => ({ responseText: entry.responseText + chunk }));
  }, [_update]);

  /** 追加思考 chunk */
  const appendThinking = useCallback((id, chunk) => {
    _update(id, entry => ({ thinkingText: entry.thinkingText + chunk }));
  }, [_update]);

  /** 结束请求 */
  const finishLog = useCallback((id, status, errorMsg = null, statusCode = null, responseBody = null, actualUrl = null, sentBody = null) => {
    _update(id, entry => {
      const endTime = Date.now();
      return {
        status,
        endTime,
        duration: endTime - entry.startTime,
        error: errorMsg,
        statusCode,
        responseBody,
        ...(actualUrl && { actualUrl }),
        ...(sentBody && { sentBody }),
      };
    });
  }, [_update]);

  /** 清空所有日志 */
  const clearLogs = useCallback(() => {
    logsRef.current = [];
    setLogs([]);
  }, []);

  return {
    logs,
    logsRef,
    startLog,
    markStreaming,
    appendResponse,
    appendThinking,
    finishLog,
    clearLogs,
  };
}
