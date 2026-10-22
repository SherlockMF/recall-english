import { useEffect, useRef, useState } from 'react'
import type { StudyTimeEntry } from '../domain/types'
import { StudyClock } from './studyTime'

export type StudyTimerApi = ReturnType<typeof useStudyTimer>

interface TimerInput {
  sessionId: string
  entries?: StudyTimeEntry[]
  enabled: boolean
  save?: (entry: StudyTimeEntry) => Promise<void>
}

export function useStudyTimer({ sessionId, entries, enabled, save }: TimerInput) {
  const clockRef = useRef<StudyClock | null>(null)
  if (!clockRef.current) clockRef.current = new StudyClock(sessionId, entries)
  const clock = clockRef.current
  const initialTotal = useRef(clock.totalMs)
  const enabledRef = useRef(enabled)
  const committedEnabledRef = useRef<boolean | undefined>(undefined)
  const saveRef = useRef(save)
  const errorRef = useRef(false)
  const mounted = useRef(true)
  const focused = useRef(document.hasFocus())
  const saved = useRef(new Map<string, number>())
  const saving = useRef<Promise<boolean> | null>(null)
  // Elapsed time lives outside React state: it changes every 250ms, and
  // pushing it through setState would re-render the whole session tree.
  // The clock leaf components subscribe via subscribeElapsed instead.
  const elapsedRef = useRef(0)
  const elapsedListeners = useRef(new Set<() => void>())
  const [idle, setIdle] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function isEnabled() { return enabledRef.current && !errorRef.current && focused.current && document.visibilityState === 'visible' }
  function notifyElapsed() {
    for (const listener of elapsedListeners.current) listener()
  }
  function getElapsed(): number {
    return elapsedRef.current
  }
  function subscribeElapsed(listener: () => void): () => void {
    elapsedListeners.current.add(listener)
    return () => {
      elapsedListeners.current.delete(listener)
    }
  }
  function sample() {
    const total = clock.sample(Date.now(), performance.now(), isEnabled())
    const elapsed = total - initialTotal.current
    if (mounted.current) {
      if (elapsedRef.current !== elapsed) {
        elapsedRef.current = elapsed
        notifyElapsed()
      }
      setIdle(clock.idle)
    }
    return elapsed
  }

  async function flush(): Promise<boolean> {
    sample()
    if (saving.current) await saving.current
    const snapshot = clock.entries().filter((entry) => saved.current.get(entry.id) !== entry.activeMs)
    if (!saveRef.current || snapshot.length === 0) return !errorRef.current
    const work = (async () => {
      try {
        for (const entry of snapshot) {
          await saveRef.current!(entry)
          saved.current.set(entry.id, entry.activeMs)
        }
        errorRef.current = false
        if (mounted.current) setError(null)
        sample()
        return true
      } catch (cause) {
        sample()
        errorRef.current = true
        clock.sample(Date.now(), performance.now(), false)
        if (mounted.current) setError(cause instanceof Error ? cause.message : '学习时间保存失败')
        return false
      }
    })()
    saving.current = work
    const result = await work
    if (saving.current === work) saving.current = null
    return result
  }

  function setRunning(next: boolean) {
    enabledRef.current = next
    sample()
  }

  useEffect(() => {
    saveRef.current = save
    // React may batch a blocking state on/off into one commit. Reconcile the
    // immediate stop with each committed UI state even if `enabled` is unchanged.
    if (enabledRef.current !== enabled) setRunning(enabled)
    if (!enabled && committedEnabledRef.current !== enabled) void flush()
    committedEnabledRef.current = enabled
  })

  useEffect(() => {
    mounted.current = true
    sample()
    let lastCheckpoint = performance.now()
    const tick = window.setInterval(() => {
      const wasIdle = clock.idle
      sample()
      if ((!wasIdle && clock.idle) || performance.now() - lastCheckpoint >= 5_000) {
        lastCheckpoint = performance.now()
        if (!errorRef.current) void flush()
      }
    }, 250)
    const interact = () => {
      clock.interact(Date.now(), performance.now(), isEnabled())
      if (mounted.current) setIdle(false)
    }
    const visibility = () => { sample(); void flush() }
    const focus = () => { focused.current = true; interact(); sample() }
    const blur = () => { focused.current = false; sample(); void flush() }
    const pagehide = () => { enabledRef.current = false; sample(); void flush() }
    window.addEventListener('keydown', interact)
    window.addEventListener('pointerdown', interact)
    window.addEventListener('input', interact)
    window.addEventListener('focus', focus)
    window.addEventListener('blur', blur)
    window.addEventListener('pagehide', pagehide)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      enabledRef.current = false
      sample()
      mounted.current = false
      void flush()
      window.clearInterval(tick)
      window.removeEventListener('keydown', interact)
      window.removeEventListener('pointerdown', interact)
      window.removeEventListener('input', interact)
      window.removeEventListener('focus', focus)
      window.removeEventListener('blur', blur)
      window.removeEventListener('pagehide', pagehide)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [])

  return {
    elapsedMs: elapsedRef.current,
    idle,
    error,
    sample,
    flush,
    setRunning,
    getElapsed,
    subscribeElapsed,
  }
}
