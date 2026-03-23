import React, { useState, useCallback, useEffect, useRef } from "react";
import UserInput from "../../components/UserInput/UserInput";
import AnswerCard from "../../components/AnswerCard/AnswerCard";
import SettingsPanel from "../../components/SettingsPanel/SettingsPanel";
import DebugPanel from "../../components/DebugPanel/DebugPanel";
import HeaderButtons from "../../components/HeaderButtons/HeaderButtons";
import WelcomeScreen from "../../components/WelcomeScreen/WelcomeScreen";
import ChatLayout from "../../components/ChatLayout/ChatLayout";
import HistorySidebar from "../../components/HistorySidebar/HistorySidebar";
import { useTranslation } from "react-i18next";
import useStreaming from "../../hooks/useStreaming";
import useChatHistory from "../../hooks/useChatHistory";
import useAgentsConfig from "../../hooks/useAgentsConfig";
import useQuestionFlow from "../../hooks/useQuestionFlow";
import useDeveloperMode from "../../hooks/useDeveloperMode";
import ConfigManager from "../../utils/ConfigManager";
import {
  createLinkedMessagePair,
  createUiOnlyMessage,
  createMessageId,
  extractTextContent,
  normalizeStoredChat,
} from "../../utils/chatMessages";

const cloneContentValue = (value) => {
  if (Array.isArray(value)) return [...value];
  if (value && typeof value === "object") return { ...value };
  return value;
};

const cloneUiContent = (content = []) =>
  Array.isArray(content)
    ? content.map((item) => ({
        ...item,
        value: cloneContentValue(item?.value),
      }))
    : [];

const buildInitialConversation = (t) => {
  const initialPair = createLinkedMessagePair({
    role: "assistant",
    textContent: t("ChatPage.initPrompt"),
    uiContent: [{ type: "response", value: t("ChatPage.uiInitPrompt") }],
    retryable: false,
  });

  return {
    messages: [initialPair.message],
    uiMessages: [initialPair.uiMessage],
  };
};

