import './App.css'
import ChatPage from './pages/ChatPage/ChatPage'
import AgentChatPage from './pages/AgentChatPage/AgentChatPage'
import DesignPreview from './pages/DesignPreview/DesignPreview'

function App() {
  // 隐藏路径 /design：渲染 P0/P1/P2 token 与组件预览页
  // 主应用走根路径，零影响
  const isDesignPreview =
    typeof window !== 'undefined' && window.location.pathname === '/design'

  // agent_runtime 运行时开关（F4 验收后默认开，`决策记录.md` F-6）：
  // 新 Agent 页面是默认路径；需要回旧路径时把该键设为 'false'。
  // 旧路径的清理排在投递之后（F-1 决策 2 倾向 A），本期保留这个回退开关。
  const useAgentRuntime =
    typeof window === 'undefined' || window.localStorage.getItem('agent_runtime') !== 'false'

  return (
    <div className="App">
      {isDesignPreview ? (
        <DesignPreview />
      ) : useAgentRuntime ? (
        <AgentChatPage />
      ) : (
        <ChatPage />
      )}
    </div>
  )
}

export default App
