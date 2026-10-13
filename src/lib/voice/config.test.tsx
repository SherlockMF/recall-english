import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useVoiceConfig, VOICE_CONFIG_CHANGED_EVENT } from './config'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers() })

it('refreshes every mounted consumer after settings change', async () => {
  let configured = false
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ configured, model: 'qwen3.8-omni-flash-realtime', maxSeconds: null }))))
  const first = renderHook(() => useVoiceConfig())
  const second = renderHook(() => useVoiceConfig())
  await waitFor(() => expect(first.result.current.config?.configured).toBe(false))
  await waitFor(() => expect(second.result.current.config?.configured).toBe(false))
  configured = true
  act(() => window.dispatchEvent(new Event(VOICE_CONFIG_CHANGED_EVENT)))
  await waitFor(() => expect(first.result.current.config?.configured).toBe(true))
  await waitFor(() => expect(second.result.current.config?.configured).toBe(true))
})

it('reports a timeout instead of staying in the loading state', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', vi.fn((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
  })))
  const { result } = renderHook(() => useVoiceConfig())
  await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
  expect(result.current.error).toContain('超时')
})
