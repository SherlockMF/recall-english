import type { VoiceFeedback } from '../lib/voice/feedback'
import type { SaveVoiceExpression as SaveAction } from '../lib/voice/review'
import { SaveVoiceExpression } from './SaveVoiceExpression'

export function VoiceFeedbackReview({ feedback, onSave }: { feedback: VoiceFeedback; onSave?: SaveAction }) {
  return <div className="voice-feedback"><p>{feedback.summaryZh}</p>
    {feedback.corrections.length === 0 && <p>本次没有列出明确的表达错误。</p>}
    {feedback.corrections.map(row => <div className="voice-correction" key={`${row.original}:${row.improved}`}><p className="voice-original">{row.original}</p><p><strong>{row.improved}</strong></p><small>{row.explanationZh}</small><SaveVoiceExpression onSave={onSave} draft={{ expression: row.improved, meaning: '', original: row.original, note: row.explanationZh }} /></div>)}
    {feedback.expressions.length > 0 && <div className="voice-useful-expressions">{feedback.expressions.map(row => <div key={row.en}><strong>{row.en}</strong><span>{row.zh}</span><SaveVoiceExpression onSave={onSave} draft={{ expression: row.en, meaning: row.zh }} /></div>)}</div>}
  </div>
}
