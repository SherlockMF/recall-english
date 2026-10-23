import { expect, it } from 'vitest'
import { dictionaryWordId } from '../wordSenses'

it('gives the same supplemental sense a stable id on different devices without merging distinct senses', () => {
  const id = dictionaryWordId('Hello', 'dictionary:youdao:greeting')
  expect(dictionaryWordId(' hello ', 'dictionary:youdao:greeting')).toBe(id)
  expect(dictionaryWordId('hello', 'dictionary:youdao:surprise')).not.toBe(id)
  expect(id).toMatch(/^dictionary-[a-f\d]{32}$/)
})
