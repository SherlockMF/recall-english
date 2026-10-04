import { useEffect, useRef, useState } from 'react'
import type { StudyTimeEntry } from '../domain/types'
import { StudyClock } from './studyTime'

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
  saveRef.current = save
  const errorRef = useRef(false)
  const mounted = useRef(true)
  const focused = useRef(document.hasFocus())
  const saved = useRef(new Map<string, number>())
  const saving = useRef<Promise<boolean> | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [idle, setIdle] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function isEnabled() { return enabledRef.current && !errorRef.current && focused.current && document.visibilityState === 'visible' }
  function sample() {
    const total = clock.sample(Date.now(), performance.now(), isEnabled())
    if (mounted.current) {
      setElapsedMs(total - initialTotal.current)
      setIdle(clock.idle)
    }
    return total - initialTotal.current
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

  return { elapsedMs, idle, error, sample, flush, setRunning }
}
