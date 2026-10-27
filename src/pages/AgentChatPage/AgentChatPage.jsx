import { useDeferredValue, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import MODES from '../../agent/modePrompts';
import useChatSession from '../../hooks/useChatSession';
import ConfigManager from '../../utils/ConfigManager';
import zhTranslation from '../../locales/zh/translation.json';
import enTranslation from '../../locales/en/translation.json';
import {
  dismissMainPromptMigrationNotice,
  readMainPromptMigrationState,
} from '../../utils/promptMigration';
import AnswerCard from '../../components/AnswerCard/AnswerCard';
import MessageContent from '../../components/MessageContent/MessageContent';
import { BrandLogo, Button, Icon, Textarea, cn } from '@/components/ui';
import QuestionGroup from './QuestionGroup';
import HistoryDrawer from './HistoryDrawer';
import ConfigPanel from './ConfigPanel';
import useConversationHistory from './useConversationHistory';
import { classifyTurnError } from './errorAdapter';
import { levelSelectToSubmission, toAnswerCardModel } from './questionAdapter';

/**
 * AgentChatPage — 新 Agent 运行时页面（D4：useChatSession 真实接线）
 *
 * 边界（决策记录 C-3，不得违反）：
 *   - 只发命令：session 返回的 9 个命令，没有任何 setter / dispatch
 *   - 渲染只吃 renderedTurns（projectTurns 投影），不读 turn.parts 自己拼
 *   - 答案只经 submitAnswer / skipQuestion，页面不拼答案文本、不触发下一轮
 *
 * 页面自有的 useState 只有两个纯 UI 状态：输入框文本、当前打开的答案卡。
 * reasoning 高频 delta 的渲染节流用 useDeferredValue（B7 实测 354 条），不碰 C 层。
 */

/** ConfigManager 的配置形状 → 运行层 { endpoint, apiKey, model }（与 B7 脚本同形）。 */
function toRunnerConfig(stored) {
  return {
    endpoint: ConfigManager.buildEndpointUrl(stored),
    apiKey: stored?.apiKey ?? '',
    model: stored?.model ?? '',
  };
}

/**
 * 配置快照（与旧路径同源：localStorage 的 `mainAgentConfig` / `optionAgentConfig` /
 * `optionAgentPrompt`）。页面挂载时读一次，配置面板每次改动后重读。
 *
 * 之所以要「重读」而不是直接拿面板回传的值：面板回传的是 ModelConfigPanel 拼出的形状，
 * 落盘还要经过 ConfigManager（含 URL 拼接规则），重读一次保证页面看到的与下次启动一致。
 */
function readConfigSnapshot() {
  return {
    main: ConfigManager.getMainModelConfig(),
    option: ConfigManager.getOptionModelConfig(),
    optionPrompt: ConfigManager.getOptionPrompt(),
  };
}

/**
 * 「重试这一轮」只在最后一轮没跑完时出现（F2，`决策记录.md` C-1 结论 3）。
 *
 * 为什么不用 `session.canRetryLastTurn`：它只判「有最后一轮且不在运行中」，
 * 正常完成、正在等待作答的轮次也算真；重试那些轮次没有意义，还会把已完成内容再跑一遍。
 */
const RETRYABLE_TURN_STATUSES = new Set(['failed', 'cancelled', 'interrupted']);

/**
 * 空态推荐主题（G2）：点一下填进输入框并聚焦，不自动发送——
 * 自动发送会让「误触一下就开始烧 token」，填词更符合「先改一改再问」的习惯。
 */
const SUGGESTION_KEYS = [
  'AgentChat.page.suggest.closure',
  'AgentChat.page.suggest.eventLoop',
  'AgentChat.page.suggest.prototype',
];

/** D6 迁移判定的比对源：中英两份内置提示词原文（D-页面与模式.md 2.2）。 */
const BUILT_IN_MAIN_PROMPTS = [
  zhTranslation?.SystemPrompts?.learningMode,
  enTranslation?.SystemPrompts?.learningMode,
].filter((prompt) => typeof prompt === 'string' && prompt.length > 0);

/**
 * 存储相关的提示条（E3）：与「这一轮运行失败」区分开——
 * 那一轮的正文还在页面上，而存储失败只影响「下次还能不能打开」，所以单独一条、可关闭。
 */
function HistoryNotice({ text, onDismiss, dismissLabel }) {
  return (
    <div className="border-b border-sun-300/40 bg-sun-300/12">
      <div className="mx-auto flex w-full max-w-3xl items-start gap-2 px-4 py-2 text-small text-ink-700 sm:px-6">
        <Icon name="Info" size={14} className="mt-0.5 shrink-0 text-sun-700" />
        <span className="min-w-0 flex-1">{text}</span>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-sm p-1 text-ink-500 transition-colors duration-fast hover:bg-paper-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500/20"
          aria-label={dismissLabel}
        >
          <Icon name="X" size={14} />
        </button>
      </div>
    </div>
  );
}

HistoryNotice.propTypes = {
  text: PropTypes.string.isRequired,
  onDismiss: PropTypes.func.isRequired,
  dismissLabel: PropTypes.string.isRequired,
};

function AgentChatPage() {
  const { t } = useTranslation();
  const [inputText, setInputText] = useState('');
  const inputRef = useRef(null);
  const [openQuestionId, setOpenQuestionId] = useState(null);
  const [optionHintDismissed, setOptionHintDismissed] = useState(false);

  // D6：老用户自定义过主提示词时提示一次（localStorage 持久化关闭态，判据「只出现一次」）
  const [showMigrationNotice, setShowMigrationNotice] = useState(
    () =>
      readMainPromptMigrationState({ storage: localStorage, builtIns: BUILT_IN_MAIN_PROMPTS })
        .shouldNotify,
  );
  const dismissMigrationNotice = () => {
    dismissMainPromptMigrationNotice(localStorage);
    setShowMigrationNotice(false);
  };

  // 配置快照：与旧路径同源（localStorage）。苏格拉底模式只校验主模型；
  // 缺副模型不阻断——候选答案由运行层降级为「不可用」，问题仍可手动作答（B-6 / D-3）。
  const [configSnapshot, setConfigSnapshot] = useState(readConfigSnapshot);
  const { configReady, optionReady, config, optionConfig, optionSystemPrompt } = useMemo(() => {
    const { main, option, optionPrompt } = configSnapshot;
    return {
      configReady: ConfigManager.isModelConfigured(main),
      optionReady: ConfigManager.isModelConfigured(option),
      config: toRunnerConfig(main),
      optionConfig: toRunnerConfig(option),
      optionSystemPrompt: optionPrompt,
    };
  }, [configSnapshot]);

  // 配置面板（模态）。保存即生效：`useChatSession` 的 `sendMessage` 依赖 config，
  // 换掉快照后下一次运行就用新配置，不需要刷新页面。
  const [configOpen, setConfigOpen] = useState(false);

  // 合并而不是整体覆盖：面板不管理 `enableThinking` / `thinkingBudget` 等旧路径字段，
  // 直接覆盖会把它们重置成默认值（旧路径仍在读同一份存储）。
  const handleMainConfigChange = (next) => {
    ConfigManager.saveMainModelConfig({ ...ConfigManager.getMainModelConfig(), ...next });
    setConfigSnapshot(readConfigSnapshot());
  };
  const handleOptionConfigChange = (next) => {
    ConfigManager.saveOptionModelConfig({ ...ConfigManager.getOptionModelConfig(), ...next });
    setConfigSnapshot(readConfigSnapshot());
  };

  const session = useChatSession({ modes: MODES, config, optionConfig, optionSystemPrompt });
  // E3：载入 / 保存 / 提示。页面只读它的结果，不自己解析存储。
  const history = useConversationHistory({ session });
  // E5：历史抽屉的开合（纯 UI 状态，数据在打开时重读）
  const [historyOpen, setHistoryOpen] = useState(false);
  const renderedTurns = useDeferredValue(session.renderedTurns);

  /**
   * 重试入口与「重新生成中…」（F2）都靠**派生值**，不新增可写布尔量：
   *   canRetryLastTurn：最后一轮是 failed / cancelled / interrupted，且当前不在运行中；
   *   isRegenerating：正在运行，且最后一轮里已存在**上一次运行**的片段（片段上的 `runId` 不同）。
   * 后者的意义是不用记「用户点过重试」——那个布尔量会在取消/迟到事件时与真实状态打架。
   * 已知边界：若上一轮在被取消前一个片段都没产生（连工具卡都没有），这里会显示「正在生成…」。
   */
  const lastTurn = session.turns.at(-1) ?? null;
  const canRetryLastTurn =
    Boolean(lastTurn) && !session.isRunning && RETRYABLE_TURN_STATUSES.has(lastTurn.status);
  const isRegenerating =
    session.isRunning &&
    Boolean(
      Array.isArray(lastTurn?.parts) &&
        lastTurn.parts.some(
          (part) => typeof part?.runId === 'string' && part.runId !== lastTurn.runId,
        ),
    );

  const openQuestion = useMemo(() => {
    if (!openQuestionId) return null;
    for (const turn of session.renderedTurns) {
      const found = turn.questions.find((question) => question.id === openQuestionId);
      if (found) return found;
    }
    return null;
  }, [openQuestionId, session.renderedTurns]);

  const trimmedInput = inputText.trim();
  const canSend = configReady && session.canSendMessage && trimmedInput.length > 0;

  const handleSend = () => {
    if (!canSend) return;
    session.sendMessage(trimmedInput);
    setInputText('');
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      handleSend();
    }
  };

  const applySuggestion = (text) => {
    setInputText(text);
    inputRef.current?.focus();
  };

  const handleLevelSelect = (level, content) => {
    if (!openQuestion) return;
    session.submitAnswer(levelSelectToSubmission(openQuestion.id, level, content));
    setOpenQuestionId(null);
  };

  // ── E5：历史抽屉 ──
  const historyErrorText = useMemo(() => {
    const reason = history.actionFailure ?? history.listFailure;
    if (!reason) return null;
    if (reason === 'not_found') return t('AgentChat.history.actionFailedNotFound');
    if (reason === 'quota') return t('AgentChat.history.actionFailedQuota');
    if (reason === 'corrupt') return t('AgentChat.history.actionFailedCorrupt');
    return t('AgentChat.history.actionFailedUnknown');
  }, [history.actionFailure, history.listFailure, t]);

  const openHistory = () => {
    // 每次打开都重读：抽屉里的列表是快照，后台保存过就会过期
    history.refreshConversations();
    setHistoryOpen(true);
  };

  /**
   * 运行中禁止切换会话（F1 决策 2B）：`openConversation` 会中止运行并整体替换状态，
   * 这一轮只在「发送 / 工具完成」两处落过盘，剩余内容会丢。抽屉里已禁用按钮，
   * 这里再挡一次（按钮状态与状态更新之间仍有间隙）。
   */
  const handleOpenConversation = (id) => {
    if (session.isRunning) return;
    if (history.openConversationById(id)) setHistoryOpen(false);
  };

  const dismissHistoryError = () => {
    history.dismissActionFailure();
    history.dismissListFailure();
  };

  return (
    <div className="flex h-dvh flex-col bg-paper-50">
      {/* ChatGPT 式沉浸画布（2026-10-19 用户反馈）：整页统一 paper-50 亮底、
          页头无分隔线只留「左 logo / 右按钮」；吸顶必须不透明，否则正文会透上来 */}
      <header className="sticky top-0 z-20 bg-paper-50">
        {/* 页头通栏（2026-10-19 用户反馈）：不随正文 max-w-3xl 居中，logo 贴左上、按钮贴右上 */}
        <div className="flex w-full items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <BrandLogo size={24} />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-small font-semibold text-ink-900">
                {t('AgentChat.page.title')}
              </p>
              <p className="truncate text-caption text-ink-500">{t('AgentChat.page.tagline')}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button intent="ghost" size="sm" onClick={() => setConfigOpen(true)}>
              <Icon name="SlidersHorizontal" size={14} className="text-current" />
              <span className="hidden sm:inline">{t('AgentChat.page.settings')}</span>
            </Button>
            <Button intent="ghost" size="sm" onClick={openHistory}>
              <Icon name="History" size={14} className="text-current" />
              <span className="hidden sm:inline">{t('AgentChat.history.openHistory')}</span>
            </Button>
            {/* 新会话同样会中止当前运行并清空状态（F1 决策 2B），运行中不可点 */}
            <Button
              intent="secondary"
              size="sm"
              onClick={session.newConversation}
              disabled={session.isRunning}
              title={session.isRunning ? t('AgentChat.history.runningHint') : undefined}
            >
              <Icon name="Plus" size={14} className="text-current" />
              <span className="hidden sm:inline">{t('AgentChat.page.newConversation')}</span>
            </Button>
          </div>
        </div>
      </header>

      {history.loadFailure && (
        <HistoryNotice
          text={t('AgentChat.history.loadFailed')}
          onDismiss={history.dismissLoadFailure}
          dismissLabel={t('AgentChat.page.dismissHint')}
        />
      )}

      {history.corruptCount > 0 && (
        <HistoryNotice
          text={t('AgentChat.history.corrupt', { count: history.corruptCount })}
          onDismiss={history.dismissCorrupt}
          dismissLabel={t('AgentChat.page.dismissHint')}
        />
      )}

      {history.saveFailureKey && (
        <HistoryNotice
          text={t(history.saveFailureKey)}
          onDismiss={history.dismissSaveFailure}
          dismissLabel={t('AgentChat.page.dismissHint')}
        />
      )}

      {!configReady && (
        <div className="border-b border-sun-300/40 bg-sun-300/12">
          <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 text-small text-ink-700 sm:px-6">
            <Icon name="Info" size={14} className="shrink-0 text-sun-700" />
            <span className="min-w-0 flex-1">{t('AgentChat.config.mainModelMissing')}</span>
            <Button
              intent="secondary"
              size="sm"
              className="shrink-0"
              onClick={() => setConfigOpen(true)}
            >
              <Icon name="SlidersHorizontal" size={14} className="text-current" />
              {t('AgentChat.page.settings')}
            </Button>
          </div>
        </div>
      )}

      {configReady && !optionReady && !optionHintDismissed && (
        <div className="border-b border-paper-200/60 bg-paper-100/50">
          <div className="mx-auto flex w-full max-w-3xl items-start gap-2 px-4 py-2 text-small text-ink-700 sm:px-6">
            <Icon name="Info" size={14} className="mt-0.5 shrink-0 text-ink-300" />
            <span className="min-w-0 flex-1">{t('AgentChat.config.optionModelMissing')}</span>
            <button
              type="button"
              onClick={() => setOptionHintDismissed(true)}
              className="shrink-0 rounded-sm p-1 text-ink-500 transition-colors duration-fast hover:bg-paper-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500/20"
              aria-label={t('AgentChat.page.dismissHint')}
            >
              <Icon name="X" size={14} />
            </button>
          </div>
        </div>
      )}

      {showMigrationNotice && (
        <div className="border-b border-paper-200/60 bg-paper-100/50">
          <div className="mx-auto flex w-full max-w-3xl items-start gap-2 px-4 py-2 text-small text-ink-700 sm:px-6">
            <Icon name="ScrollText" size={14} className="mt-0.5 shrink-0 text-ink-300" />
            <span className="min-w-0 flex-1">{t('AgentChat.config.migrationNotice')}</span>
            <button
              type="button"
              onClick={dismissMigrationNotice}
              className="shrink-0 rounded-sm p-1 text-ink-500 transition-colors duration-fast hover:bg-paper-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500/20"
              aria-label={t('AgentChat.page.dismissHint')}
            >
              <Icon name="X" size={14} />
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto scrollbar-custom">
        <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
          {/* 恢复完成前不显示空态，避免「历史里明明有会话」却先闪一下空提示 */}
          {history.ready && renderedTurns.length === 0 && (
            <div className="flex min-h-[58vh] flex-col items-center justify-center gap-6 pb-10 text-center">
              <div className="rounded-lg bg-white p-3 shadow-soft ring-1 ring-paper-200">
                <BrandLogo size={40} />
              </div>
              <div className="space-y-2">
                <h1 className="text-h1 font-semibold text-ink-900">
                  {t('AgentChat.page.emptyTitle')}
                </h1>
                <p className="mx-auto max-w-sm text-small leading-relaxed text-ink-500">
                  {t('AgentChat.page.emptyState')}
                </p>
              </div>
              {/* 两点提点：交互式学习（追问 + 点卡作答）与生成式 UI（讲解卡片 / 可视化实时生成）。
                  刻意做轻——一行小字加图标，点到为止，不做成卡片式 feature grid */}
              {/* w-full 让 max-w-full 有确定参照：父级 items-center 下本行宽度由内容决定，
                  百分比约束成循环依赖，窄屏会溢出（390px 实测右侧被裁） */}
              <div className="flex w-full flex-col items-center gap-1.5 text-small text-ink-500 sm:flex-row sm:justify-center sm:gap-4">
                {/* 文本包一层 min-w-0：inline-flex 里的匿名 flex item 不会换行，
                    窄屏下会溢出被裁（390px 实测），包一层让它可收缩换行 */}
                <span className="inline-flex max-w-full items-center gap-1.5">
                  <Icon name="MessagesSquare" size={14} className="text-sage-500" />
                  <span className="min-w-0">{t('AgentChat.page.featureInteractive')}</span>
                </span>
                <span className="hidden h-3.5 w-px bg-paper-200 sm:block" aria-hidden="true" />
                <span className="inline-flex max-w-full items-center gap-1.5">
                  <Icon name="Sparkles" size={14} className="text-sage-500" />
                  <span className="min-w-0">{t('AgentChat.page.featureGenerative')}</span>
                </span>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTION_KEYS.map((key) => {
                  const label = t(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => applySuggestion(label)}
                      className={cn(
                        'rounded-pill border border-paper-200 bg-white px-3.5 py-1.5 text-small text-ink-700',
                        'transition-all duration-base ease-soft hover:-translate-y-0.5',
                        'hover:border-sage-300 hover:text-sage-900 hover:shadow-soft',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500/30',
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-10">
            {renderedTurns.map((turn, index) => {
            const errorInfo = classifyTurnError(turn);
            return (
            <div key={turn.id} className="space-y-3">
              {turn.userText && (
                <div className="flex justify-end">
                  <p className="max-w-[85%] whitespace-pre-wrap rounded-lg rounded-br-xs bg-sage-50 px-4 py-2.5 text-body leading-relaxed text-ink-900 shadow-soft ring-1 ring-sage-300/25">
                    {turn.userText}
                  </p>
                </div>
              )}

              <MessageContent blocks={turn.blocks} />

              {/* 刷新时没跑完的那一轮：内容保留、明确告知、不自动重放（E3） */}
              {turn.status === 'interrupted' && (
                <div className="flex items-start gap-2 rounded-md border border-paper-200/70 bg-paper-100/50 px-3 py-2 text-small text-ink-500">
                  <Icon name="Clock" size={14} className="mt-0.5 shrink-0 text-ink-300" />
                  <span>{t('AgentChat.history.interrupted')}</span>
                </div>
              )}

              <QuestionGroup
                questions={turn.questions}
                blocks={turn.blocks}
                onOpen={setOpenQuestionId}
                onSkip={(questionId) => session.skipQuestion({ questionId })}
              />

              {turn.error && (
                <div className="rounded-md border border-state-alert/35 bg-state-alert/[0.06] px-3.5 py-3">
                  <p className="flex items-center gap-2 text-small font-semibold text-ink-900">
                    <Icon name="TriangleAlert" size={14} className="text-state-alert" />
                    {t('AgentChat.page.errorTitle')}
                  </p>
                  {/* 分类文案（F3）：类别由运行层 endedBy 决定，见 errorAdapter */}
                  {errorInfo.kind === 'tool_unsupported' && (
                    <p className="mt-1.5 text-small leading-relaxed text-ink-700">
                      {t('AgentChat.page.toolUnsupported', {
                        endpoint: config.endpoint || t('AgentChat.config.notFilled'),
                        model: config.model || t('AgentChat.config.notFilled'),
                      })}
                    </p>
                  )}
                  {errorInfo.textKey && (
                    <p className="mt-1.5 text-small leading-relaxed text-ink-700">
                      {t(errorInfo.textKey)}
                    </p>
                  )}
                  <p className="mt-1.5 whitespace-pre-wrap break-words rounded-sm bg-white/70 px-2 py-1 font-mono text-caption text-ink-500">
                    {turn.error}
                  </p>
                </div>
              )}

              {/* F2：入口只挂在最后一轮尾部，且只在没跑完（失败 / 取消 / 刷新中断）时出现 */}
              {index === renderedTurns.length - 1 && canRetryLastTurn && (
                <Button
                  intent="secondary"
                  size="sm"
                  onClick={session.retryLastTurn}
                  className="shrink-0 whitespace-nowrap"
                >
                  <Icon name="RefreshCw" size={14} className="text-current" />
                  {t('AgentChat.page.retry')}
                </Button>
              )}
            </div>
            );
          })}

            {session.isRunning && (
              <div className="flex items-center gap-2.5 text-small text-ink-500">
                <span className="flex items-center gap-1">
                  {[0, 1, 2].map((dot) => (
                    <span
                      key={dot}
                      className="h-1.5 w-1.5 animate-pulse rounded-full bg-sage-300"
                      style={{ animationDelay: `${dot * 160}ms` }}
                    />
                  ))}
                </span>
                {isRegenerating ? t('AgentChat.page.regenerating') : t('AgentChat.page.generating')}
              </div>
            )}
          </div>
        </div>
      </main>

      <footer>
        <div className="mx-auto w-full max-w-3xl px-4 py-4 sm:px-6">
          {/* ChatGPT 式输入胶囊：白色浮起 + 柔光，比画布更亮一档；聚焦描边变 sage */}
          <div
            className={cn(
              'flex items-end gap-2 rounded-lg border border-paper-200/70 bg-white p-2 shadow-soft',
              'transition-all duration-base ease-soft',
              'focus-within:border-sage-300 focus-within:shadow-lift',
            )}
          >
            <Textarea
              ref={inputRef}
              rows={2}
              value={inputText}
              onChange={(event) => setInputText(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                session.isAwaitingUser
                  ? t('AgentChat.page.placeholderAwaiting')
                  : t('AgentChat.page.placeholderSend')
              }
              disabled={!configReady}
              aria-label={t('AgentChat.page.inputAriaLabel')}
              className="border-0 bg-transparent px-2 py-1.5 focus:ring-0"
            />
            {/* shrink-0 + nowrap：窄屏下按钮被压缩会让「发送」两字折行（D8 走查发现） */}
            {session.canCancel ? (
              <Button
                intent="secondary"
                size="md"
                className="shrink-0 whitespace-nowrap"
                onClick={session.cancelRun}
              >
                <Icon name="Square" size={14} className="text-current" />
                {t('AgentChat.page.cancel')}
              </Button>
            ) : (
              <Button
                intent="primary"
                size="md"
                className="shrink-0 whitespace-nowrap"
                onClick={handleSend}
                disabled={!canSend}
              >
                <Icon name="ArrowUp" size={14} strokeWidth={2.25} className="text-current" />
                {t('AgentChat.page.send')}
              </Button>
            )}
          </div>
        </div>
      </footer>

      {openQuestion && (
        // 与旧路径相同的全屏定位容器（ChatPage.jsx:713）：
        // AnswerCard 桌面端靠 Draggable bounds="parent" + absolute 居中，
        // 父容器必须撑满视口且不占文档流，否则浮层位置跳脱、挤压页面
        <div className="pointer-events-none fixed inset-0 z-[9999]">
          {openQuestion.optionsStatus === 'unavailable' && (
            <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-sm border border-paper-200 bg-paper-50 px-3 py-2 text-small text-ink-700 shadow-lift">
              {t('AgentChat.page.optionsUnavailableHint')}
            </div>
          )}
          <AnswerCard
            question={toAnswerCardModel(openQuestion)}
            answerSettled
            onLevelSelect={handleLevelSelect}
            onClose={() => setOpenQuestionId(null)}
          />
        </div>
      )}

      <ConfigPanel
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        mainConfig={configSnapshot.main}
        optionConfig={configSnapshot.option}
        onMainConfigChange={handleMainConfigChange}
        onOptionConfigChange={handleOptionConfigChange}
      />

      <HistoryDrawer
        open={historyOpen}
        items={history.conversations}
        currentId={session.conversationId}
        errorText={historyErrorText}
        running={session.isRunning}
        onClose={() => setHistoryOpen(false)}
        onOpen={handleOpenConversation}
        onRename={history.renameConversation}
        onDelete={history.removeConversation}
        onDismissError={dismissHistoryError}
      />
    </div>
  );
}

export default AgentChatPage;
