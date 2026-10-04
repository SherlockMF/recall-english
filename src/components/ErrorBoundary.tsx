import { Component, type ErrorInfo, type ReactNode } from 'react'

import { exportBackupJson } from '../lib/backup'
import { showToast } from '../lib/toast'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  message: string | undefined
}

/**
 * Top-level render guard: without it any render error blanks the page and the
 * user loses access to the backup export their local-only data depends on.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { message: undefined }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      message: error instanceof Error && error.message ? error.message : '页面发生意外错误。',
    }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error:', error, info.componentStack)
  }

  override render() {
    if (!this.state.message) return this.props.children
    return (
      <div className="loading-screen error-screen" role="alert">
        <span className="loading-mark">!</span>
        <strong>应用遇到了问题</strong>
        <p>{this.state.message}</p>
        <p>学习数据保存在本机浏览器中，刷新页面通常可以恢复；也可以先导出一份学习备份。</p>
        <div className="error-screen-actions">
          <button className="primary-button" onClick={() => window.location.reload()} type="button">
            刷新页面
          </button>
          <button className="secondary-button" onClick={() => void this.downloadBackup()} type="button">
            导出学习备份
          </button>
        </div>
      </div>
    )
  }

  private async downloadBackup() {
    try {
      const json = await exportBackupJson()
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `recall-english-recovery-${new Date().toISOString().slice(0, 10)}.json`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      showToast(
        error instanceof Error ? `导出失败：${error.message}` : '导出失败，请尝试刷新页面。',
        'error',
      )
    }
  }
}
