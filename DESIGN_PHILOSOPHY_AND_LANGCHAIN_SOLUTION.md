# 问知选 - 核心设计思想与 LangChain 实现方案

## 一、核心设计思想

### 1.1 教育理念：苏格拉底式教学法

**核心哲学**：「不直接给答案，而是通过提问引导学习者自己发现答案」

```
传统AI对话：用户提问 → AI直接回答 → 用户被动接收

苏格拉底式：用户提问 → AI反问引导 → 用户思考回答 → AI继续引导 → 用户主动理解
```

**设计目标**：
- **倒逼思考**：AI不直接给出答案，而是通过层层追问让用户自己推导
- **知识摸底**：先了解用户的知识水平，再决定从哪里开始讲解
- **分层教学**：根据用户回答动态调整教学深度
- **理解检验**：通过提问确认用户是否真正理解

### 1.2 交互创新：预测式回答系统

**痛点洞察**：
- 传统对话中，用户需要手动输入回答，打字负担重
- 用户可能不知道如何表达自己的理解程度
- 容易产生对AI的依赖，直接看答案而不思考

**解决方案**：五级预设回答 + 延迟揭示

```
┌─────────────────────────────────────────────────────────────┐
│                    AI提出问题后                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐
│  │  茫然   │  │  耳闻   │  │  入门   │  │  熟悉   │  │  精通   │
│  │ (none)  │  │ (heard) │  │ (basic) │  │(familiar)│ │(expert) │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘
│                                                             │
│  + 自定义回答输入框                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**延迟揭示机制**：
- 答案默认隐藏，需要等待N秒后才能查看
- 鼠标悬停才显示具体内容
- 强迫用户先思考，再参考AI预测的回答

### 1.3 双Agent协作架构

```
┌─────────────────────────────────────────────────────────────┐
│                      用户输入问题                            │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Main Agent (主AI)                         │
│  角色：苏格拉底式导师                                         │
│  职责：                                                      │
│    1. 理解用户问题                                           │
│    2. 进行知识摸底                                           │
│    3. 提出引导性问题 (用〖question〗标签包裹)                  │
│    4. 给出解释说明 (用〖response〗标签包裹)                    │
│    5. 根据用户回答调整教学策略                                │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          │ 解析出 〖question〗
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   Option Agent (选项AI)                      │
│  角色：学生模拟器                                             │
│  职责：                                                      │
│    1. 接收主AI提出的问题                                     │
│    2. 模拟5种不同理解水平的学生                               │
│    3. 生成对应级别的回答选项                                  │
│       - none: 完全不懂的回答                                 │
│       - heard: 听说过但不理解的回答                          │
│       - basic: 基本了解的回答                                │
│       - familiar: 比较熟悉的回答                             │
│       - expert: 专家级别的回答                               │
└─────────────────────────────────────────────────────────────┘
```

**协作流程**：
1. 用户提问 → Main Agent 生成带标签的响应
2. 前端实时解析 `〖question〗` 标签
3. 每解析出一个问题 → 立即调用 Option Agent
4. Option Agent 生成五级回答 → 展示给用户选择
5. 用户选择/输入回答 → 作为上下文继续对话

---

## 二、Agent 设计详解

### 2.1 Main Agent (主AI) 设计

**System Prompt 核心要素**：

```markdown
1. 角色定位
   - 苏格拉底式导师
   - 不直接给答案，通过提问引导

2. 对话流程
   - 知识摸底 → 分层教学 → 理解检验

3. 输出格式约束 (关键!)
   - 〖response〗...〖/response〗 包裹解释内容
   - 〖question〗...〖/question〗 包裹问题
   - 单一问号原则：每个question标签只能有一个问号
   - 禁止嵌套

4. 教学策略
   - 善用生活中的例子
   - 把用户当小学生讲解
   - 循序渐进
```

**为什么需要标签格式？**
- 便于前端实时解析流式响应
- 区分"解释内容"和"需要用户回答的问题"
- 支持问题的独立提取和处理

### 2.2 Option Agent (选项AI) 设计

**System Prompt 核心要素**：

```markdown
1. 角色定位
   - 模拟不同理解水平的学生

