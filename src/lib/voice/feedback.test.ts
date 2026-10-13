import { afterEach, describe, expect, it, vi } from 'vitest'
import { chatJson } from '../llm/client'
import { generateVoiceFeedback } from './feedback'

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
