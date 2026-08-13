import {
  buildBilingualMeanings,
  normalizePartOfSpeech,
  parseYoudaoPayload,
  youdaoDictVoiceUrl,
  wordPronunciationUrls,
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
        partOfSpeech: 'noun',
        definition: 'Ownership interest in a company.',
        zhGloss: '权益',
        example: undefined,
        exampleZh: undefined,
        synonyms: ['stake'],
        antonyms: undefined,
      },
      {
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
