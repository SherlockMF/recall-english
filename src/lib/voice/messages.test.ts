import { afterEach, describe, expect, it, vi } from 'vitest'
import { VoiceMessageSession } from './messages'

afterEach(() => vi.unstubAllGlobals())
describe('voice message transport', () => {
  it('reuses a session and the message ID for an explicit retry, then closes it', async () => {
    const request = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ id: 'session-1', maxSeconds: null })))
      .mockRejectedValueOnce(new TypeError('network'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'm-1', userText: 'Coffee.', text: 'Sure.', audio: 'AAAAAA==', sampleRate: 24000, usage: {} })))
      .mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', request)
    const call = new VoiceMessageSession()
    await call.start('Practice ordering coffee.')
    await expect(call.send('m-1', new Uint8Array(32000))).rejects.toThrow()
    expect((await call.send('m-1', new Uint8Array(32000))).text).toBe('Sure.')
    expect(request.mock.calls[1][0]).toBe('/api/voice/messages/session-1/turns')
    expect(JSON.parse(request.mock.calls[1][1].body).id).toBe('m-1')
    expect(request.mock.calls[2][1].body).toBe(request.mock.calls[1][1].body)
    call.end()
    expect(request.mock.calls.at(-1)?.[1]).toMatchObject({ method: 'DELETE', keepalive: true })
  })
})
