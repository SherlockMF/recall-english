import { afterEach, expect, it, vi } from 'vitest'
import { apiFetch, setApiTokenProvider } from './apiFetch'

afterEach(() => { setApiTokenProvider(null); vi.unstubAllGlobals() })

it('adds a fresh account token without changing local-mode request headers', async () => {
  const request = vi.fn(async (_input: string, _options?: RequestInit) => new Response('{}'))
  vi.stubGlobal('fetch', request)
  await apiFetch('/api/voice/config')
  expect(request.mock.calls[0][1]).toBeUndefined()
  setApiTokenProvider(async () => 'test-session-token')
  await apiFetch('/api/voice/session', { method: 'POST', headers: { 'Content-Type': 'application/sdp' }, body: 'v=0' })
  const options = request.mock.calls[1][1] as RequestInit
  expect(new Headers(options.headers).get('Authorization')).toBe('Bearer test-session-token')
  expect(new Headers(options.headers).get('Content-Type')).toBe('application/sdp')
})

it('does not send authenticated requests without a session or to external URLs', async () => {
  const request = vi.fn()
  vi.stubGlobal('fetch', request)
  setApiTokenProvider(async () => null)
  await expect(apiFetch('/api/dictionary/example')).rejects.toThrow('登录')
  setApiTokenProvider(async () => 'test-session-token')
  await expect(apiFetch('https://other.example/api')).rejects.toThrow('同源')
  expect(request).not.toHaveBeenCalled()
})
