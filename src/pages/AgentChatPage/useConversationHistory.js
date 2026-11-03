/**
 * 页面级存储接线（阶段 E · 任务 E3）
 *
 * 职责只有三件：**载入、保存、提示**。
 *   - 载入：`listForSidebar()` 取最近一条 → `loadById` → （v1 先过 `projectV1Record`）→
 *     交给 `openConversation(record)`。不新造载入路径（`决策记录.md` C-3）。
 *   - 保存：按「保存签名」判断该不该写，签名不变就跳过——流式正文/思考增量不进签名，
 *     所以不会每个 token 写一次全量历史（`E-历史存储与恢复.md` §2.3）。
 *   - 提示：保存失败与数据损坏都以状态返回给页面，由页面渲染成可关闭的提示条；
 *     这里**不吞异常、不打印假成功**。
 *
 * 为什么放在页面目录而不是 `src/hooks/`：它依赖「哪个页面在展示哪条会话」，
 * 属于展示层的接线；会话层（`useChatSession`）已验收，E 阶段不改它（决策 5）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createHistoryStore } from '../../utils/historyStore.js';
import { projectV1Record } from '../../utils/historyV1.js';

/** 保存失败原因 → 文案键。全是 E3 新增的键，不改 `AgentChat` 里已有的键。 */
export const SAVE_FAILURE_KEYS = Object.freeze({
  quota: 'AgentChat.history.saveFailedQuota',
  corrupt: 'AgentChat.history.saveFailedCorrupt',
  invalid: 'AgentChat.history.saveFailedInvalid',
  unavailable: 'AgentChat.history.saveFailedUnavailable',
});

/** 访问浏览器存储本身在隐私模式下就可能抛，这里统一兜住并交给模块返回 `unavailable`。 */
function resolveStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** 单轮里「会改变存储内容」的那几项。正文/思考增量**故意不计入**。 */
function lastTurnSignature(turn) {
  const parts = Array.isArray(turn?.parts) ? turn.parts : [];
  const toolSignature = parts
    .filter((part) => part?.type === 'tool')
    .map((part) => `${part.toolCallId ?? ''}:${part.status ?? ''}`)
    .join(',');

  const questions = Array.isArray(turn?.questions) ? turn.questions : [];
  const questionSignature = questions
    .map((question) => `${question?.id ?? ''}:${question?.state ?? ''}`)
    .join(',');

  return [
    turn?.status ?? '',
    Array.isArray(turn?.modelMessages) ? turn.modelMessages.length : 0,
    toolSignature,
    questionSignature,
    turn?.error ? 'error' : '',
    // 类别变了也要落盘：同样是「有错误」，超时与普通失败的文案不同（F3）
    turn?.errorKind ?? '',
  ].join('§');
}

/**
 * 保存签名：会话 id + 轮数 + 最后一轮的结构签名。
 *
 * 只取最后一轮是因为四个保存点（发送 / 工具完成 / 作答提交 / 运行结束）都作用在最后一轮；
 * 已收尾的轮次不会再变，前面几轮不必参与比较。
 */
export function buildSaveSignature(conversationId, turns) {
  const list = Array.isArray(turns) ? turns : [];
  return [conversationId ?? '', list.length, lastTurnSignature(list[list.length - 1])].join('§');
}

/**
 * @param {Object} params
 * @param {Object} params.session `useChatSession()` 的返回值（只读数据 + 命令）
 * @param {Object} [params.storage] 覆盖存储对象（测试用；默认浏览器本地存储）
 */
