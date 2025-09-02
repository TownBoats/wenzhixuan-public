import { useMemo, useRef, useState } from "react";
import StreamingParser from "../utils/StreamingParser";

export default function useStreaming({ onQuestionFound } = {}) {
  const [currResponse, setCurrResponse] = useState([]);
  const currResponseRef = useRef([]);
  const lastTagRef = useRef("response");

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

  const end = () => parser.end();

  return { parser, currResponse, currResponseRef, setCurrResponse, end };
}


