export interface VoiceTurn {
  id: string
  role: 'user' | 'assistant'
  text: string
  final: boolean
  interrupted: boolean
  responseId?: string
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export function createTranscriptReducer() {
  const seen = new Set<string>()
  const interruptedResponses = new Set<string>()
  let activeResponseId: string | undefined
  return (turns: VoiceTurn[], value: unknown): VoiceTurn[] => {
    const event = asRecord(value)
    if (typeof event.event_id === 'string') {
      if (seen.has(event.event_id)) return turns
      seen.add(event.event_id)
    }
    if (event.type === 'response.created') {
      const response = asRecord(event.response)
      activeResponseId = typeof response.id === 'string' ? response.id : undefined
      return turns
    }
    if (event.type === 'input_audio_buffer.speech_started') {
      const last = turns.at(-1)
      if (activeResponseId) interruptedResponses.add(activeResponseId)
      if (last?.role === 'assistant' && !last.final && last.responseId) interruptedResponses.add(last.responseId)
      const interrupted = last?.role === 'assistant' && !last.final
        ? turns.map((turn) => turn.id === last.id ? { ...turn, interrupted: true } : turn)
        : turns
      if (typeof event.item_id !== 'string' || interrupted.some((turn) => turn.id === event.item_id)) return interrupted
      return [...interrupted, { id: event.item_id, role: 'user', text: '', final: false, interrupted: false }]
    }
    if (event.type === 'response.done') {
      const response = asRecord(event.response)
      if (response.id === activeResponseId) activeResponseId = undefined
      if (typeof response.id === 'string' && interruptedResponses.has(response.id)) return turns
      const outputs = Array.isArray(response.output) ? response.output : []
      let next = turns
      for (const output of outputs) {
        const item = asRecord(output)
        if (typeof item.id !== 'string' || item.role !== 'assistant') continue
        const content = Array.isArray(item.content) ? item.content : []
        const text = content.map((part) => {
          const record = asRecord(part)
          return typeof record.transcript === 'string' ? record.transcript : typeof record.text === 'string' ? record.text : ''
        }).join('')
        const existing = next.find((turn) => turn.id === item.id)
        const turn: VoiceTurn = { id: item.id, role: 'assistant', responseId: String(response.id ?? ''), text, final: response.status === 'completed', interrupted: response.status !== 'completed' }
        if (existing?.interrupted) continue
        next = existing ? next.map((candidate) => candidate.id === item.id ? turn : candidate) : [...next, turn]
      }
      return next
    }
    const type = typeof event.type === 'string' ? event.type : ''
    const user = type.startsWith('conversation.item.input_audio_transcription.')
    const assistant = type.startsWith('response.audio_transcript.') || type.startsWith('response.text.')
    if (assistant && typeof event.response_id === 'string' && interruptedResponses.has(event.response_id)) return turns
    if ((!user && !assistant) || typeof event.item_id !== 'string') return turns
    const final = type.endsWith('.done') || type.endsWith('.completed')
    const text = final ? (event.transcript ?? event.text)
      : user ? (typeof event.text === 'string' && typeof event.stash === 'string' ? event.text + event.stash : undefined) : event.delta
    if (typeof text !== 'string') return turns
    const existing = turns.find((turn) => turn.id === event.item_id)
    if (existing?.interrupted || (existing?.final && !final)) return turns
    const turn: VoiceTurn = {
      id: event.item_id, role: user ? 'user' : 'assistant',
      text: (final || user ? text : (existing?.text ?? '') + text).slice(0, 10_000), final, interrupted: false,
      responseId: typeof event.response_id === 'string' ? event.response_id : undefined,
    }
    return existing ? turns.map((candidate) => candidate.id === turn.id ? turn : candidate) : [...turns, turn]
  }
}
