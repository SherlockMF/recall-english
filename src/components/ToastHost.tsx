import { useSyncExternalStore } from 'react'

import { dismissToast, getToastSnapshot, subscribeToasts } from '../lib/toast'

/** Renders the global toast queue; mount once, next to the app root. */
export function ToastHost() {
  const toasts = useSyncExternalStore(subscribeToasts, getToastSnapshot)
  if (toasts.length === 0) return null
  return (
    <div aria-live="polite" className="toast-host" role="status">
      {toasts.map((toast) => (
        <button
          className={`toast toast-${toast.kind}`}
          key={toast.id}
          onClick={() => dismissToast(toast.id)}
          type="button"
        >
          {toast.text}
        </button>
      ))}
    </div>
  )
}
