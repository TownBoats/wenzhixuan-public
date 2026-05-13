import { useState } from 'react';
import PropTypes from 'prop-types';
import ConfigManager from '../../utils/ConfigManager';
import { Button, Icon, Tag, cn } from '@/components/ui';

/**
 * DebugPanel — 开发者调试面板（设计 token 重写版）
 *
 * 设计意图：保留**工程感**（信息密度 / 等宽字 / 紧凑间距 / 语义色块），
 *          但所有具体颜色走新 token（state-good / state-alert / sage 等），
 *          所有按钮走 ui/Button + Icon，所有徽章走 ui/Tag。
 *
 * 视觉迁移自旧版：
 *   - bg-white/97 + slate borders          → bg-paper-50 + paper-200
 *   - StatusBadge 4 套 (slate/blue/green/red) → ui Tag (neutral/active/good/alert)
 *   - AgentBadge violet/amber                → sage / sun（与全局 accent 一致）
 *   - violet 激活 Tab 文字 + 下划线           → sage-700 + 3px sage 下划线
 *   - 内联 SVG 折叠/关闭                     → ui Button + lucide ChevronDown / X
 *   - 错误 red-50/red-700 卡边                → state-alert 系
 *   - 内嵌 pre 块 bg-slate-50                → bg-paper-100 (信息密度不变)
 *
 * 行为完全保留：日志渲染顺序 / 折叠展开 / 清空 / config Tab。
 */

// ─── 状态徽章 ────────────────────────────────────────────────
const STATUS_VARIANT = {
  pending: 'neutral',
  streaming: 'active',
  success: 'good',
  error: 'alert',
};
const STATUS_LABEL = {
  pending: '等待中',
  streaming: '响应中',
  success: '成功',
  error: '失败',
};

const StatusBadge = ({ status }) => (
  <Tag
    variant={STATUS_VARIANT[status] || 'neutral'}
    className={cn(status === 'streaming' && 'animate-pulse')}
  >
    {STATUS_LABEL[status] || status}
  </Tag>
);
StatusBadge.propTypes = { status: PropTypes.string };

// ─── Agent 徽章（主/选项） ───────────────────────────────────
const AgentBadge = ({ agent }) => (
  <Tag variant={agent === 'main' ? 'active' : 'warn'}>
    {agent === 'main' ? '主模型' : '选项模型'}
  </Tag>
);
AgentBadge.propTypes = { agent: PropTypes.string };

