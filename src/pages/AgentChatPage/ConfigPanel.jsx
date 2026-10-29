import { useEffect } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import ModelConfigPanel from '../../components/ModelConfigPanel/ModelConfigPanel';
import SettingsSection from '../../components/SettingsPanel/SettingsSection';
import AnswerWaitSettings from '../../components/SettingsPanel/AnswerWaitSettings';
import { Button, Icon, BrandLogo } from '@/components/ui';

/**
 * ConfigPanel — 新路径的配置面板（模态）
 *
 * 为什么新写而不是复用旧 `components/SettingsPanel/SettingsPanel.jsx`：
 *   旧面板是四 Tab（通用 / 模型 / 提示词 / 数据）600 行组件，强依赖旧路径的
 *   `histories`、`handleNewChat`、`mainPrompt` 等状态，搬进新页面要造一堆等价数据。
 *   新路径包含答题偏好和模型配置：
 *     ① 主模型（复用 ModelConfigPanel，与旧面板同一套行为：BYOK、测试连接、URL 调试）
 *     ② 候选答案模型（同上，留空即降级为手动作答）
 *     ③ 答题等待时间（沿用旧版 localStorage 偏好）
 *     ④ 我的个人信息（作者邮箱 / GitHub，来自原「关于」Tab）
 *
 * 不提供的项（有意为之）：
 *   - 主提示词编辑：新架构由 `src/agent/skills/*.md` 按教学模式固定，改了也不生效（D6 迁移提示已说明）
 *   - 历史导入导出：新路径已有历史抽屉与 `chat_histories_v2`，导入旧格式会破坏 schema 约定
 *
 * 边界：本组件只做「读当前配置 → 交给 ModelConfigPanel → 把变更回传页面」，
 * 不直接写会话状态、不调用运行层。保存落盘由页面统一处理（ConfigManager）。
 */
function ConfigPanel({ open, onClose, mainConfig, optionConfig, onMainConfigChange, onOptionConfigChange }) {
  const { t } = useTranslation();

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

              <ModelConfigPanel
                currentConfig={mainConfig}
                onConfigChange={onMainConfigChange}
                agentType="main"
              />

              <ModelConfigPanel
                currentConfig={optionConfig}
                onConfigChange={onOptionConfigChange}
                agentType="option"
              />

              <AnswerWaitSettings />

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
};

export default ConfigPanel;
