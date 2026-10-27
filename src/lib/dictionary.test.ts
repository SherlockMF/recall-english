import 'fake-indexeddb/auto'

import { deleteDB } from 'idb'

import {
  DATABASE_NAME,
  closeDatabase,
  normalizeDictionaryQuery,
  setDictionaryCache,
} from './db'
import {
  DICTIONARY_API_BASE_URL,
  DICTIONARY_RESULT_VERSION,
  DICTIONARY_TIMEOUT_MS,
  composeDictionaryResult,
  isUsableDictionaryCache,
  lookupDictionary,
} from './dictionary'

function response(body: unknown, status = 200): Response {
  const text = typeof body === 'string' ? body : JSON.stringify(body)
  let parsed: unknown = body
  if (typeof body === 'string') {
    try {
      parsed = JSON.parse(body)
    } catch {
      parsed = body
    }
  }
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockImplementation(async () => {
      if (typeof parsed === 'string') throw new SyntaxError('Unexpected token')
      return parsed
    }),
    text: vi.fn().mockResolvedValue(text),
  } as unknown as Response
}

const dictionaryPayload = [
  {
    word: 'profit margin',
    phonetic: '/ˈprɒfɪt ˌmɑːdʒɪn/',
    phonetics: [
      {
        text: '/ˈprɒfɪt ˌmɑːdʒɪn/',
        audio: '//audio.example.test/profit-margin.mp3',
      },
    ],
    meanings: [
      {
        partOfSpeech: 'noun',
        synonyms: ['margin'],
        definitions: [
          {
            definition: 'The amount by which revenue exceeds costs.',
            example: 'Our profit margin improved this quarter.',
            synonyms: ['profitability'],
          },
        ],
      },
    ],
  },
]

const youdaoProfitPayload = {
  expand_ec: {
    word: [
      {
        pos: 'n.',
        transList: [
          {
            trans: '利润率',
            content: {
              detailPos: 'n.',
              sents: [
                {
                  sentSpeech: 'Our profit margin improved this quarter.',
                  sentTrans: '我们的利润率本季提高了。',
                },
              ],
            },
          },
        ],
      },
    ],
  },
  simple: {
    word: [{ 'return-phrase': 'profit margin', ukphone: 'ˈprɒfɪt ˌmɑːdʒɪn' }],
  },
}

