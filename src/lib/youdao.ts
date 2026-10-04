import type { DictionaryMeaning, SpeechAccent } from '../domain/types'

export const YOUDAO_API_BASE_URL = '/api/youdao/jsonapi_s'
/** Absolute URL — `<audio>` can load cross-origin without the Vite proxy. */
export const YOUDAO_DICTVOICE_BASE_URL = 'https://dict.youdao.com/dictvoice'
export const YOUDAO_TIMEOUT_MS = 5_000

export interface YoudaoSense {
  partOfSpeech: string
  zhGloss: string
  exampleEn?: string
  exampleZh?: string
}

export interface YoudaoLookupResult {
  word: string
  senses: YoudaoSense[]
  ipaUk?: string
  ipaUs?: string
  phonetic?: string
}

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

export function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

/**
 * Map any dictionary POS tag to a small stable set.
 * Rule: strip non-letters, then match by linguistic family — not a brittle alias table.
 */
export function normalizePartOfSpeech(raw: string): string {
  const letters = raw.trim().toLowerCase().replace(/[^a-z]/g, '')
  if (!letters) return 'expression'

  if (letters.startsWith('adj') || letters === 'a') return 'adjective'
  if (letters.startsWith('adv')) return 'adverb'
  if (letters.startsWith('prep')) return 'preposition'
  if (letters.startsWith('conj')) return 'conjunction'
  if (letters.startsWith('pron')) return 'pronoun'
  if (letters.startsWith('inter') || letters === 'int') return 'interjection'
  if (letters.startsWith('num')) return 'numeral'
  if (letters.startsWith('art')) return 'article'
  if (letters.includes('phrase') || letters === 'phr') return 'phrase'
  // vt / vi / v / verb / modalverb …
  if (letters.startsWith('v') || letters.includes('verb')) return 'verb'
  // n / noun / un(countable) / cn / pl / plural …
  if (
    letters.startsWith('n')
    || letters === 'un'
    || letters === 'cn'
    || letters.startsWith('pl')
    || letters.includes('noun')
  ) {
    return 'noun'
  }

  return letters
}

function isProperNameSense(pos: string, zhGloss: string): boolean {
  const posLower = pos.toLowerCase()
  if (pos.includes('【名】') || zhGloss.includes('人名') || posLower.includes('name')) {
    return true
  }
  // e.g. "（Proud）（英）普劳德（人名）" already caught; also bare surname glosses.
  return /（[A-Z][A-Za-z]*）/.test(zhGloss) && zhGloss.includes('名')
}

function readReturnPhrase(entry: UnknownRecord): string | undefined {
  const raw = entry['return-phrase']
  if (typeof raw === 'string') return nonEmptyString(raw)
  if (!isRecord(raw) || !isRecord(raw.l)) return undefined
  const inner = raw.l.i
  if (typeof inner === 'string') return nonEmptyString(inner)
  if (Array.isArray(inner) && typeof inner[0] === 'string') return nonEmptyString(inner[0])
  return undefined
}

function readYoudaoPhonetics(payload: UnknownRecord): {
  word?: string
  ipaUk?: string
  ipaUs?: string
  phonetic?: string
} {
  const sources = [payload.simple, payload.ec]
  let word: string | undefined
  let ipaUk: string | undefined
  let ipaUs: string | undefined

  for (const source of sources) {
    if (!isRecord(source)) continue
    const rawWord = source.word
    const entries = Array.isArray(rawWord) ? rawWord : rawWord ? [rawWord] : []
    for (const entry of entries) {
      if (!isRecord(entry)) continue
      if (!word) word = readReturnPhrase(entry)
      if (!ipaUk) ipaUk = nonEmptyString(entry.ukphone)
      if (!ipaUs) ipaUs = nonEmptyString(entry.usphone)
    }
  }

  return {
    word,
    ipaUk,
    ipaUs,
    phonetic: ipaUk ?? ipaUs,
  }
}

function readExamplePair(content: unknown): { exampleEn?: string; exampleZh?: string } {
  if (!isRecord(content) || !Array.isArray(content.sents) || content.sents.length === 0) {
    return {}
  }
  const first = content.sents[0]
  if (!isRecord(first)) return {}

  const speech = nonEmptyString(first.sentSpeech)
  const orig = nonEmptyString(first.sentOrig)
  const exampleEn = speech ? stripHtml(speech) : orig ? stripHtml(orig) : undefined
  const exampleZh = nonEmptyString(first.sentTrans)

  return { exampleEn, exampleZh }
}

function parseExpandEcSenses(payload: UnknownRecord): YoudaoSense[] {
  if (!isRecord(payload.expand_ec) || !Array.isArray(payload.expand_ec.word)) return []
  const senses: YoudaoSense[] = []

  for (const entry of payload.expand_ec.word) {
    if (!isRecord(entry) || !Array.isArray(entry.transList)) continue
    const entryPos = nonEmptyString(entry.pos) ?? ''

    for (const item of entry.transList) {
      if (!isRecord(item)) continue
      const zhGloss = nonEmptyString(item.trans)
      if (!zhGloss) continue

      const content = item.content
      const detailPos = isRecord(content) ? nonEmptyString(content.detailPos) : undefined
      // Prefer entry-level POS (n./v.) over detail tags (un./cn.).
      const rawPos = entryPos || detailPos || 'expression'
      if (isProperNameSense(rawPos, zhGloss)) continue

      const { exampleEn, exampleZh } = readExamplePair(content)
      senses.push({
        partOfSpeech: normalizePartOfSpeech(rawPos),
        zhGloss,
        exampleEn,
        exampleZh,
      })
    }
  }

  return senses
}

