import {
  buildBilingualMeanings,
  normalizePartOfSpeech,
  parseYoudaoPayload,
  youdaoDictVoiceUrl,
  wordPronunciationUrls,
  lookupYoudao,
} from './youdao'
import type { DictionaryMeaning } from '../domain/types'

const youdaoProudPayload = {
  expand_ec: {
    word: [
      {
        pos: 'adj.',
        transList: [
          {
            trans: '自豪的，得意的',
            content: {
              detailPos: 'adj.',
              sents: [
                {
                  sentOrig: 'She must be very <b>proud</b> of herself.',
                  sentSpeech: 'She must be very proud of herself.',
                  sentTrans: '她一定非常自豪。',
                },
              ],
            },
          },
          {
            trans: '傲慢的，自负的',
            content: {
              detailPos: 'adj.',
              sents: [
                {
                  sentOrig: 'She was too <b>proud</b> to admit she could be wrong.',
                  sentSpeech: 'She was too proud to admit she could be wrong.',
                  sentTrans: '她自视甚高，不愿承认自己也会有错。',
                },
              ],
            },
          },
        ],
      },
      {
        pos: '【名】',
        transList: [
          {
            trans: '（Proud）（英）普劳德（人名）',
            content: { detailPos: '【名】' },
          },
        ],
      },
    ],
  },
  simple: {
    word: [{ 'return-phrase': 'proud', ukphone: 'praʊd', usphone: 'praʊd' }],
  },
}

describe('Youdao POS normalization', () => {
  it('maps dictionary POS families by rule, not one-off aliases', () => {
    expect(normalizePartOfSpeech('un.')).toBe('noun')
    expect(normalizePartOfSpeech('n.')).toBe('noun')
    expect(normalizePartOfSpeech('pl.')).toBe('noun')
    expect(normalizePartOfSpeech('vt.')).toBe('verb')
    expect(normalizePartOfSpeech('vi.')).toBe('verb')
    expect(normalizePartOfSpeech('adj.')).toBe('adjective')
    expect(normalizePartOfSpeech('adv.')).toBe('adverb')
    expect(normalizePartOfSpeech('prep.')).toBe('preposition')
  })
})

