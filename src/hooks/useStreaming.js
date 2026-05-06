import { useMemo, useRef, useState } from "react";
import StreamingParser from "../utils/StreamingParser";

export default function useStreaming({ onQuestionFound } = {}) {
  const [currResponse, setCurrResponse] = useState([]);
  const currResponseRef = useRef([]);
  const lastTagRef = useRef("response");

  // 思考模式通道
  const [currThinking, setCurrThinking] = useState("");
  const currThinkingRef = useRef("");

  const parser = useMemo(() => new StreamingParser({
    contentChunk: ({ content, tag }) => {
      setCurrResponse(prev => {
        if (tag === lastTagRef.current && prev.length > 0) {
          const next = [...prev];
          next[next.length - 1].value += content;
          currResponseRef.current = next;
          return next;
        } else {
          lastTagRef.current = tag;
          const next = [...prev, { type: tag, value: content }];
          currResponseRef.current = next;
          return next;
        }
      });
    },
    questionComplete: ({ content, index }) => {
      onQuestionFound?.(String(content), index);
    },
    parsingComplete: () => {
      // 交由上层决定何时把 currResponse 推入 uiMessages
    },
  }), [onQuestionFound]);

  const feedThinking = (chunk) => {
    setCurrThinking(prev => prev + chunk);
    currThinkingRef.current += chunk;
  };

  const end = () => parser.end();

  const reset = () => {
    parser.dispose();
    lastTagRef.current = "response";
    currResponseRef.current = [];
    setCurrResponse([]);
    // 注意：thinking 在 reset 时不清空，由 runAssistantTurn 在 finally 调用 resetThinking
  };

  const resetThinking = () => {
    currThinkingRef.current = "";
    setCurrThinking("");
  };

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
