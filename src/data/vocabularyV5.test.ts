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

  it('rejects wrap/meta definitions and old template example banks on non-v1 senses', () => {
    const nonV1 = bundledSeedWords.filter((item) => !item.id.startsWith('v1-'))
    expect(
      nonV1.some((item) =>
        /sense of|practical .+ line or phrase|carry out the action|concept expressed by the phrase|in (business|accounting|finance|daily) practice$|used in (business|accounting|finance|daily) work$|as used in study and work$|the daily meaning of |a measured level or proportion relating to|in commercial or accounting use$|banking arrangement or institution role|^costs attributable to |^an investor in |used in business and finance$| in accounting and trade practice$/i.test(
          item.enDefinition,
        ),
      ),
    ).toBe(false)
    expect(
      nonV1.filter(
        (item) =>
          / relating to /i.test(item.enDefinition) &&
          !/^of or relating to/i.test(item.enDefinition) &&
          !/\(law\)/i.test(item.enDefinition) &&
          !/property resulting from being or relating to/i.test(item.enDefinition),
      ).length,
    ).toBe(0)
    expect(
      nonV1.filter((item) =>
        (item.examples || []).some((example) =>
          /Could you show me where to find|In the worksheet we applied|I sorted out the .+ on campus this afternoon|Before we sign, let’s confirm the|Ops put the .+ on this week|We closed the week by settling the|The client asked for clarity on the|We escalated the .+ to the steering group|Legal asked us to redefine the|The kickoff deck covers the|The deal model hinges on the|She explained the .+ in plain English|The briefing clarified the|We validated the .+ against source data|The memo defines the|Add the .+ to tomorrow.?s agenda|Two teams share ownership of the/i.test(
            example.en,
          ),
        ),
      ).length,
    ).toBe(0)
    expect(bundledSeedWords.find((item) => item.expression === 'credit card')?.enDefinition).toMatch(
      /^a card issued/i,
    )
    expect(bundledSeedWords.find((item) => item.expression === 'persist')?.enDefinition).toMatch(
      /continue firmly/i,
    )
    expect(bundledSeedWords.find((item) => item.expression === 'sales commissions')?.enDefinition).toMatch(
      /salespeople|commission/i,
    )
    expect(bundledSeedWords.find((item) => item.expression === 'cost of debt')?.enDefinition).toMatch(
      /cost associated with|interest/i,
    )
    expect(bundledSeedWords.find((item) => item.expression === 'marketing channel')?.enDefinition).toMatch(
      /path|channel/i,
    )
    expect(bundledSeedWords.find((item) => item.expression === 'skin')?.enDefinition).toMatch(
      /outer covering/i,
    )
    expect(bundledSeedWords.find((item) => item.expression === 'trade deficit')?.enDefinition).toMatch(
      /imports over exports|deficit/i,
    )
    expect(bundledSeedWords.find((item) => item.expression === 'delivery ex-warehouse')?.enDefinition).toMatch(
      /warehouse/i,
    )
    expect(bundledSeedWords.find((item) => item.expression === 'economic')?.collocations?.join(' ')).not.toMatch(
      /pilot the economic|scale the economic/i,
    )
    expect(bundledSeedWords.find((item) => item.expression === 'net indebtedness')?.enDefinition).toMatch(
      /debt|owed/i,
    )
    expect(bundledSeedWords.find((item) => item.expression === 'safe deposit box')?.enDefinition).toMatch(
      /vault|valuables|box/i,
    )
    expect(bundledSeedWords.find((item) => item.expression === 'capital employed')?.enDefinition).toMatch(
      /capital used|employed/i,
    )
    expect(bundledSeedWords.find((item) => item.expression === 'institutional investor')?.collocations?.join(' ')).toMatch(
      /appoint|brief|hire|consult|meet|recommend|rely/i,
    )
    expect(bundledSeedWords.find((item) => item.expression === 'institutional investor')?.collocations?.join(' ')).not.toMatch(
      /hedge the institutional investor|price the institutional investor/i,
    )
    expect(bundledSeedWords.find((item) => item.expression === 'safe deposit box')?.examples?.[0]?.en).toMatch(
      /inspect|lease|secure|visit|Access|Security|expire/i,
    )
    expect(bundledSeedWords.find((item) => item.expression === 'safe deposit box')?.examples?.[0]?.en).not.toMatch(
      /Customs released goods/i,
    )
    expect(bundledSeedWords.find((item) => item.expression === 'shipment advice')?.collocations?.join(' ')).toMatch(
      /issue|file|review|sign|attach|archive|draft|circulate|amend/i,
    )
    expect(bundledSeedWords.find((item) => item.expression === 'commercial bank')?.enDefinition).toMatch(
      /retail and commercial|commercial banking/i,
    )
    expect(bundledSeedWords.find((item) => item.expression === 'institutional investor')?.enDefinition).toMatch(
      /organisation|organization|fund|insurer|pools of capital/i,
    )
    expect(bundledSeedWords.find((item) => item.expression === 'acquisition cost')?.enDefinition).toMatch(
      /acquiring|acquisition/i,
    )
    expect(bundledSeedWords.find((item) => item.expression === 'acquisition cost')?.enDefinition).not.toMatch(
      /costs attributable to/i,
    )
    expect(bundledSeedWords.find((item) => item.expression === 'commercial bank')?.enDefinition).toMatch(
      /retail and commercial|commercial banking/i,
    )
    expect(bundledSeedWords.find((item) => item.expression === 'yield gap')?.enDefinition).toMatch(
      /yield|bonds|equities/i,
    )
    expect(bundledSeedWords.find((item) => item.expression === 'advances from customers')?.enDefinition).toMatch(
      /before|advance|customers/i,
    )
    expect(bundledSeedWords.find((item) => item.expression === 'advances from customers')?.collocations?.join(' ')).not.toMatch(
      /appoint|brief the advances/i,
    )
    expect(bundledSeedWords.find((item) => item.expression === 'yield gap')?.examples?.[0]?.en).not.toMatch(
      /memo defines|tomorrow.?s agenda|share ownership/i,
    )
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
