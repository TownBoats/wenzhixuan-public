import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';

export class AgentModel {
  constructor(config = {}) {
    this.settings = {
      model: 'gpt-4o-mini',
      system_message: '',
      temperature: 0.3,
      max_tokens: 4096,
      top_p: 0.85,
      frequency_penalty: 0.2,
      presence_penalty: 0.1,
      stream: true,
      typewriterDelay: true,   // 打字机效果分块
      enableThinking: false,
      thinkingBudget: 8000,
      ...config.settings,
    };

    this.callbacks = {
      onRequestStart: config.onRequestStart || (() => {}),
      onResponseStart: config.onResponseStart || (() => {}),
      onResponseEnd: config.onResponseEnd || (() => {}),
    };

    this.API_URL = config.customEndpoint || '';
    this.API_KEY = config.apiKey || '';
  }

  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
  }

  setSystemMessage(message) { this.settings.system_message = message; }
  setModel(model) { this.settings.model = model; }
  setTemperature(temperature) { this.settings.temperature = temperature; }

  updateApiConfig(endpoint, apiKey) {
    this.API_URL = endpoint;
    this.API_KEY = apiKey;
  }

  /**
   * 将完整 URL（含 /chat/completions）转换为 AI SDK 需要的 baseURL。
   * 若不以 /chat/completions 结尾，则原样返回作为 baseURL（由 SDK 自行处理）。
   */
  _buildAiSdkBaseUrl(fullUrl) {
    let absolute = fullUrl;
    if (!fullUrl.startsWith('http')) {
      const prefix = fullUrl.startsWith('/') ? '' : '/';
      absolute = `${window.location.origin}${prefix}${fullUrl}`;
    }
    return absolute.replace(/\/chat\/completions(\?.*)?$/, '');
  }

  _buildProvider() {
    const baseURL = this._buildAiSdkBaseUrl(this.API_URL);
    return createOpenAI({
      baseURL,
      apiKey: this.API_KEY || 'placeholder',
      compatibility: 'compatible',
    });
  }

  /** 返回当前请求的元信息，供日志记录使用 */
  getRequestMeta() {
    const baseURL = this._buildAiSdkBaseUrl(this.API_URL);
    // provider.chat(model) → path=/chat/completions
    return {
      url: `${baseURL}/chat/completions`,
      originalUrl: this.API_URL,
      model: this.settings.model,
      temperature: this.settings.temperature,
      maxTokens: this.settings.max_tokens,
      topP: this.settings.top_p,
      frequencyPenalty: this.settings.frequency_penalty,
      presencePenalty: this.settings.presence_penalty,
      enableThinking: this.settings.enableThinking,
    };
  }

  /**
   * 主完成方法。
   * @param {Array}    messages        对话历史
   * @param {Function} onDataReceived  文本 chunk 回调 (chunk: string) => void
   * @param {Function} onComplete      流结束回调 () => void
   * @param {Object}   options
   * @param {Function} options.onReasoning  思考内容 chunk 回调 (chunk: string) => void
   */
  async getCompletion(messages, onDataReceived, onComplete, options = {}) {
    const { onReasoning } = options;

    this.callbacks.onRequestStart();

    let retryCount = 0;
    const maxRetries = 3;
    const getRetryDelay = (n) => Math.min(1000 * Math.pow(2, n), 10000);

    while (retryCount < maxRetries) {
      try {
        await this._streamOnce(messages, onDataReceived, onReasoning);
        this.callbacks.onResponseEnd();
        onComplete?.();
        return;
      } catch (error) {
        console.error(`尝试 ${retryCount + 1} 失败:`, error);
        if (retryCount === maxRetries - 1) {
          // 保留完整诊断信息，把 HTTP 状态码放到 message 里便于展示
          const enriched = this._enrichError(error);
          const statusCode = enriched.statusCode;
          enriched.message = statusCode
            ? `HTTP ${statusCode} - ${error.message}`
            : error.message;
          throw enriched;
        }
        retryCount++;
        const delay = getRetryDelay(retryCount);
        console.log(`等待 ${delay}ms 后重试...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  async _streamOnce(messages, onDataReceived, onReasoning) {
    const provider = this._buildProvider();

    // 构建 providerOptions（Anthropic 扩展思考）
    const providerOptions = {};
    if (this.settings.enableThinking) {
      const isAnthropic =
        this.API_URL.includes('anthropic') ||
        this.API_URL.includes('claude');
      if (isAnthropic) {
        providerOptions.anthropic = {
          thinking: { type: 'enabled', budgetTokens: this.settings.thinkingBudget },
        };
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      console.warn('请求超时');
    }, 60000);

    try {
      const result = await streamText({
        model: provider.chat(this.settings.model),
        system: this.settings.system_message,
        messages,
        temperature: this.settings.temperature,
        maxTokens: this.settings.max_tokens,
        topP: this.settings.top_p,
        frequencyPenalty: this.settings.frequency_penalty,
        presencePenalty: this.settings.presence_penalty,
        ...(Object.keys(providerOptions).length > 0 && { providerOptions }),
        abortSignal: controller.signal,
        // 开启原始 chunk，以便手动提取 reasoning_content
        // （@ai-sdk/openai chat provider 不处理 delta.reasoning_content）
        includeRawChunks: true,
      });

      let responseStarted = false;
      const delay = (ms) => new Promise((r) => setTimeout(r, ms));
      const chunkSize = 10;
      const chunkDelay = 10;

      for await (const part of result.fullStream) {
        if (part.type === 'reasoning-delta') {
          // Anthropic / OpenAI Responses API 的 reasoning
          onReasoning?.(part.text ?? '');
        } else if (part.type === 'raw') {
          // 从原始 chunk 提取 reasoning_content（DeepSeek R1 / Qwen QwQ 等）
          const reasoningChunk =
            part.rawValue?.choices?.[0]?.delta?.reasoning_content;
          if (reasoningChunk) {
            onReasoning?.(reasoningChunk);
          }
        } else if (part.type === 'text-delta') {
          if (!responseStarted) {
            this.callbacks.onResponseStart();
            responseStarted = true;
          }
          const text = part.text ?? '';
          if (!text) continue;
          if (this.settings.typewriterDelay) {
            for (let i = 0; i < text.length; i += chunkSize) {
              await delay(chunkDelay);
              onDataReceived(text.slice(i, i + chunkSize));
            }
          } else {
            onDataReceived(text);
          }
        } else if (part.type === 'error') {
          throw this._enrichError(part.error);
        }
      }
    } catch (error) {
      throw this._enrichError(error);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 从 AISDKError / APICallError / 普通 Error 中提取完整诊断信息，
   * 附加到 error 对象上后返回，确保不丢失任何细节。
   */
  _enrichError(error) {
    if (!error) return new Error('Unknown error');

    // 处理非 Error 类型（如字符串、普通对象）
    let err = error instanceof Error ? error : new Error(
      typeof error === 'string' ? error : JSON.stringify(error)
    );

    // 从 APICallError 提取字段（优先使用已有值）
    if (!err.statusCode) err.statusCode = error.statusCode ?? error.status ?? null;
    if (!err.responseBody) {
      err.responseBody = error.responseBody ?? error.body ?? null;
      // 如果 responseBody 是对象，序列化为字符串
      if (err.responseBody && typeof err.responseBody !== 'string') {
        err.responseBody = JSON.stringify(err.responseBody, null, 2);
      }
    }
    // APICallError 特有字段
    if (!err.actualUrl) err.actualUrl = error.url ?? null;
    if (!err.requestBodyValues) err.requestBodyValues = error.requestBodyValues ?? null;
    if (!err.responseHeaders) err.responseHeaders = error.responseHeaders ?? null;

    return err;
  }
}

export default AgentModel;
