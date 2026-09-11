import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import StreamingParser from "../utils/StreamingParser";

export default function useStreaming({ onQuestionFound } = {}) {
  const [currResponse, setCurrResponse] = useState([]);
  const currResponseRef = useRef([]);
  const lastTagRef = useRef("response");

  // 思考模式通道
  const [currThinking, setCurrThinking] = useState("");
  const currThinkingRef = useRef("");

  // onQuestionFound 通常是内联箭头函数（每次渲染都是新引用），用 ref 保存最新引用，
  // 避免 parser 被反复重建
  const onQuestionFoundRef = useRef(onQuestionFound);
  useEffect(() => {
    onQuestionFoundRef.current = onQuestionFound;
  }, [onQuestionFound]);

  /**
   * 追加一个内容片段。
   *
   * 关键：以 currResponseRef 为唯一数据源做纯函数式计算，再用结果值调用 setState。
   * 不能写成 setCurrResponse(prev => { next[next.length-1].value += content; ... })：
   * 那种写法就地改写了上一份 state 里的对象，而 React（StrictMode）会重复调用
   * updater，同一个 chunk 会被追加两次 —— 表现就是正文"每个字渲染两遍"。
   */
  const appendChunk = useCallback((tag, content) => {
    const prev = currResponseRef.current;
    const lastIndex = prev.length - 1;

    const next =
      lastIndex >= 0 && tag === lastTagRef.current
        ? [
            ...prev.slice(0, lastIndex),
            { ...prev[lastIndex], value: `${prev[lastIndex].value}${content}` },
          ]
        : [...prev, { type: tag, value: content }];

    lastTagRef.current = tag;
    currResponseRef.current = next;
    setCurrResponse(next);
  }, []);

  // parser 只创建一次：回调本身稳定，且内部通过 ref 读最新数据
  const parser = useMemo(
    () =>
      new StreamingParser({
        contentChunk: ({ content, tag }) => appendChunk(tag, content),
        questionComplete: ({ content, index }) => {
          onQuestionFoundRef.current?.(String(content), index);
        },
        parsingComplete: () => {
          // 交由上层决定何时把 currResponse 推入 uiMessages
        },
      }),
    [appendChunk],
  );

  const feedThinking = useCallback((chunk) => {
    setCurrThinking((prev) => prev + chunk);
    currThinkingRef.current += chunk;
  }, []);

  const end = useCallback(() => parser.end(), [parser]);

  const reset = useCallback(() => {
    parser.dispose();
    lastTagRef.current = "response";
    currResponseRef.current = [];
    setCurrResponse([]);
    // 注意：thinking 在 reset 时不清空，由 runAssistantTurn 在 finally 调用 resetThinking
  }, [parser]);

  const resetThinking = useCallback(() => {
    currThinkingRef.current = "";
    setCurrThinking("");
  }, []);

  return {
    parser,
    currResponse,
    currResponseRef,
    setCurrResponse,
    currThinking,
    currThinkingRef,
    feedThinking,
    end,
    reset,
    resetThinking,
  };
}