function parseEcBasicSenses(payload: UnknownRecord): YoudaoSense[] {
  if (!isRecord(payload.ec)) return []
  const word = payload.ec.word
  const entries = Array.isArray(word) ? word : word ? [word] : []
  const senses: YoudaoSense[] = []

  for (const entry of entries) {
    if (!isRecord(entry) || !Array.isArray(entry.trs)) continue
    for (const tr of entry.trs) {
      if (!isRecord(tr)) continue
      const rawPos = nonEmptyString(tr.pos) ?? 'expression'
      const tran = nonEmptyString(tr.tran)
      if (!tran) continue
      if (isProperNameSense(rawPos, tran)) continue

      for (const part of tran.split(/[；;]/)) {
        const zhGloss = part.trim()
        if (!zhGloss) continue
        senses.push({
          partOfSpeech: normalizePartOfSpeech(rawPos),
          zhGloss,
        })
      }
    }
  }

  return senses
}

/** Parse Youdao jsonapi payload into sense + phonetic fields. */
export function parseYoudaoPayload(payload: unknown, query = ''): YoudaoLookupResult {
  if (!isRecord(payload)) {
    return { word: query, senses: [] }
  }

  const senses = parseExpandEcSenses(payload)
  const phonetics = readYoudaoPhonetics(payload)

  return {
    word: phonetics.word || query,
    senses: senses.length > 0 ? senses : parseEcBasicSenses(payload),
    ipaUk: phonetics.ipaUk,
    ipaUs: phonetics.ipaUs,
    phonetic: phonetics.phonetic,
  }
}
/**
 * Sense picker is Chinese-first: each Youdao sense becomes one card.
 * English definitions attach only when the POS mapping is unambiguous (1 Chinese ↔ 1 English).
 */
export function buildBilingualMeanings(
  youdaoSenses: YoudaoSense[],
  englishMeanings: DictionaryMeaning[],
): DictionaryMeaning[] {
  if (youdaoSenses.length === 0) return englishMeanings

  const englishByPos = new Map<string, DictionaryMeaning[]>()
  for (const meaning of englishMeanings) {
    const key = normalizePartOfSpeech(meaning.partOfSpeech)
    const bucket = englishByPos.get(key) ?? []
    bucket.push(meaning)
    englishByPos.set(key, bucket)
  }

  const youdaoCountByPos = new Map<string, number>()
  for (const sense of youdaoSenses) {
    const key = normalizePartOfSpeech(sense.partOfSpeech)
    youdaoCountByPos.set(key, (youdaoCountByPos.get(key) ?? 0) + 1)
  }

  return youdaoSenses.map((sense) => {
    const key = normalizePartOfSpeech(sense.partOfSpeech)
    const englishBucket = englishByPos.get(key) ?? []
    const youdaoCount = youdaoCountByPos.get(key) ?? 0
    const english = englishBucket.length === 1 && youdaoCount === 1
      ? englishBucket[0]
      : undefined
    const definition = english?.definition || sense.exampleEn || ''

    return {
      partOfSpeech: sense.partOfSpeech,
      definition,
      zhGloss: sense.zhGloss,
      example: sense.exampleEn ?? english?.example,
      exampleZh: sense.exampleZh,
      synonyms: english?.synonyms ?? [],
      antonyms: english?.antonyms,
    }
  })
}
export function youdaoDictVoiceUrl(
  expression: string,
  accent: SpeechAccent,
): string | undefined {
  const audio = expression.trim()
  if (!audio) return undefined
  const type = accent === 'uk' ? 1 : 2
  return `${YOUDAO_DICTVOICE_BASE_URL}?audio=${encodeURIComponent(audio)}&type=${type}`
}

export function wordPronunciationUrls(
  expression: string,
  accent: SpeechAccent,
  storedAudioUrl?: string,
): string[] {
  const urls: string[] = []
  const youdao = youdaoDictVoiceUrl(expression, accent)
  if (youdao) urls.push(youdao)
  const stored = storedAudioUrl?.trim()
  if (stored && stored !== youdao) urls.push(stored)
  return urls
}

export async function lookupYoudao(
  query: string,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<YoudaoLookupResult> {
  const cleaned = query.trim()
  if (!cleaned) return { word: '', senses: [] }

  const controller = new AbortController()
  const timeoutMs = options.timeoutMs ?? YOUDAO_TIMEOUT_MS
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  const onAbort = () => controller.abort(options.signal?.reason)
  options.signal?.addEventListener('abort', onAbort, { once: true })

  try {
    const response = await fetch(
      `${YOUDAO_API_BASE_URL}?doctype=json&jsonversion=4&q=${encodeURIComponent(cleaned)}`,
      // No User-Agent here: browsers forbid overriding it and the extra header
      // can break CORS-preflight for a cross-origin proxy.
      { signal: controller.signal, headers: { Accept: 'application/json' } },
    )
    if (!response.ok) return { word: cleaned, senses: [] }
    const payload: unknown = await response.json()
    return parseYoudaoPayload(payload, cleaned)
  } catch {
    return { word: cleaned, senses: [] }
  } finally {
    clearTimeout(timeoutId)
    options.signal?.removeEventListener('abort', onAbort)
  }
}
