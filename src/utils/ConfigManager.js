// 预设已移除，保留纯自定义配置
import { SYSTEM_PROMPTS } from "../services/prompts";

// 配置管理器
class ConfigManager {
  // 默认配置（BYOK + 无预设）
  static DEFAULT_MAIN_CONFIG = {
    baseURL: 'https://open.bigmodel.cn',
    customEndpoint: '/api/paas/v4/chat/completions',
    settings: { model: 'gpt-4o-mini' }
  };
  static DEFAULT_OPTION_CONFIG = {
    baseURL: 'https://open.bigmodel.cn',
    customEndpoint: '/api/paas/v4/chat/completions',
    settings: { model: 'gpt-4o-mini' }
  };
  
  // 获取主模型配置
  static getMainModelConfig() {
    try {
      // 从localStorage中获取保存的配置
      const savedConfig = localStorage.getItem('mainAgentConfig');
      if (savedConfig) {
        // 解析保存的配置
        const parsed = JSON.parse(savedConfig);
        // 返回配置，如果localStorage中没有保存的配置，则使用默认配置
        return {
          baseURL: parsed.baseURL || this.DEFAULT_MAIN_CONFIG.baseURL,
          customEndpoint: parsed.customEndpoint || this.DEFAULT_MAIN_CONFIG.customEndpoint,
          apiKey: parsed.apiKey || '',
          model: parsed.model || this.DEFAULT_MAIN_CONFIG.settings.model,
          useCustomURL: parsed.useCustomURL || false,
          fullURL: parsed.fullURL || ''
        };
      }
    } catch (error) {
      // 如果加载配置失败，则输出警告信息
      console.warn('加载主模型配置失败:', error);
    }
    
    // 使用默认配置
    return {
      baseURL: this.DEFAULT_MAIN_CONFIG.baseURL,
      customEndpoint: this.DEFAULT_MAIN_CONFIG.customEndpoint,
      apiKey: '',
      model: this.DEFAULT_MAIN_CONFIG.settings.model,
      useCustomURL: false,
      fullURL: ''
    };
  }
  
  // 获取选项模型配置
  static getOptionModelConfig() {
    try {
      const savedConfig = localStorage.getItem('optionAgentConfig');
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        return {
          baseURL: parsed.baseURL || this.DEFAULT_OPTION_CONFIG.baseURL,
          customEndpoint: parsed.customEndpoint || this.DEFAULT_OPTION_CONFIG.customEndpoint,
          apiKey: parsed.apiKey || '',
          model: parsed.model || this.DEFAULT_OPTION_CONFIG.settings.model,
          useCustomURL: parsed.useCustomURL || false,
          fullURL: parsed.fullURL || ''
        };
      }
    } catch (error) {
      console.warn('加载选项模型配置失败:', error);
    }
    
    // 使用默认配置
    return {
      baseURL: this.DEFAULT_OPTION_CONFIG.baseURL,
      customEndpoint: this.DEFAULT_OPTION_CONFIG.customEndpoint,
      apiKey: '',
      model: this.DEFAULT_OPTION_CONFIG.settings.model,
      useCustomURL: false,
      fullURL: ''
    };
  }
  
  // 保存主模型配置
  static saveMainModelConfig(config) {
    try {
      localStorage.setItem('mainAgentConfig', JSON.stringify(config));
      return true;
    } catch (error) {
      console.error('保存主模型配置失败:', error);
      return false;
    }
  }
  
  // 保存选项模型配置
  static saveOptionModelConfig(config) {
    try {
      localStorage.setItem('optionAgentConfig', JSON.stringify(config));
      return true;
    } catch (error) {
      console.error('保存选项模型配置失败:', error);
      return false;
    }
  }
  
  // 获取主模型提示词
  static getMainPrompt() {
    try {
      return localStorage.getItem('mainAgentPrompt') || SYSTEM_PROMPTS.LEARNING_MODE;
    } catch (error) {
      return SYSTEM_PROMPTS.TEST_MODE;
    }
  }
  
  // 获取选项模型提示词
  static getOptionPrompt() {
    try {
      // 首先尝试从localStorage获取用户设置的提示词
      const userSetPrompt = localStorage.getItem('optionAgentPrompt');
      if (userSetPrompt) {
        return userSetPrompt;
      }
      
      // 其次尝试获取当前语言的翻译提示词
      const translatedPrompt = localStorage.getItem('option_ai_prompt');
      if (translatedPrompt) {
        return translatedPrompt;
      }
      
      // 最后使用默认提示词
      return SYSTEM_PROMPTS.OPTION_AI_MODE;
    } catch (error) {
      return SYSTEM_PROMPTS.OPTION_AI_MODE;
    }
  }
  
  // 保存主模型提示词
  static saveMainPrompt(prompt) {
    try {
      localStorage.setItem('mainAgentPrompt', prompt);
      return true;
    } catch (error) {
      console.error('保存主模型提示词失败:', error);
      return false;
    }
  }
  
  // 保存选项模型提示词
  static saveOptionPrompt(prompt) {
    try {
      localStorage.setItem('optionAgentPrompt', prompt);
      return true;
    } catch (error) {
      console.error('保存选项模型提示词失败:', error);
      return false;
    }
  }
  
  // 构建端点URL
  static buildEndpointUrl(config) {
    if (config.useCustomURL) {
      return config.fullURL || '';
    }

    const base = (config.baseURL || '').trim();
    const endpoint = (config.customEndpoint || '').trim();

    // 若 base 是绝对地址 (http/https)，直接按 URL 规则拼接
    const isAbsolute = /^https?:\/\//i.test(base);

    const normalizedBase = base
      ? isAbsolute
        ? base.replace(/\/?$/, '')
        : `/${base.replace(/^\/+|\/+$/g, '')}`
      : '';

    const normalizedEndpoint = endpoint
      ? `/${endpoint.replace(/^\/+/, '')}`
      : '';

    // 允许只用 endpoint（例如用户在 full URL 模式外填了完整路径）
    if (!normalizedBase) return normalizedEndpoint;
    return normalizedBase + normalizedEndpoint;
  }
}

export default ConfigManager; 