import './App.css'
import AgentChatPage from './pages/AgentChatPage/AgentChatPage'
import DesignPreview from './pages/DesignPreview/DesignPreview'

function App() {
  // 隐藏路径 /design：渲染 P0/P1/P2 token 与组件预览页
  // 主应用走根路径，零影响
  const isDesignPreview =
    typeof window !== 'undefined' && window.location.pathname === '/design'

  // `agent_runtime` 运行时开关已移除：新页面是唯一路径。
  // 旧路径（pages/ChatPage 等）代码仍留在仓库里、不再被引用，
  // 清理另行安排（原计划见 HANDOFF 第 3 节「投递后待办」）。
  return (
    <div className="App">{isDesignPreview ? <DesignPreview /> : <AgentChatPage />}</div>
  )
}

export default App
