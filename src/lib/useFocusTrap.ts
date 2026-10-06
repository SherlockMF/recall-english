import { useEffect, type RefObject } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

/**
 * Traps Tab focus inside the referenced dialog while it is mounted and
 * returns focus to the previously focused element on unmount.
 */
export function useFocusTrap(dialogRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null

    function focusableItems(): HTMLElement[] {
      return Array.from(dialog!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    }

    focusableItems()[0]?.focus()

    function handleKey(event: KeyboardEvent) {
      if (event.key !== 'Tab') return
      const items = focusableItems()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      const inside = active !== null && dialog!.contains(active)
      if (event.shiftKey) {
        if (active === first || !inside) {
          event.preventDefault()
          last.focus()
        }
      } else if (active === last || !inside) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handleKey, true)
    return () => {
      window.removeEventListener('keydown', handleKey, true)
      previouslyFocused?.focus()
    }
  }, [dialogRef])
}
