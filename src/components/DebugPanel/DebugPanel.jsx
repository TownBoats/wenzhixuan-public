import React, { useState } from 'react';
import ConfigManager from "../../utils/ConfigManager";

// ─── 小工具 ──────────────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
  const map = {
    pending:   'bg-slate-100 text-slate-500',
    streaming: 'bg-blue-50 text-blue-600 animate-pulse',
    success:   'bg-green-50 text-green-700',
    error:     'bg-red-50 text-red-700',
  };
  const label = {
    pending: '等待中', streaming: '响应中', success: '成功', error: '失败',
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${map[status] || map.pending}`}>
      {label[status] || status}
    </span>
  );
};

const AgentBadge = ({ agent }) => (
  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
    agent === 'main'
      ? 'bg-violet-50 text-violet-700'
      : 'bg-amber-50 text-amber-700'
  }`}>
    {agent === 'main' ? '主模型' : '选项模型'}
  </span>
);

const CollapseSection = ({ title, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-100 rounded overflow-hidden mt-1.5">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <span className="text-[11px] font-medium text-slate-600">{title}</span>
        <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="p-2.5 bg-white">
          {children}
        </div>
      )}
    </div>
  );
};

// ─── 单条日志卡片 ──────────────────────────────────────────────────────────────

const LogCard = ({ entry }) => {
  const time = new Date(entry.startTime).toLocaleTimeString('zh-CN', { hour12: false });
  const dur = entry.duration != null ? `${entry.duration}ms` : '—';

  return (
    <div className={`rounded-lg border text-xs mb-2 overflow-hidden ${
      entry.status === 'error' ? 'border-red-200 bg-red-50/30' : 'border-slate-200 bg-white'
    }`}>
      {/* 头部 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 flex-wrap">
        <AgentBadge agent={entry.agent} />
        <StatusBadge status={entry.status} />
        {/* HTTP 状态码徽章 */}
        {entry.statusCode && (
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
            entry.statusCode >= 200 && entry.statusCode < 300
              ? 'bg-green-50 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}>
            {entry.statusCode}
          </span>
        )}
        <span className="text-slate-400 font-mono">{time}</span>
        {entry.duration != null && (
          <span className="ml-auto text-slate-400 font-mono">{dur}</span>
        )}
      </div>

      {/* 问题（Option Agent 专用） */}
      {entry.questionText && (
        <div className="px-3 py-1.5 border-b border-slate-100 text-slate-600 bg-amber-50/30">
          <span className="font-medium text-[10px] text-amber-700 mr-1">问题：</span>
          {entry.questionText}
        </div>
      )}

      {/* 错误信息 */}
      {entry.error && (
        <div className="px-3 py-1.5 text-red-700 bg-red-50/50 border-b border-red-100 break-all">
          <span className="font-medium">错误：</span>{entry.error}
        </div>
      )}

      <div className="p-2">
        {/* 请求详情（URL / 模型 / 参数） */}
        {entry.requestMeta && (
          <CollapseSection title="请求详情" defaultOpen={entry.status === 'error'}>
            <div className="space-y-1 text-[11px]">
              {/* 实际 URL（来自 APICallError.url，最可靠）优先于计算值 */}
              <div className="flex gap-2 items-start">
                <span className="text-slate-400 shrink-0 w-20">实际 URL</span>
                <span className={`font-mono break-all ${entry.actualUrl ? 'text-red-700 font-semibold' : 'text-slate-700'}`}>
                  {entry.actualUrl || entry.requestMeta.url}
                  {entry.actualUrl && entry.actualUrl !== entry.requestMeta.url && (
                    <span className="ml-1 text-[10px] text-red-500">← SDK 实际发送</span>
                  )}
                </span>
              </div>
              {entry.requestMeta.originalUrl !== entry.requestMeta.url && (
                <div className="flex gap-2 items-start">
                  <span className="text-slate-400 shrink-0 w-20">配置 URL</span>
                  <span className="font-mono text-slate-500 break-all">{entry.requestMeta.originalUrl}</span>
                </div>
              )}
              <div className="flex gap-2">
                <span className="text-slate-400 shrink-0 w-20">模型</span>
                <span className="font-mono text-slate-700">{entry.requestMeta.model}</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {[
                  ['温度', entry.requestMeta.temperature],
                  ['maxTokens', entry.requestMeta.maxTokens],
                  ['topP', entry.requestMeta.topP],
                  ['freqPen', entry.requestMeta.frequencyPenalty],
                  ['presPen', entry.requestMeta.presencePenalty],
                ].map(([k, v]) => v != null && (
                  <span key={k} className="inline-flex gap-1 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">
                    <span className="text-slate-400">{k}</span>
                    <span className="font-mono text-slate-700">{v}</span>
                  </span>
                ))}
              </div>
            </div>
          </CollapseSection>
        )}

        {/* 原始响应体（仅错误时显示） */}
        {entry.responseBody && (
          <CollapseSection title="原始响应体" defaultOpen={true}>
            <pre className="text-[11px] text-red-700 whitespace-pre-wrap break-all font-mono leading-relaxed max-h-40 overflow-y-auto bg-red-50/30 p-2 rounded">
              {entry.responseBody}
            </pre>
          </CollapseSection>
        )}

        {/* 实际发送的请求体（错误时展开，帮助排查参数问题） */}
        {entry.sentBody && (
          <CollapseSection title="实际发送的请求体" defaultOpen={entry.status === 'error'}>
            <pre className="text-[11px] text-slate-600 whitespace-pre-wrap break-all font-mono leading-relaxed max-h-52 overflow-y-auto bg-slate-50 p-2 rounded">
              {entry.sentBody}
            </pre>
          </CollapseSection>
        )}

        {/* 思考内容 */}
        {entry.thinkingText && (
          <CollapseSection title={`思考内容（${entry.thinkingText.length.toLocaleString()} 字）`}>
            <pre className="text-[11px] text-slate-500 whitespace-pre-wrap break-all font-mono leading-relaxed max-h-40 overflow-y-auto">
              {entry.thinkingText}
            </pre>
          </CollapseSection>
        )}

        {/* 模型输出 */}
        {entry.responseText && (
          <CollapseSection title={`模型输出（${entry.responseText.length.toLocaleString()} 字）`}
            defaultOpen={entry.status === 'error' && !entry.responseBody}>
            <pre className="text-[11px] text-slate-700 whitespace-pre-wrap break-all leading-relaxed max-h-52 overflow-y-auto">
              {entry.responseText}
            </pre>
          </CollapseSection>
        )}

        {/* 请求消息 */}
        {entry.requestMessages?.length > 0 && (
          <CollapseSection title={`请求消息（${entry.requestMessages.length} 条）`}>
            <pre className="text-[11px] text-slate-600 whitespace-pre-wrap break-all font-mono max-h-52 overflow-y-auto">
              {JSON.stringify(entry.requestMessages, null, 2)}
            </pre>
          </CollapseSection>
        )}
      </div>
    </div>
  );
};

