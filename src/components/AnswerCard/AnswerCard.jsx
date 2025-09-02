import React, { useEffect, useState, useRef } from 'react';
import Draggable from 'react-draggable';
import MarkdownRenderer from '../MarkdownRenderer/MarkdownRenderer';
import { Resizable } from 'react-resizable';
import 'react-resizable/css/styles.css';
import { useTranslation } from 'react-i18next';


const AnswerCard = ({ question, onLevelSelect, onClose, theme = 'default' }) => {

  const { t } = useTranslation();
  const [customAnswer, setCustomAnswer] = React.useState('');
  const [localAnswers, setLocalAnswers] = useState(question?.answer || {});
  const [revealedCards, setRevealedCards] = useState({});
  const [hoveredCard, setHoveredCard] = useState(null);
  const [countdowns, setCountdowns] = useState({});

  const LEVEL_LABELS = {
    none: t('AnswerCard.none'),
    heard: t('AnswerCard.heard'),
    basic: t('AnswerCard.basic'),
    familiar: t('AnswerCard.familiar'),
    expert: t('AnswerCard.expert')
  };
  
  // 先初始化 size 状态
  const [size, setSize] = useState(() => {
    // 尝试从localStorage获取保存的尺寸
    const savedSize = localStorage.getItem('answerCardSize');
    if (savedSize) {
      try {
        const parsedSize = JSON.parse(savedSize);
        // 检查保存的尺寸是否合理
        if (parsedSize && 
            parsedSize.width >= 450 && parsedSize.width <= 1200 && 
            parsedSize.height >= 350 && parsedSize.height <= window.innerHeight * 0.9) {
          return parsedSize;
        }
      } catch (e) {
        console.error('Error parsing saved size:', e);
      }
    }
    
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // 计算合适的初始宽度 (最小700px，最大为视窗宽度的75%)
    const initialWidth = Math.min(
      Math.max(700, viewportWidth * 0.65),
      viewportWidth * 0.75
    );
    
    // 计算合适的初始高度，使用16:9的黄金比例
    // 宽高比限制在最小450px，最大为视窗高度的80%
    const targetHeight = initialWidth * 0.5625; // 16:9比例
    const initialHeight = Math.min(
      Math.max(450, targetHeight),
      viewportHeight * 0.8
    );

    return {
      width: initialWidth,
      height: initialHeight
    };
  });

  // 然后再初始化 position 状态
  const [position, setPosition] = useState(() => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    return { 
      x: Math.max((viewportWidth - size.width) / 2, 20),  // 水平居中
      y: Math.max((viewportHeight - size.height) / 2, 20)  // 垂直居中
    };
  });

  const [isDragging, setIsDragging] = useState(false);
  const cardRef = useRef(null);
  const nodeRef = useRef(null);
  
  // 折叠状态
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!question || typeof question !== 'object') return null;
  if (!question.question || !question.answer) return null;

  // 检查答案是否正在加载（所有答案内容为空字符串）
  const isLoading = Object.values(localAnswers).every(value => value === "");

  // 监听问题答案的变化
  useEffect(() => {
    if (question?.answer) {
      setLocalAnswers(question.answer);
    }
  }, [question.answer]);

  // 初始化计时器
  useEffect(() => {
    if (!question?.answer) return;
    
    // 获取等待时间设置
    const enableWaitTime = localStorage.getItem('enableWaitTime') !== 'false'; // 默认启用
    
    // 如果禁用等待时间，直接返回
    if (!enableWaitTime) {
      setCountdowns({ global: 0 });
      return;
    }
    
    // 获取设置的等待时间，默认5秒
    const savedTime = localStorage.getItem('waitTime');
    const countdown = savedTime ? parseInt(savedTime) : 5; 
    
    // 创建全局倒计时状态
    setCountdowns({ global: countdown });
    
    // 如果等待时间为0，直接返回
    if (countdown <= 0) return;
    
    // 创建计时器
    const timer = setInterval(() => {
      setCountdowns(prev => {
        if (prev.global > 0) {
          return { global: prev.global - 1 };
        } else {
          // 倒计时结束，清除计时器
          clearInterval(timer);
          return { global: 0 };
        }
      });
    }, 1000);
    
    // 清理函数
    return () => {
      clearInterval(timer);
    };
  }, [question?.answer]);

  // 处理拖拽开始
  const handleDragStart = () => {
    setIsDragging(true);
  };

  // 处理拖拽结束
  const handleDragStop = (e, data) => {
    setIsDragging(false);
    setPosition({ x: data.x, y: data.y });
  };

  // 折叠/展开切换
  const toggleCollapse = (e) => {
    e.stopPropagation(); // 防止触发拖拽
    setIsCollapsed(!isCollapsed);
  };

  const handleLevelClick = (level) => {
    // 如果倒计时还未结束，不执行任何操作
    if (countdowns.global > 0) return;
    
    const answerArray = localAnswers[level];
    if (!Array.isArray(answerArray) || answerArray.length === 0) return;
    const answerContent = answerArray[0].content;
    onLevelSelect?.(level, answerContent);
  };

  const handleCustomSubmit = (e) => {
    // 处理键盘事件：只有在按下回车键且没有按住Shift键时才提交
    if (e && e.type === 'keydown') {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); // 阻止默认的换行行为
        if (customAnswer.trim()) {
          onLevelSelect?.('custom', customAnswer.trim());
          onClose?.();
        }
      }
      return;
    }
    
    // 处理点击按钮事件 - 这里的e来自按钮点击
    if (customAnswer.trim()) {
      onLevelSelect?.('custom', customAnswer.trim());
      onClose?.();
    }
  };

  // 加载状态的选项卡组件
  const LoadingOptionCard = () => (
    <div className={`p-3 rounded-xl ${
      theme === 'tech'
        ? 'bg-tech-primary/80 border border-tech-text/20'
        : 'bg-white/80 border border-slate-200'
    }`}>
      <div className="animate-pulse space-y-3">
        <div className={`h-4 w-24 rounded ${
          theme === 'tech' ? 'bg-tech-text/10' : 'bg-slate-200'
        }`}></div>
        <div className={`space-y-2 ${
          theme === 'tech' ? 'text-tech-text' : 'text-slate-600'
        }`}>
          <div className={`h-3 w-full rounded ${
            theme === 'tech' ? 'bg-tech-text/10' : 'bg-slate-200'
          }`}></div>
          <div className={`h-3 w-4/5 rounded ${
            theme === 'tech' ? 'bg-tech-text/10' : 'bg-slate-200'
          }`}></div>
        </div>
      </div>
    </div>
  );

  return (
    <Draggable
      nodeRef={nodeRef}
      handle=".drag-handle"
      position={position}
      onStart={handleDragStart}
      onStop={handleDragStop}
      bounds="parent"
    >
      <Resizable
        width={size.width}
        height={size.height}
        onResize={(e, { size }) => {
          setSize({
            width: size.width,
            height: size.height
          });
        }}
        onResizeStop={(e, { size }) => {
          // 调整结束后保存新尺寸到localStorage
          const newSize = {
            width: size.width,
            height: size.height
          };
          localStorage.setItem('answerCardSize', JSON.stringify(newSize));
        }}
        minConstraints={[450, 350]} // 降低最小尺寸限制，使小屏幕设备更友好
        maxConstraints={[1200, window.innerHeight * 0.9]} // 最大尺寸
        resizeHandles={['se']} // 只在右下角显示调整手柄
      >
        <div
          ref={nodeRef}
          className={`absolute rounded-xl transition-all duration-150 overflow-hidden z-[10000] pointer-events-auto
            ${theme === 'tech' 
              ? 'shadow-[0_0_0_2px_rgba(var(--tech-text-rgb),0.2),0_4px_20px_-2px_rgba(0,0,0,0.1)]'
              : 'shadow-[0_0_0_2px_rgb(226,232,240),0_4px_20px_-2px_rgba(0,0,0,0.1)]'
            }`}
          style={{
            width: isCollapsed ? '300px' : `${size.width}px`,
            height: isCollapsed ? 'auto' : `${size.height}px`,
            transition: 'width 0.15s ease'
          }}
        >
          <div
            className={`${
              theme === 'tech'
                ? 'bg-tech-secondary'
                : 'bg-white'
            } rounded-xl h-full flex flex-col`}
          >
            {/* 拖拽手柄/标题栏 */}
            <div 
              className={`drag-handle p-4 flex justify-between items-center cursor-grab ${
                theme === 'tech' 
                  ? 'bg-tech-primary border-b-2 border-tech-text/20'
                  : 'bg-slate-50 border-b-2 border-slate-200'
              } ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            >
              <div className={`font-medium truncate mr-2 flex items-center ${
                theme === 'tech' ? 'text-tech-highlight' : 'text-slate-700'
              }`}>
                {isCollapsed ? (
                  <div className="flex items-center">
                    <span className="truncate max-w-[180px]">
                      {question.question.length > 30 
                        ? question.question.substring(0, 30) + '...' 
                        : question.question}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center">
                    <span>{t('AnswerCard.questionDetails')}</span>
                  </div>
                )}
              </div>
              
              {/* 添加全局倒计时显示 - 更醒目的设计 */}
              {countdowns.global > 0 && !isCollapsed && (
                <div className={`flex-1 mx-4 py-1 px-3 rounded-lg text-center ${
                  theme === 'tech' 
                    ? 'bg-tech-accent/10 border border-tech-accent/30' 
                    : 'bg-cyan-50 border border-cyan-200'
                }`}>
                  <div className={`text-sm font-medium ${
                    theme === 'tech' ? 'text-tech-highlight' : 'text-cyan-700'
                  }`}>
                    <span className="font-['Noto Serif SC', serif]">{t('AnswerCard.tips1')}</span>
                    <span className={`font-mono font-bold ${
                      theme === 'tech' ? 'text-tech-accent' : 'text-cyan-600'
                    }`}>{countdowns.global}</span>
                    <span className="font-['Noto Serif SC', serif]">{t('AnswerCard.tips2')}</span>
                  </div>
                </div>
              )}
              
              <div className="flex items-center space-x-2">
                <button 
                  onClick={toggleCollapse}
                  className={`collapse-button p-1 rounded ${
                    theme === 'tech' 
                      ? 'hover:bg-tech-accent/20 text-tech-text hover:text-tech-highlight' 
                      : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'
                  } transition-colors`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {isCollapsed ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 8v8a2 2 0 002 2h12a2 2 0 002-2V8m0 0V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2m0 0h16" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 12V6a2 2 0 00-2-2H6a2 2 0 00-2 2v6m16 0v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6m16 0h-16" />
                    )}
                  </svg>
                </button>
                <button 
                  onClick={onClose}
                  className={`p-1 rounded ${
                    theme === 'tech' 
                      ? 'hover:bg-tech-accent/20 text-tech-text hover:text-tech-highlight' 
                      : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'
                  } transition-colors`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* 卡片内容区域 */}
            {!isCollapsed && (
              <div className="card-content flex-1 overflow-hidden">
                {/* 左右布局容器 */}
                <div className="flex h-full flex-col">
                  {/* 左侧：问题和答案选项 */}
                  <div className="flex-1 h-full flex">
                    <div className={`flex-1 flex flex-col m-4 ${
                      theme === 'tech'
                        ? 'bg-tech-primary/50 border-2 border-tech-text/20'
                        : 'bg-white border-2 border-slate-200/60'
                    } rounded-xl backdrop-blur-sm overflow-hidden`}>
                      <div className={`p-3 font-medium text-lg font-['PingFang SC'] ${
                        theme === 'tech' ? 'text-tech-highlight' : 'text-slate-700'
                      }`}>
                        <MarkdownRenderer content={question.question} theme={theme} />
                      </div>
                      
                      <div className="flex-1 overflow-y-auto p-3">
                        <div className="flex flex-col space-y-2 h-full">
                          {isLoading ? (
                            <div className={`flex-1 flex flex-col justify-center items-center rounded-xl ${
                              theme === 'tech' 
                                ? 'bg-tech-primary/80 border-2 border-tech-accent' 
                                : 'bg-cyan-50 border-2 border-cyan-200'
                            }`}>
                              <div className="flex flex-col items-center">
                                <div className={`text-6xl mb-6`}>🤔</div>
                                <div className={`text-xl font-medium mb-3 ${
                                  theme === 'tech' ? 'text-tech-highlight' : 'text-slate-700'
                                }`}>
                                  {t('AnswerCard.aiError')}
                                </div>
                                <div className={`text-lg ${
                                  theme === 'tech' ? 'text-tech-text' : 'text-slate-600'
                                }`}>
                                  {t('AnswerCard.aiErrorTips')}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex-1 space-y-2">
                              {Object.entries(LEVEL_LABELS).map(([level, label]) => {
                                const answerArray = localAnswers[level];
                                if (!Array.isArray(answerArray) || answerArray.length === 0) return null;
                                
                                return (
                                  <div 
                                    key={level}
                                    className={`group p-2 sm:p-3 rounded-xl transition-all duration-150 ${
                                      theme === 'tech'
                                        ? 'bg-tech-primary/80 border-2 hover:border-tech-accent hover:shadow-lg hover:shadow-tech-accent/10'
                                        : 'bg-white hover:bg-gradient-to-br from-cyan-50/30 to-slate-50/30 border-2 hover:border-cyan-300 hover:shadow-lg hover:shadow-cyan-100/20'
                                    } ${
                                      hoveredCard === level 
                                        ? theme === 'tech'
                                          ? 'border-tech-accent bg-tech-primary/90'
                                          : 'border-cyan-300 bg-cyan-50/30'
                                        : theme === 'tech'
                                          ? 'border-tech-text/20'
                                          : 'border-slate-200'
                                    } ${
                                      countdowns.global > 0 
                                        ? 'cursor-not-allowed opacity-80' 
                                        : 'cursor-pointer'
                                    }`}
                                    onClick={() => handleLevelClick(level)}
                                    onMouseEnter={() => {
                                      setHoveredCard(level);
                                      // 只有当全局倒计时结束后，才允许鼠标悬浮显示内容
                                      if (countdowns.global <= 0) {
                                        setRevealedCards(prev => ({...prev, [level]: true}));
                                      }
                                    }}
                                    onMouseLeave={() => setHoveredCard(null)}
                                  >
                                    <div className="flex items-start gap-3">
                                      {/* 左侧：标签徽章（固定宽度，始终可见） */}
                                      <div className="shrink-0 flex items-center gap-1.5 mt-0.5">
                                        <span className={`font-medium font-['PingFang SC'] ${theme === 'tech' ? 'text-tech-highlight' : 'text-slate-700'}`}>
                                          <span className={`${theme === 'tech' ? 'text-tech-accent' : 'text-cyan-500'}`}>{label}</span>
                                        </span>
                                        <span
                                          className={`w-1.5 h-1.5 rounded-full ${
                                            level === 'none' ? 'bg-[#D3D3D3]' :
                                            level === 'heard' ? 'bg-[#6BAED6]' :
                                            level === 'basic' ? 'bg-[#4CAF50]' :
                                            level === 'familiar' ? 'bg-[#FF9800]' :
                                            level === 'expert' ? 'bg-[#FFD700]' : ''
                                          }`}
                                        />
                                      </div>

                                      {/* 右侧：内容区（可揭示），默认摘要高度，hover/揭示后放开 */}
                                      <div className={`min-w-0 flex-1 font-['PingFang SC'] leading-[1.45] text-sm ${theme === 'tech' ? 'text-tech-text' : 'text-slate-600'}`}>
                                        <div className="relative">
                                          {/* 实际内容 */}
                                          <div className={`transition-all duration-150 ${revealedCards[level] ? 'opacity-100' : 'opacity-0'}`}>
                                            {/* 默认做摘要：最多 ~3行；hover 或揭示后自动展开 */}
                                            <div className="max-h-[5.6rem] overflow-hidden group-hover:max-h-[24rem] transition-[max-height] duration-200 ease-in-out">
                                              <MarkdownRenderer content={answerArray[0].content} theme={theme} />
                                            </div>
                                          </div>

                                          {/* 覆盖提示层：只铺在内容区，不遮住左侧标签 */}
                                          {!revealedCards[level] && (
                                            <div className="absolute inset-0 flex flex-col justify-center items-center">
                                              <div className="absolute inset-0"
                                                style={{
                                                  backgroundImage: `linear-gradient(${theme === 'tech' ? '#1a2b3c0a' : '#cbd5e10a'} 1px, transparent 1px),
                                                                   linear-gradient(90deg, ${theme === 'tech' ? '#1a2b3c0a' : '#cbd5e10a'} 1px, transparent 1px)`,
                                                  backgroundSize: '20px 20px',
                                                  backgroundPosition: '-0.5px -0.5px'
                                                }}
                                              />
                                              <div className={`text-center py-1.5 px-3 z-10 ${theme === 'tech' ? 'text-tech-highlight' : 'text-cyan-700'}`}>
                                                <span className="font-['Noto Serif SC', serif] text-[0.95rem] tracking-[0.03em] border-b border-current pb-0.5 inline-block">
                                                  {t('AnswerCard.tips3')}
                                                </span>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                              {/* 自定义回答作为同级卡片 */}
                              <div 
                                className={`group p-2 sm:p-3 rounded-xl transition-all duration-150 ${
                                  theme === 'tech'
                                    ? 'bg-tech-primary/80 border-2 hover:border-tech-accent hover:shadow-lg hover:shadow-tech-accent/10'
                                    : 'bg-white hover:bg-gradient-to-br from-cyan-50/30 to-slate-50/30 border-2 hover:border-cyan-300 hover:shadow-lg hover:shadow-cyan-100/20'
                                } ${
                                  hoveredCard === 'custom' 
                                    ? theme === 'tech'
                                      ? 'border-tech-accent bg-tech-primary/90'
                                      : 'border-cyan-300 bg-cyan-50/30'
                                    : theme === 'tech'
                                      ? 'border-tech-text/20'
                                      : 'border-slate-200'
                                }`}
                                onMouseEnter={() => setHoveredCard('custom')}
                                onMouseLeave={() => setHoveredCard(null)}
                              >
                                <div className="flex items-start gap-3">
                                  {/* 左侧：标签徽章 */}
                                  <div className="shrink-0 flex items-center gap-1.5 mt-0.5">
                                    <span className={`font-medium font-['PingFang SC'] ${theme === 'tech' ? 'text-tech-highlight' : 'text-slate-700'}`}>
                                      <span className={`${theme === 'tech' ? 'text-tech-accent' : 'text-cyan-500'}`}>{t('AnswerCard.customAnswer')}</span>
                                    </span>
                                    <span className={`w-1.5 h-1.5 rounded-full bg-[#8B5CF6]`} />
                                  </div>

                                  {/* 右侧：自定义输入内容区 */}
                                  <div className={`min-w-0 flex-1 font-['PingFang SC'] leading-[1.45] text-sm ${theme === 'tech' ? 'text-tech-text' : 'text-slate-600'}`}>
                                    <div className="relative">
                                      <textarea
                                        value={customAnswer}
                                        onChange={(e) => setCustomAnswer(e.target.value)}
                                        onKeyDown={handleCustomSubmit}
                                        className={`w-full min-h-[56px] p-2.5 sm:p-3 pr-10 rounded-lg outline-none transition-all font-['PingFang SC'] resize-none text-sm leading-[1.45] ${
                                          theme === 'tech'
                                            ? 'bg-transparent border border-tech-text/15 text-tech-highlight placeholder-tech-text/40 focus:border-tech-accent focus:ring-1 focus:ring-tech-accent/25'
                                            : 'bg-transparent border border-slate-200/70 text-slate-800 placeholder-slate-400 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-100'
                                        }`}
                                        placeholder={t('AnswerCard.placeholder')}
                                      />
                                      <button
                                        onClick={(e) => {
                                          handleCustomSubmit(e);
                                        }}
                                        disabled={!customAnswer.trim()}
                                        className={`absolute right-2.5 sm:right-3 bottom-2.5 sm:bottom-3 p-1 rounded-md transition-all duration-200 ${
                                          theme === 'tech' ? 'text-tech-accent/80 hover:text-tech-accent' : 'text-cyan-500/80 hover:text-cyan-500'
                                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                                        title={t('AnswerCard.send')}
                                      >
                                        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                                          <path d="M3.4 20.4l17.45-7.48a1 1 0 000-1.84L3.4 3.6a.993.993 0 00-1.39.91L2 9.12c0 .5.37.93.87.99L17 12L2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z"/>
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 添加调整大小的手柄样式 */}
            <div className={`absolute bottom-0 right-0 w-4 h-4 cursor-se-resize ${
              theme === 'tech' 
                ? 'text-tech-accent' 
                : 'text-cyan-500'
            }`}>
              <svg 
                viewBox="0 0 24 24" 
                fill="currentColor" 
                className="w-4 h-4 opacity-50 hover:opacity-100 transition-opacity"
              >
                <path d="M22 22H20V20H22V22ZM22 18H18V20H22V18ZM18 22H16V24H18V22ZM14 22H12V24H14V22ZM22 14H20V16H22V14Z" />
              </svg>
            </div>
          </div>
        </div>
      </Resizable>
    </Draggable>
  );
};

export default AnswerCard;