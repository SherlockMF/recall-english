import { useState } from 'react'
import type { SaveVoiceExpression as SaveAction, VoiceExpressionDraft } from '../lib/voice/review'

export function SaveVoiceExpression({ draft, onSave }: { draft: VoiceExpressionDraft; onSave?: SaveAction }) {
  const [open, setOpen] = useState(false)
  const [expression, setExpression] = useState(draft.expression)
  const [meaning, setMeaning] = useState(draft.meaning)
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState('')
  if (!onSave) return null
  if (state === 'saved') return <p className="form-note" role="status">已加入优先学习，可在词库查看。新表达按每日数量安排；已有进度保持不变。已暂停或标记为已会的词，需在词库重新启用。</p>
  if (!open) return <button type="button" className="mini-text-button" onClick={() => setOpen(true)}>加入复习</button>
  return <form className="voice-save-form" onSubmit={async event => {
    event.preventDefault(); setState('saving'); setError('')
    try { await onSave({ ...draft, expression, meaning }); setState('saved') }
    catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败，请重试。'); setState('idle') }
  }}>
    <label>英文表达<input aria-label="要复习的英文表达" maxLength={1000} required value={expression} disabled={state === 'saving'} onChange={event => setExpression(event.target.value)} /></label>
    <label>中文意思<input aria-label="表达的中文意思" maxLength={500} required placeholder="请确认实际含义，不要填写语法说明" value={meaning} disabled={state === 'saving'} onChange={event => setMeaning(event.target.value)} /></label>
    <p className="form-note">AI 建议可能有误，确认后保存。仅保存选中的文字与纠错说明，不保存录音，也不计为已掌握。</p>
    <div className="backup-actions"><button className="primary-button" type="submit" disabled={state === 'saving' || !expression.trim() || !meaning.trim()}>{state === 'saving' ? '正在保存…' : '确认加入复习'}</button><button className="mini-text-button" type="button" disabled={state === 'saving'} onClick={() => setOpen(false)}>取消</button></div>
    {error && <p role="alert">{error}</p>}
  </form>
}