2. 输入
   - 主AI的解释上下文
   - 主AI提出的问题

3. 输出格式
   〖none〗完全不懂的回答〖/none〗
   〖heard〗听说过的回答〖/heard〗
   〖basic〗基本了解的回答〖/basic〗
   〖familiar〗比较熟悉的回答〖/familiar〗
   〖expert〗专家级别的回答〖/expert〗

4. 原则
   - 简短精确，20字以内
   - 级别区分明显
   - 人性化表达
   - 与用户语言一致
```

### 2.3 Agent 间的数据流

```
用户: "什么是递归？"
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Main Agent 输出 (流式):                                      │
│                                                             │
│ 〖response〗                                                 │
│ 递归是编程中一个重要的概念。在我解释之前，                      │
│ 我想先了解一下你的背景知识。                                   │
│ 〖/response〗                                                │
│                                                             │
│ 〖question〗你知道什么是函数吗？〖/question〗  ◄── 触发Option AI │
│                                                             │
│ 〖question〗你听说过"自己调用自己"这种说法吗？〖/question〗      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
         │
         │ 解析出问题: "你知道什么是函数吗？"
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Option Agent 输入:                                           │
│   context: "递归是编程中一个重要的概念..."                     │
│   question: "你知道什么是函数吗？"                             │
│                                                             │
│ Option Agent 输出:                                           │
│ 〖none〗函数是什么？没听过这个词〖/none〗                       │
│ 〖heard〗好像是代码里的东西，具体不太清楚〖/heard〗              │
│ 〖basic〗函数就是一段可以重复使用的代码块〖/basic〗              │
│ 〖familiar〗函数是封装代码逻辑的单元，可以接收参数返回值〖/familiar〗│
│ 〖expert〗函数是一等公民，支持高阶函数、闭包等特性〖/expert〗     │
└─────────────────────────────────────────────────────────────┘
```

---

## 三、技术要点总结

### 3.1 流式解析 (Streaming Parser)

**挑战**：AI响应是流式的，需要实时解析标签

**解决方案**：状态机解析器
```
INITIAL → IN_TAG → IN_CONTENT → CLOSING_TAG → INITIAL
```

**关键点**：
- 缓冲区管理，处理标签跨chunk的情况
- 实时回调，每解析出内容立即通知UI
- 问题完成回调，触发Option Agent请求

### 3.2 并行请求管理

**场景**：Main Agent 可能一次输出多个问题

**处理**：
- 每个问题独立触发 Option Agent 请求
- 使用问题ID追踪状态
- 支持请求中、响应中、已完成等状态

### 3.3 上下文管理

**Main Agent 上下文**：完整对话历史
**Option Agent 上下文**：Main Agent 当前回复 + 当前问题

### 3.4 用户回答聚合

当用户回答完所有问题后：
1. 收集所有问题和用户选择的回答
2. 格式化为摘要文本
3. 自动发送给 Main Agent 继续对话

---

## 四、LangChain 实现方案

### 4.1 可行性分析

**完全可行**，LangChain 提供了所有必要的组件：

| 原系统功能 | LangChain 对应方案 |
|-----------|-------------------|
| Agent 封装 | `ChatOpenAI` / `ChatAnthropic` 等 |
| System Prompt | `SystemMessage` / `ChatPromptTemplate` |
| 流式响应 | `stream()` / `astream()` |
| 多Agent协作 | `LangGraph` / 自定义Chain |
| 对话历史 | `ConversationBufferMemory` / `RunnableWithMessageHistory` |
| 输出解析 | `OutputParser` / 自定义Parser |

### 4.2 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                     FastAPI Backend                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   LangGraph Workflow                 │   │
│  │                                                      │   │
│  │   ┌──────────┐    ┌──────────┐    ┌──────────┐     │   │
│  │   │  Router  │───▶│ MainAgent│───▶│ Parser   │     │   │
│  │   └──────────┘    └──────────┘    └──────────┘     │   │
│  │                         │              │            │   │
│  │                         │              ▼            │   │
│  │                         │       ┌──────────┐       │   │
│  │                         │       │OptionAgent│       │   │
│  │                         │       └──────────┘       │   │
│  │                         │              │            │   │
│  │                         ▼              ▼            │   │
│  │                   ┌─────────────────────────┐      │   │
│  │                   │    Response Aggregator   │      │   │
│  │                   └─────────────────────────┘      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ Memory Manager  │  │  Session Store  │                  │
│  │ (Redis/Postgres)│  │   (Redis)       │                  │
│  └─────────────────┘  └─────────────────┘                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ SSE / WebSocket
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                          │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 核心代码实现

#### 4.3.1 项目结构

```
wenzhixuan-backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI 入口
│   ├── config.py               # 配置管理
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── main_agent.py       # 主AI Agent
│   │   ├── option_agent.py     # 选项AI Agent
│   │   └── prompts.py          # Prompt模板
│   ├── parsers/
│   │   ├── __init__.py
│   │   └── streaming_parser.py # 流式标签解析器
│   ├── graph/
│   │   ├── __init__.py
│   │   └── workflow.py         # LangGraph 工作流
│   ├── memory/
│   │   ├── __init__.py
│   │   └── conversation.py     # 对话历史管理
│   ├── models/
│   │   ├── __init__.py
│   │   └── schemas.py          # Pydantic 模型
│   └── routers/
│       ├── __init__.py
│       └── chat.py             # 聊天API路由
├── requirements.txt
└── README.md
```

#### 4.3.2 Prompt 模板 (`agents/prompts.py`)

```python
from langchain_core.prompts import ChatPromptTemplate, SystemMessagePromptTemplate

