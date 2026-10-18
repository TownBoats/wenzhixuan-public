import { useDeferredValue, useMemo, useState } from 'react';
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
import { Button, Icon, Textarea } from '@/components/ui';
import QuestionGroup from './QuestionGroup';
import HistoryDrawer from './HistoryDrawer';
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
 * 「重试这一轮」只在最后一轮没跑完时出现（F2，`决策记录.md` C-1 结论 3）。
 *
 * 为什么不用 `session.canRetryLastTurn`：它只判「有最后一轮且不在运行中」，
 * 正常完成、正在等待作答的轮次也算真；重试那些轮次没有意义，还会把已完成内容再跑一遍。
 */
const RETRYABLE_TURN_STATUSES = new Set(['failed', 'cancelled', 'interrupted']);

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
    <div className="flex items-center justify-between gap-2 border-b border-paper-200 bg-sun-300/15 px-4 py-2 text-small text-ink-700">
      <span>{text}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded-sm p-1 text-ink-500 transition-colors duration-fast hover:bg-paper-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500/20"
        aria-label={dismissLabel}
      >
        <Icon name="X" size={14} />
      </button>
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
  const { configReady, optionReady, config, optionConfig, optionSystemPrompt } = useMemo(() => {
    const main = ConfigManager.getMainModelConfig();
    const option = ConfigManager.getOptionModelConfig();
    return {
      configReady: ConfigManager.isModelConfigured(main),
      optionReady: ConfigManager.isModelConfigured(option),
      config: toRunnerConfig(main),
      optionConfig: toRunnerConfig(option),
      optionSystemPrompt: ConfigManager.getOptionPrompt(),
    };
  }, []);

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
    <div className="flex h-screen flex-col bg-paper-100">
      <header className="flex items-center justify-between border-b border-paper-200 bg-paper-50 px-4 py-2">
        <span className="text-small text-ink-500">{t('AgentChat.page.title')}</span>
        <div className="flex items-center gap-1">
          <Button intent="ghost" size="sm" onClick={openHistory}>
            {t('AgentChat.history.openHistory')}
          </Button>
          {/* 新会话同样会中止当前运行并清空状态（F1 决策 2B），运行中不可点 */}
          <Button
            intent="ghost"
            size="sm"
            onClick={session.newConversation}
            disabled={session.isRunning}
            title={session.isRunning ? t('AgentChat.history.runningHint') : undefined}
          >
            {t('AgentChat.page.newConversation')}
          </Button>
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
        <div className="border-b border-paper-200 bg-sun-300/15 px-4 py-2 text-small text-ink-700">
          {t('AgentChat.config.mainModelMissing')}
        </div>
      )}

      {configReady && !optionReady && !optionHintDismissed && (
        <div className="flex items-center justify-between gap-2 border-b border-paper-200 bg-paper-50 px-4 py-2 text-small text-ink-700">
          <span>{t('AgentChat.config.optionModelMissing')}</span>
          <button
            type="button"
            onClick={() => setOptionHintDismissed(true)}
            className="shrink-0 rounded-sm p-1 text-ink-500 transition-colors duration-fast hover:bg-paper-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500/20"
            aria-label={t('AgentChat.page.dismissHint')}
          >
            <Icon name="X" size={14} />
          </button>
        </div>
      )}

      {showMigrationNotice && (
        <div className="flex items-center justify-between gap-2 border-b border-paper-200 bg-paper-50 px-4 py-2 text-small text-ink-700">
          <span>{t('AgentChat.config.migrationNotice')}</span>
          <button
            type="button"
            onClick={dismissMigrationNotice}
            className="shrink-0 rounded-sm p-1 text-ink-500 transition-colors duration-fast hover:bg-paper-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500/20"
            aria-label={t('AgentChat.page.dismissHint')}
          >
            <Icon name="X" size={14} />
          </button>
        </div>
      )}

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-6 p-4">
          {/* 恢复完成前不显示空态，避免「历史里明明有会话」却先闪一下空提示 */}
          {history.ready && renderedTurns.length === 0 && (
            <p className="pt-16 text-center text-body text-ink-500">
              {t('AgentChat.page.emptyState')}
            </p>
          )}

          {renderedTurns.map((turn, index) => {
            const errorInfo = classifyTurnError(turn);
            return (
            <div key={turn.id} className="space-y-3">
              {turn.userText && (
                <div className="flex justify-end">
                  <p className="max-w-[80%] whitespace-pre-wrap rounded-md bg-sage-50 px-3 py-2 text-body text-ink-900">
                    {turn.userText}
                  </p>
                </div>
              )}

              <MessageContent blocks={turn.blocks} />

              {/* 刷新时没跑完的那一轮：内容保留、明确告知、不自动重放（E3） */}
              {turn.status === 'interrupted' && (
                <div className="rounded-sm border border-paper-200 bg-paper-50 px-3 py-2 text-small text-ink-500">
                  {t('AgentChat.history.interrupted')}
                </div>
              )}

              <QuestionGroup
                questions={turn.questions}
                onOpen={setOpenQuestionId}
                onSkip={(questionId) => session.skipQuestion({ questionId })}
              />

              {turn.error && (
                <div className="rounded-sm border border-state-alert/40 bg-sun-300/15 px-3 py-2">
                  <p className="text-small font-medium text-ink-900">
                    {t('AgentChat.page.errorTitle')}
                  </p>
                  {/* 分类文案（F3）：类别由运行层 endedBy 决定，见 errorAdapter */}
                  {errorInfo.kind === 'tool_unsupported' && (
                    <p className="mt-0.5 text-small text-ink-700">
                      {t('AgentChat.page.toolUnsupported', {
                        endpoint: config.endpoint || t('AgentChat.config.notFilled'),
                        model: config.model || t('AgentChat.config.notFilled'),
                      })}
                    </p>
                  )}
                  {errorInfo.textKey && (
                    <p className="mt-0.5 text-small text-ink-700">{t(errorInfo.textKey)}</p>
                  )}
                  <p className="mt-0.5 whitespace-pre-wrap text-small text-ink-500">{turn.error}</p>
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
                  {t('AgentChat.page.retry')}
                </Button>
              )}
            </div>
            );
          })}

          {session.isRunning && (
            <p className="flex items-center gap-2 text-small text-ink-500">
              <Icon name="LoaderCircle" size={14} className="animate-spin" />
              {isRegenerating ? t('AgentChat.page.regenerating') : t('AgentChat.page.generating')}
            </p>
          )}
        </div>
      </main>

      <footer className="border-t border-paper-200 bg-paper-50 p-4">
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <Textarea
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
          />
          {/* shrink-0 + nowrap：窄屏下按钮被压缩会让「发送」两字折行（D8 走查发现） */}
          {session.canCancel ? (
            <Button
              intent="secondary"
              size="md"
              className="shrink-0 whitespace-nowrap"
              onClick={session.cancelRun}
            >
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
              {t('AgentChat.page.send')}
            </Button>
          )}
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
