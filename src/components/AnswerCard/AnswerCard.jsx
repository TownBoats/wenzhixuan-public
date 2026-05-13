import { useEffect, useState, useRef } from 'react';
import PropTypes from 'prop-types';
import Draggable from 'react-draggable';
import { Resizable } from 'react-resizable';
import 'react-resizable/css/styles.css';
import { useTranslation } from 'react-i18next';
import MarkdownRenderer from '../MarkdownRenderer/MarkdownRenderer';
import useMediaQuery, { BREAKPOINTS } from '../../hooks/useMediaQuery';
import { Button, Icon, BrandLogo, LevelIcon, cn } from '@/components/ui';

// 旧 ContentParser key → tailwind level-* token class（必须写出完整类名才能被 Tailwind 提取）
const LEVEL_TEXT_CLASS = {
  none:     'text-level-seed',
  heard:    'text-level-sprout',
  basic:    'text-level-sapling',
  familiar: 'text-level-tree',
  expert:   'text-level-forest',
};

/**
 * AnswerCard — 答题浮层（P3e Susan Kare 重设计版）
 *
 * 设计规格见 docs/REDESIGN_KARE.md §3.2：五档生长链 + 倒计时小船 +
 * 自定义铅笔输入。
 *
 * 重写策略：
 *   - 拖拽 / 缩放 / 折叠 / 倒计时 / localStorage 行为完全保留
 *   - 所有 i18n key 不动；少量 defaultValue 顺手亲和化
 *   - 旧 6 个硬编码 hex 圆点              → ui/LevelIcon (5 档生长插画)
 *   - 旧 cyan/slate 配色 + 网格 reveal     → paper/sage/sun token + 同款 reveal
 *   - 紫色 #8B5CF6 自定义点                 → sun-700 Pencil 图标（"亲笔回答"）
 *   - 🤔 emoji 加载态                      → BrandLogo(thinking) + 衬线斜体
 *   - 内联 SVG 关闭/折叠/发送              → ui/Button + lucide
 *   - tech 分支整体删除（新设计单主题，未来 dark 模式由 dark: 前缀覆盖）
 */

const LEVEL_ORDER = ['none', 'heard', 'basic', 'familiar', 'expert'];

