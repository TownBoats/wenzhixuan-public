import './App.css'
import ChatPage from './pages/ChatPage/ChatPage'
import DesignPreview from './pages/DesignPreview/DesignPreview'

function App() {
  // 隐藏路径 /design：渲染 P0/P1/P2 token 与组件预览页
  // 主应用走根路径，零影响
  const isDesignPreview =
    typeof window !== 'undefined' && window.location.pathname === '/design'

  return (
    <div className="App">
      {isDesignPreview ? <DesignPreview /> : <ChatPage />}
    </div>
  )
}

export default App
