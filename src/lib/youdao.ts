import type { DictionaryMeaning, SpeechAccent } from '../domain/types'
import { apiFetch } from './apiFetch'

export const YOUDAO_API_BASE_URL = '/api/youdao/jsonapi'
/** Absolute URL — `<audio>` can load cross-origin without the Vite proxy. */
export const YOUDAO_DICTVOICE_BASE_URL = 'https://dict.youdao.com/dictvoice'
export const YOUDAO_TIMEOUT_MS = 5_000

export interface YoudaoSense {
  partOfSpeech: string
  zhGloss: string
  definition?: string
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
      const direct = nonEmptyString(tr.tran)
      const translations = direct ? [direct] : Array.isArray(tr.tr)
        ? tr.tr.flatMap((item: unknown) => {
          if (!isRecord(item) || !isRecord(item.l)) return []
          const text = item.l.i
          return (Array.isArray(text) ? text : [text]).filter((value): value is string => typeof value === 'string')
        }) : []
      for (const translation of translations) {
        const prefix = translation.match(/^(【名】|[a-z][a-z./ &-]{0,16}\.)\s*/i)
        const rawPos = nonEmptyString(tr.pos) ?? prefix?.[1] ?? 'expression'
        const tran = prefix ? translation.slice(prefix[0].length) : translation
        let properNameTail = false
        for (const part of tran.split(/[；;]/)) {
          const zhGloss = part.trim()
          if (isProperNameSense(rawPos, zhGloss)) properNameTail = true
          if (!zhGloss || properNameTail) continue
          senses.push({ partOfSpeech: normalizePartOfSpeech(rawPos), zhGloss })
        }
      }
    }
  }

  return senses
}

/** Short Chinese alternatives are used only when they identify one source sense. */
export function chineseGlossTerms(value: string): string[] {
  const text = stripHtml(value).replace(/^(?:[（(][^（）()]*[）)]\s*)+/, '')
  const terms = text.split(/[，,；;]/).map((part) => (part.match(/\p{Script=Han}/gu) ?? []).join(''))
  return [...new Set(terms.filter((term) => term.length >= 2 && term.length <= 18))]
}

function records(value: unknown): UnknownRecord[] {
  return (Array.isArray(value) ? value : value ? [value] : []).filter(isRecord)
}

const normalizeContext = (value: string) => value.normalize('NFKC').trim().toLocaleLowerCase('en-US')