// ─── 折叠区块 ─────────────────────────────────────────────────
const CollapseSection = ({ title, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-1.5 overflow-hidden rounded-xs border border-paper-200">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between bg-paper-100 px-2.5 py-1.5 transition-colors duration-fast hover:bg-paper-200"
      >
        <span className="font-mono text-caption text-ink-700">{title}</span>
        <Icon
          name="ChevronDown"
          size={12}
          className={cn(
            'text-ink-500 transition-transform duration-fast',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && <div className="bg-paper-50 p-2.5">{children}</div>}
    </div>
  );
};
CollapseSection.propTypes = {
  title: PropTypes.node.isRequired,
  children: PropTypes.node,
  defaultOpen: PropTypes.bool,
};

// ─── 单条日志卡片 ─────────────────────────────────────────────
const LogCard = ({ entry }) => {
  const time = new Date(entry.startTime).toLocaleTimeString('zh-CN', { hour12: false });
  const dur = entry.duration != null ? `${entry.duration}ms` : '—';
  const isError = entry.status === 'error';
  const isOk = entry.statusCode >= 200 && entry.statusCode < 300;

  return (
    <div
      className={cn(
        'mb-2 overflow-hidden rounded-sm border text-caption',
        isError ? 'border-state-alert/30 bg-state-alert/5' : 'border-paper-200 bg-paper-50',
      )}
    >
      {/* 头部 */}
      <div className="flex flex-wrap items-center gap-2 border-b border-paper-200 px-3 py-2">
        <AgentBadge agent={entry.agent} />
        <StatusBadge status={entry.status} />
        {entry.statusCode && (
          <span
            className={cn(
              'inline-flex items-center rounded-xs px-1.5 py-0.5 font-mono text-caption font-bold',
              isOk
                ? 'bg-state-good/15 text-sage-700'
                : 'bg-state-alert/15 text-state-alert',
            )}
          >
            {entry.statusCode}
          </span>
        )}
        <span className="font-mono text-caption text-ink-500">{time}</span>
        {entry.duration != null && (
          <span className="ml-auto font-mono text-caption text-ink-500">{dur}</span>
        )}
      </div>

      {/* 问题（Option Agent 专用） */}
      {entry.questionText && (
        <div className="border-b border-paper-200 bg-sun-300/15 px-3 py-1.5 text-ink-700">
          <span className="mr-1 text-caption font-medium text-sun-700">问题：</span>
          {entry.questionText}
        </div>
      )}

      {/* 错误信息 */}
      {entry.error && (
        <div className="break-all border-b border-state-alert/20 bg-state-alert/10 px-3 py-1.5 text-state-alert">
          <span className="font-medium">错误：</span>
          {entry.error}
        </div>
      )}

      <div className="p-2">
        {/* 请求详情 */}
        {entry.requestMeta && (
          <CollapseSection title="请求详情" defaultOpen={isError}>
            <div className="space-y-1 text-caption">
              <div className="flex items-start gap-2">
                <span className="w-20 shrink-0 text-ink-500">实际 URL</span>
                <span
                  className={cn(
                    'break-all font-mono',
                    entry.actualUrl
                      ? 'font-semibold text-state-alert'
                      : 'text-ink-700',
                  )}
                >
                  {entry.actualUrl || entry.requestMeta.url}
                  {entry.actualUrl && entry.actualUrl !== entry.requestMeta.url && (
                    <span className="ml-1 text-caption text-state-alert">
                      ← SDK 实际发送
                    </span>
                  )}
                </span>
              </div>
              {entry.requestMeta.originalUrl !== entry.requestMeta.url && (
                <div className="flex items-start gap-2">
                  <span className="w-20 shrink-0 text-ink-500">配置 URL</span>
                  <span className="break-all font-mono text-ink-500">
                    {entry.requestMeta.originalUrl}
                  </span>
                </div>
              )}
              <div className="flex gap-2">
                <span className="w-20 shrink-0 text-ink-500">模型</span>
                <span className="font-mono text-ink-700">{entry.requestMeta.model}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  ['温度', entry.requestMeta.temperature],
                  ['maxTokens', entry.requestMeta.maxTokens],
                  ['topP', entry.requestMeta.topP],
                  ['freqPen', entry.requestMeta.frequencyPenalty],
                  ['presPen', entry.requestMeta.presencePenalty],
                ].map(
                  ([k, v]) =>
                    v != null && (
                      <span
                        key={k}
                        className="inline-flex gap-1 rounded-xs border border-paper-200 bg-paper-100 px-1.5 py-0.5"
                      >
                        <span className="text-ink-500">{k}</span>
                        <span className="font-mono text-ink-700">{v}</span>
                      </span>
                    ),
                )}
              </div>
            </div>
          </CollapseSection>
        )}

        {/* 原始响应体 */}
        {entry.responseBody && (
          <CollapseSection title="原始响应体" defaultOpen>
            <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap break-all rounded-xs bg-state-alert/10 p-2 font-mono text-caption leading-relaxed text-state-alert">
              {entry.responseBody}
            </pre>
          </CollapseSection>
        )}

        {/* 实际发送的请求体 */}
        {entry.sentBody && (
          <CollapseSection title="实际发送的请求体" defaultOpen={isError}>
            <pre className="max-h-52 overflow-y-auto whitespace-pre-wrap break-all rounded-xs bg-paper-100 p-2 font-mono text-caption leading-relaxed text-ink-700">
              {entry.sentBody}
            </pre>
          </CollapseSection>
        )}

        {/* 思考内容 */}
        {entry.thinkingText && (
          <CollapseSection title={`思考内容（${entry.thinkingText.length.toLocaleString()} 字）`}>
            <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap break-all font-mono text-caption leading-relaxed text-ink-500">
              {entry.thinkingText}
            </pre>
          </CollapseSection>
        )}

        {/* 模型输出 */}
        {entry.responseText && (
          <CollapseSection
            title={`模型输出（${entry.responseText.length.toLocaleString()} 字）`}
            defaultOpen={isError && !entry.responseBody}
          >
            <pre className="max-h-52 overflow-y-auto whitespace-pre-wrap break-all text-caption leading-relaxed text-ink-700">
              {entry.responseText}
            </pre>
          </CollapseSection>
        )}

        {/* 请求消息 */}
        {entry.requestMessages?.length > 0 && (
          <CollapseSection title={`请求消息（${entry.requestMessages.length} 条）`}>
            <pre className="max-h-52 overflow-y-auto whitespace-pre-wrap break-all font-mono text-caption text-ink-700">
              {JSON.stringify(entry.requestMessages, null, 2)}
            </pre>
          </CollapseSection>
        )}
      </div>
    </div>
  );
};
LogCard.propTypes = { entry: PropTypes.object.isRequired };

