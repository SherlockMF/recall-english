import 'fake-indexeddb/auto'

import { deleteDB } from 'idb'

import {
  DATABASE_NAME,
  closeDatabase,
} from './db'
import {
  DICTIONARY_API_BASE_URL,
  DICTIONARY_TIMEOUT_MS,
  lookupDictionary,
} from './dictionary'

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
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

describe('Free Dictionary lookup', () => {
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

  it('URL-encodes the query, normalizes audio to HTTPS, and then serves the cache first', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(dictionaryPayload))
    vi.stubGlobal('fetch', fetchMock)

    const first = await lookupDictionary('  profit margin  ')
    const second = await lookupDictionary('PROFIT MARGIN')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      `${DICTIONARY_API_BASE_URL}/profit%20margin`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(first.audioUrl).toBe('https://audio.example.test/profit-margin.mp3')
    expect(first.meanings[0]).toEqual({
      partOfSpeech: 'noun',
      definition: 'The amount by which revenue exceeds costs.',
      example: 'Our profit margin improved this quarter.',
      synonyms: ['margin', 'profitability'],
    })
    expect(second).toEqual(first)
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
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('reports upstream 5xx failures with a recoverable message', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response('<html>bad gateway</html>', 502))
    vi.stubGlobal('fetch', fetchMock)

    await expect(lookupDictionary('levarage')).rejects.toMatchObject({
      code: 'server',
      status: 502,
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