describe('Youdao sense parsing', () => {
  it('requests the supported schema instead of accepting an HTTP 200 provider error as empty senses', async () => {
    const request = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = new URL(String(input), 'https://lomivex.top')
      return new Response(JSON.stringify(url.searchParams.get('jsonversion') === '2'
        ? youdaoProudPayload : { code: 40, message: '请求接口错误.应请求json或json_s！' }))
    })
    try {
      const result = await lookupYoudao('proud')
      expect(result.senses[0]).toMatchObject({ zhGloss: '自豪的，得意的' })
    } finally { request.mockRestore() }
  })

  it('fills a single sense from a single matching WordNet definition', () => {
    const parsed = parseYoudaoPayload({ ec: { word: { trs: [{ pos: 'adj.', tran: '保险精算的' }] } },
      ee: { source: { name: 'WordNet' }, word: { trs: [{ pos: 'adj.', tr: [{ l: { i: 'of or relating to the work of an actuary' } }] }] } } }, 'actuarial')
    expect(parsed.senses[0]).toMatchObject({ definition: 'of or relating to the work of an actuary' })
  })

  it('does not use a Wikipedia namesake as the definition of a common expression', () => {
    const parsed = parseYoudaoPayload({ ec: { word: { trs: [{ pos: 'expression', tran: '家规' }] } },
      ee: { source: { name: 'Wikipedia' }, word: { trs: [{ pos: 'abstract:', tr: [{ l: { i: 'House Rules is an Australian television drama series.' } }] }] } } }, 'house rules')
    expect(parsed.senses[0].definition).toBeUndefined()
  })

  it('aligns bilingual definitions and examples to the Chinese sense instead of sharing them by POS', () => {
    const parsed = parseYoudaoPayload({ ec: { word: { trs: [{ pos: 'n.', tran: '银行；河岸' }] } },
      collins: { collins_entries: [{ headword: 'bank', entries: { entry: [{ tran_entry: [
        { pos_entry: { pos: 'N-COUNT' }, tran: 'A bank is a financial institution. 银行',
          exam_sents: { sent: [{ eng_sent: 'The bank approved the loan.', chn_sent: '银行批准了贷款。' }] } },
        { pos_entry: { pos: 'N-COUNT' }, tran: 'A bank is the land beside a river. 河岸' },
      ] }] } }] }, blng_sents_part: { 'sentence-pair': [{ sentence: 'We walked along the bank.', 'sentence-translation': '我们沿着河岸散步。' }] },
    }, 'bank')
    expect(parsed.senses[0]).toMatchObject({ definition: 'A bank is a financial institution.', exampleEn: 'The bank approved the loan.' })
    expect(parsed.senses[1]).toMatchObject({ definition: 'A bank is the land beside a river.', exampleEn: 'We walked along the bank.' })
  })

  it('does not assign ambiguous English definitions or sentences to multiple Chinese senses', () => {
    const parsed = parseYoudaoPayload({ ec: { word: { trs: [{ pos: 'n.', tran: '利息；贷款利息' }] } },
      ee: { word: { trs: [{ pos: 'n.', tr: [{ l: { i: 'interest paid' } }, { l: { i: 'money borrowed' } }] }] } },
      blng_sents_part: { 'sentence-pair': [{ sentence: 'The interest increased.', 'sentence-translation': '贷款利息提高了。' }] },
    }, 'interest')
    expect(parsed.senses.every((sense) => !sense.definition && !sense.exampleEn)).toBe(true)
  })
  it('does not use a response that belongs to a different query', async () => {
    const request = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ...youdaoProudPayload, input: 'proud' })))
    try {
      expect((await lookupYoudao('nurse')).senses).toEqual([])
    } finally { request.mockRestore() }
  })
  it('reads nested basic translations and retains ordinary senses before a proper name', () => {
    const parsed = parseYoudaoPayload({ ec: { word: [{ 'return-phrase': { l: { i: 'camera' } }, trs: [
      { tr: [{ l: { i: ['n. 照相机；摄影机；（Camera）人名；（英、意、西）卡梅拉'] } }] },
    ] }] } }, 'camera')
    expect(parsed.word).toBe('camera')
    expect(parsed.senses).toEqual([
      { partOfSpeech: 'noun', zhGloss: '照相机' },
      { partOfSpeech: 'noun', zhGloss: '摄影机' },
    ])
    expect(parseYoudaoPayload({ ec: { word: { trs: [{ pos: 'n.', tran: '照相机；摄影机；（Camera）人名' }] } } })
      .senses.map((sense) => sense.zhGloss)).toEqual(['照相机', '摄影机'])
  })
  it('extracts Chinese-first senses and strips HTML from examples', () => {
    const parsed = parseYoudaoPayload(youdaoProudPayload, 'proud')

    expect(parsed.word).toBe('proud')
    expect(parsed.phonetic).toBe('praʊd')
    expect(parsed.senses).toEqual([
      {
        partOfSpeech: 'adjective',
        zhGloss: '自豪的，得意的',
        exampleEn: 'She must be very proud of herself.',
        exampleZh: '她一定非常自豪。',
      },
      {
        partOfSpeech: 'adjective',
        zhGloss: '傲慢的，自负的',
        exampleEn: 'She was too proud to admit she could be wrong.',
        exampleZh: '她自视甚高，不愿承认自己也会有错。',
      },
    ])
  })

  it('falls back to ec basic translations when expand_ec is missing', () => {
    const senses = parseYoudaoPayload({
      ec: {
        word: {
          trs: [
            {
              pos: 'n.',
              tran: '资产流动性，资产变现能力；流动资产，现金；液体，液态',
            },
          ],
        },
      },
    }).senses

    expect(senses.map((sense) => sense.zhGloss)).toEqual([
      '资产流动性，资产变现能力',
      '流动资产，现金',
      '液体，液态',
    ])
  })
})