export default function useConversationHistory({ session, storage } = {}) {
  const store = useMemo(() => createHistoryStore(storage ?? resolveStorage()), [storage]);

  // 载入只发生在挂载时，用镜像读最新 session，避免把它写进 effect 依赖
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const [ready, setReady] = useState(false);
  const [saveFailure, setSaveFailure] = useState(null);
  const [corruptCount, setCorruptCount] = useState(0);
  const [loadFailure, setLoadFailure] = useState(false);

  // E5：抽屉里的列表与删除/重命名结果
  const [conversations, setConversations] = useState([]);
  const [listFailure, setListFailure] = useState(null);
  const [actionFailure, setActionFailure] = useState(null);

  const lastSignatureRef = useRef(null);
  const restoredRef = useRef(false);

  useEffect(() => {
    // StrictMode 下 effect 会跑两遍：载入是幂等的，但重复 openConversation 会重置页面状态，挡掉
    if (restoredRef.current) return undefined;
    restoredRef.current = true;

    let cancelled = false;

    const list = store.listForSidebar();
    if (!list.ok) {
      if (!cancelled) {
        setLoadFailure(true);
        setReady(true);
      }
      return () => {
        cancelled = true;
      };
    }

    const corrupt = (list.corrupt?.v2 ?? 0) + (list.corrupt?.v1 ?? 0);
    if (corrupt > 0 && !cancelled) setCorruptCount(corrupt);

    const latest = list.items[0];
    if (latest) {
      const loaded = store.loadById(latest.id);
      if (!loaded.ok) {
        if (!cancelled) setLoadFailure(true);
      } else {
        // 旧记录必须现场投影（只读），新记录直接可用
        const record = loaded.source === 'v1' ? projectV1Record(loaded.record) : loaded.record;
        if (!record) {
          if (!cancelled) setLoadFailure(true);
        } else {
          // 用恢复内容的签名占位：刚打开时内容没变，不该立刻回写一遍
          lastSignatureRef.current = buildSaveSignature(record.id, record.turns);
          sessionRef.current?.openConversation?.(record);
        }
      }
    }

    if (!cancelled) setReady(true);
    return () => {
      cancelled = true;
    };
  }, [store]);

  const conversationId = session?.conversationId ?? null;
  const mode = session?.mode ?? null;
  const turns = session?.turns;

  useEffect(() => {
    // 恢复完成前不落盘：否则可能把空会话或半截状态写进历史
    if (!ready || !conversationId) return;
    if (!Array.isArray(turns) || turns.length === 0) return;

    const signature = buildSaveSignature(conversationId, turns);
    if (signature === lastSignatureRef.current) return;
    lastSignatureRef.current = signature;

    const result = store.saveConversation({ id: conversationId, mode, turns });
    setSaveFailure(result.ok ? null : (result.reason ?? 'unknown'));
  }, [ready, store, conversationId, mode, turns]);

  /**
   * 重读侧栏列表（每次打开抽屉都调一次，避免看到过期快照）。
   * 故意不动 `corruptCount`：那是启动时的一次性提示，用户关掉后不该因为刷新又冒出来。
   */
  const refreshConversations = useCallback(() => {
    const result = store.listForSidebar();
    if (!result.ok) {
      setListFailure(result.reason ?? 'unavailable');
      setConversations([]);
      return false;
    }
    setListFailure(null);
    setConversations(result.items);
    return true;
  }, [store]);

  /**
   * 按 id 打开一条会话：`loadById` →（v1 现场投影）→ `openConversation` → 签名占位。
   * 签名占位与启动恢复同一个理由：刚打开内容没变，不该立刻回写、把 `timestamp` 顶到最前。
   */
  const openConversationById = useCallback((id) => {
    const loaded = store.loadById(id);
    if (!loaded.ok) {
      setActionFailure(loaded.reason ?? 'unavailable');
      return false;
    }

    const record = loaded.source === 'v1' ? projectV1Record(loaded.record) : loaded.record;
    if (!record) {
      setActionFailure('corrupt');
      return false;
    }

    lastSignatureRef.current = buildSaveSignature(record.id, record.turns);
    sessionRef.current?.openConversation?.(record);
    setSaveFailure(null);
    setActionFailure(null);
    return true;
  }, [store]);

  /** 删除：同时作用于两个键；删的是当前会话时换一条新会话，避免页面停在已删除的内容上。 */
  const removeConversation = useCallback((id) => {
    const result = store.deleteConversation(id);
    if (!result.ok) {
      setActionFailure(result.reason ?? 'unavailable');
      return false;
    }

    if (id === sessionRef.current?.conversationId) sessionRef.current?.newConversation?.();
    setActionFailure(null);
    refreshConversations();
    return true;
  }, [store, refreshConversations]);

  /** 重命名：空标题由 store 回退到自动标题；成功后重读列表（顺序不变，只换标题）。 */
  const renameConversation = useCallback((id, title) => {
    const result = store.renameConversation(id, title);
    if (!result.ok) {
      setActionFailure(result.reason ?? 'unavailable');
      return false;
    }

    setActionFailure(null);
    refreshConversations();
    return true;
  }, [store, refreshConversations]);

  const dismissSaveFailure = useCallback(() => setSaveFailure(null), []);
  const dismissCorrupt = useCallback(() => setCorruptCount(0), []);
  const dismissLoadFailure = useCallback(() => setLoadFailure(false), []);
  const dismissActionFailure = useCallback(() => setActionFailure(null), []);
  const dismissListFailure = useCallback(() => setListFailure(null), []);

  return {
    ready,
    saveFailure,
    saveFailureKey: saveFailure
      ? (SAVE_FAILURE_KEYS[saveFailure] ?? 'AgentChat.history.saveFailedUnknown')
      : null,
    corruptCount,
    loadFailure,
    dismissSaveFailure,
    dismissCorrupt,
    dismissLoadFailure,

    // ── 历史列表（E5）──
    conversations,
    listFailure,
    actionFailure,
    refreshConversations,
    openConversationById,
    removeConversation,
    renameConversation,
    dismissActionFailure,
    dismissListFailure,
  };
}
