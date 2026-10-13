import { describe, expect, it } from 'vitest'
import { VOICE_SCENARIOS, voiceInstructions, type VoiceOptions } from './scenarios'

const base: VoiceOptions = { scenario: 'daily', difficulty: 'basic', accent: 'uk', words: [] }
describe('voice scenarios', () => {
  it('treats categories as starting points instead of binding daily practice to a coffee shop', () => {
    const instructions = voiceInstructions(base)
    expect(instructions).not.toContain('barista')
    expect(instructions).not.toContain('coffee order')
    expect(instructions).toContain('everyday life')
    expect(VOICE_SCENARIOS.some((scenario) => scenario.id === 'custom')).toBe(true)
  })
  it('includes the learner scene as bounded quoted context for role and setting', () => {
    const scene = '在酒店办理入住，我是客人，你是前台，确认是否包含早餐。'
    const instructions = voiceInstructions({ ...base, scenarioDescription: scene })
    expect(instructions).toContain(JSON.stringify(scene))
    expect(instructions).toContain('roles and setting')
    expect(voiceInstructions({ ...base, scenarioDescription: 'x'.repeat(900) })).not.toContain('x'.repeat(501))
  })
  it('supports unrestricted topic choice without assigning a built-in professional role', () => {
    const instructions = voiceInstructions({ ...base, scenario: 'custom', scenarioDescription: '聊聊科幻电影，问问我喜欢的电影。' })
    expect(instructions).toContain('聊聊科幻电影')
    expect(instructions).not.toContain('barista')
    expect(instructions).not.toContain('company budget')
    expect(instructions).not.toContain('colleague')
  })
  it('asks what to talk about when custom practice has no description', () => {
    const instructions = voiceInstructions({ ...base, scenario: 'custom', scenarioDescription: '   ' })
    expect(instructions).toContain('ask what the learner would like to talk about')
    expect(instructions).toContain('British')
    expect(instructions).toContain('A2')
  })
})
