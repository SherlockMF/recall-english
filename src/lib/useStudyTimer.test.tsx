import { useState } from 'react'
import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useStudyTimer } from './useStudyTimer'

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

it('reconciles a synchronous stop when React batches a quick grading transition back to enabled', async () => {
  vi.useFakeTimers()
  vi.spyOn(document, 'hasFocus').mockReturnValue(true)
  const { result } = renderHook(() => {
    const [grading, setGrading] = useState(false)
    const [feedback, setFeedback] = useState(false)
    const timer = useStudyTimer({ sessionId: 'quick-grade', enabled: !grading })
    async function grade() {
      setGrading(true)
      timer.setRunning(false)
      await Promise.resolve()
      setFeedback(true)
      setGrading(false)
    }
    return { timer, grade, feedback }
  })
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
  await act(async () => { await result.current.grade() })
  expect(result.current.feedback).toBe(true)
  await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
  expect(result.current.timer.getElapsed()).toBe(45_000)
})