# 主AI系统提示词
MAIN_AGENT_SYSTEM_PROMPT = """你是一个遵循「苏格拉底式」风格的导师，请严格遵守以下所有指令与输出格式进行对话。

## 角色定位
- 作为思维清晰、耐心的导师，你会根据学习者的理解水平循序渐进地提问，引导其思考
- 你不能直接告诉学习者最终答案或结论，而是要通过提问启发其逐步获得答案

## 对话流程
1. 知识摸底：思考学习者可能缺乏哪些前置知识，使用恰当的问题确认其掌握情况
2. 分层教学：如果学习者尚未掌握必要的基础知识，先做相应解释
3. 理解检验：通过1～3个问题，确认学习者是否真正掌握了所学内容

## 输出格式 (必须严格遵守!)
- 使用 〖response〗...〖/response〗 包裹解释说明、陈述回答等非提问内容
- 使用 〖question〗...〖/question〗 包裹问题
- 每个question标签内只能有一个问号
- 标签不得嵌套，必须彼此独立
- 可在标签内使用Markdown格式

## 示例
〖response〗在深入讨论之前，我想先了解你对它的认识程度。〖/response〗
〖question〗你听说过这个概念吗？〖/question〗

## 原则
- 善用生活中显而易见的例子
- 把用户当小学生讲解
- 循序渐进，不要跳跃"""

# 选项AI系统提示词
OPTION_AGENT_SYSTEM_PROMPT = """# 知识水平评估模式

## 角色
你将收到一个问题，需要模拟不同理解水平的学生来提供对应的回答。

## 输出格式 (必须严格遵守!)
〖none〗完全不懂的回答〖/none〗
〖heard〗听说过但不理解的回答〖/heard〗
〖basic〗基本了解的回答〖/basic〗
〖familiar〗比较熟悉的回答〖/familiar〗
〖expert〗专家级别的回答〖/expert〗

## 原则
- 每个回答简短精确，不超过20字
- 级别之间区分明显
- 表达要人性化，符合对应角色特征
- 使用与问题相同的语言回答"""


def get_main_agent_prompt():
    return ChatPromptTemplate.from_messages([
        SystemMessagePromptTemplate.from_template(MAIN_AGENT_SYSTEM_PROMPT),
        ("placeholder", "{history}"),
        ("human", "{input}")
    ])


def get_option_agent_prompt():
    return ChatPromptTemplate.from_messages([
        SystemMessagePromptTemplate.from_template(OPTION_AGENT_SYSTEM_PROMPT),
        ("human", "上下文：{context}\n\n问题：{question}")
    ])
