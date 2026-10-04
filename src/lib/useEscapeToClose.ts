import { useEffect } from 'react'

/** Calls onEscape when Escape is pressed while the caller is mounted. */
export function useEscapeToClose(onEscape: () => void): void {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onEscape()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onEscape])
}
