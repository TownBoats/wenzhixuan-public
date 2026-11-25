import { createRoot } from 'react-dom/client'
import { StrictMode } from 'react'
import 'katex/dist/katex.min.css'
import './index.css'
import App from './App.jsx'

import './i18n'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
