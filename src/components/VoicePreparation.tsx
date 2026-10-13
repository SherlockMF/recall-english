import { useMemo, useState } from 'react'
import type { VocabularyItem } from '../domain/types'
import { MAX_SCENARIO_DESCRIPTION, VOICE_SCENARIOS, type VoiceDifficulty, type VoiceScenario } from '../lib/voice/scenarios'
import { Icon } from './Icon'

export interface VoiceSelection { scenario: VoiceScenario; descriptions: Partial<Record<VoiceScenario, string>>; difficulty: VoiceDifficulty; selectedIds: string[] }
export const DEFAULT_VOICE_SELECTION: VoiceSelection = { scenario: 'daily', descriptions: {}, difficulty: 'basic', selectedIds: [] }
export interface VoicePreparationProps { items: VocabularyItem[]; selection: VoiceSelection; onSelection: (value: VoiceSelection) => void }

export function VoicePreparation({ items, selection, onSelection, active, serviceState, messages = false, onReload }: VoicePreparationProps & { active: boolean; serviceState: string; messages?: boolean; onReload?: () => void }) {
  const [query, setQuery] = useState('')
  const scenario = VOICE_SCENARIOS.find((item) => item.id === selection.scenario) ?? VOICE_SCENARIOS[0]
  const description = selection.descriptions[selection.scenario] ?? ''
  const selectedWords = useMemo(() => items.filter((item) => selection.selectedIds.includes(item.id)), [items, selection.selectedIds])
  const matches = useMemo(() => {
    const text = query.trim().toLowerCase()
    return text ? items.filter((item) => item.status === 'active' && !selection.selectedIds.includes(item.id) && `${item.expression} ${item.zhGloss}`.toLowerCase().includes(text)).slice(0, 8) : []
  }, [items, query, selection.selectedIds])
  return <aside className="voice-preparation" aria-label="练习设置">
    <p className="eyebrow">01 / 选择场景类型</p>
    <div className="voice-scenarios">{VOICE_SCENARIOS.map((item) => <button aria-pressed={selection.scenario === item.id} className={`voice-scenario ${selection.scenario === item.id ? 'is-active' : ''}`} disabled={active} onClick={() => onSelection({ ...selection, scenario: item.id })} key={item.id} type="button"><strong>{item.label}</strong><span>{item.example}</span></button>)}</div>
    <label className="voice-field"><span>场景说明 <small>可选 · {description.length}/{MAX_SCENARIO_DESCRIPTION}</small></span><textarea rows={4} disabled={active} maxLength={MAX_SCENARIO_DESCRIPTION} value={description} aria-describedby="voice-scene-help" placeholder={scenario.placeholder} onChange={(event) => onSelection({ ...selection, descriptions: { ...selection.descriptions, [selection.scenario]: event.target.value.slice(0, MAX_SCENARIO_DESCRIPTION) } })} /></label>
    <p className="voice-scene-help" id="voice-scene-help">{selection.scenario === 'custom' ? '话题、角色和背景都由你决定；留空时自由聊天。' : '上面只是示例。写下地点、双方角色和想练的内容，AI 会据此调整；留空时围绕这类话题聊天。'}开始后如需修改，请先结束练习。</p>
    <label className="voice-field"><span>对话难度</span><select disabled={active} value={selection.difficulty} onChange={(event) => onSelection({ ...selection, difficulty: event.target.value as VoiceDifficulty })}><option value="basic">基础 · 简短句子，慢慢说</option><option value="advanced">进阶 · 自然表达，继续追问</option></select></label>
    <label className="voice-field"><span>带上想练的词 <small>可选，最多 3 个</small></span><input disabled={active || selectedWords.length >= 3} onChange={(event) => setQuery(event.target.value)} placeholder="搜索英文或中文释义" value={query} /></label>
    {matches.length > 0 && <ul className="voice-word-matches">{matches.map((word) => <li key={word.id}><button disabled={active || selectedWords.length >= 3} onClick={() => { onSelection({ ...selection, selectedIds: [...selection.selectedIds, word.id].slice(0, 3) }); setQuery('') }} type="button">{word.expression}<small>{word.zhGloss}</small></button></li>)}</ul>}
    <div>{selectedWords.map((word) => <button className="voice-word-chip" disabled={active} key={word.id} onClick={() => onSelection({ ...selection, selectedIds: selection.selectedIds.filter((id) => id !== word.id) })} type="button" aria-label={`移除 ${word.expression}`}>{word.expression}<Icon name="close" size={13} /></button>)}</div>
    <div className="voice-service-state" role="status">{serviceState}</div>
    {onReload && <button className="mini-text-button" disabled={active} onClick={onReload} type="button">重新检查</button>}
    <p className="voice-privacy">{messages ? '录好并发送后，语音才会传给千问。录音仅在当前页面保留，离开或刷新后清理。' : '开始后麦克风音频会发送到千问。静音时不采集发言；结束后释放麦克风。'}</p>
  </aside>
}
