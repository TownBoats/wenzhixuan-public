
import { createRoot } from 'react-dom/client'
import { StrictMode } from 'react'
import './index.css'
import App from './App.jsx'

import './i18n'

createRoot(document.getElementById('root')).render(
    <App />
)