const AnswerCard = ({
  question,
  onLevelSelect,
  onClose,
  // eslint-disable-next-line no-unused-vars
  theme,
}) => {
  const { t } = useTranslation();
  const isDesktop = useMediaQuery(BREAKPOINTS.md);
  const [customAnswer, setCustomAnswer] = useState('');
  const [localAnswers, setLocalAnswers] = useState(question?.answer || {});
  const [revealedCards, setRevealedCards] = useState({});
  const [hoveredCard, setHoveredCard] = useState(null);
  const [countdowns, setCountdowns] = useState({});
  const [isDragging, setIsDragging] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const LEVEL_LABELS = {
    none: t('AnswerCard.none'),
    heard: t('AnswerCard.heard'),
    basic: t('AnswerCard.basic'),
    familiar: t('AnswerCard.familiar'),
    expert: t('AnswerCard.expert'),
  };

  // ── 尺寸（恢复 localStorage） ──
  const [size, setSize] = useState(() => {
    const savedSize = localStorage.getItem('answerCardSize');
    if (savedSize) {
      try {
        const parsedSize = JSON.parse(savedSize);
        if (
          parsedSize &&
          parsedSize.width >= 450 &&
          parsedSize.width <= 1200 &&
          parsedSize.height >= 350 &&
          parsedSize.height <= window.innerHeight * 0.9
        ) {
          return parsedSize;
        }
      } catch (e) {
        console.error('Error parsing saved size:', e);
      }
    }
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const initialWidth = Math.min(
      Math.max(700, viewportWidth * 0.65),
      viewportWidth * 0.75,
    );
    const targetHeight = initialWidth * 0.5625;
    const initialHeight = Math.min(
      Math.max(450, targetHeight),
      viewportHeight * 0.8,
    );
    return { width: initialWidth, height: initialHeight };
  });

  const [position, setPosition] = useState(() => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    return {
      x: Math.max((viewportWidth - size.width) / 2, 20),
      y: Math.max((viewportHeight - size.height) / 2, 20),
    };
  });

  const nodeRef = useRef(null);

  // ── 同步 props.answer ──
  useEffect(() => {
    if (question?.answer) {
      setLocalAnswers(question.answer);
    }
  }, [question?.answer]);

  // ── 倒计时 ──
  useEffect(() => {
    if (!question?.answer) return;
    const enableWaitTime = localStorage.getItem('enableWaitTime') !== 'false';
    if (!enableWaitTime) {
      setCountdowns({ global: 0 });
      return;
    }
    const savedTime = localStorage.getItem('waitTime');
    const countdown = savedTime ? parseInt(savedTime, 10) : 5;
    setCountdowns({ global: countdown });
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdowns((prev) => {
        if (prev.global > 0) return { global: prev.global - 1 };
        clearInterval(timer);
        return { global: 0 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [question?.answer]);

  if (!question || typeof question !== 'object') return null;
  if (!question.question || !question.answer) return null;

  const isLoading = Object.values(localAnswers).every((value) => value === '');
  const isCountingDown = countdowns.global > 0;

  // ── 拖拽 ──
  const handleDragStart = () => setIsDragging(true);
  const handleDragStop = (e, data) => {
    setIsDragging(false);
    setPosition({ x: data.x, y: data.y });
  };

  const toggleCollapse = (e) => {
    e.stopPropagation();
    setIsCollapsed(!isCollapsed);
  };

  // ── 选档 / 自定义 ──
  const handleLevelClick = (level) => {
    if (isCountingDown) return;
    const answerArray = localAnswers[level];
    if (!Array.isArray(answerArray) || answerArray.length === 0) return;
    const answerContent = answerArray[0].content;
    onLevelSelect?.(level, answerContent);
  };

  const handleCustomSubmit = (e) => {
    if (e && e.type === 'keydown') {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (customAnswer.trim()) {
          onLevelSelect?.('custom', customAnswer.trim());
          onClose?.();
        }
      }
      return;
    }
    if (customAnswer.trim()) {
      onLevelSelect?.('custom', customAnswer.trim());
      onClose?.();
    }
  };

  // ── Card body：mobile / desktop 共用 ──
  const cardBody = (
        <div
          ref={nodeRef}
          className={cn(
            'pointer-events-auto overflow-hidden',
            'border border-paper-200 bg-paper-50 shadow-float',
            isDesktop
              ? 'absolute z-[10000] rounded-lg transition-all duration-fast'
              : 'fixed inset-0 z-[10000] flex flex-col',
          )}
          style={
            isDesktop
              ? {
                  width: isCollapsed ? '300px' : `${size.width}px`,
                  height: isCollapsed ? 'auto' : `${size.height}px`,
                  transition: 'width 0.15s ease',
                }
              : undefined
          }
        >
          <div className="flex h-full flex-col">
            {/* ── 拖拽手柄 / 标题栏 ── */}
            <div
              className={cn(
                'drag-handle flex items-center justify-between border-b border-paper-200',
                'bg-paper-100 px-3 py-2.5 md:px-4 md:py-3',
                isDesktop && (isDragging ? 'cursor-grabbing' : 'cursor-grab'),
              )}
            >
              <div className="mr-2 flex min-w-0 items-center gap-2 text-ink-900">
                <BrandLogo size={20} expression="default" className="shrink-0 text-sage-700" />
                <span className="truncate font-serif text-small md:text-body">
                  {isCollapsed
                    ? question.question.length > 30
                      ? question.question.substring(0, 30) + '...'
                      : question.question
                    : t('AnswerCard.questionDetails')}
                </span>
              </div>

              {isCountingDown && !isCollapsed && (
                <div className="mx-2 hidden flex-1 items-center justify-center gap-1.5 rounded-pill bg-sun-300/40 px-3 py-1 md:flex md:mx-4">
                  <Icon name="Hourglass" size={14} className="text-sun-700" />
                  <span className="font-serif text-small text-sun-700">
                    {t('AnswerCard.tips1')}
                  </span>
                  <span className="font-mono font-bold text-sun-700">{countdowns.global}</span>
                  <span className="font-serif text-small text-sun-700">
                    {t('AnswerCard.tips2')}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-1">
                {/* mobile 倒计时简化为右侧小徽章 */}
                {isCountingDown && !isCollapsed && !isDesktop && (
                  <span className="inline-flex items-center gap-1 rounded-pill bg-sun-300/40 px-2 py-0.5 font-mono text-caption font-bold text-sun-700">
                    <Icon name="Hourglass" size={12} className="text-current" />
                    {countdowns.global}
                  </span>
                )}
                {/* 折叠按钮：仅 desktop（mobile 全屏不需要折叠） */}
                {isDesktop && (
                  <Button
                    intent="ghost"
                    size="sm"
                    iconOnly
                    onClick={toggleCollapse}
                    className="collapse-button"
                    aria-label={isCollapsed ? '展开' : '折叠'}
                  >
                    <Icon name={isCollapsed ? 'Maximize2' : 'Minimize2'} size={14} />
                  </Button>
                )}
                <Button intent="ghost" size="sm" iconOnly onClick={onClose} aria-label="关闭">
                  <Icon name="X" size={14} />
                </Button>
              </div>
            </div>

            {/* ── 主区 ── */}
            {!isCollapsed && (
              <div className="card-content flex-1 overflow-hidden">
                <div className="flex h-full flex-col p-3 md:p-4">
                  <div className="flex flex-1 flex-col overflow-hidden rounded-md border border-paper-200 bg-paper-50">
                    {/* 问题 */}
                    <div className="shrink-0 border-b border-paper-200 p-3 md:p-4">
                      <p className="mb-1 font-mono text-caption text-ink-500 md:mb-2">
                        {t('AnswerCard.questionDetails')}
                      </p>
                      <div className="font-serif text-body text-ink-900 md:text-h2">
                        <MarkdownRenderer content={question.question} />
                      </div>
                    </div>

                    {/* 答案档位列 */}
                    <div className="min-h-0 flex-1 overflow-y-auto p-2 md:p-3 scrollbar-custom">
                      <div className="flex h-full flex-col space-y-2">
                        {isLoading ? (
                          <LoadingPanel t={t} />
                        ) : (
                          <>
                            {LEVEL_ORDER.map((level) => {
                              const answerArray = localAnswers[level];
                              if (!Array.isArray(answerArray) || answerArray.length === 0)
                                return null;
                              return (
                                <LevelOption
                                  key={level}
                                  level={level}
                                  label={LEVEL_LABELS[level]}
                                  answer={answerArray[0]?.content}
                                  isHovered={hoveredCard === level}
                                  isRevealed={Boolean(revealedCards[level])}
                                  isCountingDown={isCountingDown}
                                  onClick={() => handleLevelClick(level)}
                                  onMouseEnter={() => {
                                    setHoveredCard(level);
                                    if (!isCountingDown) {
                                      setRevealedCards((prev) => ({ ...prev, [level]: true }));
                                    }
                                  }}
                                  onMouseLeave={() => setHoveredCard(null)}
                                  tipText={t('AnswerCard.tips3')}
                                />
                              );
                            })}

                            {/* 自定义回答 */}
                            <CustomOption
                              value={customAnswer}
                              onChange={setCustomAnswer}
                              onKeyDown={handleCustomSubmit}
                              onSubmit={handleCustomSubmit}
                              isHovered={hoveredCard === 'custom'}
                              onMouseEnter={() => setHoveredCard('custom')}
                              onMouseLeave={() => setHoveredCard(null)}
                              label={t('AnswerCard.customAnswer')}
                              placeholder={t('AnswerCard.placeholder')}
                              sendTitle={t('AnswerCard.send')}
                            />
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── 缩放手柄（仅 desktop） ── */}
            {isDesktop && (
              <div className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize text-sage-500">
                <Icon
                  name="GripHorizontal"
                  size={14}
                  className="rotate-45 text-current opacity-50 hover:opacity-100 transition-opacity"
                />
              </div>
            )}
          </div>
        </div>
  );

  if (!isDesktop) {
    // ── Mobile: 全屏 modal，无拖拽 / 无缩放 / 无折叠 ──
    return cardBody;
  }

  // ── Desktop: 拖拽 + 缩放 ──
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
        onResize={(e, { size: next }) => setSize({ width: next.width, height: next.height })}
        onResizeStop={(e, { size: next }) => {
          localStorage.setItem(
            'answerCardSize',
            JSON.stringify({ width: next.width, height: next.height }),
          );
        }}
        minConstraints={[450, 350]}
        maxConstraints={[1200, window.innerHeight * 0.9]}
        resizeHandles={['se']}
      >
        {cardBody}
      </Resizable>
    </Draggable>
  );
};

AnswerCard.propTypes = {
  question: PropTypes.object,
  onLevelSelect: PropTypes.func,
  onClose: PropTypes.func,
  theme: PropTypes.string,
};

// ─────────────────────────────────────────────────────────
// 子组件
// ─────────────────────────────────────────────────────────

function LoadingPanel({ t }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-md border border-paper-200 bg-paper-100 p-6">
      <BrandLogo size={56} expression="thinking" className="text-sage-700" />
      <div className="text-center">
        <p className="font-serif text-h2 text-ink-900">{t('AnswerCard.aiError')}</p>
        <p className="mt-1 font-serif italic text-body text-ink-500">
          {t('AnswerCard.aiErrorTips')}
        </p>
      </div>
    </div>
  );
}
LoadingPanel.propTypes = { t: PropTypes.func.isRequired };

function LevelOption({
  level,
  label,
  answer,
  isHovered,
  isRevealed,
  isCountingDown,
  onClick,
  onMouseEnter,
  onMouseLeave,
  tipText,
}) {
  return (
    <div
      className={cn(
        'group rounded-md border bg-paper-50 p-3 transition-all duration-base ease-soft',
        isHovered ? 'border-sage-500 bg-paper-100 shadow-lift' : 'border-paper-200',
        isCountingDown ? 'cursor-not-allowed opacity-80' : 'cursor-pointer',
      )}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="flex items-start gap-3">
        {/* 左：生长插画 + 档位文字 */}
        <div className="flex shrink-0 flex-col items-center gap-1">
          <LevelIcon
            level={level}
            size={36}
            className={cn(
              'transition-transform duration-base ease-snap',
              isHovered && !isCountingDown && 'scale-110',
            )}
          />
          <span className={cn('font-serif text-caption', LEVEL_TEXT_CLASS[level])}>{label}</span>
        </div>

        {/* 右：内容 / reveal 提示 */}
        <div className="min-w-0 flex-1 font-serif text-small leading-[1.45] text-ink-700">
          <div className="relative">
            <div
              className={cn(
                'transition-opacity duration-fast',
                isRevealed ? 'opacity-100' : 'opacity-0',
              )}
            >
              <div className="max-h-[5.6rem] overflow-hidden transition-[max-height] duration-base ease-soft group-hover:max-h-[24rem]">
                <MarkdownRenderer content={answer} />
              </div>
            </div>

            {!isRevealed && (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage:
                      'linear-gradient(rgba(31,35,48,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(31,35,48,0.04) 1px, transparent 1px)',
                    backgroundSize: '20px 20px',
                    backgroundPosition: '-0.5px -0.5px',
                  }}
                />
                <div className="z-10 px-3 py-1.5 text-center text-sage-700">
                  <span className="inline-block border-b border-current pb-0.5 font-serif text-body italic tracking-[0.03em]">
                    {tipText}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

LevelOption.propTypes = {
  level: PropTypes.oneOf(LEVEL_ORDER).isRequired,
  label: PropTypes.string.isRequired,
  answer: PropTypes.string,
  isHovered: PropTypes.bool,
  isRevealed: PropTypes.bool,
  isCountingDown: PropTypes.bool,
  onClick: PropTypes.func.isRequired,
  onMouseEnter: PropTypes.func.isRequired,
  onMouseLeave: PropTypes.func.isRequired,
  tipText: PropTypes.string.isRequired,
};

function CustomOption({
  value,
  onChange,
  onKeyDown,
  onSubmit,
  isHovered,
  onMouseEnter,
  onMouseLeave,
  label,
  placeholder,
  sendTitle,
}) {
  const canSend = value.trim().length > 0;
  return (
    <div
      className={cn(
        'group rounded-md border bg-paper-50 p-3 transition-all duration-base ease-soft',
        isHovered ? 'border-sun-500 bg-paper-100 shadow-lift' : 'border-paper-200',
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="flex items-start gap-3">
        <div className="flex shrink-0 flex-col items-center gap-1">
          <Icon name="Pencil" size={28} className="text-sun-700" />
          <span className="font-serif text-caption text-sun-700">{label}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative">
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              className={cn(
                'min-h-[56px] w-full rounded-sm border border-paper-200 bg-paper-50 p-3 pr-10',
                'font-serif text-small leading-[1.45] text-ink-900 caret-sage-500',
                'placeholder:italic placeholder:text-ink-300 resize-none',
                'transition-colors duration-fast outline-none',
                'focus:border-sage-500 focus:ring-2 focus:ring-sage-500/20',
              )}
            />
            <button
              type="button"
              onClick={onSubmit}
              disabled={!canSend}
              title={sendTitle}
              aria-label={sendTitle}
              className={cn(
                'absolute right-2.5 bottom-2.5 inline-flex h-7 w-7 items-center justify-center rounded-pill',
                'transition-all duration-fast ease-snap',
                canSend
                  ? 'bg-sage-500 text-white hover:bg-sage-700 active:scale-95'
                  : 'bg-paper-200 text-ink-300 cursor-not-allowed',
              )}
            >
              <Icon name="Send" size={14} className="text-current -rotate-12" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

CustomOption.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  onKeyDown: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  isHovered: PropTypes.bool,
  onMouseEnter: PropTypes.func.isRequired,
  onMouseLeave: PropTypes.func.isRequired,
  label: PropTypes.string.isRequired,
  placeholder: PropTypes.string.isRequired,
  sendTitle: PropTypes.string.isRequired,
};

export default AnswerCard;
