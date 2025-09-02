import React, { useState } from 'react';
// 预设已移除，使用纯自定义模式
import { useTranslation } from 'react-i18next';

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
    </div>
  );
};

export default ModelConfigPanel; 