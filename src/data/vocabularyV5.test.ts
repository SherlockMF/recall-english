import { describe, expect, it } from 'vitest'
import { hydrateWords } from '../lib/db'
import { snapshotLearningTracks, snapshotMapLearningProgress } from '../lib/learningTracks'
import { ALL_VOCABULARY_LISTS } from './vocabularyLists'
import { bundledSeedWords, seedMemberships, seedWords } from './seedVocabulary'

describe('vocabulary V5 trusted library', () => {
  it('keeps V5.2 production size at 7500', () => {
    expect(bundledSeedWords).toHaveLength(7260)
    expect(seedWords).toHaveLength(7500)
    expect(bundledSeedWords.every((item) => /^(v1|core|econ)-/.test(item.id))).toBe(true)
    expect(bundledSeedWords.filter((item) => item.id.startsWith('v1-')).length).toBe(756)
  })

  it('bans placeholder definitions and template examples on bundled seeds', () => {
    expect(
      bundledSeedWords.some((item) =>
        /^(Business|Accounting|Finance|Daily)\s+sense\s+of\b/i.test(item.enDefinition),
      ),
    ).toBe(false)
    expect(
      bundledSeedWords.some((item) =>
        (item.examples || []).some((example) => /Please notice .+ in context/i.test(example.en)),
      ),
    ).toBe(false)
    expect(bundledSeedWords.some((item) => /[\u4e00-\u9fff]/.test(item.enDefinition))).toBe(false)
  })

  it('requires real collocations beyond expression repetition', () => {
    const normalize = (value: string) =>
      value
        .normalize('NFKC')
        .trim()
        .toLocaleLowerCase('en-US')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')

    for (const item of bundledSeedWords) {
      const real = (item.collocations || []).filter((col) => {
        const nc = normalize(col)
        const ne = normalize(item.expression)
        return nc && nc !== ne && nc !== normalize(`use ${item.expression}`)
      })
      expect(real.length, item.expression).toBeGreaterThanOrEqual(2)
    }
  })

  it('locks professional fact fixes from the audit', () => {
    const byExpression = (expression: string) =>
      seedWords.find((item) => item.expression === expression)

    expect(byExpression('share capital')?.enDefinition).toMatch(/no par value|Companies Act 2016/i)
    expect(byExpression('Wi-Fi')?.enDefinition).toMatch(/IEEE 802\.11|local-area/i)
    expect(byExpression('tax liability')?.zhGloss).toMatch(/应纳税额|应付税款/)
    expect(byExpression('bond')?.enDefinition).toMatch(/may provide coupons|other form of return/i)
    expect(byExpression('recognition')?.enDefinition).toMatch(/useful information|faithfully represented/i)
    expect(byExpression('bad debt')?.enDefinition).toMatch(/irrecoverable|written off/i)
    expect(byExpression('effective interest rate')?.enDefinition).toMatch(/amortis|amortiz|discount/i)
    expect(byExpression('inventory write-down')?.enDefinition).toMatch(/net realis(?:able|able) value|NRV/i)
    expect(byExpression('recoverable amount')?.enDefinition).toMatch(/fair value less costs of disposal/i)
    expect(byExpression('recoverable amount')?.enDefinition).toMatch(/value in use/i)
  })

  it('prints track totals for App tests', () => {
    const items = hydrateWords(seedWords, seedMemberships, ALL_VOCABULARY_LISTS)
    const tracks = snapshotLearningTracks(items, new Set())
    const progress = snapshotMapLearningProgress(items, new Map())
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          seedWords: seedWords.length,
          progressTotal: progress.total,
          tracks: Object.fromEntries(tracks.map((track) => [track.id, track.total])),
        },
        null,
        2,
      ),
    )
    expect(progress.total).toBe(7500)
  })
})
