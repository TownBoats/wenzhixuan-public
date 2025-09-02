import { useCallback, useReducer, useRef } from "react";
import ContentParser from "../utils/ContentParser";

// 状态机初始值
const initialState = { list: [], selected: null };

function reducer(state, action) {
  switch (action.type) {
    case "ADD_QUESTION": {
      return { ...state, list: [...state.list, action.payload] };
    }
    case "SET_STATUS": {
      return {
        ...state,
        list: state.list.map((q) =>
          q.id === action.id
            ? {
                ...q,
                status: action.status,
                isProcessing:
                  action.status === "requesting" || action.status === "responding",
              }
            : q
        ),
      };
    }
    case "SET_ANSWER": {
      return {
        ...state,
        list: state.list.map((q) =>
          q.id === action.id ? { ...q, answer: action.answer } : q
        ),
      };
    }
    case "SELECT": {
      return {
        ...state,
        list: state.list.map((q) =>
          action.question && q.id === action.question.id
            ? { ...q, isConfirmed: true }
            : q
        ),
        selected: action.question || null,
      };
    }
    case "ANSWER_SELECTED": {
      return {
        ...state,
        list: state.list.map((q) =>
          q.id === action.id
            ? {
                ...q,
                isAnswered: true,
                selectedLevel: action.level,
                selectedContent: action.content,
              }
            : q
        ),
        selected: null,
      };
    }
    case "REMOVE": {
      return { ...state, list: state.list.filter((q) => q.id !== action.id) };
    }
    case "DESELECT": {
      return { ...state, selected: null };
    }
    case "MARK_FETCHED": {
      return {
        ...state,
        list: state.list.map((q) =>
          q.id === action.id ? { ...q, hasFetchedAnswer: true } : q
        ),
      };
    }
    case "CLEAR": {
      return { ...state, list: [], selected: null };
    }
    default:
      return state;
  }
}

function generateQuestionId() {
  return `q${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function useQuestionFlow({ optionAgent }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const parserRef = useRef(
    new ContentParser(["none", "heard", "basic", "familiar", "expert"])
  );

  // 添加问题，并返回创建的问题对象（便于上层立即发起请求）
  const addQuestion = useCallback((text, index) => {
    const question = {
      id: generateQuestionId(),
      question: String(text),
      index,
      status: "idle",
      isAnswered: false,
      isConfirmed: false,
      hasFetchedAnswer: false,
      answer: { none: "", heard: "", basic: "", familiar: "", expert: "" },
    };
    dispatch({ type: "ADD_QUESTION", payload: question });
    return question;
  }, []);

  // 发起选项 Agent 的流式请求
  const fetchOptionAnswer = useCallback(
    async (question, contextMessages) => {
      if (!question || !question.id) return;

      dispatch({ type: "SET_STATUS", id: question.id, status: "requesting" });

      let accumulated = "";
      await optionAgent.getCompletion(contextMessages, (chunk) => {
        accumulated += chunk;
        const parsed = parserRef.current.parse(accumulated);
        dispatch({
          type: "SET_ANSWER",
          id: question.id,
          answer: {
            none: parsed.none || "",
            heard: parsed.heard || "",
            basic: parsed.basic || "",
            familiar: parsed.familiar || "",
            expert: parsed.expert || "",
          },
        });
        dispatch({ type: "SET_STATUS", id: question.id, status: "responding" });
      });

      dispatch({ type: "SET_STATUS", id: question.id, status: "completed" });
      dispatch({ type: "MARK_FETCHED", id: question.id });
    },
    [optionAgent]
  );

  const selectQuestion = useCallback((q) => {
    dispatch({ type: "SELECT", question: q });
  }, []);

  const chooseLevel = useCallback((id, level, content) => {
    dispatch({ type: "ANSWER_SELECTED", id, level, content });
  }, []);

  const cancelQuestion = useCallback((id) => {
    dispatch({ type: "REMOVE", id });
  }, []);

  const deselect = useCallback(() => {
    dispatch({ type: "DESELECT" });
  }, []);

  const clearAllQuestions = useCallback(() => {
    dispatch({ type: "CLEAR" });
  }, []);

  return {
    questions: state.list,
    selectedQuestion: state.selected,
    addQuestion,
    fetchOptionAnswer,
    selectQuestion,
    chooseLevel,
    cancelQuestion,
    deselect,
    clearAllQuestions,
  };
}


