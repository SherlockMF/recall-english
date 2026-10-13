import { useEffect, useRef, useState } from 'react'
import { useVoiceConfig, VOICE_CONFIG_CHANGED_EVENT } from '../lib/voice/config'
import { asRecord } from '../lib/voice/transcript'
import { KeyStatusBadge, type KeyStatus } from './KeyStatusBadge'

export function VoiceServiceStatus() {
  const { config, error, reload } = useVoiceConfig()
  const [apiKey, setApiKey] = useState('')
  const [workspaceId, setWorkspaceId] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [updateFailed, setUpdateFailed] = useState(false)
  const keyStatus: KeyStatus = busy ? 'busy' : error || updateFailed ? 'error'
    : apiKey.trim() || workspaceId.trim() ? 'pending' : !config ? 'checking' : config.configured ? 'saved' : 'missing'
  const requestRef = useRef<AbortController | null>(null)
  useEffect(() => () => {
    const controller = requestRef.current
    requestRef.current = null
    controller?.abort()
  }, [])

  async function update(method: 'PUT' | 'DELETE') {
    if (busy || requestRef.current) return
    const controller = new AbortController()
    requestRef.current = controller
    setBusy(true)
    setMessage('')
    setUpdateFailed(false)
    const timeout = setTimeout(() => controller.abort(), 10_000)
    try {
      const response = await fetch('/api/voice/config', {
        method, signal: controller.signal,
        ...(method === 'PUT' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: apiKey.trim(), workspaceId: workspaceId.trim() }) } : {}),
      })
      const payload = asRecord(await response.json())
      if (!response.ok) {
        const detail = asRecord(payload.error).message
        throw new Error(typeof detail === 'string' ? detail : '无法更新口语配置，请重试。')
      }
      if (payload.configured !== (method === 'PUT') || payload.maxSeconds !== null) throw new Error('配置响应无效，请重新检查服务状态。')
      if (controller.signal.aborted || requestRef.current !== controller) return
      setApiKey('')
      setWorkspaceId('')
      setMessage(method === 'PUT' ? '已保存口语配置，下次连接时生效。' : '已清除口语配置。')
      window.dispatchEvent(new Event(VOICE_CONFIG_CHANGED_EVENT))
    } catch (cause) {
      if (requestRef.current === controller) {
        setUpdateFailed(true)
        setMessage(controller.signal.aborted ? '更新口语配置超时，请重新检查服务状态后重试。' : cause instanceof Error ? cause.message : '无法更新口语配置，请重试。')
      }
    } finally {
      clearTimeout(timeout)
      if (requestRef.current === controller) { setBusy(false); requestRef.current = null }
    }
  }

  return <form className="settings-section" aria-labelledby="voice-service-title" onSubmit={(event) => { event.preventDefault(); void update('PUT') }}>
    <div className="settings-copy">
      <div className="settings-service-heading"><h3 id="voice-service-title">千问口语陪练</h3><KeyStatusBadge service="千问" status={keyStatus} /></div>
      <p>实时语音使用百炼北京地域。Key 只保存在本机服务端，不会进入学习备份或分享包。</p>
      <p role="status">{error || (config ? config.configured ? '千问语音已配置' : '语音服务尚未配置' : '正在检查语音服务…')}</p>
    </div>
    <label className="text-setting"><span>API Key</span><input aria-label="千问 API Key" autoComplete="off" disabled={busy} maxLength={2048} onChange={(event) => { setApiKey(event.target.value); setUpdateFailed(false) }} placeholder={config?.configured ? '已保存；更换时输入新 Key' : 'sk-...'} required type="password" value={apiKey} /></label>
    <label className="text-setting"><span>北京业务空间 ID</span><input autoComplete="off" disabled={busy} maxLength={128} onChange={(event) => { setWorkspaceId(event.target.value); setUpdateFailed(false) }} placeholder="百炼控制台中的业务空间 ID" required type="text" value={workspaceId} /></label>
    <p className="voice-footnote">Key 和业务空间需属于北京地域，并具备千问实时语音模型权限。</p>
    <p className="key-status-help">已保存表示 Key 和业务空间已保留在本机；接口权限和网络是否可用以实际连接结果为准。</p>
    <div className="backup-actions">
      <button className="primary-button" disabled={busy || !apiKey.trim() || !workspaceId.trim()} type="submit">{busy ? '正在更新…' : '保存口语配置'}</button>
      <button className="secondary-button" disabled={busy} onClick={() => void update('DELETE')} type="button">清除口语配置</button>
      <button className="secondary-button" disabled={busy} onClick={() => { setUpdateFailed(false); setMessage(''); reload() }} type="button">重新检查语音服务</button>
    </div>
    {message && <p role="status" className="voice-notice">{message}</p>}
  </form>
}
