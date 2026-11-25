import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import ModelConfigPanel from '../../components/ModelConfigPanel/ModelConfigPanel';
import SettingsSection from '../../components/SettingsPanel/SettingsSection';
import AnswerWaitSettings from '../../components/SettingsPanel/AnswerWaitSettings';
import { Button, Icon, BrandLogo, Input } from '@/components/ui';
import { normalizeContextWindow } from '../../utils/contextWindow.js';
import DataBackupSection from './DataBackupSection';

/**
 * ConfigPanel：设置面板（数据备份、主模型、候选答案模型、答题等待、作者信息）。
 *
 * 不提供主提示词编辑：教学指令由 `src/agent/skills/*.md` 固定。
 * 只读取配置并回传变更，由页面落盘；不写会话状态、不调用运行层。
 */
function ConfigPanel({ open, onClose, mainConfig, optionConfig, onMainConfigChange, onOptionConfigChange,
  transferDisabled, beforeTransfer, onDataImported }) {
  const { t } = useTranslation();
  const [dataRevision, setDataRevision] = useState(0);

  // ESC 关闭：与旧面板一致
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-stretch justify-center bg-ink-900/15 backdrop-blur-sm md:items-center md:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          role="presentation"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t('AgentChat.config.title')}
            initial={{ opacity: 0, y: 8, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.99 }}
            transition={{ duration: 0.18 }}
            className="flex h-full w-full flex-col overflow-hidden bg-paper-100 shadow-lift md:h-auto md:max-h-[85vh] md:max-w-3xl md:rounded-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b border-paper-200 bg-paper-50 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <BrandLogo size={20} />
                <h2 className="truncate text-h2 font-semibold text-ink-900">
                  {t('AgentChat.config.title')}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t('AgentChat.config.closeLabel')}
                className="shrink-0 rounded-sm p-1.5 text-ink-500 transition-colors duration-fast hover:bg-paper-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500/20"
              >
                <Icon name="X" size={16} />
              </button>
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <p className="text-small leading-relaxed text-ink-500">
                {t('AgentChat.config.description')}
              </p>

              <DataBackupSection disabled={transferDisabled} beforeTransfer={beforeTransfer}
                onImported={() => { onDataImported(); setDataRevision((value) => value + 1); }} />

              <ModelConfigPanel
                key={`main-${dataRevision}`}
                currentConfig={mainConfig}
                onConfigChange={onMainConfigChange}
                agentType="main"
              />

              <ModelConfigPanel
                key={`option-${dataRevision}`}
                currentConfig={optionConfig}
                onConfigChange={onOptionConfigChange}
                agentType="option"
              />

              <SettingsSection title={t('AgentChat.context.settingsTitle')} icon={<Icon name="Gauge" size={16} className="text-sage-700" />}>
                <label htmlFor="main-context-window" className="mb-1 block text-small font-medium text-ink-700">
                  {t('AgentChat.context.settingsLabel')}
                </label>
                <Input id="main-context-window" type="number" min="1" step="1" inputMode="numeric"
                  value={mainConfig?.contextWindow ?? ''} placeholder={t('AgentChat.context.settingsPlaceholder')}
                  aria-describedby="main-context-window-hint"
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === '' || normalizeContextWindow(value)) onMainConfigChange({ contextWindow: normalizeContextWindow(value) });
                  }} />
                <p id="main-context-window-hint" className="mt-2 text-caption leading-relaxed text-ink-500">{t('AgentChat.context.settingsHint')}</p>
              </SettingsSection>

              <AnswerWaitSettings key={dataRevision} />

              <SettingsSection
                icon={<Icon name="Mail" size={16} className="text-sage-700" />}
                title={t('AgentChat.config.profileTitle')}
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-body text-ink-700">
                    <Icon name="Mail" size={16} className="shrink-0" />
                    <span>{t('AgentChat.config.profileEmail')}</span>
                    <a
                      href="mailto:2413250743@qq.com"
                      className="text-sage-700 transition-colors duration-fast hover:text-sage-900 hover:underline"
                    >
                      2413250743@qq.com
                    </a>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-body text-ink-700">
                    <Icon name="Github" size={16} className="shrink-0" />
                    <span>{t('AgentChat.config.profileGithub')}</span>
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
              </SettingsSection>
            </div>

            <footer className="flex justify-end border-t border-paper-200 bg-paper-50 px-4 py-3">
              <Button intent="primary" size="md" onClick={onClose}>
                {t('AgentChat.config.done')}
              </Button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

ConfigPanel.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  mainConfig: PropTypes.object,
  optionConfig: PropTypes.object,
  onMainConfigChange: PropTypes.func.isRequired,
  onOptionConfigChange: PropTypes.func.isRequired,
  transferDisabled: PropTypes.bool.isRequired,
  beforeTransfer: PropTypes.func.isRequired,
  onDataImported: PropTypes.func.isRequired,
};

export default ConfigPanel;
