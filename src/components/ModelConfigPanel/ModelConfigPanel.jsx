import { useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import ConfigManager from '../../utils/ConfigManager';
import {
  Button,
  Input,
  Icon,
  Tag,
  cn,
} from '@/components/ui';

/**
 * ModelConfigPanel — BYOK 模型配置面板（设计 token 重写版）
 *
 * 视觉迁移自旧版：
 *   - bg-white + gray-200 卡片              → bg-paper-50 + paper-200 + shadow-soft
 *   - 内部分组小标题 gray-500 SPSEMI         → text-caption font-mono text-ink-500
 *   - 旧 input：gray-300 + blue-500 focus    → ui/Input atom (sage 聚焦环)
 *   - 旧 button：blue-600 / gray-800        → ui/Button(primary/secondary)
 *   - 测试结果 green-50 / red-50 双色块     → state-good/15 + state-alert/10 +
 *                                               Icon Check / AlertCircle
 *   - 弱分隔线 gray-100                      → border-paper-200
 *   - 开发者 URL 调试区 violet-600 + gray-500 → font-mono ink-500（保留 sage 强调）
 *
 * 行为完全保留：handleChange / handleURLModeChange / buildRequestURL /
 * buildEffectiveUrl / handleLoadDefault / handleTestConnection 全部一致。
 */
const ModelConfigPanel = ({
  currentConfig,
  onConfigChange,
  agentType = 'main',
  developerMode = false,
}) => {
  const { t } = useTranslation();
  const [useCustomURL, setUseCustomURL] = useState(currentConfig?.useCustomURL || false);
  const [config, setConfig] = useState({
    baseURL: currentConfig?.baseURL || '',
    customEndpoint: currentConfig?.customEndpoint || '',
    apiKey: currentConfig?.apiKey || '',
    model: currentConfig?.model || '',
    fullURL: currentConfig?.fullURL || '',
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const newConfig = { ...config, [name]: value };
    setConfig(newConfig);
    onConfigChange({ ...newConfig, useCustomURL });
  };

  const handleURLModeChange = (e) => {
    const newUseCustomURL = e.target.checked;
    setUseCustomURL(newUseCustomURL);
    onConfigChange({ ...config, useCustomURL: newUseCustomURL });
  };

  const buildRequestURL = (cfg) => {
    const url = ConfigManager.buildEndpointUrl(cfg);
    if (!url) return '';
    if (url.startsWith('http')) return url;
    if (url.startsWith('/')) return `${window.location.origin}${url}`;
    return `${window.location.origin}/${url}`;
  };

  const buildEffectiveUrl = (cfg) => {
    const full = buildRequestURL(cfg);
    if (!full) return '';
    const base = full.replace(/\/chat\/completions(\?.*)?$/, '');
    return `${base}/chat/completions`;
  };

  const handleLoadDefault = () => {
    const defaultConfig = {
      baseURL: 'https://open.bigmodel.cn',
      customEndpoint: '/api/paas/v4/chat/completions',
      apiKey: '',
      model: 'glm-4.5',
      fullURL: '',
      useCustomURL: false,
    };
    setConfig(defaultConfig);
    onConfigChange(defaultConfig);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const endpoint = buildRequestURL({ ...config, useCustomURL });
      if (!endpoint || !config.model) {
        setTestResult({ ok: false, message: t('ModelConfigPanel.invalidConfig') });
        setTesting(false);
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const headers = { 'Content-Type': 'application/json' };
      if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers,
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: 'hi' }],
          stream: true,
          max_tokens: 5,
          temperature: 0,
          top_p: 1,
          frequency_penalty: 0,
          presence_penalty: 0,
        }),
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        let errText = '';
        try {
          errText = await res.text();
        } catch {
          /* noop */
        }
        let errDetail = errText.slice(0, 400);
        try {
          const parsed = JSON.parse(errText);
          const msg = parsed?.error?.message || parsed?.message;
          if (msg) errDetail = msg;
        } catch {
          /* noop */
        }
        setTestResult({
          ok: false,
          statusCode: res.status,
          message: `HTTP ${res.status} ${res.statusText}`,
          detail: errDetail,
        });
        return;
      }

      const reader = res.body.getReader();
      try {
        const { value } = await reader.read();
        const preview = value ? new TextDecoder().decode(value).slice(0, 80) : '';
        setTestResult({ ok: true, message: t('ModelConfigPanel.testSuccess'), detail: preview });
      } finally {
        reader.cancel();
      }
    } catch (e) {
      setTestResult({
        ok: false,
        message: e.name === 'AbortError' ? '连接超时 (15s)' : e.message,
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="rounded-md border border-paper-200 bg-paper-50 p-4 shadow-soft md:p-5">
      <h3 className="mb-3 flex items-center gap-2 text-h2 font-serif text-ink-900 md:mb-4">
        {agentType === 'main' ? t('ModelConfigPanel.mainModel') : t('ModelConfigPanel.optionModel')}
        {developerMode && (
          <Tag variant="active">{t('SettingsPanel.developerMode')}</Tag>
        )}
      </h3>

      <div className="mb-4 rounded-sm border border-paper-200 bg-paper-100 px-3 py-2 text-small font-serif italic text-ink-700">
        {agentType === 'main'
          ? t('ModelConfigPanel.mainModelTip')
          : t('ModelConfigPanel.optionModelTip')}
      </div>

      <p className="mb-2 text-caption font-mono uppercase tracking-wide text-ink-500">
        连接设置
      </p>

      <div className="grid grid-cols-12 gap-x-4 gap-y-3 md:gap-y-4">
        <div className="col-span-12">
          <label className="inline-flex cursor-pointer select-none items-center gap-2 text-ink-700">
            <input
              type="checkbox"
              checked={useCustomURL}
              onChange={handleURLModeChange}
              className="form-checkbox h-4 w-4 rounded-sm accent-sage-500 transition-colors"
            />
            <span className="text-small font-medium">
              {t('ModelConfigPanel.useCustomFullURL')}
            </span>
          </label>
        </div>

        {useCustomURL ? (
          <div className="col-span-12 transition-all duration-base ease-soft">
            <label className="mb-1 block text-small font-medium text-ink-700">
              {t('ModelConfigPanel.fullURLLabel')}
            </label>
            <Input
              type="text"
              name="fullURL"
              value={config.fullURL}
              onChange={handleChange}
              placeholder="https://open.bigmodel.cn/api/paas/v4/chat/completions"
              className="font-mono"
            />
          </div>
        ) : (
          <>
            <div className="col-span-12 md:col-span-6">
              <label className="mb-1 block text-small font-medium text-ink-700">
                {t('ModelConfigPanel.baseURLLabel')}
              </label>
              <Input
                type="text"
                name="baseURL"
                value={config.baseURL}
                onChange={handleChange}
                placeholder="https://open.bigmodel.cn"
                className="font-mono"
              />
            </div>

            <div className="col-span-12 md:col-span-6">
              <label className="mb-1 block text-small font-medium text-ink-700">
                {t('ModelConfigPanel.endpointLabel')}
              </label>
              <Input
                type="text"
                name="customEndpoint"
                value={config.customEndpoint}
                onChange={handleChange}
                placeholder="/api/paas/v4/chat/completions"
                className="font-mono"
              />
            </div>
          </>
        )}

        <div className="col-span-12">
          <div className="border-t border-paper-200" />
        </div>

        <div className="col-span-12 -mt-1">
          <p className="text-caption font-mono uppercase tracking-wide text-ink-500">
            认证与模型
          </p>
        </div>

        <div className="col-span-12 md:col-span-6">
          <label className="mb-1 block text-small font-medium text-ink-700">
            {t('ModelConfigPanel.apiKeyLabel')}
          </label>
          <Input
            type="password"
            name="apiKey"
            value={config.apiKey}
            onChange={handleChange}
            placeholder="把 API Key 给我看一眼"
            autoComplete="off"
            className="font-mono"
          />
        </div>

        <div className="col-span-12 md:col-span-6">
          <label className="mb-1 block text-small font-medium text-ink-700">
            {t('ModelConfigPanel.modelLabel')}
          </label>
          <Input
            type="text"
            name="model"
            value={config.model}
            onChange={handleChange}
            placeholder="输入模型名称"
            className="font-mono"
          />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button intent="primary" size="md" onClick={handleLoadDefault}>
          {t('ModelConfigPanel.loadDefault')}
        </Button>
        <Button intent="secondary" size="md" onClick={handleTestConnection} disabled={testing}>
          {testing ? (
            <>
              <Icon name="Loader2" size={14} className="text-current animate-spin" />
              {t('ModelConfigPanel.testing')}
            </>
          ) : (
            <>
              <Icon name="Wifi" size={14} className="text-current" />
              {t('ModelConfigPanel.testConnection')}
            </>
          )}
        </Button>
      </div>

      {testResult && (
        <div
          className={cn(
            'mt-3 rounded-sm border p-3 text-small',
            testResult.ok
              ? 'border-state-good/30 bg-state-good/10 text-sage-700'
              : 'border-state-alert/30 bg-state-alert/10 text-state-alert',
          )}
        >
          <div className="flex items-center gap-2 font-medium">
            <Icon
              name={testResult.ok ? 'Check' : 'X'}
              size={16}
              className="text-current shrink-0"
            />
            {testResult.statusCode && (
              <span
                className={cn(
                  'rounded-xs px-1.5 py-0.5 font-mono font-bold',
                  testResult.ok ? 'bg-state-good/20' : 'bg-state-alert/20',
                )}
              >
                {testResult.statusCode}
              </span>
            )}
            <span>{testResult.message}</span>
          </div>
          {testResult.detail && (
            <pre
              className={cn(
                'mt-2 whitespace-pre-wrap break-all rounded-xs p-2 text-caption font-mono',
                testResult.ok
                  ? 'bg-state-good/10 text-sage-700'
                  : 'bg-state-alert/10 text-state-alert',
              )}
            >
              {testResult.ok ? `首个响应数据: ${testResult.detail}` : testResult.detail}
            </pre>
          )}
          {!testResult.ok && (
            <p className="mt-1.5 text-caption font-serif italic opacity-80">
              测试使用 stream: true 与实际对话相同，404 通常表示模型名称无效。
            </p>
          )}
        </div>
      )}

      {developerMode && (
        <div className="mt-2 space-y-1 break-all text-caption font-mono text-ink-500">
          <div>配置 URL: {buildRequestURL({ ...config, useCustomURL })}</div>
          <div className="text-sage-700">
            实际 URL (AI SDK): {buildEffectiveUrl({ ...config, useCustomURL })}
          </div>
        </div>
      )}
    </div>
  );
};

ModelConfigPanel.propTypes = {
  currentConfig: PropTypes.shape({
    baseURL: PropTypes.string,
    customEndpoint: PropTypes.string,
    apiKey: PropTypes.string,
    model: PropTypes.string,
    fullURL: PropTypes.string,
    useCustomURL: PropTypes.bool,
  }),
  onConfigChange: PropTypes.func.isRequired,
  agentType: PropTypes.oneOf(['main', 'option']),
  developerMode: PropTypes.bool,
};

export default ModelConfigPanel;
