import { useCallback, useEffect, useState } from 'react'
import { asRecord } from './transcript'
import { apiFetch } from '../apiFetch'

export interface VoiceConfig { configured: boolean; model: string; maxSeconds: null }
export const VOICE_CONFIG_CHANGED_EVENT = 'recall-voice-config-changed'

export function useVoiceConfig(enabled = true) {
  const [config, setConfig] = useState<VoiceConfig | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const reload = useCallback(() => { setConfig(null); setError(''); setRevision((value) => value + 1) }, [])
  useEffect(() => {
    window.addEventListener(VOICE_CONFIG_CHANGED_EVENT, reload)
    return () => window.removeEventListener(VOICE_CONFIG_CHANGED_EVENT, reload)
  }, [reload])
  useEffect(() => {
    if (!enabled) return
    let disposed = false
    const controller = new AbortController()
    const timeout = setTimeout(() => {
      setError('读取语音服务状态超时，请检查本地服务后重试。')
      controller.abort()
    }, 10_000)
    async function load() {
      try {
        const response = await apiFetch(`/api/voice/config?check=${revision}`, { signal: controller.signal, cache: 'no-store' })
        if (!response.ok) throw new Error('无法读取本机语音服务状态。')
        const payload = asRecord(await response.json())
        if (typeof payload.configured !== 'boolean' || typeof payload.model !== 'string' || payload.maxSeconds !== null) throw new Error('语音服务状态无效，请更新并重启本地服务。')
        if (!controller.signal.aborted) setConfig(payload as unknown as VoiceConfig)
      } catch (cause) {
        if (!disposed && !controller.signal.aborted) setError(cause instanceof Error ? cause.message : '无法读取语音服务状态。')
      } finally { clearTimeout(timeout) }
    }
    void load()
    return () => { disposed = true; clearTimeout(timeout); controller.abort() }
  }, [revision, enabled])
  return { config, error, reload }
}
