import { asRecord } from './transcript'
import { toBase64 } from './audio'

export class VoiceMessageError extends Error {
  constructor(message: string, readonly sessionEnded: boolean) { super(message) }
}
export interface VoiceMessageReply { id: string; userText: string; text: string; audio: string; sampleRate: 24000; usage: Record<string, unknown> }
export class VoiceMessageSession {
  private id = ''
  private controller = new AbortController()
  private closed = false
  async start(instructions: string) {
    const result = await this.request('/api/voice/messages', { instructions }, 25000)
    if (typeof result.id !== 'string' || !/^[a-z\d-]{1,80}$/i.test(result.id)) throw new Error('语音消息连接信息无效。')
    this.id = result.id
    if (this.closed) this.remove()
  }
  async send(id: string, pcm: Uint8Array): Promise<VoiceMessageReply> {
    if (this.closed || !this.id) throw new Error('语音消息会话已结束，请重新开始。')
    const result = await this.request(`/api/voice/messages/${this.id}/turns`, { id, audio: toBase64(pcm) }, 55000)
    if (result.id !== id || typeof result.audio !== 'string' || result.audio.length < 4 || result.audio.length > 6 * 1024 * 1024 || !/^[A-Za-z0-9+/]*={0,2}$/.test(result.audio) || result.audio.length % 4 || atob(result.audio).length % 2 || result.sampleRate !== 24000 || typeof result.userText !== 'string' || typeof result.text !== 'string') throw new Error('AI 返回的语音消息无效，请重试。')
    return { ...result, usage: asRecord(result.usage) } as unknown as VoiceMessageReply
  }
  private async request(path: string, body: unknown, milliseconds: number) {
    const controller = new AbortController()
    const cancel = () => controller.abort()
    const timeout = setTimeout(cancel, milliseconds)
    this.controller.signal.addEventListener('abort', cancel, { once: true })
    if (this.closed) cancel()
    try {
      const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal })
      const value = asRecord(await response.json())
      if (!response.ok) throw new VoiceMessageError(typeof asRecord(value.error).message === 'string' ? String(asRecord(value.error).message) : '发送失败，请重试。', [410, 502].includes(response.status))
      return value
    } catch (error) {
      if (controller.signal.aborted) throw new Error(this.closed ? '本次语音消息练习已结束。' : '发送超时，录音已保留，可以重试发送。', { cause: error })
      if (error instanceof TypeError) throw new Error('网络连接失败，录音已保留，可以重试发送。', { cause: error })
      throw error
    } finally { clearTimeout(timeout); this.controller.signal.removeEventListener('abort', cancel) }
  }
  private remove() {
    if (this.id) void fetch(`/api/voice/messages/${this.id}`, { method: 'DELETE', keepalive: true }).catch(() => undefined)
    this.id = ''
  }
  end() { this.closed = true; this.controller.abort(); this.remove() }
}
