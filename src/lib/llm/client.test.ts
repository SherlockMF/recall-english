import { afterEach, describe, expect, it, vi } from 'vitest'
import { chatJson } from './client'
import { clearDeepseekApiKey, setDeepseekApiKey } from './config'

describe('chatJson', () => {
  afterEach(() => {
    clearDeepseekApiKey()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('posts to proxy with bearer key and returns parsed json content', async () => {
    setDeepseekApiKey('sk-test')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"ok":true,"value":1}' } }],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await chatJson({
      messages: [{ role: 'user', content: 'hi' }],
    })

    expect(result).toEqual({ ok: true, value: 1 })
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/deepseek/v1/chat/completions')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test')
    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(body.model).toBe('deepseek-v4-flash')
    expect(body.thinking).toEqual({ type: 'disabled' })
    expect(body.response_format).toEqual({ type: 'json_object' })
  })

  it('throws when api key is missing', async () => {
    await expect(chatJson({
      messages: [{ role: 'user', content: 'hi' }],
    })).rejects.toMatchObject({ code: 'missing-key' })
  })

  it('throws on non-ok response', async () => {
    setDeepseekApiKey('sk-test')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'bad key' } }),
    }))
    await expect(chatJson({
      messages: [{ role: 'user', content: 'hi' }],
    })).rejects.toMatchObject({ code: 'http', status: 401 })
  })
})
