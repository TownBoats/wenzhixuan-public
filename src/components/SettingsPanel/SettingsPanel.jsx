import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import ModelConfigPanel from '../ModelConfigPanel/ModelConfigPanel';
import AgentConfigPanel from '../AgentConfigPanel/AgentConfigPanel';
import {
  Button,
  Icon,
  BrandLogo,
  Screwdriver,
  Tag,
  cn,
} from '@/components/ui';

/**
 * SettingsPanel — 设置面板（P3f Susan Kare 重设计版）
 *
 * 视觉迁移自旧版（docs/REDESIGN_KARE.md §3.7）：
 *   - 横向胶囊 Tab + 黑底白字选中 → 240px 竖向 Tab 列 + paper-100 +
 *                                     3px sage 左竖线
 *   - max-w-4xl + rounded-2xl     → max-w-3xl + rounded-lg
 *   - 标题区 gear icon            → BrandLogo + display 字号
 *   - 黑色 (gray-800) 主按钮       → ui/Button intent="primary" (sage-500)
 *   - 危险操作 gray-200 chip       → state-alert/10 hover state-alert/15
 *   - 4 段卡片重复内联样式          → SettingsCard 子组件统一
 *   - 自定义 Checkbox black gradient → sage-500 单色 + 圆头 check
 *   - alert(...) 简单弹窗仍保留     → 留待 P5/Toast 系统
 *
 * 行为完全保留：
 *   - 4 个 Tab + AnimatePresence
 *   - localStorage（developerMode / enableWaitTime / waitTime）
 *   - 语言切换的 SystemPrompts 同步逻辑（CustomEvent + handleOptionPromptChange）
 *   - 聊天记录导入/导出/清空 完整流程
 *   - Props 接口完全不变
 */

// ── 子组件：自定义 Checkbox ──────────────────────────────
const StyledCheckbox = ({ checked, onChange, label }) => (
  <label className="group flex cursor-pointer items-center gap-2">
    <div className="relative">
      <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
      <div
        className={cn(
          'flex h-5 w-5 items-center justify-center rounded-sm border transition-colors duration-fast',
          checked
            ? 'bg-sage-500 border-sage-500'
            : 'bg-paper-50 border-paper-200 group-hover:border-sage-500',
        )}
      >
        {checked && <Icon name="Check" size={14} className="text-white" strokeWidth={3} />}
      </div>
    </div>
    {label && <span className="text-small text-ink-700">{label}</span>}
  </label>
);
StyledCheckbox.propTypes = {
  checked: PropTypes.bool,
  onChange: PropTypes.func,
  label: PropTypes.string,
};

// ── 子组件：设置区块卡片 ─────────────────────────────────
const SettingsCard = ({ icon, title, children }) => (
  <div className="rounded-md border border-paper-200 bg-paper-50 p-4 shadow-soft">
    <h3 className="mb-3 flex items-center gap-2 text-h2 font-serif text-ink-900">
      {icon}
      {title}
    </h3>
    {children}
  </div>
);
SettingsCard.propTypes = {
  icon: PropTypes.node,
  title: PropTypes.string.isRequired,
  children: PropTypes.node,
};

// ── 子组件：左侧 Tab 项 ─────────────────────────────────
const SidebarTab = ({ active, icon, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'group relative flex w-full items-center gap-3 rounded-sm px-3 py-2',
      'text-body font-sans transition-colors duration-fast',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500/30',
      active
        ? 'bg-paper-100 text-ink-900'
        : 'text-ink-500 hover:bg-paper-100/60 hover:text-ink-700',
    )}
  >
    {active && (
      <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-pill bg-sage-500" />
    )}
    <span className={cn('shrink-0', active ? 'text-sage-700' : 'text-ink-500')}>{icon}</span>
    <span className="truncate">{label}</span>
  </button>
);
SidebarTab.propTypes = {
  active: PropTypes.bool,
  icon: PropTypes.node,
  label: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
};

// ─────────────────────────────────────────────────────────
// SettingsPanel
// ─────────────────────────────────────────────────────────

