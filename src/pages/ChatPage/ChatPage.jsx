// ChatPage.jsx

import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import UserInput from "../../components/UserInput/UserInput";
import AnswerCard from "../../components/AnswerCard/AnswerCard";
import SettingsPanel from "../../components/SettingsPanel/SettingsPanel";
import DebugPanel from "../../components/DebugPanel/DebugPanel";
import HeaderButtons from "../../components/HeaderButtons/HeaderButtons";
import WelcomeScreen from "../../components/WelcomeScreen/WelcomeScreen";
import ChatLayout from "../../components/ChatLayout/ChatLayout";
import HistorySidebar from "../../components/HistorySidebar/HistorySidebar";
import { useTranslation } from 'react-i18next';
import useStreaming from "../../hooks/useStreaming";
import useChatHistory from "../../hooks/useChatHistory";
import useAgentsConfig from "../../hooks/useAgentsConfig";
import useQuestionFlow from "../../hooks/useQuestionFlow";
import useDeveloperMode from "../../hooks/useDeveloperMode";

const ChatPage = ({ className }) => {
  const { t } = useTranslation();
  const [uiMessages, setUiMessages] = useState([
    {
      role: "assistant",
      content: [{ type: "response", value: t('ChatPage.uiInitPrompt') }],
    },
  ]);
  const uiMessagesRef = useRef(uiMessages);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:  t('ChatPage.initPrompt') ,
    },
  ]);
  const messagesRef = useRef(messages);

  // 使用统一的历史记录 Hook
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
  // const [response, setResponse] = useState("");
  const [fullResponse, setFullResponse] = useState("");

  //对话中的总问题

  const [totalQuestions, setTotalQuestions] = useState([]);
  const [singleTurnResponse, setSingleTurnResponse] = useState([]); //单轮对话回答
  const [singleTurnMath, setSingleTurnMath] = useState([]); //单轮对话数学
  const [singleTurnCode, setSingleTurnCode] = useState([]); //单轮对话代码

  const { parser: responseParser, currResponse, currResponseRef, setCurrResponse, end: endParser } = useStreaming({
    onQuestionFound: (content, index) => {
      const q = addQuestion(content, index);
      singleTurnQuestionRef.current = [...singleTurnQuestionRef.current, q];

      const contextMessages = mainAiContextRef.current
        ? [
            { role: "assistant", content: mainAiContextRef.current },
            { role: "user", content: String(content) },
          ]
        : [
            { role: "user", content: String(content) },
          ];

      fetchOptionAnswer(q, contextMessages);
    }
  });


  // 添加新的状态来存储原始上下文
  const [mainAiContext, setMainAiContext] = useState("");
  const mainAiContextRef = useRef("");

  // 保留一个对问题的只读引用（用于其它副作用场景，如统计等）
  const singleTurnQuestionRef = useRef([]);

  // 在 state 声明部分添加新的状态
  const [isInitialLayout, setIsInitialLayout] = useState(true);

  // lastTag 由 useStreaming 内部维护

  // 统一通过 useAgentsConfig 管理 Agent 与配置/提示词持久化
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

  // 问题流转由 useQuestionFlow 管理（确保在拿到 optionAgent 后再初始化）
  const {
    questions: singleTurnQuestion,
    selectedQuestion,
    addQuestion,
    fetchOptionAnswer,
    selectQuestion,
    chooseLevel,
    cancelQuestion,
    clearAllQuestions,
  } = useQuestionFlow({ optionAgent });

  // 解析器由 useStreaming 提供

  // 旧的 pending 队列与请求逻辑已迁移至 useQuestionFlow

  // 在 handleSendMessage 函数中添加布局切换
  const handleSendMessage = useCallback(async () => {
    if (!inputText.trim()) return;
    
    // 切换布局
    setIsInitialLayout(false);
    setShowQuickPrompts(false);
    
    setIsLoading(true);
    // setResponse(""); // 清空之前的回复
    setFullResponse("");

    const newUiMessages = [
      ...uiMessages,
      { role: "user", content: [{ type: "response", value: inputText }] },
    ];
    const newTrueMessages = [
      ...messages,
      { role: "user", content: inputText  },
    ];
    uiMessagesRef.current = newUiMessages;
    setUiMessages(newUiMessages);
    // console.log("messages:", newUiMessages);
    // console.log("newTrueMessages:", newTrueMessages);
    setInputText("");

    try {
      let fullResponse = "";
      await mainAgent.getCompletion(
        newTrueMessages,
        (content) => {
          fullResponse += content;
          responseParser.feed(content);
        },
        async () => {
          // 更新原始上下文
          setMainAiContext(fullResponse);
          mainAiContextRef.current = fullResponse;
          // console.log("主AI响应完成，完整上下文:", fullResponse);
          
          endParser();
          setUiMessages(prevUiMessages => ([
            ...prevUiMessages,
            { role: "assistant", content: currResponseRef.current }
          ]));
          // console.log("调用完毕");
        }
      );
      
      const updatedMessages = [
        ...newTrueMessages,
        { role: "assistant", content: fullResponse }
      ];
      setMessages(updatedMessages);
      messagesRef.current = updatedMessages;
      
    } catch (error) {
      console.error("Error:", error);
      alert("发送消息时出错，请检查api配置");
    } finally {
      setIsLoading(false);
    }
  }, [inputText, messages, mainAgent]);


  useEffect(() => {
    if (singleTurnQuestion.length > 0) {
      // 修改为：只检查用户是否已手动回答所有问题
      const allQuestionsAnswered = singleTurnQuestion.every(q => q.isAnswered);
      
      if (allQuestionsAnswered) {
        // 设置加载状态
        setIsLoading(true);
        
        // 生成更规范的总结文本
        const summary = [
          ...singleTurnQuestion.map((q, index) => [
            `${t('ChatPage.question')} ${index + 1}：${q.question}`,
            `${t('ChatPage.answer')}：${q.selectedContent}`,
            `\r\n`
          ].join('\r\n'))
        ].join('\r\n\r\n');
        
        const newTrueMessages = [
          ...messages,
          { 
            role: "user", 
            content: summary
          }
        ];

        // 触发新的对话
        let fullResponse = "";
        const handleCompletion = async () => {
          try {
            await mainAgent.getCompletion(
              newTrueMessages,
              (content) => {
                fullResponse += content;
                responseParser.feed(content);
              },
              () => {
                // 更新原始上下文
                setMainAiContext(fullResponse);
                mainAiContextRef.current = fullResponse;
                // console.log("新对话完成，更新上下文:", fullResponse);
                
                endParser();
                setUiMessages(prevUiMessages => ([
                  ...prevUiMessages,
                  { role: "assistant", content: currResponseRef.current }
                ]));
                // 完成后关闭加载状态
                // setIsLoading(false);
              }
            );
          } catch (error) {
            console.error("对话生成出错:", error);
            // 出错时也要关闭加载状态
            setIsLoading(false);
          }
          // 更新消息列表
          setMessages(newTrueMessages);
          messagesRef.current = newTrueMessages;
        };

        handleCompletion();
        clearAllQuestions();
      }
    }
  }, [singleTurnQuestion, messages, uiMessages, mainAgent]);

  useEffect(() => {
    // console.log(`singleTurnResponse`, singleTurnResponse);
    if (singleTurnResponse.length > 0) {
      // setResponse(temResponse);
    }
  }, [singleTurnResponse]);

  // 生成唯一ID的逻辑已迁移至 Hook 内部

  // 问题点击处理
  const handleQuestionClick = (question) => {
    selectQuestion(question);
  };

  // 等级选择处理
  const handleLevelSelect = (level, content) => {
    if (!selectedQuestion) return;
    chooseLevel(selectedQuestion.id, level, content);

    // 将用户的回答添加到消息列表中，使用新的卡片形式
    setUiMessages(prev => [
      ...prev,
      { 
        role: "user", 
        content: [{
          type: "answer-card",
          value: {
            question: selectedQuestion.question,
            level: level,
            answer: content
          }
        }]
      }
    ]);
  };

  // 关闭答案卡片
  const handleCloseAnswer = () => {
    // 关闭答案卡片
    if (selectedQuestion) {
      // 若仅想关闭弹层而保留问题状态，可只取消选择
      deselect();
    }
  };

  // 修改 handleNewChat 函数
  const handleNewChat = (initialPrompt = null) => {
    setIsInitialLayout(true);
    const id = newChat();
    
    const initialMessage = {
      role: "assistant",
      content: t('ChatPage.initPrompt'),
    };
    
    const initialUiMessage = {
      role: "assistant",
      content: [{ 
        type: "response", 
        value: t('ChatPage.uiInitPrompt') 
      }],
    };

    setMessages([initialMessage]);
    setUiMessages([initialUiMessage]);
    
    // 重置其他状态
    clearAllQuestions(); // 清空问题列表
    setShowQuickPrompts(true); // 显示快速开始面板
    
    // 如果有初始提示，自动发送
    if (initialPrompt) {
      setInputText(initialPrompt);
      // 使用 setTimeout 确保状态更新后再发送消息
      setTimeout(() => {
        handleSendMessage();
      }, 100);
    }
  };

  // 移除散落保存逻辑，统一由 autosave 处理

  // 修改快速提示选择处理函数
  const handleQuickPromptSelect = (promptText) => {
    handleNewChat(promptText); // 创建新对话并发送选中的提示
    setShowQuickPrompts(false);
  };

  // 在ChatPage组件中添加新的state
  const [showQuickPrompts, setShowQuickPrompts] = useState(true);

  // 添加新的 useEffect 来处理 currResponse 的清空
  useEffect(() => {
    if (uiMessages.length > 0 && currResponse.length > 0) {
      const lastMessage = uiMessages[uiMessages.length - 1];
      // 检查最后一条消息是否包含当前的 currResponse
      if (lastMessage.role === 'assistant' && 
          JSON.stringify(lastMessage.content) === JSON.stringify(currResponse)) {
        // 确保 uiMessages 已更新后再清空 currResponse
        // console.log("两者的内容:", lastMessage.content, currResponse);
        setCurrResponse([]);
      }
    }
  }, [uiMessages, currResponse]);

  // 处理取消问题的函数
  const handleCancelQuestion = (questionId) => {
    cancelQuestion(questionId);
  };

  // 配置与提示词更新，直接使用 Hook 暴露的方法
  const handleMainConfigChange = updateMainConfig;
  const handleOptionConfigChange = updateOptionConfig;
  const handleMainPromptChange = updateMainPrompt;
  const handleOptionPromptChange = updateOptionPrompt;

  // 合并后的唯一自动保存
  useEffect(() => {
    autosave({ id: currentChatId, messages, uiMessages });
  }, [autosave, currentChatId, messages, uiMessages]);

  // 添加新的状态控制问题卡片容器的展开/收起
  const [showQuestionCards, setShowQuestionCards] = useState(true);

  // 修改 handleRetryUserMessage 函数
  const handleRetryUserMessage = async (messageIndex) => {
    // 确保是用户消息
    if (messages[messageIndex].role !== "user") return;
    
    // 获取要重发的消息内容
    const userMessage = messages[messageIndex];
    const userContent = typeof userMessage.content === 'string' 
      ? userMessage.content 
      : userMessage.content.map(item => item.value).join('\n');
    
    setIsLoading(true);
    setInputText(""); // 清空输入框
    
    // 删除该消息后的所有消息
    const newMessages = messages.slice(0, messageIndex);
    const newUiMessages = uiMessages.slice(0, messageIndex);
    
    // 立即更新状态，让UI显示删除效果
    setMessages(newMessages);
    setUiMessages(newUiMessages);
    messagesRef.current = newMessages;
    uiMessagesRef.current = newUiMessages;
    
    // 重新添加用户消息
    const newUserMessages = [
      ...newMessages,
      userMessage
    ];
    const newUserUiMessages = [
      ...newUiMessages,
      uiMessages[messageIndex] // 保留原始格式的用户消息
    ];
    
    setMessages(newUserMessages);
    setUiMessages(newUserUiMessages);
    messagesRef.current = newUserMessages;
    uiMessagesRef.current = newUserUiMessages;
    
    // 清空单轮对话问题
    clearAllQuestions();
    
    try {
      // 发送到AI进行处理
      let fullResponse = "";
      await mainAgent.getCompletion(
        newUserMessages,
        (content) => {
          fullResponse += content;
          responseParser.feed(content);
        },
        async () => {
          // 更新原始上下文
          setMainAiContext(fullResponse);
          mainAiContextRef.current = fullResponse;
          
          // 结束解析器的处理并推入 UI 消息
          endParser();
          setUiMessages(prevUiMessages => ([
            ...prevUiMessages,
            { role: "assistant", content: currResponseRef.current }
          ]));
          
          // 将新的回答添加到消息列表
          const finalMessages = [...newUserMessages, { 
            role: "assistant", 
            content: fullResponse 
          }];
          
          setMessages(finalMessages);
          messagesRef.current = finalMessages;
        }
      );
    } catch (error) {
      console.error("重试用户消息时出错:", error);
      // 处理错误
    } finally {
      setIsLoading(false);
    }
  };

  // 在现有的 state 声明中添加
  const [showSettings, setShowSettings] = useState(false);

  // 添加新的状态控制调试面板
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  // 在 ChatPage 组件内添加新的状态
  const [showRightSidebar, setShowRightSidebar] = useState(false);

  // 添加 handleRetryMessage 函数
  const handleRetryMessage = async (messageIndex) => {
    // 找到要重试的消息的上下文
    const contextMessages = messages.slice(0, messageIndex);
    const lastUserMessage = contextMessages.filter(m => m.role === "user").pop();
    
    if (!lastUserMessage) return;

    setIsLoading(true);
    setCurrResponse([]);

    try {
      // 先删除当前的回答
      const newMessages = messages.slice(0, messageIndex);
      const newUiMessages = uiMessages.slice(0, messageIndex);
      
      // 立即更新状态，让UI显示删除效果
      setMessages(newMessages);
      setUiMessages(newUiMessages);
      messagesRef.current = newMessages;
      uiMessagesRef.current = newUiMessages;

      // 清空问题列表，因为要重新生成
      clearAllQuestions();

      let fullResponse = "";
      await mainAgent.getCompletion(
        contextMessages,
        (content) => {
          fullResponse += content;
          responseParser.feed(content);
        },
        async () => {
          // 更新原始上下文
          setMainAiContext(fullResponse);
          mainAiContextRef.current = fullResponse;
          
          // 结束解析器的处理并推入 UI 消息
          endParser();
          setUiMessages(prevUiMessages => ([
            ...prevUiMessages,
            { role: "assistant", content: currResponseRef.current }
          ]));

          // 将新的回答添加到消息列表
          const finalMessages = [...newMessages, { 
            role: "assistant", 
            content: fullResponse 
          }];
          
          setMessages(finalMessages);
          messagesRef.current = finalMessages;
        }
      );

    } catch (error) {
      console.error("重试回答时出错:", error);
      // 发生错误时恢复原始消息
      setMessages(messages);
      setUiMessages(uiMessages);
      messagesRef.current = messages;
      uiMessagesRef.current = uiMessages;
    } finally {
      setIsLoading(false);
    }
  };

  // 当当前对话为空时，创建一个新对话并初始化界面
  useEffect(() => {
    if (!currentChatId) {
      newChat();
      const initialMessage = {
        role: "assistant",
        content: t('ChatPage.initPrompt'),
      };
      const initialUiMessage = {
        role: "assistant",
        content: [{ type: "response", value: t('ChatPage.uiInitPrompt') }],
      };
      setMessages([initialMessage]);
      setUiMessages([initialUiMessage]);
      setIsInitialLayout(true);
      setShowQuickPrompts(true);
    }
  }, [currentChatId, newChat, t]);

  // 监听 currentHistory，同步消息与布局
  useEffect(() => {
    if (currentHistory) {
      setMessages(currentHistory.messages || []);
      setUiMessages(currentHistory.uiMessages || []);
      if (currentHistory.messages && currentHistory.messages.length > 1) {
        setIsInitialLayout(false);
        setShowQuickPrompts(false);
      } else {
        setIsInitialLayout(true);
        setShowQuickPrompts(true);
      }
    }
  }, [currentHistory]);

  // 删除与标题更新均使用 Hook 提供的方法

  const {
    developerMode,
    titleStyle,
    onHeaderClick,
    onTitleClick,
    toggleDevPanel,
  } = useDeveloperMode({ t, showDebugPanel, setShowDebugPanel });

  return (
    <div className="min-h-screen overflow-hidden relative transition-colors duration-300">
      <div className="flex h-screen">
        <div className="flex-1 flex flex-col relative">
          <div 
            className={`p-4 transition-colors duration-300 ${
              'bg-white/80 border-b border-slate-200/60'
            } relative z-10`}
            onClick={onHeaderClick}
          >
            <div className="flex items-center justify-between">
              <h1 
                className={`text-xl font-medium tracking-tight font-['PingFang SC'] ${
                  'text-slate-800'
                } hover:text-cyan-600 transition-colors duration-300 cursor-pointer`}
                onClick={(e) => {
                  e.stopPropagation();
                  onTitleClick(e);
                  handleNewChat();
                }}
                style={titleStyle}
              >
                {t('ChatPage.title')}
                {developerMode && (
                  <span className="ml-1 text-xs text-blue-500 opacity-50">Dev</span>
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

          <div className={`flex-1 relative overflow-hidden transition-all duration-500 ${
            isInitialLayout ? 'flex items-center justify-center' : ''
          }`}>
            {isInitialLayout ? (
              <WelcomeScreen 
                inputText={inputText}
                setInputText={setInputText}
                handleSendMessage={handleSendMessage}
                isLoading={isLoading}
                showQuickPrompts={showQuickPrompts}
                handleQuickPromptSelect={handleQuickPromptSelect}
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

      {/* 使用新的SettingsPanel组件 */}
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

      {/* 使用新的DebugPanel组件 - 仅在开发者模式下显示 */}
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
