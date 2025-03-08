import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Logger } from './logging/logger'
import { LoggerProvider } from './logging/context'

// Initialize root logger
const rootLogger = new Logger({ component: 'Root' });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LoggerProvider value={rootLogger}>
      <App />
    </LoggerProvider>
  </StrictMode>,
)
