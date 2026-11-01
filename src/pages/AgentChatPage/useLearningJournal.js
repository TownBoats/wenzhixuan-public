/**
 * 学习链路 · 页面层调度（ADR-001 §3.4）
 *
 * 对账式：每次 turns 变化，算「已闭合但还没提取（或已过期）」的单元，
 * 一次只跑一个，成功后写库并触发下一轮对账。
 *
 * 边界：
 *   - 不碰 reducer，不写 turn 状态；失败只留在学习记录里；
 *   - 会话切换立即中止在途请求，并用代次号丢弃迟到结果；
 *   - 未配置副模型时完全不发请求，UI 显示为不可用；
 *   - 失败单元只在本轮对话里跳过，turns 一变化就重新有机会重试。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { extractLearning, isExtractConfigReady } from '../../agent/services/extractLearning.js';
import {
  applyUnitFailure,
  applyUnitResult,
  buildEvidencePool,
  buildExtractionInput,
  digestState,
  nextPendingUnit,
  projectRecord,
  validateNodes,
} from '../../utils/learningJournal.js';
import { createLearningJournalStore } from '../../utils/learningJournalStore.js';

/**
 * 提取器版本：提示词或校验规则改版时递增，旧结果自动过期。
 * v2：节点改为「概念主题 + 状态」，v1 的结果没有 topic，需要重算。
 */
export const EXTRACTOR_VERSION = 'v2';

function resolveStorage(explicit) {
  if (explicit) return explicit;
  return typeof localStorage === 'undefined' ? null : localStorage;
}

