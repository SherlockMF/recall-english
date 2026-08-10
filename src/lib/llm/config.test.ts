import { afterEach, describe, expect, it } from 'vitest'
import {
  clearDeepseekApiKey,
  getDeepseekApiKey,
  setDeepseekApiKey,
} from './config'

describe('deepseek config', () => {
  afterEach(() => {
    clearDeepseekApiKey()
  })

  it('stores and reads trimmed api key from localStorage', () => {
    expect(getDeepseekApiKey()).toBe('')
    setDeepseekApiKey('  sk-test-key  ')
    expect(getDeepseekApiKey()).toBe('sk-test-key')
  })

  it('clear removes the key', () => {
    setDeepseekApiKey('sk-test-key')
    clearDeepseekApiKey()
    expect(getDeepseekApiKey()).toBe('')
  })
})
