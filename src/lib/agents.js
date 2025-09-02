import { AgentModel } from "./AgentModel";
import { SYSTEM_PROMPTS } from "../services/prompts";
import ConfigManager from "../utils/ConfigManager";

// 创建主AI实例
export const createMainAgent = (callbacks = {}, customConfig = null) => {
  // 使用传入的配置或从ConfigManager获取配置
  const config = customConfig || ConfigManager.getMainModelConfig();
  const prompt = customConfig?.prompt || ConfigManager.getMainPrompt();
  
  // 构建端点URL
  const endpoint = ConfigManager.buildEndpointUrl(config);
  
  const instance = new AgentModel({
    customEndpoint: endpoint,
    apiKey: config.apiKey,
    settings: {
      model: config.model,
      system_message: prompt
    },
    onRequestStart: () => {
      // console.log('主AI开始发送请求');
      callbacks.onRequestStart?.();
    },
    onResponseStart: () => {
      // console.log('主AI开始回答');
      callbacks.onResponseStart?.();
    },
    onResponseEnd: () => {
      // console.log('主AI回答完毕');
      callbacks.onResponseEnd?.();
    }
  });
  
  instance.updateSettings({
    temperature: 0.3
  });
  
  return instance;
};

// 创建选项AI实例
export const createOptionAgent = (callbacks = {}, customConfig = null) => {
  // 使用传入的配置或从ConfigManager获取配置
  const config = customConfig || ConfigManager.getOptionModelConfig();
  const prompt = customConfig?.prompt || ConfigManager.getOptionPrompt();
  
  // 构建端点URL
  const endpoint = ConfigManager.buildEndpointUrl(config);
  
  const instance = new AgentModel({
    customEndpoint: endpoint,
    apiKey: config.apiKey,
    settings: {
      model: config.model,
      system_message: prompt
    },
    onRequestStart: () => {
      // console.log('选项AI开始发送请求');
      callbacks.onRequestStart?.();
    },
    onResponseStart: () => {
      // console.log('选项AI开始回答');
      callbacks.onResponseStart?.();
    },
    onResponseEnd: () => {
      // console.log('选项AI回答完毕');
      callbacks.onResponseEnd?.();
    }
  });
  
  instance.updateSettings({
    temperature: 1
  });
  
  return instance;
}; 