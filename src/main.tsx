import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastHost } from './components/ToastHost'
import './styles.css'
import { isCloudEnabled } from './lib/cloud/config'

const CloudApp = lazy(() => import('./components/CloudApp').then(module => ({ default: module.CloudApp })))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Suspense fallback={<div className="loading-screen" role="status">正在打开学习页面…</div>}>
        {isCloudEnabled() ? <CloudApp /> : <App />}
      </Suspense>
      <ToastHost />
    </ErrorBoundary>
  </StrictMode>,
)