// ─── 日志面板 ──────────────────────────────────────────────────────────────────

const LogsTab = ({ logs, clearLogs }) => {
  const reversed = [...logs].reverse();
  const successCount = logs.filter(l => l.status === 'success').length;
  const errorCount   = logs.filter(l => l.status === 'error').length;
  const streamingCount = logs.filter(l => l.status === 'streaming' || l.status === 'pending').length;

  return (
    <div className="flex flex-col h-full">
      {/* 统计栏 */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-100 bg-slate-50/60 shrink-0">
        <span className="text-xs text-slate-500">共 <b className="text-slate-700">{logs.length}</b> 条</span>
        {successCount > 0 && <span className="text-xs text-green-700">{successCount} 成功</span>}
        {errorCount   > 0 && <span className="text-xs text-red-700">{errorCount} 失败</span>}
        {streamingCount > 0 && <span className="text-xs text-blue-600 animate-pulse">{streamingCount} 进行中</span>}
        <button
          onClick={clearLogs}
          className="ml-auto text-xs text-slate-400 hover:text-red-500 transition-colors px-2 py-0.5 rounded hover:bg-red-50"
        >
          清空
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {reversed.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-slate-400 text-xs gap-2">
            <svg className="w-8 h-8 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            暂无请求日志
          </div>
        ) : (
          reversed.map(entry => <LogCard key={entry.id} entry={entry} />)
        )}
      </div>
    </div>
  );
};