describe('bilingual meaning composition', () => {
  it('does not attach English assists when multiple Chinese senses share a POS', () => {
    const english: DictionaryMeaning[] = [
      {
        partOfSpeech: 'noun',
        definition: 'Availability of liquid assets.',
        synonyms: [],
      },
    ]

    const youdao = parseYoudaoPayload({
      expand_ec: {
        word: [
          {
            pos: 'n.',
            transList: [
              {
                trans: '资产流动性，资产变现能力',
                content: {
                  detailPos: 'un.',
                  sents: [
                    {
                      sentSpeech: 'The company maintains high liquidity.',
                      sentTrans: '公司保持着很高的流动性。',
                    },
                  ],
                },
              },
              {
                trans: '流动资产，现金',
                content: { detailPos: 'un.' },
              },
            ],
          },
        ],
      },
    }).senses

    const merged = buildBilingualMeanings(youdao, english)

    expect(merged).toHaveLength(2)
    expect(merged[0]).toMatchObject({
      zhGloss: '资产流动性，资产变现能力',
      definition: 'The company maintains high liquidity.',
      example: 'The company maintains high liquidity.',
      partOfSpeech: 'noun',
    })
    expect(merged[1]).toMatchObject({
      zhGloss: '流动资产，现金',
      definition: '',
      partOfSpeech: 'noun',
    })
    expect(merged.every((item) => item.zhGloss)).toBe(true)
  })

  it('attaches English definition only for unambiguous 1:1 POS matches', () => {
    const english: DictionaryMeaning[] = [
      {
        partOfSpeech: 'noun',
        definition: 'Ownership interest in a company.',
        synonyms: ['stake'],
      },
      {
        partOfSpeech: 'adjective',
        definition: 'Fair and impartial.',
        synonyms: [],
      },
    ]
    const youdao = [
      { partOfSpeech: 'noun', zhGloss: '权益' },
      { partOfSpeech: 'adjective', zhGloss: '公平的' },
    ]

    expect(buildBilingualMeanings(youdao, english)).toEqual([
      {
        senseKey: 'dictionary:youdao:["noun","权益",0]',
        partOfSpeech: 'noun',
        definition: 'Ownership interest in a company.',
        zhGloss: '权益',
        example: undefined,
        exampleZh: undefined,
        synonyms: ['stake'],
        antonyms: undefined,
      },
      {
        senseKey: 'dictionary:youdao:["adjective","公平的",0]',
        partOfSpeech: 'adjective',
        definition: 'Fair and impartial.',
        zhGloss: '公平的',
        example: undefined,
        exampleZh: undefined,
        synonyms: [],
        antonyms: undefined,
      },
    ])
  })

  it('retains source identities through enrichment and distinguishes repeated glosses', () => {
    const source = [{ partOfSpeech: 'noun', zhGloss: '银行' }, { partOfSpeech: 'noun', zhGloss: '银行' }]
    const original = buildBilingualMeanings(source, [])
    const enriched = buildBilingualMeanings(source.map((sense, index) => ({ ...sense, exampleEn: `Example ${index}` })), [])
    expect(original.map((meaning) => meaning.senseKey)).toEqual(enriched.map((meaning) => meaning.senseKey))
    expect(new Set(original.map((meaning) => meaning.senseKey)).size).toBe(2)
  })

  it('falls back to English-only meanings when Youdao has no usable senses', () => {
    const english: DictionaryMeaning[] = [
      {
        partOfSpeech: 'noun',
        definition: 'A feeling of pride.',
        example: 'He felt pride.',
        synonyms: [],
      },
    ]

    expect(buildBilingualMeanings([], english)).toEqual(english)
  })
})

describe('Youdao dictionary voice URLs', () => {
  it('builds UK/US dictvoice URLs', () => {
    expect(youdaoDictVoiceUrl('proud', 'uk')).toBe(
      'https://dict.youdao.com/dictvoice?audio=proud&type=1',
    )
    expect(youdaoDictVoiceUrl('cash flow', 'us')).toBe(
      'https://dict.youdao.com/dictvoice?audio=cash%20flow&type=2',
    )
  })

  it('puts Youdao ahead of stored Free Dictionary audio', () => {
    expect(wordPronunciationUrls('proud', 'uk', 'https://audio.example/proud-uk.mp3')).toEqual([
      'https://dict.youdao.com/dictvoice?audio=proud&type=1',
      'https://audio.example/proud-uk.mp3',
    ])
  })
})
