import { afterEach, describe, expect, it, vi } from 'vitest'
import { chatJson } from '../llm/client'
import { generateVoiceFeedback, generateVoiceTurnFeedback } from './feedback'

vi.mock('../llm/client', () => ({ chatJson: vi.fn() }))
afterEach(() => vi.clearAllMocks())

describe('voice feedback', () => {
  it('sends only finalized learner speech and validates corrections against it', async () => {
    vi.mocked(chatJson).mockResolvedValue({ summaryZh: '尝试用完整句子表达。', corrections: [{ original: 'I goes home.', improved: 'I go home.', explanationZh: '主语 I 后用 go。' }], expressions: [{ en: 'go home', zh: '回家' }] })
    const result = await generateVoiceFeedback([
      { id: 'u', role: 'user', text: 'I goes home.', final: true, interrupted: false },
      { id: 'u2', role: 'user', text: 'unfinished', final: false, interrupted: false },
      { id: 'a', role: 'assistant', text: 'assistant answer', final: true, interrupted: false },
    ])
    const content = vi.mocked(chatJson).mock.calls[0][0].messages[1].content
    expect(content).toContain('I goes home.')
    expect(content).not.toContain('unfinished')
    expect(content).not.toContain('assistant answer')
    expect(result.corrections).toHaveLength(1)
  })

  it('does not request feedback for an empty conversation', async () => {
    await expect(generateVoiceFeedback([])).rejects.toThrow('没有可评估')
    expect(chatJson).not.toHaveBeenCalled()
  })

  it('keeps budgeted speech valid JSON without cutting an utterance', async () => {
    vi.mocked(chatJson).mockResolvedValue({ summaryZh: '总结', corrections: [], expressions: [] })
    await generateVoiceFeedback(Array.from({ length: 5 }, (_, index) => ({ id: String(index), role: 'user' as const, text: 'words '.repeat(1600), final: true, interrupted: false })))
    const content = vi.mocked(chatJson).mock.calls[0][0].messages[1].content
    expect(content.length).toBeLessThanOrEqual(30_000)
    expect(JSON.parse(content).learnerSpeech).toHaveLength(3)
  })

  it('rejects fabricated quotes and malformed output', async () => {
    vi.mocked(chatJson).mockResolvedValue({ summaryZh: '总结', corrections: [{ original: 'invented quote', improved: 'better', explanationZh: '理由' }], expressions: [] })
    await expect(generateVoiceFeedback([{ id: 'u', role: 'user', text: 'Hi.', final: true, interrupted: false }])).rejects.toThrow('反馈格式')
  })
})

describe('single-utterance voice feedback', () => {
  it('sends the current speech and a bounded previous reply as quoted data', async () => {
    vi.mocked(chatJson).mockResolvedValue({ corrections: [{ original: 'I goes', improved: 'I go', explanationZh: '主语 I 后用 go。' }] })
    const controller = new AbortController()
    const corrections = await generateVoiceTurnFeedback('I goes home.', 'Where do you go?', controller.signal)
    expect(corrections[0].improved).toBe('I go')
    const options = vi.mocked(chatJson).mock.calls.at(-1)![0]
    expect(JSON.parse(options.messages[1].content)).toEqual({ learnerSpeech: 'I goes home.', previousReply: 'Where do you go?' })
    expect(options.signal).toBe(controller.signal)
    expect(options.retries ?? 0).toBe(0)
    expect(options.timeoutMs).toBeLessThanOrEqual(15_000)
  })

  it('accepts an empty correction list for valid speech', async () => {
    vi.mocked(chatJson).mockResolvedValue({ corrections: [] })
    expect(await generateVoiceTurnFeedback('I worked today.', '')).toEqual([])
  })

  it.each([
    { corrections: [{ original: 'invented', improved: 'I go', explanationZh: '理由' }] },
    { corrections: [{ original: 'I goes', improved: 'I goes', explanationZh: '理由' }] },
    { corrections: [{ original: 'I goes', improved: 'I go', explanationZh: '' }] },
    { corrections: Array.from({ length: 4 }, () => ({ original: 'I goes', improved: 'I go', explanationZh: '理由' })) },
    { corrections: null },
  ])('rejects fabricated, unchanged or malformed corrections: %j', async (payload) => {
    vi.mocked(chatJson).mockResolvedValue(payload)
    await expect(generateVoiceTurnFeedback('I goes home.', 'invented')).rejects.toThrow('反馈格式')
  })

  it('bounds context and rejects empty or oversized speech without a request', async () => {
    vi.mocked(chatJson).mockResolvedValue({ corrections: [] })
    await generateVoiceTurnFeedback('Hello.', 'x'.repeat(3000))
    const content = vi.mocked(chatJson).mock.calls.at(-1)![0].messages[1].content
    expect(JSON.parse(content).previousReply.length).toBeLessThanOrEqual(2000)
    vi.mocked(chatJson).mockClear()
    await expect(generateVoiceTurnFeedback(' ', '')).rejects.toThrow()
    await expect(generateVoiceTurnFeedback('x'.repeat(10_001), '')).rejects.toThrow()
    expect(chatJson).not.toHaveBeenCalled()
  })

  it('does not send an already cancelled request', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(generateVoiceTurnFeedback('Hello.', '', controller.signal)).rejects.toThrow()
    expect(chatJson).not.toHaveBeenCalled()
  })
})