```

#### 4.3.3 流式解析器 (`parsers/streaming_parser.py`)

```python
import re
from typing import Callable, Optional
from dataclasses import dataclass
from enum import Enum


class ParserState(Enum):
    INITIAL = "initial"
    IN_TAG = "in_tag"
    IN_CONTENT = "in_content"
    CLOSING_TAG = "closing_tag"


@dataclass
class ParsedContent:
    tag: str
    content: str
    is_complete: bool


class StreamingTagParser:
    """流式标签解析器，用于实时解析AI响应中的标签"""
    
    def __init__(
        self,
        on_content_chunk: Optional[Callable[[str, str], None]] = None,
        on_question_complete: Optional[Callable[[str, int], None]] = None,
        on_response_chunk: Optional[Callable[[str], None]] = None,
    ):
        self.state = ParserState.INITIAL
        self.buffer = ""
        self.current_tag = ""
        self.current_content = ""
        self.question_index = 0
        
        # 回调函数
        self.on_content_chunk = on_content_chunk
        self.on_question_complete = on_question_complete
        self.on_response_chunk = on_response_chunk
    
    def feed(self, chunk: str) -> list[ParsedContent]:
        """喂入流式数据块"""
        self.buffer += chunk
        results = []
        
        while self.buffer:
            if self.state == ParserState.INITIAL:
                if not self._handle_initial():
                    break
            elif self.state == ParserState.IN_TAG:
                if not self._handle_tag():
                    break
            elif self.state == ParserState.IN_CONTENT:
                result = self._handle_content()
                if result:
                    results.append(result)
                if self.state == ParserState.IN_CONTENT:
                    break
            elif self.state == ParserState.CLOSING_TAG:
                result = self._handle_closing()
                if result:
                    results.append(result)
                if self.state == ParserState.CLOSING_TAG:
                    break
        
        return results
    
    def _handle_initial(self) -> bool:
        tag_start = self.buffer.find("〖")
        if tag_start == -1:
            self.buffer = ""
            return False
        
        if tag_start > 0:
            self.buffer = self.buffer[tag_start:]
        
        if len(self.buffer) < 2:
            return False
        
        if self.buffer[1] == "/":
            self.state = ParserState.CLOSING_TAG
            self.buffer = self.buffer[2:]
        else:
            self.state = ParserState.IN_TAG
            self.buffer = self.buffer[1:]
        
        return True
    
    def _handle_tag(self) -> bool:
        tag_end = self.buffer.find("〗")
        if tag_end == -1:
            return False
        
        self.current_tag = self.buffer[:tag_end].strip()
        self.buffer = self.buffer[tag_end + 1:]
        self.state = ParserState.IN_CONTENT
        self.current_content = ""
        return True
    
    def _handle_content(self) -> Optional[ParsedContent]:
        next_tag = self.buffer.find("〖")
        
        if next_tag == -1:
            # 没有找到下一个标签，所有内容都是当前标签的
            content = self.buffer
            self.current_content += content
            self.buffer = ""
            
            # 触发内容回调
            if content and self.on_content_chunk:
                self.on_content_chunk(content, self.current_tag)
            if content and self.current_tag == "response" and self.on_response_chunk:
                self.on_response_chunk(content)
            
            return None
        
        if next_tag > 0:
            content = self.buffer[:next_tag]
            self.current_content += content
            self.buffer = self.buffer[next_tag:]
            
            if content and self.on_content_chunk:
                self.on_content_chunk(content, self.current_tag)
            if content and self.current_tag == "response" and self.on_response_chunk:
                self.on_response_chunk(content)
        
        # 检查是否是结束标签
        if len(self.buffer) >= 2 and self.buffer.startswith("〖/"):
            self.state = ParserState.CLOSING_TAG
            self.buffer = self.buffer[2:]
        
        return None
    
    def _handle_closing(self) -> Optional[ParsedContent]:
        tag_end = self.buffer.find("〗")
        if tag_end == -1:
            return False
        
        closing_tag = self.buffer[:tag_end].strip()
        self.buffer = self.buffer[tag_end + 1:]
        
        result = None
        if closing_tag == self.current_tag:
            result = ParsedContent(
                tag=self.current_tag,
                content=self.current_content,
                is_complete=True
            )
            
            # 如果是问题标签完成，触发回调
            if self.current_tag == "question" and self.on_question_complete:
                self.on_question_complete(self.current_content, self.question_index)
                self.question_index += 1
        
        self.state = ParserState.INITIAL
        self.current_tag = ""
        self.current_content = ""
        
        return result
    
    def reset(self):
        """重置解析器状态"""
        self.state = ParserState.INITIAL
        self.buffer = ""
        self.current_tag = ""
        self.current_content = ""
        self.question_index = 0