const ChatPage = ({ className }) => {
  const { t } = useTranslation();
  const initialConversationRef = useRef(null);
  if (!initialConversationRef.current) {
    initialConversationRef.current = buildInitialConversation(t);
  }

  const [uiMessages, setUiMessages] = useState(
    () => initialConversationRef.current.uiMessages
  );
  const uiMessagesRef = useRef(uiMessages);
  const [messages, setMessages] = useState(
    () => initialConversationRef.current.messages
  );
  const messagesRef = useRef(messages);
  const loadedHistoryIdRef = useRef(null);
  const mainAiContextRef = useRef("");

  const {
    histories,
    currentChatId,
    currentHistory,
    newChat,
    selectHistory,
    updateTitle,
    deleteHistory,
    autosave,
    setHistories,
  } = useChatHistory({ t });

  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLayout, setIsInitialLayout] = useState(true);
  const [showQuickPrompts, setShowQuickPrompts] = useState(true);
  const [showQuestionCards, setShowQuestionCards] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [showRightSidebar, setShowRightSidebar] = useState(false);

  const {
    parser: responseParser,
    currResponse,
    currResponseRef,
    end: endParser,
    reset: resetStreaming,
  } = useStreaming({
    onQuestionFound: (content, index) => {
      const question = addQuestion(content, index);

      const contextMessages = mainAiContextRef.current
        ? [
            { role: "assistant", content: mainAiContextRef.current },
            { role: "user", content: String(content) },
          ]
        : [{ role: "user", content: String(content) }];

      fetchOptionAnswer(question, contextMessages);
    },
  });

  const {
    mainAgent,
    optionAgent,
    mainModelConfig,
    optionModelConfig,
    mainPrompt,
    optionPrompt,
    updateMainConfig,
    updateOptionConfig,
    updateMainPrompt,
    updateOptionPrompt,
  } = useAgentsConfig({
    onMainLoadingChange: (loading) => setIsLoading(loading),
  });

  const {
    questions: singleTurnQuestion,
    selectedQuestion,
    addQuestion,
    fetchOptionAnswer,
    selectQuestion,
    chooseLevel,
    cancelQuestion,
    deselect,
    clearAllQuestions,
  } = useQuestionFlow({ optionAgent });

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    uiMessagesRef.current = uiMessages;
  }, [uiMessages]);

  const syncConversationState = useCallback((nextMessages, nextUiMessages) => {
    messagesRef.current = nextMessages;
    uiMessagesRef.current = nextUiMessages;
    setMessages(nextMessages);
    setUiMessages(nextUiMessages);
  }, []);

  const appendUiOnlyMessage = useCallback((nextUiMessage) => {
    setUiMessages((prevUiMessages) => {
      const nextUiMessages = [...prevUiMessages, nextUiMessage];
      uiMessagesRef.current = nextUiMessages;
      return nextUiMessages;
    });
  }, []);

  const getMessageIndexById = useCallback(
    (messageId, sourceMessages = messagesRef.current) =>
      sourceMessages.findIndex((message) => message.id === messageId),
    []
  );

  const getUiIndexByMessageId = useCallback(
    (messageId, sourceUiMessages = uiMessagesRef.current) =>
      sourceUiMessages.findIndex(
        (message) =>
          message.id === messageId || message.sourceMessageId === messageId
      ),
    []
  );

  const buildFailedAssistantPair = useCallback(
    (error, assistantMessageId) => {
      const failedMessage = t("ChatPage.requestFailed", {
        defaultValue: "请求失败，请检查模型配置后重试。",
      });
      const partialContent = cloneUiContent(currResponseRef.current);
      const failedUiContent =
        partialContent.length > 0
          ? [
              ...partialContent,
              { type: "response", value: `\n\n${failedMessage}` },
            ]
          : [{ type: "response", value: failedMessage }];

      return createLinkedMessagePair({
        id: assistantMessageId,
        role: "assistant",
        textContent: extractTextContent(failedUiContent) || failedMessage,
        uiContent: failedUiContent,
        status: "error",
        error: {
          message: failedMessage,
          detail: error?.message || "",
        },
      });
    },
    [currResponseRef, t]
  );

  const runAssistantTurn = useCallback(
    async ({
      requestMessages,
      baseMessages,
      baseUiMessages,
      assistantMessageId = createMessageId(),
    }) => {
      setIsLoading(true);
      setIsInitialLayout(false);
      setShowQuickPrompts(false);
      resetStreaming();

      try {
        let streamedResponse = "";
        await mainAgent.getCompletion(
          requestMessages,
          (content) => {
            streamedResponse += content;
            responseParser.feed(content);
          },
          () => {}
        );

        endParser();

        const assistantUiContent = cloneUiContent(currResponseRef.current);
        const assistantText =
          streamedResponse || extractTextContent(assistantUiContent);
        const assistantPair = createLinkedMessagePair({
          id: assistantMessageId,
          role: "assistant",
          textContent: assistantText,
          uiContent:
            assistantUiContent.length > 0
              ? assistantUiContent
              : [{ type: "response", value: assistantText }],
        });

        syncConversationState(
          [...baseMessages, assistantPair.message],
          [...baseUiMessages, assistantPair.uiMessage]
        );
        mainAiContextRef.current = assistantText;

        return { ok: true, response: assistantText };
      } catch (error) {
        console.error("主对话请求失败:", error);
        const failedPair = buildFailedAssistantPair(error, assistantMessageId);
        syncConversationState(
          [...baseMessages, failedPair.message],
          [...baseUiMessages, failedPair.uiMessage]
        );
        return { ok: false, error };
      } finally {
        resetStreaming();
        setIsLoading(false);
      }
    },
    [
      buildFailedAssistantPair,
      currResponseRef,
      endParser,
      mainAgent,
      resetStreaming,
      responseParser,
      syncConversationState,
    ]
  );

  const handleSendMessage = useCallback(
    async (overrideText = inputText, options = {}) => {
      const userText = String(overrideText || "").trim();
      if (!userText || isLoading) return false;

      const baseMessages = options.baseMessages || messagesRef.current;
      const baseUiMessages = options.baseUiMessages || uiMessagesRef.current;
      const userPair = createLinkedMessagePair({
        role: "user",
        textContent: userText,
        uiContent: [{ type: "response", value: userText }],
      });

      const nextMessages = [...baseMessages, userPair.message];
      const nextUiMessages = [...baseUiMessages, userPair.uiMessage];

      clearAllQuestions();
      syncConversationState(nextMessages, nextUiMessages);
      setInputText("");

      const result = await runAssistantTurn({
        requestMessages: nextMessages,
        baseMessages: nextMessages,
        baseUiMessages: nextUiMessages,
      });

      return result.ok;
    },
    [clearAllQuestions, inputText, isLoading, runAssistantTurn, syncConversationState]
  );

  useEffect(() => {
    if (singleTurnQuestion.length === 0) return;
    if (!singleTurnQuestion.every((question) => question.isAnswered)) return;
    if (isLoading) return;

    const summary = singleTurnQuestion
      .map((question, index) =>
        [
          `${t("ChatPage.question")} ${index + 1}：${question.question}`,
          `${t("ChatPage.answer")}：${question.selectedContent}`,
          "\r\n",
        ].join("\r\n")
      )
      .join("\r\n\r\n");

    const summaryPair = createLinkedMessagePair({
      role: "user",
      textContent: summary,
      uiContent: [{ type: "response", value: summary }],
    });

    const nextMessages = [...messagesRef.current, summaryPair.message];
    const nextUiMessages = uiMessagesRef.current;

    syncConversationState(nextMessages, nextUiMessages);
    clearAllQuestions();

    runAssistantTurn({
      requestMessages: nextMessages,
      baseMessages: nextMessages,
      baseUiMessages: nextUiMessages,
    });
  }, [clearAllQuestions, isLoading, runAssistantTurn, singleTurnQuestion, syncConversationState, t]);

  const handleQuestionClick = useCallback((question) => {
    selectQuestion(question);
  }, [selectQuestion]);

  const handleLevelSelect = useCallback(
    (level, content) => {
      if (!selectedQuestion) return;

      chooseLevel(selectedQuestion.id, level, content);
      appendUiOnlyMessage(
        createUiOnlyMessage({
          role: "user",
          content: [
            {
              type: "answer-card",
              value: {
                question: selectedQuestion.question,
                level,
                answer: content,
              },
            },
          ],
        })
      );
    },
    [appendUiOnlyMessage, chooseLevel, selectedQuestion]
  );

  const handleCloseAnswer = useCallback(() => {
    if (selectedQuestion) {
      deselect();
    }
  }, [deselect, selectedQuestion]);

  const handleNewChat = useCallback(
    async (initialPrompt = null) => {
      loadedHistoryIdRef.current = null;
      newChat();

      const initialConversation = buildInitialConversation(t);
      mainAiContextRef.current = "";
      clearAllQuestions();
      syncConversationState(
        initialConversation.messages,
        initialConversation.uiMessages
      );
      setIsInitialLayout(true);
      setShowQuickPrompts(true);
      setInputText("");

      if (initialPrompt) {
        await handleSendMessage(initialPrompt, {
          baseMessages: initialConversation.messages,
          baseUiMessages: initialConversation.uiMessages,
        });
      }
    },
    [clearAllQuestions, handleSendMessage, newChat, syncConversationState, t]
  );

  const handleQuickPromptSelect = useCallback((promptText) => {
    handleNewChat(promptText);
  }, [handleNewChat]);

  const handleCancelQuestion = useCallback((questionId) => {
    cancelQuestion(questionId);
  }, [cancelQuestion]);

  const handleMainConfigChange = updateMainConfig;
  const handleOptionConfigChange = updateOptionConfig;
  const handleMainPromptChange = updateMainPrompt;
  const handleOptionPromptChange = updateOptionPrompt;
  const isModelConfigured =
    ConfigManager.isModelConfigured(mainModelConfig) &&
    ConfigManager.isModelConfigured(optionModelConfig);

  useEffect(() => {
    autosave({ id: currentChatId, messages, uiMessages });
  }, [autosave, currentChatId, messages, uiMessages]);

  const handleRetryUserMessage = useCallback(
    async (messageId) => {
      if (isLoading) return;

      const currentMessages = messagesRef.current;
      const currentUiMessages = uiMessagesRef.current;
      const messageIndex = getMessageIndexById(messageId, currentMessages);
      const uiIndex = getUiIndexByMessageId(messageId, currentUiMessages);

      if (messageIndex === -1 || uiIndex === -1) return;
      if (currentMessages[messageIndex]?.role !== "user") return;

      const nextMessages = currentMessages.slice(0, messageIndex + 1);
      const nextUiMessages = currentUiMessages.slice(0, uiIndex + 1);

      clearAllQuestions();
      syncConversationState(nextMessages, nextUiMessages);

      await runAssistantTurn({
        requestMessages: nextMessages,
        baseMessages: nextMessages,
        baseUiMessages: nextUiMessages,
      });
    },
    [
      clearAllQuestions,
      getMessageIndexById,
      getUiIndexByMessageId,
      isLoading,
      runAssistantTurn,
      syncConversationState,
    ]
  );

  const handleRetryMessage = useCallback(
    async (messageId) => {
      if (isLoading) return;

      const currentMessages = messagesRef.current;
      const currentUiMessages = uiMessagesRef.current;
      const messageIndex = getMessageIndexById(messageId, currentMessages);
      const uiIndex = getUiIndexByMessageId(messageId, currentUiMessages);

      if (messageIndex === -1 || uiIndex === -1) return;
      if (currentMessages[messageIndex]?.role !== "assistant") return;

      const contextMessages = currentMessages.slice(0, messageIndex);
      if (!contextMessages.some((message) => message.role === "user")) return;

      const nextUiMessages = currentUiMessages.slice(0, uiIndex);

      clearAllQuestions();
      syncConversationState(contextMessages, nextUiMessages);

      await runAssistantTurn({
        requestMessages: contextMessages,
        baseMessages: contextMessages,
        baseUiMessages: nextUiMessages,
        assistantMessageId: currentMessages[messageIndex].id,
      });
    },
    [
      clearAllQuestions,
      getMessageIndexById,
      getUiIndexByMessageId,
      isLoading,
      runAssistantTurn,
      syncConversationState,
    ]
  );

  useEffect(() => {
    if (currentChatId) return;

    loadedHistoryIdRef.current = null;
    newChat();
    const initialConversation = buildInitialConversation(t);
    mainAiContextRef.current = "";
    syncConversationState(initialConversation.messages, initialConversation.uiMessages);
    setIsInitialLayout(true);
    setShowQuickPrompts(true);
  }, [currentChatId, newChat, syncConversationState, t]);

  useEffect(() => {
    if (!currentHistory) return;
    if (loadedHistoryIdRef.current === currentHistory.id) return;

    loadedHistoryIdRef.current = currentHistory.id;
    const normalizedHistory = normalizeStoredChat(
      currentHistory.messages || [],
      currentHistory.uiMessages || []
    );
    const hasConversation = normalizedHistory.messages.length > 1;
    const lastAssistantMessage = [...normalizedHistory.messages]
      .reverse()
      .find(
        (message) => message.role === "assistant" && message.status !== "error"
      );

    mainAiContextRef.current = lastAssistantMessage
      ? extractTextContent(lastAssistantMessage.content)
      : "";

    syncConversationState(
      normalizedHistory.messages,
      normalizedHistory.uiMessages
    );
    setIsInitialLayout(!hasConversation);
    setShowQuickPrompts(!hasConversation);
  }, [currentHistory, syncConversationState]);

  const {
    developerMode,
    titleStyle,
    onHeaderClick,
    onTitleClick,
    toggleDevPanel,
  } = useDeveloperMode({ t, showDebugPanel, setShowDebugPanel });

  return (
    <div
      className={`min-h-screen overflow-hidden relative transition-colors duration-300 ${className || ""}`}
    >
      <div className="flex h-screen">
        <div className="flex-1 flex flex-col relative">
          <div
            className="p-4 transition-colors duration-300 bg-white/80 border-b border-slate-200/60 relative z-10"
            onClick={onHeaderClick}
          >
            <div className="flex items-center justify-between">
              <h1
                className="text-xl font-medium tracking-tight font-['PingFang SC'] text-slate-800 hover:text-cyan-600 transition-colors duration-300 cursor-pointer"
                onClick={(event) => {
                  event.stopPropagation();
                  onTitleClick(event);
                  handleNewChat();
                }}
                style={titleStyle}
              >
                {t("ChatPage.title")}
                {developerMode && (
                  <span className="ml-1 text-xs text-blue-500 opacity-50">
                    Dev
                  </span>
                )}
              </h1>

              <HeaderButtons
                handleNewChat={handleNewChat}
                setShowSettings={setShowSettings}
                showSettings={showSettings}
                setShowDebugPanel={setShowDebugPanel}
                showDebugPanel={showDebugPanel}
                setShowRightSidebar={setShowRightSidebar}
                showRightSidebar={showRightSidebar}
                developerMode={developerMode}
                mainModelConfig={mainModelConfig}
                optionModelConfig={optionModelConfig}
                handleOptionPromptChange={handleOptionPromptChange}
                handleMainPromptChange={handleMainPromptChange}
                toggleDevPanel={toggleDevPanel}
              />
            </div>
          </div>

          <div
            className={`flex-1 relative overflow-hidden transition-all duration-500 ${
              isInitialLayout ? "flex items-center justify-center" : ""
            }`}
          >
            {isInitialLayout ? (
              <WelcomeScreen
                inputText={inputText}
                setInputText={setInputText}
                handleSendMessage={handleSendMessage}
                isLoading={isLoading}
                showQuickPrompts={showQuickPrompts}
                handleQuickPromptSelect={handleQuickPromptSelect}
                onOpenSettings={() => setShowSettings(true)}
                isModelConfigured={isModelConfigured}
              />
            ) : (
              <ChatLayout
                singleTurnQuestion={singleTurnQuestion}
                showQuestionCards={showQuestionCards}
                setShowQuestionCards={setShowQuestionCards}
                handleQuestionClick={handleQuestionClick}
                handleCancelQuestion={handleCancelQuestion}
                uiMessages={uiMessages}
                isLoading={isLoading}
                onRetryMessage={handleRetryMessage}
                onRetryUserMessage={handleRetryUserMessage}
                selectedQuestion={selectedQuestion}
                onLevelSelect={handleLevelSelect}
                onCloseAnswer={handleCloseAnswer}
                currResponse={currResponse}
              />
            )}
          </div>

          {!isInitialLayout && (
            <div className="border-t transition-colors duration-300 bg-white/80 backdrop-blur-sm relative z-10">
              <div className="py-4">
                <UserInput
                  inputText={inputText}
                  setInputText={setInputText}
                  handleSendMessage={handleSendMessage}
                  isLoading={isLoading}
                  centered={false}
                />
              </div>
            </div>
          )}
        </div>

        <HistorySidebar
          showRightSidebar={showRightSidebar}
          setShowRightSidebar={setShowRightSidebar}
          histories={histories}
          currentChatId={currentChatId}
          handleSelectHistory={selectHistory}
          handleDeleteHistory={deleteHistory}
          handleUpdateTitle={updateTitle}
        />
      </div>

      <SettingsPanel
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        mainModelConfig={mainModelConfig}
        optionModelConfig={optionModelConfig}
        handleMainConfigChange={handleMainConfigChange}
        handleOptionConfigChange={handleOptionConfigChange}
        mainPrompt={mainPrompt}
        optionPrompt={optionPrompt}
        handleMainPromptChange={handleMainPromptChange}
        handleOptionPromptChange={handleOptionPromptChange}
        histories={histories}
        setHistories={setHistories}
        handleNewChat={handleNewChat}
      />

      {selectedQuestion && (
        <div className="fixed inset-0 z-[9999] pointer-events-none">
          <AnswerCard
            question={selectedQuestion}
            onLevelSelect={handleLevelSelect}
            onClose={handleCloseAnswer}
          />
        </div>
      )}

      {developerMode && (
        <DebugPanel
          showDebugPanel={showDebugPanel}
          setShowDebugPanel={setShowDebugPanel}
          mainModelConfig={mainModelConfig}
          optionModelConfig={optionModelConfig}
          mainPrompt={mainPrompt}
          optionPrompt={optionPrompt}
          currentChatId={currentChatId}
          messages={messages}
          singleTurnQuestion={singleTurnQuestion}
          histories={histories}
        />
      )}
    </div>
  );
};

export default ChatPage;
