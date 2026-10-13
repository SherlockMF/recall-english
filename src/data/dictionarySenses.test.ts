import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadBundledDictionarySenses } from './dictionarySenses'
import { DICTIONARY_CONTENT_REVISION } from './dictionaryContentRevision'

describe('bundled dictionary senses loader', () => {
  afterEach(() => vi.restoreAllMocks())

  it('loads the supplemental asset with its independent revision', async () => {
    const request = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      revision: DICTIONARY_CONTENT_REVISION, results: [],
    })))
    expect((await loadBundledDictionarySenses()).revision).toBe(DICTIONARY_CONTENT_REVISION)
    expect(request).toHaveBeenCalledWith(`/data/bundledDictionarySenses.json?v=${DICTIONARY_CONTENT_REVISION}`)
  })

  it('rejects stale supplemental content instead of stamping a wrong revision', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ revision: 'stale', results: [] })))
    await expect(loadBundledDictionarySenses()).rejects.toThrow('版本')
  })
})