export default function useLearningJournal({
  session,
  optionConfig,
  systemPrompt,
  storage,
} = {}) {
  const store = useMemo(() => createLearningJournalStore(resolveStorage(storage)), [storage]);

  const conversationId = session?.conversationId ?? null;
  const turns = session?.turns;
  const isRunning = session?.isRunning ?? false;

  const [record, setRecord] = useState(null);
  // 计数而不是布尔：用户重复展开时也要重新对账（含尾单元）
  const [requestTick, setRequestTick] = useState(0);
  const [extracting, setExtracting] = useState(false);
  const [failure, setFailure] = useState(null);

  const controllerRef = useRef(null);
  const busyRef = useRef(false);
  const blockedRef = useRef(null);
  const generationRef = useRef(0);
  const recordRef = useRef(null);
  const tailRef = useRef(false);
  const turnsRef = useRef(turns);
  turnsRef.current = turns;

  // 会话切换：中止在途、重置视图、读取该会话的记录
  useEffect(() => {
    generationRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    busyRef.current = false;
    blockedRef.current = null;
    recordRef.current = null;
    tailRef.current = false;
    setExtracting(false);
    setFailure(null);
    setRequestTick(0);

    if (!conversationId) {
      setRecord(null);
      return;
    }

    const loaded = store.load(conversationId);
    const nextRecord = loaded.ok ? loaded.record : null;
    recordRef.current = nextRecord;
    setRecord(nextRecord);
    if (!loaded.ok) setFailure(loaded.reason ?? 'unavailable');
  }, [conversationId, store]);

  // 卸载时中止，避免运行层继续往已卸载的页面推结果
  useEffect(() => () => controllerRef.current?.abort(), []);

  // 首次生成由用户显式触发（展开链路时），避免打开旧会话就批量消耗；
  // 尾单元也只在这一次展开里提取，之后轮次变化不会反复重跑
  const requestGeneration = useCallback(() => {
    tailRef.current = true;
    setRequestTick((tick) => tick + 1);
  }, []);

  useEffect(() => {
    if (!conversationId) return undefined;
    if (!Array.isArray(turns) || turns.length === 0) return undefined;
    if (isRunning || busyRef.current) return undefined;
    if (requestTick === 0 && !recordRef.current) return undefined;
    if (!systemPrompt || !isExtractConfigReady(optionConfig)) return undefined;

    const baseRecord = recordRef.current ?? { units: [] };
    const allowTail = tailRef.current;
    const pending = nextPendingUnit({
      turns,
      record: baseRecord,
      extractorVersion: EXTRACTOR_VERSION,
      includeTail: allowTail,
    });

    if (!pending) return undefined;
    // 同一批 turns 下刚失败过就不再自动重试；turns 一变化就放行，
    // 否则失败单元会永久堵住后面所有单元
    if (blockedRef.current === turns) return undefined;

    const generation = generationRef.current;
    const controller = new AbortController();
    controllerRef.current = controller;
    busyRef.current = true;
    setExtracting(true);

    const run = async () => {
      const pool = buildEvidencePool({ unit: pending.unit, turns });
      const input = buildExtractionInput({
        unit: pending.unit,
        turns,
        prevState: projectRecord(baseRecord.units),
      });

      let result;
      try {
        result = await extractLearning({
          input,
          config: optionConfig,
          systemPrompt,
          abortSignal: controller.signal,
        });
      } catch {
        result = { status: 'unavailable', errorCode: 'learning_model_failed', detail: 'request_failed' };
      }

      // 会话已切换或组件已卸载：迟到结果直接丢，不写库、不报错
      if (generation !== generationRef.current || controller.signal.aborted) {
        busyRef.current = false;
        return;
      }

      const fallbackGoal =
        turns.find((turn) => turn?.id === pending.unit.turnId)?.userMessage?.text ?? '';

      if (result.status !== 'ready') {
        const next = {
          ...baseRecord,
          conversationId,
          units: applyUnitFailure(baseRecord, {
            unit: pending.unit,
            inputHash: pending.inputHash,
            prevDigest: pending.prevDigest,
            extractorVersion: EXTRACTOR_VERSION,
            reason: result.detail ?? result.errorCode ?? 'failed',
          }),
        };
        recordRef.current = next;
        setRecord(next);
        setFailure(result.errorCode ?? 'failed');
        blockedRef.current = turns;
        setExtracting(false);
        busyRef.current = false;
        return;
      }

      const validated = validateNodes(result, {
        evidencePool: pool,
        isFirstUnit: pending.isFirstUnit,
        fallbackGoal,
      });

      const withUnit = applyUnitResult(baseRecord, {
        unit: pending.unit,
        goal: validated.goal,
        nodes: validated.nodes,
        inputHash: pending.inputHash,
        prevDigest: pending.prevDigest,
        stateDigest: '',
        extractorVersion: EXTRACTOR_VERSION,
      });

      const stateDigest = digestState(projectRecord(withUnit));
      const next = {
        ...baseRecord,
        conversationId,
        units: withUnit.map((unit) =>
          unit.key === pending.unit.key ? { ...unit, stateDigest } : unit,
        ),
      };

      recordRef.current = next;
      setRecord(next);
      blockedRef.current = null;
      setFailure(null);
      setExtracting(false);
      busyRef.current = false;
      // 尾单元只提取一次；闭合单元不受影响，会继续对账
      if (pending.unit.isTail) tailRef.current = false;

      const saved = store.save(next);
      // 保存失败要显式报出来：学习记录是派生数据，但「以为存了其实没存」不能默默发生
      if (!saved.ok) setFailure(saved.reason ?? 'save_failed');
    };

    run();

    return undefined;
    // record 参与依赖：一个单元写回后要立刻对账下一个，否则只会提取队首
  }, [conversationId, turns, isRunning, requestTick, optionConfig, systemPrompt, store, record]);

  const projected = useMemo(() => projectRecord(record?.units), [record]);

  // 有结果就展示结果：保存失败属于另一条信息，不该把已经算出来的链路也藏起来
  let state = 'empty';
  if (!isExtractConfigReady(optionConfig)) state = 'unavailable';
  else if (extracting) state = 'extracting';
  else if (projected.nodes.length > 0) state = 'ready';
  else if (failure) state = 'failed';

  return {
    state,
    goal: projected.goal,
    nodes: projected.nodes,
    extracting,
    failure,
    requestGeneration,
  };
}
