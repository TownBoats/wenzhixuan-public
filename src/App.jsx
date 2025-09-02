import { useState } from 'react'
import './App.css'
import ChatPage from './pages/ChatPage/ChatPage'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="App">
      <ChatPage />
    </div>
  )
}

export default App