// ─── 日志面板 ─────────────────────────────────────────────────
const LogsTab = ({ logs, clearLogs }) => {
  const reversed = [...logs].reverse();
  const successCount = logs.filter((l) => l.status === 'success').length;
  const errorCount = logs.filter((l) => l.status === 'error').length;
  const streamingCount = logs.filter(
    (l) => l.status === 'streaming' || l.status === 'pending',
  ).length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-paper-200 bg-paper-100/60 px-4 py-2">
        <span className="text-caption text-ink-500">
          共{' '}
          <b className="font-mono text-ink-900">{logs.length}</b> 条
        </span>
        {successCount > 0 && (
          <span className="text-caption text-sage-700">
            {successCount} 成功
          </span>
        )}
        {errorCount > 0 && (
          <span className="text-caption text-state-alert">{errorCount} 失败</span>
        )}
        {streamingCount > 0 && (
          <span className="animate-pulse text-caption text-sage-500">
            {streamingCount} 进行中
          </span>
        )}
        <button
          type="button"
          onClick={clearLogs}
          className="ml-auto rounded-xs px-2 py-0.5 text-caption text-ink-500 transition-colors duration-fast hover:bg-state-alert/10 hover:text-state-alert"
        >
          清空
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 scrollbar-custom">
        {reversed.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-caption text-ink-300">
            <Icon name="ClipboardList" size={32} className="text-current opacity-50" />
            暂无请求日志
          </div>
        ) : (
          reversed.map((entry) => <LogCard key={entry.id} entry={entry} />)
        )}
      </div>
    </div>
  );
};
LogsTab.propTypes = {
  logs: PropTypes.array.isRequired,
  clearLogs: PropTypes.func.isRequired,
};

// ─── 配置面板 ─────────────────────────────────────────────────
const ConfigSection = ({ title, children }) => (
  <div>
    <h4 className="mb-2 font-mono text-caption uppercase tracking-wide text-ink-500">
      {title}
    </h4>
    {children}
  </div>
);
ConfigSection.propTypes = { title: PropTypes.string.isRequired, children: PropTypes.node };

