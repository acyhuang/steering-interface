import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './styles/controls.css'
import { Logger } from './logging/logger'
import { LoggerProvider } from './logging/context'

// Initialize root logger
const rootLogger = new Logger({ component: 'Root' });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LoggerProvider value={rootLogger}>
      <App />
    </LoggerProvider>
  </React.StrictMode>,
)
