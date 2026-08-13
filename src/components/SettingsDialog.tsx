import { useRef, useState } from 'react'
import type { SpeechAccent, UserSettings } from '../domain/types'
import {
  clearDeepseekApiKey,
  getDeepseekApiKey,
  setDeepseekApiKey,
} from '../lib/llm/config'
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
  const [newItems, setNewItems] = useState(settings.newItemsPerDay)
  const [speechAccent, setSpeechAccent] = useState<SpeechAccent>(settings.speechAccent)
  const [apiKey, setApiKey] = useState(() => getDeepseekApiKey())
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [persistentState, setPersistentState] = useState<'idle' | 'granted' | 'unavailable'>('idle')
  const backupFileRef = useRef<HTMLInputElement>(null)
  const vocabularyFileRef = useRef<HTMLInputElement>(null)

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
            <p>核心训练固定为 15 分钟。系统会根据真实回忆率，在你的范围内减少新内容。</p>
          </div>
          <label className="range-setting">
            <span><strong>每天最多 {newItems} 个新表达</strong><small>可选范围 3–8</small></span>
            <input aria-label="每天最多的新表达" max="8" min="3" onChange={(event) => setNewItems(Number(event.target.value))} type="range" value={newItems} />
            <div><span>3</span><span>稳步</span><span>8</span></div>
          </label>
          <div className="retention-setting">
            <span><Icon name="brain" size={20} /></span>
            <div><strong>目标保持率 90%</strong><p>FSRS 会把容易忘的内容安排得更近，不需要手动调间隔。</p></div>
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
            <p>可选。用于语义判分、提示、造题与词条补全。Key 只存在本机，不会进入备份；未配置时自动使用本地规则。</p>
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
            <button className="secondary-button" onClick={() => void onExportVocabulary()} type="button"><Icon name="download" size={18} /> 导出词库</button>
            <button className="secondary-button" onClick={() => vocabularyFileRef.current?.click()} type="button"><Icon name="upload" size={18} /> 导入词库</button>
            <input
              accept="application/json,.json"
              className="sr-only"
              onChange={async (event) => {
                const file = event.target.files?.[0]
                if (!file) return
                if (!window.confirm('导入词库会合并到当前词库，不会替换学习进度。确认继续吗？')) {
                  event.target.value = ''
                  return
                }
                const result = await onImportVocabulary(await file.text())
                setMessage(result.message)
                event.target.value = ''
              }}
              ref={vocabularyFileRef}
              type="file"
            />
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-copy">
            <h3>学习备份</h3>
            <p>{vocabularyCount} 个义项 · {attemptCount} 次真实回忆。导出含词条、进度与设置；导入会整库替换。数据只保存在这个浏览器中。</p>
          </div>
          <div className="backup-actions">
            <button className="secondary-button" onClick={() => void onExport()} type="button"><Icon name="download" size={18} /> 导出学习备份</button>
            <button className="secondary-button" onClick={() => backupFileRef.current?.click()} type="button"><Icon name="upload" size={18} /> 导入学习备份</button>
            <input
              accept="application/json,.json"
              className="sr-only"
              onChange={async (event) => {
                const file = event.target.files?.[0]
                if (!file) return
                if (!window.confirm('导入会用备份中的进度替换当前本地数据。确认继续吗？')) {
                  event.target.value = ''
                  return
                }
                const result = await onImport(await file.text())
                setMessage(result.message)
                event.target.value = ''
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
              setSaving(true)
              setMessage('')
              try {
                if (apiKey.trim()) setDeepseekApiKey(apiKey)
                else clearDeepseekApiKey()
                await onSave({ ...settings, newItemsPerDay: newItems, speechAccent })
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
