import './App.css'
import AgentChatPage from './pages/AgentChatPage/AgentChatPage'
import DesignPreview from './pages/DesignPreview/DesignPreview'

function App() {
  // 隐藏路径 /design：设计预览页
  const isDesignPreview =
    typeof window !== 'undefined' && window.location.pathname === '/design'

  return (
    <div className="App">{isDesignPreview ? <DesignPreview /> : <AgentChatPage />}</div>
  )
}

export default App