const JsonBlock = ({ value }) => (
  <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-all rounded-xs bg-paper-100 p-3 font-mono text-caption text-ink-700">
    {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
  </pre>
);
JsonBlock.propTypes = { value: PropTypes.any };

const ConfigTab = ({
  mainModelConfig,
  optionModelConfig,
  mainPrompt,
  optionPrompt,
  currentChatId,
  messages,
  singleTurnQuestion,
  histories,
}) => (
  <div className="flex-1 space-y-6 overflow-y-auto p-4 scrollbar-custom">
    <ConfigSection title="主模型配置">
      <JsonBlock value={mainModelConfig} />
    </ConfigSection>
    <ConfigSection title="选项模型配置">
      <JsonBlock value={optionModelConfig} />
    </ConfigSection>
    <ConfigSection title="主模型提示词">
      <JsonBlock value={mainPrompt} />
    </ConfigSection>
    <ConfigSection title="选项模型提示词">
      <JsonBlock value={optionPrompt} />
    </ConfigSection>
    <ConfigSection title="本地存储状态">
      <Button
        intent="secondary"
        size="sm"
        onClick={() => {
          const data = {
            mainAgentConfig: ConfigManager.getMainModelConfig(),
            optionAgentConfig: ConfigManager.getOptionModelConfig(),
            mainAgentPrompt: ConfigManager.getMainPrompt(),
            optionAgentPrompt: ConfigManager.getOptionPrompt(),
          };
          console.log('本地存储数据:', data);
          alert('本地存储数据已输出到控制台');
        }}
      >
        <Icon name="Terminal" size={14} className="text-current" />
        查看本地存储数据
      </Button>
    </ConfigSection>
    <ConfigSection title="当前对话状态">
      <div className="space-y-2">
        {[
          ['当前对话ID', currentChatId || '无'],
          ['消息数量', messages.length],
          ['问题数量', singleTurnQuestion.length],
          ['历史记录数量', histories.length],
        ].map(([label, value]) => (
          <div key={label} className="flex items-center justify-between border-b border-paper-200 pb-1 last:border-0">
            <span className="text-caption text-ink-500">{label}</span>
            <span className="font-mono text-caption text-ink-900">{value}</span>
          </div>
        ))}
      </div>
    </ConfigSection>
  </div>
);
ConfigTab.propTypes = {
  mainModelConfig: PropTypes.object,
  optionModelConfig: PropTypes.object,
  mainPrompt: PropTypes.string,
  optionPrompt: PropTypes.string,
  currentChatId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  messages: PropTypes.array.isRequired,
  singleTurnQuestion: PropTypes.array.isRequired,
  histories: PropTypes.array.isRequired,
};

// ─── 主面板 ──────────────────────────────────────────────────
const TABS = [
  { id: 'logs', label: '请求日志' },
  { id: 'config', label: '配置' },
];

const DebugPanel = ({
  showDebugPanel,
  setShowDebugPanel,
  mainModelConfig,
  optionModelConfig,
  mainPrompt,
  optionPrompt,
  currentChatId,
  messages,
  singleTurnQuestion,
  histories,
  logs = [],
  clearLogs,
}) => {
  const [activeTab, setActiveTab] = useState('logs');
  const errorCount = logs.filter((l) => l.status === 'error').length;

  if (!showDebugPanel) return null;

  return (
    <div
      className="fixed right-0 top-0 z-50 flex flex-col border-l border-paper-200 bg-paper-50/97 shadow-lift"
      style={{ width: 420, top: 72, height: 'calc(100% - 72px)' }}
    >
      {/* 顶栏 */}
      <div className="flex shrink-0 items-center justify-between border-b border-paper-200 px-4 py-3">
        <h2 className="flex items-center gap-2 font-serif text-h2 text-ink-900">
          <Icon name="Bug" size={16} className="text-sage-700" />
          调试面板
        </h2>
        <Button
          intent="ghost"
          size="sm"
          iconOnly
          onClick={() => setShowDebugPanel(false)}
          aria-label="关闭"
        >
          <Icon name="X" size={14} />
        </Button>
      </div>

      {/* Tab 切换 */}
      <div className="flex shrink-0 border-b border-paper-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'relative flex-1 py-2 text-small font-medium transition-colors duration-fast',
              activeTab === tab.id
                ? 'text-sage-700'
                : 'text-ink-500 hover:text-ink-700',
            )}
          >
            {tab.label}
            {tab.id === 'logs' && errorCount > 0 && (
              <span className="ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-pill bg-state-alert/15 px-1 font-mono text-caption text-state-alert">
                {errorCount}
              </span>
            )}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-4 right-4 h-[2px] rounded-pill bg-sage-500" />
            )}
          </button>
        ))}
      </div>

      {/* 内容区 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {activeTab === 'logs' && <LogsTab logs={logs} clearLogs={clearLogs} />}
        {activeTab === 'config' && (
          <ConfigTab
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
    </div>
  );
};

DebugPanel.propTypes = {
  showDebugPanel: PropTypes.bool,
  setShowDebugPanel: PropTypes.func.isRequired,
  mainModelConfig: PropTypes.object,
  optionModelConfig: PropTypes.object,
  mainPrompt: PropTypes.string,
  optionPrompt: PropTypes.string,
  currentChatId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  messages: PropTypes.array,
  singleTurnQuestion: PropTypes.array,
  histories: PropTypes.array,
  logs: PropTypes.array,
  clearLogs: PropTypes.func.isRequired,
};

export default DebugPanel;