const SettingsPanel = ({
  showSettings,
  setShowSettings,
  mainModelConfig,
  optionModelConfig,
  handleMainConfigChange,
  handleOptionConfigChange,
  mainPrompt,
  optionPrompt,
  handleMainPromptChange,
  handleOptionPromptChange,
  // histories list itself is unused here; we read/write via localStorage
  // and only need setHistories to push merges. Kept in props for back-compat.
  // eslint-disable-next-line no-unused-vars
  histories,
  setHistories,
  handleNewChat,
}) => {
  const { i18n, t } = useTranslation();
  const [settingsTab, setSettingsTab] = useState('general');
  const [language, setLanguage] = useState(() => i18n.language || 'zh');
  const [developerMode, setDeveloperMode] = useState(
    () => localStorage.getItem('developerMode') === 'true',
  );
  const [enableWaitTime, setEnableWaitTime] = useState(
    () => localStorage.getItem('enableWaitTime') !== 'false',
  );
  const [waitTime, setWaitTime] = useState(() => {
    const saved = localStorage.getItem('waitTime');
    return saved ? parseInt(saved, 10) : 5;
  });

  const handleWaitTimeChange = (newTime) => {
    const time = parseInt(newTime, 10);
    if (!isNaN(time) && time >= 0 && time <= 30) {
      setWaitTime(time);
      localStorage.setItem('waitTime', time.toString());
    }
  };

  const handleEnableWaitTimeChange = () => {
    const next = !enableWaitTime;
    setEnableWaitTime(next);
    localStorage.setItem('enableWaitTime', next.toString());
  };

  // ── 监听 developerMode 变化 ──
  useEffect(() => {
    const handleStorageChange = () => {
      const currentValue = localStorage.getItem('developerMode') === 'true';
      if (currentValue !== developerMode) setDeveloperMode(currentValue);
    };
    window.addEventListener('storage', handleStorageChange);
    const interval = setInterval(handleStorageChange, 1000);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [developerMode]);

  // ── ESC 关闭 ──
  useEffect(() => {
    if (!showSettings) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setShowSettings(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showSettings, setShowSettings]);

  // ── 语言切换（保留旧逻辑） ──
  const handleLanguageSelect = (lng) => {
    if (lng === language) return;
    i18n.changeLanguage(lng);
    setLanguage(lng);
    setTimeout(() => {
      try {
        const newOptionPrompt = i18n.t('SystemPrompts.optionAiMode', { lng });
        if (newOptionPrompt && !newOptionPrompt.includes('SystemPrompts.')) {
          localStorage.setItem('option_ai_prompt', newOptionPrompt);
          window.dispatchEvent(
            new CustomEvent('language-changed', {
              detail: { language: lng, prompt: newOptionPrompt },
            }),
          );
          if (
            optionPrompt &&
            (optionPrompt === localStorage.getItem('optionAgentPrompt') ||
              optionPrompt === i18n.t('SystemPrompts.optionAiMode', { lng: language }))
          ) {
            handleOptionPromptChange(newOptionPrompt);
          }
        }
      } catch (error) {
        console.error('SettingsPanel: 更新选项AI提示词时出错:', error);
      }
      alert(i18n.t('SettingsPanel.language.changeSuccess', { lng }));
      setShowSettings(false);
    }, 100);
  };

  const handleSaveSettings = () => {
    localStorage.setItem('enableWaitTime', enableWaitTime.toString());
    localStorage.setItem('waitTime', waitTime.toString());
    alert(t('SettingsPanel.footer.saveSuccess'));
    setShowSettings(false);
  };

  // ── 聊天记录导出 ──
  const handleExport = () => {
    const chatHistories = localStorage.getItem('chat_histories');
    if (!chatHistories) {
      alert('没有可导出的聊天记录');
      return;
    }
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(chatHistories);
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute(
      'download',
      `问知轩聊天记录_${new Date().toISOString().slice(0, 10)}.json`,
    );
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // ── 聊天记录导入 ──
  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        if (!Array.isArray(importedData)) throw new Error('导入的数据格式不正确');
        const existing = localStorage.getItem('chat_histories');
        let merged = [];
        if (existing) {
          const map = new Map();
          JSON.parse(existing).forEach((h) => map.set(h.id, h));
          importedData.forEach((h) => map.set(h.id, h));
          merged = Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
        } else {
          merged = importedData;
        }
        localStorage.setItem('chat_histories', JSON.stringify(merged));
        setHistories(merged);
        alert(`成功导入 ${importedData.length} 条聊天记录`);
        e.target.value = null;
      } catch (error) {
        console.error('导入聊天记录失败:', error);
        alert(`导入失败: ${error.message}`);
      }
    };
    reader.readAsText(file);
  };

  // ── 清空所有聊天记录 ──
  const handleClearAll = () => {
    if (!confirm('确定要清空所有聊天记录吗？此操作不可恢复。')) return;
    const chatHistories = localStorage.getItem('chat_histories');
    if (chatHistories) {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(chatHistories);
      const a = document.createElement('a');
      a.setAttribute('href', dataStr);
      a.setAttribute(
        'download',
        `问知轩聊天记录备份_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`,
      );
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    localStorage.removeItem('chat_histories');
    setHistories([]);
    handleNewChat();
    alert('所有聊天记录已清空，并已自动创建了一个新的对话。');
  };

  if (!showSettings) return null;

  // ── Tab 定义 ──
  const tabs = [
    { id: 'general', label: t('SettingsPanel.tabs.general'), icon: <Icon name="SlidersHorizontal" size={18} /> },
    { id: 'model',   label: t('SettingsPanel.tabs.model'),   icon: <Icon name="Brain" size={18} /> },
    { id: 'prompt',  label: t('SettingsPanel.tabs.prompt'),  icon: <Icon name="ScrollText" size={18} /> },
    { id: 'about',   label: t('SettingsPanel.tabs.about'),   icon: <BrandLogo size={18} /> },
  ];

  return (
    <AnimatePresence>
      {showSettings && (
        <motion.div
          className="fixed inset-0 z-50 flex items-stretch justify-center bg-ink-900/15 backdrop-blur-sm md:items-center md:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={() => setShowSettings(false)}
        >
          <motion.div
            className={cn(
              'flex w-full flex-col overflow-hidden bg-paper-50 shadow-float',
              'h-full max-h-full md:h-[78vh] md:max-h-[78vh] md:max-w-3xl',
              'border border-paper-200 md:rounded-lg',
            )}
            initial={{ scale: 0.96, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex flex-none items-center justify-between border-b border-paper-200 bg-paper-100 px-4 py-3 md:px-5">
              <div className="flex items-center gap-2 md:gap-3">
                <BrandLogo size={24} className="text-sage-700 md:!h-7 md:!w-7" />
                <h2 className="font-display text-h2 text-ink-900 md:text-h1">
                  {t('SettingsPanel.title')}
                </h2>
                {developerMode && (
                  <Tag variant="active">{t('SettingsPanel.developerMode')}</Tag>
                )}
              </div>
              <Button
                intent="ghost"
                size="sm"
                iconOnly
                onClick={() => setShowSettings(false)}
                aria-label="关闭"
              >
                <Icon name="X" size={16} />
              </Button>
            </div>

            {/* Mobile 顶部横向 Tab */}
            <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-paper-200 bg-paper-50/60 px-3 py-2 scrollbar-none md:hidden">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSettingsTab(tab.id)}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 rounded-pill px-3 py-1.5',
                    'text-small font-medium transition-colors duration-fast',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500/30',
                    settingsTab === tab.id
                      ? 'bg-paper-50 text-ink-900 shadow-soft'
                      : 'text-ink-500 hover:bg-paper-100 hover:text-ink-700',
                  )}
                >
                  <span className="shrink-0">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>

            {/* Body: sidebar + content（mobile 仅 content） */}
            <div className="flex min-h-0 flex-1">
              {/* Desktop 左侧 sidebar */}
              <nav className="hidden w-[200px] shrink-0 flex-col gap-1 border-r border-paper-200 bg-paper-50/60 p-3 md:flex">
                {tabs.map((tab) => (
                  <SidebarTab
                    key={tab.id}
                    active={settingsTab === tab.id}
                    icon={tab.icon}
                    label={tab.label}
                    onClick={() => setSettingsTab(tab.id)}
                  />
                ))}
              </nav>

              {/* Content */}
              <div className="flex-1 overflow-y-auto scrollbar-custom">
                <div className="p-4 md:p-5">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={settingsTab}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      {settingsTab === 'general' && (
                        <div className="space-y-4">
                          {/* 语言 */}
                          <SettingsCard
                            icon={<Icon name="Languages" size={16} className="text-sage-700" />}
                            title={t('SettingsPanel.language.label')}
                          >
                            <div className="inline-flex rounded-pill bg-paper-100 p-1">
                              {[
                                { code: 'zh', label: t('SettingsPanel.language.zh') },
                                { code: 'en', label: t('SettingsPanel.language.en') },
                              ].map((opt) => (
                                <button
                                  key={opt.code}
                                  type="button"
                                  onClick={() => handleLanguageSelect(opt.code)}
                                  className={cn(
                                    'rounded-pill px-4 py-1 text-small transition-colors duration-fast',
                                    language === opt.code
                                      ? 'bg-paper-50 text-ink-900 shadow-soft'
                                      : 'text-ink-500 hover:text-ink-700',
                                  )}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </SettingsCard>

                          {/* 答题等待时间 */}
                          <SettingsCard
                            icon={<Icon name="Hourglass" size={16} className="text-sage-700" />}
                            title={t('SettingsPanel.answerCardWaitingTime')}
                          >
                            <div className="space-y-3">
                              <div className="flex items-center justify-between rounded-sm bg-paper-100 p-3">
                                <span className="text-small text-ink-700">
                                  {t('SettingsPanel.enableWaitingTime')}
                                </span>
                                <StyledCheckbox
                                  checked={enableWaitTime}
                                  onChange={handleEnableWaitTimeChange}
                                />
                              </div>

                              <div
                                className={cn(
                                  'rounded-sm bg-paper-100 p-3 transition-opacity duration-base',
                                  !enableWaitTime && 'pointer-events-none opacity-50',
                                )}
                              >
                                <label className="mb-2 block text-small font-medium text-ink-700">
                                  {t('SettingsPanel.answerCardWaitingTime')} ({waitTime}{' '}
                                  {t('SettingsPanel.seconds')})
                                </label>
                                <div className="flex items-center gap-3">
                                  <span className="text-caption font-mono text-ink-500">0</span>
                                  <input
                                    type="range"
                                    min="0"
                                    max="30"
                                    value={waitTime}
                                    onChange={(e) => handleWaitTimeChange(e.target.value)}
                                    className="h-1.5 flex-1 rounded-pill bg-paper-200 accent-sage-500"
                                  />
                                  <span className="text-caption font-mono text-ink-500">30</span>
                                  <input
                                    type="number"
                                    min="0"
                                    max="30"
                                    value={waitTime}
                                    onChange={(e) => handleWaitTimeChange(e.target.value)}
                                    className="h-8 w-12 rounded-sm border border-paper-200 bg-paper-50 px-2 text-center font-mono text-small text-ink-900 caret-sage-500 outline-none focus:border-sage-500 focus:ring-2 focus:ring-sage-500/20"
                                  />
                                </div>
                                <p className="mt-2 text-caption font-serif italic text-ink-500">
                                  {waitTime === 0
                                    ? t('SettingsPanel.currentSettingOff')
                                    : t('SettingsPanel.currentSettingOn', { seconds: waitTime })}
                                </p>
                              </div>
                            </div>
                          </SettingsCard>

                          {/* 聊天记录管理 */}
                          <SettingsCard
                            icon={<Icon name="Archive" size={16} className="text-sage-700" />}
                            title={t('SettingsPanel.chatHistory.title')}
                          >
                            <div className="space-y-3">
                              <Button
                                intent="primary"
                                size="md"
                                onClick={handleExport}
                                className="w-full"
                              >
                                <Icon name="Download" size={16} className="text-current" />
                                {t('SettingsPanel.chatHistory.export')}
                              </Button>

                              <div>
                                <label className="mb-2 block text-small font-medium text-ink-700">
                                  {t('SettingsPanel.chatHistory.importLabel')}
                                </label>
                                <input
                                  type="file"
                                  id="chat-history-import"
                                  accept=".json"
                                  className="hidden"
                                  onChange={handleImport}
                                />
                                <Button
                                  intent="secondary"
                                  size="md"
                                  onClick={() => document.getElementById('chat-history-import').click()}
                                  className="w-full"
                                >
                                  <Icon name="Upload" size={16} className="text-current" />
                                  {t('SettingsPanel.chatHistory.importButton')}
                                </Button>
                                <p className="mt-1.5 text-caption font-serif italic text-ink-500">
                                  {t('SettingsPanel.chatHistory.importTips')}
                                </p>
                              </div>

                              {/* 危险操作 */}
                              <div>
                                <button
                                  type="button"
                                  onClick={handleClearAll}
                                  className={cn(
                                    'inline-flex h-9 w-full items-center justify-center gap-2 rounded-sm px-4',
                                    'border border-state-alert/30 bg-state-alert/10 text-small font-medium text-state-alert',
                                    'transition-colors duration-fast hover:bg-state-alert/15',
                                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-state-alert/30',
                                  )}
                                >
                                  <Icon name="Trash2" size={14} className="text-current" />
                                  {t('SettingsPanel.chatHistory.clearAll')}
                                </button>
                                <p className="mt-1.5 text-caption font-serif italic text-ink-500">
                                  {t('SettingsPanel.chatHistory.clearAllTips')}
                                </p>
                              </div>
                            </div>
                          </SettingsCard>
                        </div>
                      )}

                      {settingsTab === 'model' && (
                        <div className="space-y-4">
                          <ModelConfigPanel
                            currentConfig={mainModelConfig}
                            onConfigChange={handleMainConfigChange}
                            agentType="main"
                            developerMode={developerMode}
                          />
                          <ModelConfigPanel
                            currentConfig={optionModelConfig}
                            onConfigChange={handleOptionConfigChange}
                            agentType="option"
                            developerMode={developerMode}
                          />
                        </div>
                      )}

                      {settingsTab === 'prompt' && (
                        <div className="space-y-4">
                          <AgentConfigPanel
                            currentPrompt={mainPrompt}
                            onPromptChange={handleMainPromptChange}
                            agentType="main"
                          />
                          <AgentConfigPanel
                            currentPrompt={optionPrompt}
                            onPromptChange={handleOptionPromptChange}
                            agentType="option"
                          />
                        </div>
                      )}

                      {settingsTab === 'about' && (
                        <SettingsCard
                          icon={<Screwdriver size={16} className="text-sage-700" />}
                          title={t('SettingsPanel.about.title')}
                        >
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-body text-ink-700">
                              <Icon name="Mail" size={16} className="shrink-0" />
                              <span>{t('SettingsPanel.about.email')}</span>
                              <a
                                href="mailto:2413250743@qq.com"
                                className="text-sage-700 transition-colors duration-fast hover:text-sage-900 hover:underline"
                              >
                                2413250743@qq.com
                              </a>
                            </div>
                            <div className="flex items-center gap-2 text-body text-ink-700">
                              <Icon name="Github" size={16} className="shrink-0" />
                              <span>{t('SettingsPanel.about.github')}</span>
                              <a
                                href="https://github.com/TownBoats"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sage-700 transition-colors duration-fast hover:text-sage-900 hover:underline"
                              >
                                TownBoats
                              </a>
                            </div>
                          </div>
                        </SettingsCard>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex flex-none justify-end gap-2 border-t border-paper-200 bg-paper-50 px-4 py-3 md:px-5">
              <Button intent="secondary" size="md" onClick={() => setShowSettings(false)} className="flex-1 md:flex-none">
                {t('SettingsPanel.footer.cancel')}
              </Button>
              <Button intent="primary" size="md" onClick={handleSaveSettings} className="flex-1 md:flex-none">
                {t('SettingsPanel.footer.confirm')}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

SettingsPanel.propTypes = {
  showSettings: PropTypes.bool,
  setShowSettings: PropTypes.func.isRequired,
  mainModelConfig: PropTypes.object,
  optionModelConfig: PropTypes.object,
  handleMainConfigChange: PropTypes.func,
  handleOptionConfigChange: PropTypes.func,
  mainPrompt: PropTypes.string,
  optionPrompt: PropTypes.string,
  handleMainPromptChange: PropTypes.func,
  handleOptionPromptChange: PropTypes.func,
  histories: PropTypes.array,
  setHistories: PropTypes.func,
  handleNewChat: PropTypes.func,
};

export default SettingsPanel;