describe('dictionary lookup (Chinese-first)', () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    await closeDatabase()
    await deleteDB(DATABASE_NAME)
  })

  afterEach(async () => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    await closeDatabase()
    await deleteDB(DATABASE_NAME)
  })

  it('composes Youdao senses as the picker cards with optional English assist', () => {
    const result = composeDictionaryResult({
      query: 'profit margin',
      youdao: {
        word: 'profit margin',
        senses: [
          {
            partOfSpeech: 'noun',
            zhGloss: '利润率',
            exampleEn: 'Our profit margin improved this quarter.',
            exampleZh: '我们的利润率本季提高了。',
          },
        ],
        phonetic: 'ˈprɒfɪt ˌmɑːdʒɪn',
      },
      english: {
        schemaVersion: DICTIONARY_RESULT_VERSION,
        query: 'profit margin',
        word: 'profit margin',
        phonetic: '/ˈprɒfɪt ˌmɑːdʒɪn/',
        meanings: [
          {
            partOfSpeech: 'noun',
            definition: 'The amount by which revenue exceeds costs.',
            synonyms: ['margin'],
          },
        ],
        fetchedAt: '2026-01-01T00:00:00.000Z',
      },
    })

    expect(result.meanings[0]).toMatchObject({
      zhGloss: '利润率',
      definition: 'The amount by which revenue exceeds costs.',
      example: 'Our profit margin improved this quarter.',
      exampleZh: '我们的利润率本季提高了。',
    })
    expect(result.audioUk).toContain('dict.youdao.com/dictvoice')
  })

  it('still succeeds when Free Dictionary fails but Youdao has Chinese senses', () => {
    const result = composeDictionaryResult({
      query: 'liquidity',
      youdao: {
        word: 'liquidity',
        senses: [
          { partOfSpeech: 'noun', zhGloss: '资产流动性，资产变现能力' },
          { partOfSpeech: 'noun', zhGloss: '流动资产，现金' },
        ],
      },
    })

    expect(result.meanings).toHaveLength(2)
    expect(result.meanings.every((item) => item.zhGloss)).toBe(true)
  })

  it('ignores pre-bilingual cache entries and rebuilds', async () => {
    await setDictionaryCache(normalizeDictionaryQuery('profit margin'), {
      query: 'profit margin',
      word: 'profit margin',
      meanings: [
        {
          partOfSpeech: 'noun',
          definition: 'The amount by which revenue exceeds costs.',
          synonyms: [],
        },
      ],
      fetchedAt: '2020-01-01T00:00:00.000Z',
    })

    expect(isUsableDictionaryCache({
      query: 'x',
      word: 'x',
      meanings: [{ partOfSpeech: 'noun', definition: 'x', synonyms: [] }],
      fetchedAt: '2020-01-01T00:00:00.000Z',
    })).toBe(false)

    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/api/youdao/')) return response(youdaoProfitPayload)
      return response(dictionaryPayload)
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await lookupDictionary('profit margin')
    expect(result.schemaVersion).toBe(DICTIONARY_RESULT_VERSION)
    expect(result.meanings[0].zhGloss).toBe('利润率')
  })

  it('URL-encodes the query, prefers Youdao audio, and serves versioned cache', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/api/youdao/')) return response(youdaoProfitPayload)
      return response(dictionaryPayload)
    })
    vi.stubGlobal('fetch', fetchMock)

    const first = await lookupDictionary('  profit margin  ')
    const second = await lookupDictionary('PROFIT MARGIN')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenCalledWith(
      `${DICTIONARY_API_BASE_URL}/profit%20margin`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(first.audioUrl).toBe('https://dict.youdao.com/dictvoice?audio=profit%20margin&type=1')
    expect(first.meanings[0]).toMatchObject({
      partOfSpeech: 'noun',
      zhGloss: '利润率',
      definition: 'The amount by which revenue exceeds costs.',
    })
    expect(second).toEqual(first)
  })

  it('returns Youdao senses even when Free Dictionary 404s', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/api/youdao/')) {
        return response({
          expand_ec: {
            word: [
              {
                pos: 'n.',
                transList: [{ trans: '流动性', content: { detailPos: 'n.' } }],
              },
            ],
          },
        })
      }
      return response({ title: 'No Definitions Found' }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await lookupDictionary('liquidity')
    expect(result.meanings[0].zhGloss).toBe('流动性')
  })

  it('keeps bilingual lookup usable when the optional English dictionary is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      const url = new URL(String(input), 'https://lomivex.top')
      if (url.pathname.startsWith('/api/youdao/')) {
        return response(url.searchParams.get('jsonversion') === '2'
          ? youdaoProfitPayload : { code: 40, message: '请求接口错误.应请求json或json_s！' })
      }
      return response({ error: 'provider-failed' }, 502)
    }))
    const result = await lookupDictionary('profit margin')
    expect(result.meanings[0]).toMatchObject({ zhGloss: '利润率' })
  })

  it('reports a missing word separately from offline mode', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ title: 'No Definitions Found' }, 404))
    vi.stubGlobal('fetch', fetchMock)

    await expect(lookupDictionary('notaword')).rejects.toMatchObject({
      code: 'not-found',
      status: 404,
    })

    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false)
    await expect(lookupDictionary('anotherword')).rejects.toMatchObject({
      code: 'offline',
    })
  })

  it('reports upstream 5xx failures with a recoverable message', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response('<html>bad gateway</html>', 502))
    vi.stubGlobal('fetch', fetchMock)

    await expect(lookupDictionary('levarage')).rejects.toMatchObject({
      code: 'server',
      status: 502,
      message: '词典服务暂时异常，请稍后重试；这不代表词条拼写有误。',
    })
  })

  it('uses a five-second default and reports an aborted request as a timeout', async () => {
    expect(DICTIONARY_TIMEOUT_MS).toBe(5_000)
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        }),
      ),
    )

    await expect(
      lookupDictionary('slowword', { timeoutMs: 10 }),
    ).rejects.toMatchObject({ code: 'timeout' })
  })
})
