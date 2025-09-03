import React, { useState } from 'react';
// 预设已移除，使用纯自定义模式
import { useTranslation } from 'react-i18next';
import ConfigManager from '../../utils/ConfigManager';

// 预设相关 UI 已移除

const ModelConfigPanel = ({ 
  currentConfig,
  onConfigChange,
  agentType = 'main',
  developerMode = false
}) => {
  const { t } = useTranslation();
  const [useCustomURL, setUseCustomURL] = useState(currentConfig?.useCustomURL || false);
  const [config, setConfig] = useState({
    baseURL: currentConfig?.baseURL || '',
    customEndpoint: currentConfig?.customEndpoint || '',
    apiKey: currentConfig?.apiKey || '',
    model: currentConfig?.model || '',
    fullURL: currentConfig?.fullURL || ''
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const newConfig = {
      ...config,
      [name]: value
    };
    setConfig(newConfig);
    onConfigChange({...newConfig, useCustomURL});
  };

  // 预设选择逻辑已移除

  // 处理 URL 模式切换
  const handleURLModeChange = (e) => {
    const newUseCustomURL = e.target.checked;
    setUseCustomURL(newUseCustomURL);
    onConfigChange({...config, useCustomURL: newUseCustomURL});
  };

  // 预设显示名逻辑已移除

  // 预设列表已移除

  // 构建请求 URL（与 AgentModel 保持一致）
  const buildRequestURL = (cfg) => {
    const url = ConfigManager.buildEndpointUrl(cfg);
    if (!url) return '';
    if (url.startsWith('http')) return url;
    if (url.startsWith('/')) return `${window.location.origin}${url}`;
    return `${window.location.origin}/${url}`;
  };

  const handleLoadDefault = () => {
    const defaultConfig = {
      baseURL: 'https://open.bigmodel.cn',
      customEndpoint: '/api/paas/v4/chat/completions',
      apiKey: 'b8e17bace7ca4c1e94986a712927aae5.myggdGFghhXCq2Jp',
      model: 'glm-4.5',
      fullURL: '',
      useCustomURL: false
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
      const headers = {
        'Content-Type': 'application/json',
      };
      if (config.apiKey) {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers,
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'user', content: 'ping' }
          ],
          stream: false,
          max_tokens: 1,
          temperature: 0
        })
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        setTestResult({ ok: true, message: t('ModelConfigPanel.testSuccess') });
      } else {
        let errText = '';
        try { errText = await res.text(); } catch {}
        setTestResult({ ok: false, message: `${t('ModelConfigPanel.testFailed')} ${res.status} ${res.statusText}${errText ? ' - ' + errText.slice(0, 200) : ''}` });
      }
    } catch (e) {
      setTestResult({ ok: false, message: `${t('ModelConfigPanel.testFailed')} ${e.message}` });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="p-4 md:p-5 rounded-xl shadow-sm bg-white border border-gray-200">
      <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4 text-gray-800 tracking-tight">
        {agentType === 'main' ? t('ModelConfigPanel.mainModel') : t('ModelConfigPanel.optionModel')}
        {developerMode && <span className="ml-2 text-xs text-blue-500 opacity-70">{t('SettingsPanel.developerMode')}</span>}
      </h3>
      
      
      {/* 添加模型推荐提示 */}
      <div className="mb-3 md:mb-4 text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
        {agentType === 'main' 
          ? <p>{t('ModelConfigPanel.mainModelTip')}</p>
          : <p>{t('ModelConfigPanel.optionModelTip')}</p>
        }
      </div>
      
      {/* 分组标题：连接设置 */}
      <div className="mb-2 md:mb-3">
        <div className="text-[11px] md:text-xs font-semibold tracking-wide text-gray-500">连接设置</div>
      </div>

      {/* 表单区域：12 栅格 + 基线节奏 */}
      <div className="grid grid-cols-12 gap-x-4 gap-y-3 md:gap-y-4">
        {/* URL 模式选择 - 所有模式下都显示 */}
        <div className="col-span-12">
          <label className="inline-flex items-center gap-2 text-gray-700 select-none">
            <input
              type="checkbox"
              checked={useCustomURL}
              onChange={handleURLModeChange}
              className="form-checkbox h-4 w-4 accent-black transition-colors"
            />
            <span className="text-sm font-medium">{t('ModelConfigPanel.useCustomFullURL')}</span>
          </label>
        </div>

        {/* 根据模式显示不同的输入框 */}
        {useCustomURL ? (
          <div className="col-span-12 transition-all duration-200 ease-out">
            <label className="block text-[13px] font-medium mb-1 text-gray-700">
              {t('ModelConfigPanel.fullURLLabel')}
            </label>
            <input
              type="text"
              name="fullURL"
              value={config.fullURL}
              onChange={handleChange}
              placeholder="https://open.bigmodel.cn/api/paas/v4/chat/completions"
              className="w-full h-10 px-3 rounded-lg border bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-shadow"
            />
          </div>
        ) : (
          <>
            {/* 预设选择已移除 */}

            {/* 所有模式下都显示高级配置 */}
            <div className="col-span-12 md:col-span-6">
              <label className="block text-[13px] font-medium mb-1 text-gray-700">
                {t('ModelConfigPanel.baseURLLabel')}
              </label>
              <input
                type="text"
                name="baseURL"
                value={config.baseURL}
                onChange={handleChange}
                placeholder="https://open.bigmodel.cn"
                className="w-full h-10 px-3 rounded-lg border bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-shadow"
              />
            </div>

            <div className="col-span-12 md:col-span-6">
              <label className="block text-[13px] font-medium mb-1 text-gray-700">
                {t('ModelConfigPanel.endpointLabel')}
              </label>
              <input
                type="text"
                name="customEndpoint"
                value={config.customEndpoint}
                onChange={handleChange}
                placeholder="/api/paas/v4/chat/completions"
                className="w-full h-10 px-3 rounded-lg border bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-shadow"
              />
            </div>
          </>
        )}

        {/* 分隔线（弱分隔） */}
        <div className="col-span-12">
          <div className="border-t border-gray-100" />
        </div>

        {/* 分组标题：认证与模型 */}
        <div className="col-span-12 -mt-1">
          <div className="text-[11px] md:text-xs font-semibold tracking-wide text-gray-500">认证与模型</div>
        </div>

        {/* API 密钥 */}
        <div className="col-span-12 md:col-span-6">
          <label className="block text-[13px] font-medium mb-1 text-gray-700">
            {t('ModelConfigPanel.apiKeyLabel')}
          </label>
          <input
            type="password"
            name="apiKey"
            value={config.apiKey}
            onChange={handleChange}
            placeholder="输入 API 密钥"
            autoComplete="off"
            className="w-full h-10 px-3 rounded-lg border bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-shadow"
          />
        </div>

        {/* 模型名称 - 所有模式下都可编辑 */}
        <div className="col-span-12 md:col-span-6">
          <label className="block text-[13px] font-medium mb-1 text-gray-700">
            {t('ModelConfigPanel.modelLabel')}
          </label>
          <input
            type="text"
            name="model"
            value={config.model}
            onChange={handleChange}
            placeholder="输入模型名称"
            className="w-full h-10 px-3 rounded-lg border bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-shadow"
          />
        </div>
      </div>

      {/* 按钮区域 */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            onClick={handleLoadDefault}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md active:shadow-inner"
          >
            {t('ModelConfigPanel.loadDefault')}
          </button>
          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all bg-gray-800 hover:bg-gray-900 text-white disabled:opacity-60 disabled:cursor-not-allowed shadow-sm hover:shadow-md active:shadow-inner"
          >
            {testing ? t('ModelConfigPanel.testing') : t('ModelConfigPanel.testConnection')}
          </button>
        </div>
        <div className="text-xs">
          {testResult && (
            <span className={testResult.ok ? 'text-green-600' : 'text-red-600'}>
              {testResult.message}
            </span>
          )}
        </div>
      </div>
      {developerMode && (
        <div className="mt-2 text-[11px] text-gray-500 break-all">
          Endpoint: {buildRequestURL({ ...config, useCustomURL })}
        </div>
      )}
    </div>
  );
};

export default ModelConfigPanel;