// ─── 配置面板（原有内容） ──────────────────────────────────────────────────────

const ConfigTab = ({
  mainModelConfig, optionModelConfig,
  mainPrompt, optionPrompt,
  currentChatId, messages, singleTurnQuestion, histories,
}) => (
  <div className="flex-1 overflow-y-auto p-4 space-y-6">
    <div>
      <h4 className="text-sm font-medium mb-2 text-slate-600">主模型配置</h4>
      <pre className="p-3 rounded bg-slate-50 text-xs overflow-auto max-h-60 whitespace-pre-wrap break-all">
        {JSON.stringify(mainModelConfig, null, 2)}
      </pre>
    </div>
    <div>
      <h4 className="text-sm font-medium mb-2 text-slate-600">选项模型配置</h4>
      <pre className="p-3 rounded bg-slate-50 text-xs overflow-auto max-h-60 whitespace-pre-wrap break-all">
        {JSON.stringify(optionModelConfig, null, 2)}
      </pre>
    </div>
    <div>
      <h4 className="text-sm font-medium mb-2 text-slate-600">主模型提示词</h4>
      <pre className="p-3 rounded bg-slate-50 text-xs overflow-auto max-h-60 whitespace-pre-wrap break-all">
        {mainPrompt}
      </pre>
    </div>
    <div>
      <h4 className="text-sm font-medium mb-2 text-slate-600">选项模型提示词</h4>
      <pre className="p-3 rounded bg-slate-50 text-xs overflow-auto max-h-60 whitespace-pre-wrap break-all">
        {optionPrompt}
      </pre>
    </div>
    <div>
      <h4 className="text-sm font-medium mb-2 text-slate-600">本地存储状态</h4>
      <button
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
        className="px-4 py-2 bg-slate-100 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors"
      >
        查看本地存储数据
      </button>
    </div>
    <div>
      <h4 className="text-sm font-medium mb-2 text-slate-600">当前对话状态</h4>
      <div className="space-y-2">
        {[
          ['当前对话ID', currentChatId || '无'],
          ['消息数量', messages.length],
          ['问题数量', singleTurnQuestion.length],
          ['历史记录数量', histories.length],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between">
            <span className="text-xs text-slate-500">{label}:</span>
            <span className="text-xs font-mono">{value}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ─── 主 DebugPanel ─────────────────────────────────────────────────────────────

const TABS = [
  { id: 'logs',   label: '请求日志' },
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
  // 新增
  logs = [],
  clearLogs,
}) => {
  const [activeTab, setActiveTab] = useState('logs');

  if (!showDebugPanel) return null;

  return (
    <div
      className="fixed right-0 top-0 bg-white/97 border-l border-slate-200 shadow-xl z-50 flex flex-col"
      style={{ width: 420, top: 72, height: 'calc(100% - 72px)' }}
    >
      {/* 顶部栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0">
        <h2 className="text-sm font-semibold text-slate-800">调试面板</h2>
        <button
          onClick={() => setShowDebugPanel(false)}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 标签页 */}
      <div className="flex border-b border-slate-200 shrink-0">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 text-xs font-medium transition-colors relative ${
              activeTab === tab.id
                ? 'text-violet-700'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
            {tab.id === 'logs' && logs.some(l => l.status === 'error') && (
              <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-100 text-red-700 text-[10px]">
                {logs.filter(l => l.status === 'error').length}
              </span>
            )}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-violet-600 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'logs' && (
          <LogsTab logs={logs} clearLogs={clearLogs} />
        )}
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

export default DebugPanel;