```

#### 4.3.4 Agent 实现 (`agents/main_agent.py`)

```python
from typing import AsyncIterator
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_core.runnables import RunnableWithMessageHistory

from .prompts import get_main_agent_prompt, MAIN_AGENT_SYSTEM_PROMPT


class MainAgent:
    """主AI Agent - 苏格拉底式导师"""
    
    def __init__(
        self,
        model_name: str = "gpt-4o-mini",
        api_key: str = None,
        base_url: str = None,
        temperature: float = 0.3,
    ):
        self.llm = ChatOpenAI(
            model=model_name,
            api_key=api_key,
            base_url=base_url,
            temperature=temperature,
            streaming=True,
        )
        self.system_message = SystemMessage(content=MAIN_AGENT_SYSTEM_PROMPT)
    
    async def stream(
        self,
        user_input: str,
        history: list[dict] = None,
    ) -> AsyncIterator[str]:
        """流式生成响应"""
        messages = [self.system_message]
        
        # 添加历史消息
        if history:
            for msg in history:
                if msg["role"] == "user":
                    messages.append(HumanMessage(content=msg["content"]))
                elif msg["role"] == "assistant":
                    messages.append(AIMessage(content=msg["content"]))
        
        # 添加当前用户输入
        messages.append(HumanMessage(content=user_input))
        
        # 流式生成
        async for chunk in self.llm.astream(messages):
            if chunk.content:
                yield chunk.content
    
    def update_config(
        self,
        model_name: str = None,
        api_key: str = None,
        base_url: str = None,
        temperature: float = None,
    ):
        """更新配置"""
        if model_name:
            self.llm.model_name = model_name
        if api_key:
            self.llm.api_key = api_key
        if base_url:
            self.llm.base_url = base_url
        if temperature is not None:
            self.llm.temperature = temperature
```

#### 4.3.5 Option Agent (`agents/option_agent.py`)

```python
from typing import AsyncIterator
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

from .prompts import OPTION_AGENT_SYSTEM_PROMPT


class OptionAgent:
    """选项AI Agent - 生成多级别预设回答"""
    
    def __init__(
        self,
        model_name: str = "gpt-4o-mini",
        api_key: str = None,
        base_url: str = None,
        temperature: float = 1.0,  # 较高温度增加多样性
    ):
        self.llm = ChatOpenAI(
            model=model_name,
            api_key=api_key,
            base_url=base_url,
            temperature=temperature,
            streaming=True,
        )
        self.system_message = SystemMessage(content=OPTION_AGENT_SYSTEM_PROMPT)
    
    async def stream(
        self,
        question: str,
        context: str = "",
    ) -> AsyncIterator[str]:
        """流式生成五级回答"""
        user_content = f"上下文：{context}\n\n问题：{question}" if context else f"问题：{question}"
        
        messages = [
            self.system_message,
            HumanMessage(content=user_content)
        ]
        
        async for chunk in self.llm.astream(messages):
            if chunk.content:
                yield chunk.content
    
    async def generate(
        self,
        question: str,
        context: str = "",
    ) -> dict[str, str]:
        """一次性生成并解析五级回答"""
        full_response = ""
        async for chunk in self.stream(question, context):
            full_response += chunk
        
        return self._parse_levels(full_response)
    
    def _parse_levels(self, response: str) -> dict[str, str]:
        """解析五级回答"""
        import re
        
        levels = ["none", "heard", "basic", "familiar", "expert"]
        result = {level: "" for level in levels}
        
        for level in levels:
            pattern = f"〖{level}〗(.*?)〖/{level}〗"
            match = re.search(pattern, response, re.DOTALL)
            if match:
                result[level] = match.group(1).strip()
        
        return result
