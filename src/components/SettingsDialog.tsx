import { useEffect, useRef, useState } from 'react'
import type { SpeechAccent, UserSettings } from '../domain/types'
import {
  clearDeepseekApiKey,
  getDeepseekApiKey,
  setDeepseekApiKey,
} from '../lib/llm/config'
import { useEscapeToClose } from '../lib/useEscapeToClose'
import { Icon } from './Icon'

interface SettingsDialogProps {
  settings: UserSettings
  vocabularyCount: number
  attemptCount: number
  onClose: () => void
  onSave: (settings: UserSettings) => Promise<void>
  onExport: () => Promise<void>
  onImport: (content: string) => Promise<{ ok: boolean; message: string }>
  onExportVocabulary: () => Promise<void>
  onImportVocabulary: (content: string) => Promise<{ ok: boolean; message: string }>
}

export function SettingsDialog({
  settings,
  vocabularyCount,
  attemptCount,
  onClose,
  onSave,
  onExport,
  onImport,
  onExportVocabulary,
  onImportVocabulary,
}: SettingsDialogProps) {
  const [newItems, setNewItems] = useState(String(settings.newItemsPerDay))
  const [dailyMinutes, setDailyMinutes] = useState(String(settings.dailyMinutes ?? settings.coreMinutes))
  const [speechAccent, setSpeechAccent] = useState<SpeechAccent>(settings.speechAccent)
  const [apiKey, setApiKey] = useState(() => getDeepseekApiKey())
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [backupBusy, setBackupBusy] = useState(false)
  const [persistentState, setPersistentState] = useState<'idle' | 'granted' | 'unavailable'>('idle')
  const backupFileRef = useRef<HTMLInputElement>(null)
  const vocabularyFileRef = useRef<HTMLInputElement>(null)

  useEscapeToClose(onClose)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    setDailyMinutes(String(settings.dailyMinutes ?? settings.coreMinutes))
    setNewItems(String(settings.newItemsPerDay))
    setSpeechAccent(settings.speechAccent)
  }, [settings.dailyMinutes, settings.coreMinutes, settings.newItemsPerDay, settings.speechAccent])

  async function runBackupAction(action: () => Promise<void>) {
    setBackupBusy(true)
    setMessage('')
    try {
      await action()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '操作失败，请重试。')
    } finally {
      setBackupBusy(false)
    }
  }

  async function importFromFile(file: File, importAction: (content: string) => Promise<{ ok: boolean; message: string }>) {
    setBackupBusy(true)
    setMessage('')
    try {
      const result = await importAction(await file.text())
      setMessage(result.message)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '导入失败，请重试。')
    } finally {
      setBackupBusy(false)
    }
  }

  async function requestPersistentStorage() {
    if (!navigator.storage?.persist) {
      setPersistentState('unavailable')
      return
    }
    const granted = await navigator.storage.persist()
    setPersistentState(granted ? 'granted' : 'unavailable')
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target) onClose()
    }}>
      <section aria-labelledby="settings-title" aria-modal="true" className="dialog-card settings-dialog" role="dialog">
        <div className="dialog-heading">
          <div><p className="eyebrow">LOCAL & PRIVATE</p><h2 id="settings-title">学习设置</h2></div>
          <button aria-label="关闭设置" className="icon-button" onClick={onClose} type="button"><Icon name="close" size={20} /></button>
        </div>

        <div className="settings-section">
          <div className="settings-copy">
            <h3>每日节奏</h3>
            <p>回忆与应用共用当天时间，可分多次完成。先复习，再根据剩余时间与延迟回忆表现安排新表达。</p>
          </div>
          <label className="text-setting">
            <span>每日学习分钟 <small>5—120 分钟</small></span>
            <input aria-label="每日学习分钟" type="number" min="5" max="120" step="1" value={dailyMinutes} onChange={(event) => setDailyMinutes(event.target.value)} />
          </label>
          <label className="text-setting">
            <span>每日新表达上限 <small>0—100 个；0 表示只复习</small></span>
            <input aria-label="每日新表达上限" type="number" min="0" max="100" step="1" value={newItems} onChange={(event) => setNewItems(event.target.value)} />
          </label>
          <div className="retention-setting">
            <span><Icon name="brain" size={20} /></span>
            <div><strong>目标保持率 {Math.round(settings.desiredRetention * 100)}%</strong><p>这是 FSRS 安排复习的目标，不代表已经达到的掌握程度。</p></div>
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-copy">
            <h3>发音口音</h3>
            <p>练习反馈与「再听一次」默认使用的口音。词库页仍可临时切换 UK / US。</p>
          </div>
          <div className="accent-toggle" role="group" aria-label="默认发音口音">
            <button
              aria-pressed={speechAccent === 'uk'}
              className={`mini-text-button${speechAccent === 'uk' ? ' is-active' : ''}`}
              onClick={() => setSpeechAccent('uk')}
              type="button"
            >
              UK 英式
            </button>
            <button
              aria-pressed={speechAccent === 'us'}
              className={`mini-text-button${speechAccent === 'us' ? ' is-active' : ''}`}
              onClick={() => setSpeechAccent('us')}
              type="button"
            >
              US 美式
            </button>
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-copy">
            <h3>DeepSeek 辅助</h3>
            <p>可选。用于语义判分、提示、造题与词条补全；开放造句需主动点击 AI 验证。Key 只存在本机，不会进入备份；未验证的造句不会计为已通过。</p>
          </div>
          <label className="text-setting">
            <span>API Key</span>
            <input
              autoComplete="off"
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="sk-..."
              type="password"
              value={apiKey}
            />
          </label>
          <button
            className="secondary-button"
            onClick={() => {
              clearDeepseekApiKey()
              setApiKey('')
              setMessage('已清除 DeepSeek API Key。')
            }}
            type="button"
          >
            清除 API Key
          </button>
        </div>

        <div className="settings-section">
          <div className="settings-copy">
            <h3>词库</h3>
            <p>导出/导入全部义项（内置种子 + 词典/手动录入）及分类归属。导入为合并，不覆盖学习进度。</p>
          </div>
          <div className="backup-actions">
            <button className="secondary-button" disabled={backupBusy} onClick={() => void runBackupAction(onExportVocabulary)} type="button"><Icon name="download" size={18} /> 导出词库</button>
            <button className="secondary-button" disabled={backupBusy} onClick={() => vocabularyFileRef.current?.click()} type="button"><Icon name="upload" size={18} /> 导入词库</button>
            <input
              accept="application/json,.json"
              className="sr-only"
              onChange={async (event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (!file) return
                if (!window.confirm('导入词库会合并到当前词库，不会替换学习进度。确认继续吗？')) return
                await importFromFile(file, onImportVocabulary)
              }}
              ref={vocabularyFileRef}
              type="file"
            />
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-copy">
            <h3>学习备份</h3>
            <p>{vocabularyCount} 个义项 · {attemptCount} 次作答。导出含词条、进度、证据、学习计时与设置；导入会整库替换。数据只保存在这个浏览器中。</p>
          </div>
          <div className="backup-actions">
            <button className="secondary-button" disabled={backupBusy} onClick={() => void runBackupAction(onExport)} type="button"><Icon name="download" size={18} /> 导出学习备份</button>
            <button className="secondary-button" disabled={backupBusy} onClick={() => backupFileRef.current?.click()} type="button"><Icon name="upload" size={18} /> 导入学习备份</button>
            <input
              accept="application/json,.json"
              className="sr-only"
              onChange={async (event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (!file) return
                if (!window.confirm('导入会用备份中的进度替换当前本地数据。确认继续吗？')) return
                await importFromFile(file, onImport)
              }}
              ref={backupFileRef}
              type="file"
            />
          </div>
          <button className="storage-persist-button" onClick={() => void requestPersistentStorage()} type="button">
            <Icon name="check" size={17} />
            {persistentState === 'granted'
              ? '浏览器已允许持久保存'
              : persistentState === 'unavailable'
                ? '浏览器未授予持久保存，请定期导出'
                : '请求浏览器持久保存本地数据'}
          </button>
        </div>

        {message && <div className="inline-alert">{message}</div>}

        <div className="dialog-actions">
          <button className="secondary-button" onClick={onClose} type="button">取消</button>
          <button
            className="primary-button"
            disabled={saving}
            onClick={async () => {
              const minutes = Number(dailyMinutes)
              const limit = Number(newItems)
              if (!dailyMinutes.trim() || !newItems.trim() || !Number.isInteger(minutes) || minutes < 5 || minutes > 120 || !Number.isInteger(limit) || limit < 0 || limit > 100) {
                setMessage('学习时长须为 5—120 的整数，新表达上限须为 0—100 的整数。')
                return
              }
              setSaving(true)
              setMessage('')
              try {
                if (apiKey.trim()) setDeepseekApiKey(apiKey)
                else clearDeepseekApiKey()
                await onSave({ ...settings, dailyMinutes: minutes, newItemsPerDay: limit, speechAccent })
                onClose()
              } catch (error) {
                setMessage(error instanceof Error ? error.message : '保存设置失败，请重试。')
              } finally {
                setSaving(false)
              }
            }}
            type="button"
          >
            保存设置
          </button>
        </div>
      </section>
    </div>
  )
}
