// AgentModel.js
import ContentParser from "../utils/ContentParser";

export class AgentModel {
  constructor(config = {}) {
    this.TIMEOUT = 30000;
    
    // 默认设置
    this.settings = {
      model: 'gpt-4o-mini',
      system_message: '',
      temperature: 0.3,
      max_tokens: 4096,
      top_p: 0.85,
      frequency_penalty: 0.2,
      presence_penalty:0.1,
      stream: true,
      ...config.settings // 允许通过配置覆盖默认设置
    };

    // 回调函数
    this.callbacks = {
      onRequestStart: config.onRequestStart || (() => {}),
      onResponseStart: config.onResponseStart || (() => {}),
      onResponseEnd: config.onResponseEnd || (() => {})
    };

    // 初始化 API 配置（BYOK）：仅使用运行时传入的 endpoint 与 key
    this.API_URL = config.customEndpoint || '';
    this.API_KEY = config.apiKey;

    // this.contentParser = new ContentParser(['response', 'question', 'code', 'math']); // 初始化解析器
  }

  // BYOK: 环境变量端点与密钥解析已移除

  // 更新模型参数
  updateSettings(newSettings) {
    this.settings = {
      ...this.settings,
      ...newSettings
    };
  }

  // 设置系统提示词
  setSystemMessage(message) {
    this.settings.system_message = message;
  }

  // 设置模型
  setModel(model) {
    this.settings.model = model;
  }

  // 设置温度
  setTemperature(temperature) {
    this.settings.temperature = temperature;
  }

  // 主要的完成请求方法
  async getCompletion(messages, onDataReceived, onComplete) {
    const controller = new AbortController();
    // 触发请求开始回调
    this.callbacks.onRequestStart();
    
    const timeoutId = setTimeout(() => {
      controller.abort();
      console.warn('请求超时，正在重试...');
    }, 60000);

    let retryCount = 0;
    const maxRetries = 3;
    const getRetryDelay = (retryCount) => Math.min(1000 * Math.pow(2, retryCount), 10000);
    let responseStarted = false;

    while (retryCount < maxRetries) {
      try {
        // 确保使用正确的 URL，并且添加正确的斜杠
        const requestURL = this.API_URL.startsWith('http') 
          ? this.API_URL 
          : this.API_URL.startsWith('/')
            ? `${window.location.origin}${this.API_URL}`
            : `${window.location.origin}/${this.API_URL}`;
        
        console.log('Request URL:', requestURL); // 添加日志以便调试
        
        const headers = {
          'Content-Type': 'application/json',
          // 添加额外的请求头以提高稳定性
          'Connection': 'keep-alive',
          'Keep-Alive': 'timeout=60',
        };
        if (this.API_KEY) {
          headers['Authorization'] = `Bearer ${this.API_KEY}`;
        }
        const response = await fetch(requestURL, {
          method: 'POST',
          signal: controller.signal,
          headers,
          body: JSON.stringify({
            model: this.settings.model,
            messages: [
              { role: 'system', content: this.settings.system_message },
              ...messages,
            ],
            temperature: this.settings.temperature,
            max_tokens: this.settings.max_tokens,
            top_p: this.settings.top_p,
            frequency_penalty: this.settings.frequency_penalty,
            presence_penalty: this.settings.presence_penalty,
            stream: this.settings.stream,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              console.log('回答完毕');
              this.callbacks.onResponseEnd();
              if (onComplete) {
                onComplete();
              }
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
              if (line.trim() === '') continue;
              const message = line.replace(/^data: /, '');
              if (message === '[DONE]') continue;
              try {
                const parsed = JSON.parse(message);
                if (parsed.choices && parsed.choices[0].delta?.content) {
                  // 第一次收到内容时触发响应开始回调
                  if (!responseStarted) {
                    this.callbacks.onResponseStart();
                    responseStarted = true;
                  }
                  // 添加日志输出
                  // console.log('收到内容块:', parsed.choices[0].delta.content,'内容块长度:', parsed.choices[0].delta.content.length);
                  const content = parsed.choices[0].delta.content;
                  const maxLength = 10;
                  // 添加延迟输出函数
                  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
                  
                  // 使用 async/await 处理延迟
                  for (let i = 0; i < content.length; i += maxLength) {
                    await delay(10); // 每个内容块之间添加50ms延迟
                    onDataReceived(content.slice(i, i + maxLength));
                  }
                }
              } catch (error) {
                console.warn('解析消息时出错:', error);
                continue;
              }
            }
          }
        } catch (streamError) {
          console.error('流读取错误:', streamError);
          throw streamError;
        } finally {
          reader.releaseLock();
        }

        clearTimeout(timeoutId);
        return;

      } catch (error) {
        console.error(`尝试 ${retryCount + 1} 失败:`, error);
        
        // 清理当前请求的资源
        clearTimeout(timeoutId);
        controller.abort();

        if (retryCount === maxRetries - 1) {
          if (onComplete) {
            onComplete();
          }
          throw new Error(`请求在 ${maxRetries} 次尝试后失败`);
        }
        
        retryCount++;
        // 使用指数退避策略
        const delay = getRetryDelay(retryCount);
        console.log(`等待 ${delay}ms 后重试...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // 更新 API 配置的方法
  updateApiConfig(endpoint, apiKey) {
    this.API_URL = endpoint;
    this.API_KEY = apiKey;
  }
}

// 添加预设配置
export default AgentModel;