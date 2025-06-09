import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './styles/controls.css'
import { Logger } from './logging/logger'
import { LoggerProvider } from './logging/context'

// Initialize root logger
const rootLogger = new Logger({ component: 'Root' });

// Log the API base URL that the frontend will use
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
console.log(`Frontend starting up - API Base URL: ${API_BASE_URL}`);
console.log(`Full API URL: ${API_BASE_URL}/api/v1`);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LoggerProvider value={rootLogger}>
      <App />
    </LoggerProvider>
  </React.StrictMode>,
)
