import { describe, expect, it } from 'vitest'
import { lookupSenseEntry } from './buildDictionarySensePack.mjs'

function response(word = 'bank') {
  return new Response(JSON.stringify({ ec: { word: [{ 'return-phrase': word, trs: [
    { pos: 'n.', tran: '银行；河岸' },
  ] }] } }), { headers: { 'content-type': 'application/json' } })
}

describe('dictionary sense pack lookup', () => {
  it('retains all bilingual senses under the requested expression', async () => {
    const entry = await lookupSenseEntry('bank', { fetch: async () => response() })
    expect(entry.status).toBe('found')
    expect(entry.result.word).toBe('bank')
    expect(entry.result.meanings.map((meaning: { zhGloss: string }) => meaning.zhGloss)).toEqual(['银行', '河岸'])
  })

  it('retries transient errors but records genuine absent entries', async () => {
    let calls = 0
    const entry = await lookupSenseEntry('bank', { retryDelayMs: 0, fetch: async () => {
      calls++
      return calls === 1 ? new Response('', { status: 503 }) : response()
    } })
    expect(calls).toBe(2)
    expect(entry.status).toBe('found')
    const absent = await lookupSenseEntry('missing phrase', { fetch: async () => new Response('{}') })
    expect(absent.status).toBe('not-found')
  })

  it('does not attach a different headword to the original expression', async () => {
    const entry = await lookupSenseEntry('banks', { fetch: async () => response('bank') })
    expect(entry.status).toBe('different-headword')
    expect(entry.result).toBeUndefined()
    const wrongInput = await lookupSenseEntry('bank', { fetch: async () => new Response(JSON.stringify({ input: 'unrelated' })) })
    expect(wrongInput.status).toBe('different-headword')
  })
})