```

#### 4.3.6 LangGraph 工作流 (`graph/workflow.py`)

```python
from typing import TypedDict, Annotated, Sequence
from langgraph.graph import StateGraph, END
from langchain_core.messages import BaseMessage
import operator


class ConversationState(TypedDict):
    """对话状态"""
    messages: Annotated[Sequence[BaseMessage], operator.add]
    current_response: str
    parsed_questions: list[dict]
    question_options: dict[str, dict]
    user_answers: list[dict]
    is_complete: bool


class SocraticWorkflow:
    """苏格拉底式对话工作流"""
    
    def __init__(self, main_agent, option_agent, parser):
        self.main_agent = main_agent
        self.option_agent = option_agent
        self.parser = parser
        self.graph = self._build_graph()
    
    def _build_graph(self) -> StateGraph:
        workflow = StateGraph(ConversationState)
        
        # 添加节点
        workflow.add_node("generate_response", self._generate_response)
        workflow.add_node("parse_questions", self._parse_questions)
        workflow.add_node("generate_options", self._generate_options)
        workflow.add_node("wait_user_answer", self._wait_user_answer)
        workflow.add_node("aggregate_answers", self._aggregate_answers)
        
        # 设置入口
        workflow.set_entry_point("generate_response")
        
        # 添加边
        workflow.add_edge("generate_response", "parse_questions")
        workflow.add_conditional_edges(
            "parse_questions",
            self._has_questions,
            {
                True: "generate_options",
                False: END
            }
        )
        workflow.add_edge("generate_options", "wait_user_answer")
        workflow.add_conditional_edges(
            "wait_user_answer",
            self._all_answered,
            {
                True: "aggregate_answers",
                False: "wait_user_answer"
            }
        )
        workflow.add_edge("aggregate_answers", "generate_response")
        
        return workflow.compile()
    
    async def _generate_response(self, state: ConversationState) -> dict:
        """生成主AI响应"""
        # 实现流式生成逻辑
        pass
    
    async def _parse_questions(self, state: ConversationState) -> dict:
        """解析问题"""
        # 使用 StreamingTagParser 解析
        pass
    
    async def _generate_options(self, state: ConversationState) -> dict:
        """为每个问题生成选项"""
        # 并行调用 OptionAgent
        pass
    
    async def _wait_user_answer(self, state: ConversationState) -> dict:
        """等待用户回答"""
        # 这里需要与前端交互
        pass
    
    async def _aggregate_answers(self, state: ConversationState) -> dict:
        """聚合用户回答"""
        pass
    
    def _has_questions(self, state: ConversationState) -> bool:
        return len(state.get("parsed_questions", [])) > 0
    
    def _all_answered(self, state: ConversationState) -> bool:
        questions = state.get("parsed_questions", [])
        answers = state.get("user_answers", [])
        return len(answers) >= len(questions)
```

#### 4.3.7 FastAPI 路由 (`routers/chat.py`)

```python
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import json

from ..agents.main_agent import MainAgent
from ..agents.option_agent import OptionAgent
from ..parsers.streaming_parser import StreamingTagParser


router = APIRouter(prefix="/api/chat", tags=["chat"])

# 全局 Agent 实例 (实际应用中应该用依赖注入)
main_agent = MainAgent()
option_agent = OptionAgent()


class ChatRequest(BaseModel):
    message: str
    history: Optional[list[dict]] = None
    session_id: Optional[str] = None


class OptionRequest(BaseModel):
    question: str
    context: Optional[str] = ""


