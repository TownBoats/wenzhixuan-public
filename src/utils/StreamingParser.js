class StreamingParser {
    constructor(callbacks = {}) {
        this.state = 'INITIAL';      // 当前解析状态
        this.buffer = '';            // 数据缓冲区
        this.currentTag = '';        // 当前处理的标签名
        this.currentContent = '';    // 当前标签的完整内容
        this.callbacks = callbacks;   // 回调函数集合
        this.currentIndex = 0;       // 当前处理的标签索引
        this.timeout = null;         // 超时处理器
        this.maxBufferSize = 10000;  // 最大缓冲区大小
        this.debugMode = false;      // 调试模式标志
        this.tagBuffer = '';         // 标签名缓冲区
    }

    feed(chunk) {
        if (!chunk) return;

        // 触发chunk接收回调
        if (this.callbacks.chunkReceived) {
            this.callbacks.chunkReceived({
                chunk,
                tag: this.currentTag,
                state: this.state
            });
        }

        this.buffer += chunk;
        
        if (this.buffer.length > this.maxBufferSize) {
            this.log('Buffer overflow, resetting parser');
            this.reset();
            return;
        }

        if (this.timeout) {
            clearTimeout(this.timeout);
        }

        this.parse();

        this.timeout = setTimeout(() => {
            if (this.buffer.length > 0) {
                this.log('Parser timeout - resetting state');
                this.reset();
            }
        }, 5000);
    }

    parse() {
        let iterationCount = 0;
        const maxIterations = 1000;

        while (this.buffer.length > 0 && iterationCount < maxIterations) {
            this.log('Current state:', this.state);
            this.log('Current buffer:', this.buffer);

            let consumed = false;

            switch (this.state) {
                case 'INITIAL':
                    consumed = this.handleInitialState();
                    break;
                case 'IN_TAG':
                    consumed = this.handleTagState();
                    break;
                case 'IN_CONTENT':
                    consumed = this.handleContentState();
                    break;
                case 'CLOSING_TAG':
                    consumed = this.handleClosingTagState();
                    break;
                default:
                    this.log('Invalid state:', this.state);
                    this.reset();
                    return;
            }

            if (!consumed) {
                break;
            }

            iterationCount++;
            if (iterationCount === maxIterations) {
                this.log('Max iterations reached, resetting parser');
                this.reset();
            }
        }
    }

    handleInitialState() {
        const tagStart = this.buffer.indexOf('〖');
        
        if (tagStart === -1) {
            return false;
        }
        
        // 清除标签前的内容
        if (tagStart > 0) {
            this.buffer = this.buffer.slice(tagStart);
        }
        
        // 检查是否有足够的字符来判断标签类型
        if (this.buffer.length < 2) {
            return false;
        }
        
        // 检查是否是结束标签
        if (this.buffer[1] === '/') {
            this.state = 'CLOSING_TAG';
            this.buffer = this.buffer.slice(2);
            this.tagBuffer = '';
        } else {
            this.state = 'IN_TAG';
            this.buffer = this.buffer.slice(1);
            this.tagBuffer = '';
        }
        
        return true;
    }

    handleTagState() {
        const tagEnd = this.buffer.indexOf('〗');
        
        if (tagEnd === -1) {
            this.tagBuffer += this.buffer;
            this.buffer = '';
            return false;
        }
        
        this.currentTag = this.buffer.slice(0, tagEnd).trim();
        if (this.tagBuffer) {
            this.currentTag = this.tagBuffer + this.currentTag;
        }
        this.currentTag = this.currentTag.trim();
        
        this.buffer = this.buffer.slice(tagEnd + 1);
        this.tagBuffer = '';
        this.state = 'IN_CONTENT';
        this.currentContent = '';
        
        this.log('Found opening tag:', this.currentTag);
        return true;
    }

    handleContentState() {
        const nextChunkStart = this.buffer.indexOf('〖');
        
        if (nextChunkStart === -1) {
            // 保留所有原始内容，包括换行符和空行
            if (this.callbacks.contentChunk && this.buffer) {
                this.callbacks.contentChunk({
                    content: this.buffer,
                    tag: this.currentTag,
                    index: this.currentIndex,
                    preserveWhitespace: true  // 添加新标志
                });
            }
            
            this.currentContent += this.buffer;
            this.buffer = '';
            this.notifyContent();
            return true;
        }

        // 找到了下一个标签的开始
        if (nextChunkStart > 0) {
            const chunk = this.buffer.slice(0, nextChunkStart);
            // 发送内容chunk时保留所有空白字符
            if (this.callbacks.contentChunk && chunk) {
                this.callbacks.contentChunk({
                    content: chunk,
                    tag: this.currentTag,
                    index: this.currentIndex,
                    preserveWhitespace: true  // 添加新标志
                });
            }
            
            this.currentContent += chunk;
            this.buffer = this.buffer.slice(nextChunkStart);
            this.notifyContent();
        }

        // 检查是否是结束标签
        if (this.buffer.length >= 2 && this.buffer.startsWith('〖/')) {
            this.state = 'CLOSING_TAG';
            this.buffer = this.buffer.slice(2);
            this.tagBuffer = '';
            return true;
        }

        return false;
    }

    handleClosingTagState() {
        const tagEnd = this.buffer.indexOf('〗');
        
        if (tagEnd === -1) {
            this.tagBuffer += this.buffer;
            this.buffer = '';
            return false;
        }
        
        let closingTag = this.buffer.slice(0, tagEnd).trim();
        if (this.tagBuffer) {
            closingTag = this.tagBuffer + closingTag;
        }
        closingTag = closingTag.trim();
        
        this.buffer = this.buffer.slice(tagEnd + 1);
        
        if (closingTag === this.currentTag) {
            this.notifyTagComplete();
            this.state = 'INITIAL';
            this.currentTag = '';
            this.currentContent = '';
        } else {
            // 如果标签不匹配，将整个关闭标签作为内容处理
            this.currentContent += '〖/' + closingTag + '〗';
            this.state = 'IN_CONTENT';
        }
        
        this.tagBuffer = '';
        return true;
    }

    notifyContent() {
        if (this.callbacks[this.currentTag] && this.currentContent) {
            try {
                this.callbacks[this.currentTag]({
                    content: this.currentContent,
                    index: this.currentIndex,
                    preserveWhitespace: true  // 添加新标志
                });
            } catch (error) {
                this.log('Error in content callback:', error);
            }
        }
    }

    notifyTagComplete() {
        const callbackName = `${this.currentTag}Complete`;
        if (this.callbacks[callbackName]) {
            try {
                this.callbacks[callbackName]({
                    content: this.currentContent,
                    index: this.currentIndex
                });
            } catch (error) {
                this.log('Error in complete callback:', error);
            }
        }
        this.currentIndex++;
    }

    reset() {
        this.state = 'INITIAL';
        this.buffer = '';
        this.currentTag = '';
        this.currentContent = '';
        this.tagBuffer = '';
        this.log('Parser reset');
    }

    dispose() {
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }
        this.reset();
    }

    setDebug(enabled) {
        this.debugMode = enabled;
    }

    log(...args) {
        if (this.debugMode) {
            console.log('[StreamingParser]', ...args);
        }
    }

    end() {
        // 清除之前可能存在的超时定时器
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }

        // 先解析剩余数据
        this.parse();
        console.log('解析类内部end：解析结束！');

        // 强制处理任何剩余的缓冲区数据
        if (this.buffer.length > 0) {
            // 如果还在处理标签内容，强制完成当前标签
            if (this.state === 'IN_CONTENT' && this.currentTag) {
                this.currentContent += this.buffer;
                this.notifyContent();
                this.notifyTagComplete();
            }
            // 清空缓冲区
            this.buffer = '';
        }

        // 调用解析完成回调
        if (this.callbacks.parsingComplete) {
            console.log('解析类内部回调函数调用');
            try {
                this.callbacks.parsingComplete();
            } catch (error) {
                this.log('Error in parsingComplete callback:', error);
            }
        }

        // 最后重置解析器状态
        this.reset();
    }
}

export default StreamingParser;