export type ToastKind = 'info' | 'error'

export interface ToastMessage {
  id: number
  kind: ToastKind
  text: string
}

type ToastListener = (toasts: ToastMessage[]) => void

const TOAST_TIMEOUT_MS: Record<ToastKind, number> = { info: 3500, error: 6000 }

let toasts: ToastMessage[] = []
let nextId = 1
const listeners = new Set<ToastListener>()

function emit(): void {
  for (const listener of listeners) listener(toasts)
}

export function subscribeToasts(listener: ToastListener): () => void {
  listeners.add(listener)
  listener(toasts)
  return () => {
    listeners.delete(listener)
  }
}

/** Stable snapshot for useSyncExternalStore. */
export function getToastSnapshot(): ToastMessage[] {
  return toasts
}

export function showToast(text: string, kind: ToastKind = 'info'): void {
  const toast: ToastMessage = { id: nextId++, kind, text }
  toasts = [...toasts, toast]
  emit()
  window.setTimeout(() => dismissToast(toast.id), TOAST_TIMEOUT_MS[kind])
}

export function dismissToast(id: number): void {
  if (!toasts.some((toast) => toast.id === id)) return
  toasts = toasts.filter((toast) => toast.id !== id)
  emit()
}