@router.post("/stream")
async def stream_chat(request: ChatRequest):
    """流式对话接口"""
    
    async def generate():
        parser = StreamingTagParser()
        full_response = ""
        
        async for chunk in main_agent.stream(
            request.message,
            request.history
        ):
            full_response += chunk
            
            # 解析标签
            parsed = parser.feed(chunk)
            
            # 发送SSE事件
            yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"
            
            # 如果解析出完整的问题，发送问题事件
            for item in parsed:
                if item.tag == "question" and item.is_complete:
                    yield f"data: {json.dumps({'type': 'question', 'content': item.content, 'index': parser.question_index - 1})}\n\n"
        
        # 发送完成事件
        yield f"data: {json.dumps({'type': 'done', 'full_response': full_response})}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@router.post("/options/stream")
async def stream_options(request: OptionRequest):
    """流式生成选项接口"""
    
    async def generate():
        async for chunk in option_agent.stream(
            request.question,
            request.context
        ):
            yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"
        
        yield f"data: {json.dumps({'type': 'done'})}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream"
    )


@router.post("/options")
async def generate_options(request: OptionRequest):
    """一次性生成选项接口"""
    result = await option_agent.generate(
        request.question,
        request.context
    )
    return {"options": result}
```

#### 4.3.8 主入口 (`main.py`)

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import chat

app = FastAPI(
    title="问知选 API",
    description="苏格拉底式教学AI后端",
    version="1.0.0"
)

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(chat.router)


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
```

#### 4.3.9 依赖文件 (`requirements.txt`)

```
fastapi>=0.109.0
uvicorn>=0.27.0
langchain>=0.1.0
langchain-openai>=0.0.5
langgraph>=0.0.20
pydantic>=2.5.0
redis>=5.0.0
python-dotenv>=1.0.0
```

---

## 五、前后端对接方案

### 5.1 API 接口设计

```yaml
# 主对话流式接口
POST /api/chat/stream
Request:
  message: string
  history: [{role: string, content: string}]
  session_id: string
Response: SSE Stream
  - {type: "chunk", content: "..."}
  - {type: "question", content: "...", index: 0}
  - {type: "done", full_response: "..."}

# 选项生成流式接口
POST /api/chat/options/stream
Request:
  question: string
  context: string
Response: SSE Stream
  - {type: "chunk", content: "..."}
  - {type: "done"}

# 选项生成一次性接口
POST /api/chat/options
Request:
  question: string
  context: string
Response:
  options: {none: "", heard: "", basic: "", familiar: "", expert: ""}
```

### 5.2 前端改造要点

1. **替换 AgentModel**：改为调用后端 API
2. **保持 StreamingParser**：前端仍需解析 SSE 数据
3. **移除 BYOK 逻辑**：API Key 由后端管理
4. **添加 session_id**：支持多会话

---

## 六、优化建议

### 6.1 后端优势

| 方面 | 原纯前端方案 | LangChain后端方案 |
|------|-------------|------------------|
| API Key安全 | 存localStorage，有泄露风险 | 服务端管理，安全 |
| 模型切换 | 需要用户配置 | 后端统一管理 |
| 对话历史 | localStorage，设备隔离 | 数据库存储，跨设备 |
| 并发控制 | 无 | 可限流、排队 |
| 监控分析 | 无 | 可记录使用数据 |
| 扩展性 | 受限 | 可接入更多功能 |

### 6.2 可扩展功能

1. **RAG 增强**：接入知识库，让导师有更专业的背景知识
2. **学习进度追踪**：记录用户的学习路径和薄弱点
3. **自适应难度**：根据历史回答自动调整问题难度
4. **多模态支持**：支持图片、语音输入
5. **协作学习**：多用户同时学习同一主题

---

## 七、总结

### 核心设计思想
1. **苏格拉底式教学**：通过提问引导思考，而非直接给答案
2. **双Agent协作**：主AI负责教学，选项AI负责预测回答
3. **降低输入负担**：预设回答选项，点击即可交互
4. **强迫思考机制**：延迟揭示答案，鼓励先思考

### LangChain 实现要点
1. **流式解析**：自定义 Parser 处理标签格式
2. **并行请求**：每个问题独立触发选项生成
3. **状态管理**：LangGraph 管理对话流程
4. **SSE 通信**：实时推送流式响应

### 迁移收益
- 更安全的 API Key 管理
- 更强大的扩展能力
- 更好的数据分析基础
- 更灵活的模型切换
