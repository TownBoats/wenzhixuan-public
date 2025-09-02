// ContentParser.js

class ContentParser {
    constructor(tags = ['response', 'question']) {
        this.tags = tags;
    }

    /**
     * 解析包含指定标签的文本内容
     * @param {string} content - 要解析的文本内容
     * @returns {Object} - 返回解析结果，key为标签名，value为内容数组
     */
    parse(content) {
        const result = {};
        // console.log('解析器开始解析');
        // console.log('解析器解析的内容:', content);
        // 为每个标签初始化结果数组
        this.tags.forEach(tag => {
            result[tag] = [];
        });

        // 解析每个标签的内容
        this.tags.forEach(tag => {
            const regex = new RegExp(`〖${tag}〗([\\s\\S]*?)〖\\/${tag}〗`, 'g');
            let match;
            
            while ((match = regex.exec(content)) !== null) {
                result[tag].push({
                    content: match[1].trim(),
                    index: match.index,
                    length: match[0].length
                });
            }
        });

        return result;
    }

    /**
     * 添加新的标签到解析器
     * @param {string|string[]} newTags - 要添加的新标签
     */
    addTags(newTags) {
        if (Array.isArray(newTags)) {
            this.tags = [...new Set([...this.tags, ...newTags])];
        } else {
            this.tags = [...new Set([...this.tags, newTags])];
        }
    }

    /**
     * 移除现有标签
     * @param {string|string[]} tagsToRemove - 要移除的标签
     */
    removeTags(tagsToRemove) {
        const tagsArray = Array.isArray(tagsToRemove) ? tagsToRemove : [tagsToRemove];
        this.tags = this.tags.filter(tag => !tagsArray.includes(tag));
    }

    /**
     * 获取当前配置的所有标签
     * @returns {string[]} - 返回当前配置的标签列表
     */
    getTags() {
        return [...this.tags];
    }
}
export default ContentParser;