function fillYoudaoContext(senses: YoudaoSense[], payload: UnknownRecord, query: string): YoudaoSense[] {
  const compatible = (sense: YoudaoSense, pos: string) => sense.partOfSpeech === 'expression'
    || pos === 'expression' || normalizePartOfSpeech(sense.partOfSpeech) === pos
  const matches = (sense: YoudaoSense, translation: string) => {
    const chinese = (translation.match(/\p{Script=Han}/gu) ?? []).join('')
    return chineseGlossTerms(sense.zhGloss).some((term) => chinese.includes(term))
  }
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const mentionsWord = (sentence: string) => new RegExp(`(?:^|[^a-z])${escaped}(?:s|es|ed|d|ing)?(?:$|[^a-z])`, 'i').test(sentence)
  const bilingual: Array<{ pos: string; zh: string; definition: string; exampleEn?: string; exampleZh?: string }> = []
  if (isRecord(payload.collins)) for (const entry of records(payload.collins.collins_entries)) {
    if (typeof entry.headword === 'string' && normalizeContext(entry.headword) !== normalizeContext(query)) continue
    if (!isRecord(entry.entries)) continue
    for (const group of records(entry.entries.entry)) for (const item of records(group.tran_entry)) {
      const translation = typeof item.tran === 'string' ? stripHtml(item.tran) : ''
      const chineseStart = translation.search(/\p{Script=Han}/u)
      if (chineseStart <= 0) continue
      const definition = translation.slice(0, chineseStart).trim()
      if (!/[a-z]/i.test(definition)) continue
      const pos = isRecord(item.pos_entry) && typeof item.pos_entry.pos === 'string'
        ? normalizePartOfSpeech(item.pos_entry.pos) : 'expression'
      const examples = isRecord(item.exam_sents) ? records(item.exam_sents.sent) : []
      const example = examples.find((sent) => typeof sent.eng_sent === 'string' && mentionsWord(stripHtml(sent.eng_sent)))
      bilingual.push({ pos, zh: translation.slice(chineseStart), definition,
        exampleEn: example && typeof example.eng_sent === 'string' ? stripHtml(example.eng_sent) : undefined,
        exampleZh: example && typeof example.chn_sent === 'string' ? stripHtml(example.chn_sent) : undefined })
    }
  }
  const english: Array<{ pos: string; definition: string }> = []
  if (isRecord(payload.ee) && isRecord(payload.ee.source) && payload.ee.source.name === 'WordNet') for (const word of records(payload.ee.word)) for (const group of records(word.trs)) {
    const pos = typeof group.pos === 'string' ? normalizePartOfSpeech(group.pos) : 'expression'
    for (const item of records(group.tr)) {
      if (!isRecord(item.l)) continue
      const values = Array.isArray(item.l.i) ? item.l.i : [item.l.i]
      for (const value of values) if (typeof value === 'string') {
        const definition = stripHtml(value)
        if (/[a-z]/i.test(definition) && !/\p{Script=Han}/u.test(definition) && normalizeContext(definition) !== normalizeContext(query)) {
          if (!english.some((candidate) => candidate.pos === pos && candidate.definition === definition)) english.push({ pos, definition })
        }
      }
    }
  }
  const sentences = isRecord(payload.blng_sents_part) ? records(payload.blng_sents_part['sentence-pair']) : []
  return senses.map((original) => {
    const sense = { ...original }
    const candidates = bilingual.filter((candidate) => compatible(sense, candidate.pos) && matches(sense, candidate.zh)
      && senses.filter((other) => compatible(other, candidate.pos) && matches(other, candidate.zh)).length === 1)
    if (candidates.length === 1) {
      sense.definition ||= candidates[0].definition
      if (!sense.exampleEn && candidates[0].exampleEn) {
        sense.exampleEn = candidates[0].exampleEn
        sense.exampleZh = candidates[0].exampleZh
      }
    }
    const definitions = english.filter((candidate) => compatible(sense, candidate.pos))
    if (!sense.definition && definitions.length === 1
      && senses.filter((other) => compatible(other, definitions[0].pos)).length === 1) sense.definition = definitions[0].definition
    if (!sense.exampleEn) {
      const example = sentences.find((sent) => {
        const en = typeof sent.sentence === 'string' ? sent.sentence : sent['sentence-eng']
        const zh = sent['sentence-translation']
        return typeof en === 'string' && typeof zh === 'string' && mentionsWord(stripHtml(en)) && matches(sense, zh)
          && senses.filter((other) => matches(other, zh)).length === 1
      })
      if (example) {
        const en = typeof example.sentence === 'string' ? example.sentence : example['sentence-eng']
        sense.exampleEn = stripHtml(en as string)
        sense.exampleZh = stripHtml(example['sentence-translation'] as string)
      }
    }
    return sense
  })
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
    senses: fillYoudaoContext(senses.length > 0 ? senses : parseEcBasicSenses(payload), payload, query || phonetics.word || ''),
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

  const sourceOccurrences = new Map<string, number>()
  return youdaoSenses.map((sense) => {
    const key = normalizePartOfSpeech(sense.partOfSpeech)
    const englishBucket = englishByPos.get(key) ?? []
    const youdaoCount = youdaoCountByPos.get(key) ?? 0
    const english = englishBucket.length === 1 && youdaoCount === 1
      ? englishBucket[0]
      : undefined
    const definition = sense.definition || english?.definition || sense.exampleEn || ''
    const sourceGloss = sense.zhGloss.normalize('NFKC').trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ')
    const source = JSON.stringify([key, sourceGloss])
    const occurrence = sourceOccurrences.get(source) ?? 0
    sourceOccurrences.set(source, occurrence + 1)

    return {
      senseKey: `dictionary:youdao:${JSON.stringify([key, sourceGloss, occurrence])}`,
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
    const response = await apiFetch(
      `${YOUDAO_API_BASE_URL}?doctype=json&jsonversion=4&q=${encodeURIComponent(cleaned)}`,
      // No User-Agent here: browsers forbid overriding it and the extra header
      // can break CORS-preflight for a cross-origin proxy.
      { signal: controller.signal, headers: { Accept: 'application/json' } },
    )
    if (!response.ok) return { word: cleaned, senses: [] }
    const payload: unknown = await response.json()
    if (isRecord(payload) && typeof payload.input === 'string'
      && payload.input.normalize('NFKC').trim().toLocaleLowerCase('en-US') !== cleaned.normalize('NFKC').trim().toLocaleLowerCase('en-US')) {
      return { word: cleaned, senses: [] }
    }
    return parseYoudaoPayload(payload, cleaned)
  } catch {
    return { word: cleaned, senses: [] }
  } finally {
    clearTimeout(timeoutId)
    options.signal?.removeEventListener('abort', onAbort)
  }
}
