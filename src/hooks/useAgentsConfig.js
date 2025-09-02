import { useEffect, useMemo, useState } from "react";
import ConfigManager from "../utils/ConfigManager";
import { createMainAgent, createOptionAgent } from "../lib/agents";

export default function useAgentsConfig({ onMainLoadingChange, onOptionStatusChange }) {
  // 初始配置 & 提示词
  const [mainModelConfig, setMainModelConfig] = useState(() => ConfigManager.getMainModelConfig());
  const [optionModelConfig, setOptionModelConfig] = useState(() => ConfigManager.getOptionModelConfig());
  const [mainPrompt, setMainPrompt] = useState(() => ConfigManager.getMainPrompt());
  const [optionPrompt, setOptionPrompt] = useState(() => ConfigManager.getOptionPrompt());

  const mainAgent = useMemo(() => createMainAgent({
    onRequestStart: () => onMainLoadingChange?.(true),
    onResponseEnd: () => onMainLoadingChange?.(false),
  }, { ...mainModelConfig, prompt: mainPrompt }), []); // 实例稳定，配置走下面的 effect

  const optionAgent = useMemo(() => createOptionAgent({
    onRequestStart: () => onOptionStatusChange?.('requesting'),
    onResponseStart: () => onOptionStatusChange?.('responding'),
    onResponseEnd: () => onOptionStatusChange?.('completed'),
  }, { ...optionModelConfig, prompt: optionPrompt }), []); // 同上

  // 配置变化时，统一更新 agent
  useEffect(() => {
    const endpoint = ConfigManager.buildEndpointUrl(mainModelConfig);
    mainAgent.updateApiConfig(endpoint, mainModelConfig.apiKey);
    mainAgent.setModel(mainModelConfig.model);
  }, [mainAgent, mainModelConfig]);

  useEffect(() => {
    const endpoint = ConfigManager.buildEndpointUrl(optionModelConfig);
    optionAgent.updateApiConfig(endpoint, optionModelConfig.apiKey);
    optionAgent.setModel(optionModelConfig.model);
  }, [optionAgent, optionModelConfig]);

  // 暴露保存接口
  const updateMainConfig = (cfg) => { ConfigManager.saveMainModelConfig(cfg); setMainModelConfig(cfg); };
  const updateOptionConfig = (cfg) => { ConfigManager.saveOptionModelConfig(cfg); setOptionModelConfig(cfg); };
  const updateMainPrompt = (p) => { ConfigManager.saveMainPrompt(p); setMainPrompt(p); mainAgent.updateSettings({ system_message: p }); };
  const updateOptionPrompt = (p) => { ConfigManager.saveOptionPrompt(p); setOptionPrompt(p); optionAgent.updateSettings({ system_message: p }); };

  return {
    mainAgent, optionAgent,
    mainModelConfig, optionModelConfig,
    mainPrompt, optionPrompt,
    updateMainConfig, updateOptionConfig,
    updateMainPrompt, updateOptionPrompt,
  };
}


