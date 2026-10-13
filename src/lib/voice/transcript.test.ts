import { describe, expect, it } from 'vitest'
import { createTranscriptReducer, type VoiceTurn } from './transcript'

describe('voice transcript', () => {
  it('replaces Qwen cumulative text and temporary stash while the learner speaks', () => {
    const update = createTranscriptReducer()
    let turns = update([], { type: 'input_audio_buffer.speech_started', item_id: 'u' })
    turns = update(turns, { type: 'conversation.item.input_audio_transcription.delta', item_id: 'u', text: 'I ', stash: 'go' })
    expect(turns[0]).toMatchObject({ text: 'I go', final: false })
    turns = update(turns, { type: 'conversation.item.input_audio_transcription.delta', item_id: 'u', text: 'I go ', stash: 'home.' })
    expect(turns[0].text).toBe('I go home.')
    turns = update(turns, { type: 'conversation.item.input_audio_transcription.completed', item_id: 'u', transcript: 'I go home.' })
    expect(turns[0]).toMatchObject({ text: 'I go home.', final: true })
  })
  it('deduplicates events and replaces partial text with its final transcript', () => {
    const update = createTranscriptReducer()
    let turns: VoiceTurn[] = []
    const delta = { type: 'response.audio_transcript.delta', event_id: 'e1', item_id: 'a', response_id: 'r', delta: 'Hello' }
    turns = update(turns, delta)
    turns = update(turns, delta)
    turns = update(turns, { type: 'response.audio_transcript.done', item_id: 'a', response_id: 'r', transcript: 'Hello there.' })
    expect(turns).toHaveLength(1)
    expect(turns[0]).toMatchObject({ role: 'assistant', text: 'Hello there.', final: true })
  })

  it('keeps the heard partial text after interruption instead of the later full answer', () => {
    const update = createTranscriptReducer()
    let turns = update([], { type: 'response.audio_transcript.delta', item_id: 'a', response_id: 'r', delta: 'Hello' })
    turns = update(turns, { type: 'input_audio_buffer.speech_started', item_id: 'u' })
    turns = update(turns, { type: 'response.audio_transcript.done', item_id: 'a', response_id: 'r', transcript: 'Hello there. How are you?' })
    turns = update(turns, { type: 'conversation.item.input_audio_transcription.completed', item_id: 'u', transcript: 'I am fine.' })
    expect(turns[0]).toMatchObject({ text: 'Hello', interrupted: true })
    expect(turns[1]).toMatchObject({ role: 'user', text: 'I am fine.', final: true })
  })

  it('uses final response snapshots to recover missing assistant deltas', () => {
    const update = createTranscriptReducer()
    const turns = update([], { type: 'response.done', response: { id: 'r', status: 'completed', output: [{ id: 'a', role: 'assistant', content: [{ transcript: 'Welcome.' }] }] } })
    expect(turns[0]).toMatchObject({ role: 'assistant', text: 'Welcome.', final: true })
  })

  it('ignores a cancelled response whose first transcript arrives after interruption', () => {
    const update = createTranscriptReducer()
    let turns = update([], { type: 'response.created', response: { id: 'r' } })
    turns = update(turns, { type: 'input_audio_buffer.speech_started', item_id: 'u' })
    turns = update(turns, { type: 'response.audio_transcript.delta', item_id: 'a', response_id: 'r', delta: 'Late reply' })
    turns = update(turns, { type: 'response.done', response: { id: 'r', status: 'cancelled', output: [{ id: 'a', role: 'assistant', content: [{ transcript: 'Late reply' }] }] } })
    expect(turns).toHaveLength(1)
    expect(turns[0].role).toBe('user')
  })

  it('ignores malformed data and does not append deltas after a final transcript', () => {
    const update = createTranscriptReducer()
    let turns = update([], { type: 'conversation.item.input_audio_transcription.completed', item_id: 'u', transcript: 'Hi.' })
    turns = update(turns, { type: 'conversation.item.input_audio_transcription.delta', item_id: 'u', text: '', stash: 'Hi.' })
    expect(update(turns, { type: 'response.audio_transcript.delta', delta: 5 })).toEqual(turns)
    expect(turns[0].text).toBe('Hi.')
  })
})
