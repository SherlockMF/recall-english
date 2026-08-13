import type { SpeechAccent, Word } from '../domain/types'
import { wordPronunciationUrls } from './youdao'

let activeAudio: HTMLAudioElement | undefined

/** Exported for tests — higher score = better match for natural English TTS. */
export function scoreVoice(
  voice: Pick<SpeechSynthesisVoice, 'lang' | 'name' | 'localService'>,
  accent: SpeechAccent,
): number {
  const lang = voice.lang.toLowerCase()
  const prefix = accent === 'uk' ? 'en-gb' : 'en-us'
  if (!lang.startsWith(prefix) && !(accent === 'us' && lang === 'en')) return -1
  if (accent === 'uk' && !lang.startsWith('en-gb')) return -1

  let score = 10
  if (lang.startsWith(prefix)) score += 20
  if (voice.localService) score += 8

  const name = voice.name.toLowerCase()
  const premiums = [
    'natural',
    'neural',
    'premium',
    'enhanced',
    'online',
    'google',
    'microsoft',
    'samantha',
    'daniel',
    'martha',
    'moira',
    'karen',
    'serena',
    'raveena',
  ]
  for (const token of premiums) {
    if (name.includes(token)) score += 12
  }
  if (name.includes('compact') || name.includes('eloquence')) score -= 15
  return score
}

export function pickBestVoice(
  voices: SpeechSynthesisVoice[],
  accent: SpeechAccent,
): SpeechSynthesisVoice | undefined {
  let best: SpeechSynthesisVoice | undefined
  let bestScore = -1
  for (const voice of voices) {
    const score = scoreVoice(voice, accent)
    if (score > bestScore) {
      bestScore = score
      best = voice
    }
  }
  return bestScore >= 0 ? best : undefined
}

function stopAllSpeech() {
  if (activeAudio) {
    activeAudio.pause()
    activeAudio.currentTime = 0
    activeAudio = undefined
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
}

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!('speechSynthesis' in window)) return Promise.resolve([])
  const existing = window.speechSynthesis.getVoices()
  if (existing.length > 0) return Promise.resolve(existing)

  return new Promise((resolve) => {
    const finish = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', finish)
      resolve(window.speechSynthesis.getVoices())
    }
    window.speechSynthesis.addEventListener('voiceschanged', finish)
    window.setTimeout(finish, 400)
  })
}

export async function speakText(
  text: string,
  accent: SpeechAccent,
  audioUrl?: string | readonly string[],
  rate = 0.92,
): Promise<void> {
  const cleaned = text.trim()
  if (!cleaned) return

  stopAllSpeech()

  const candidates = Array.isArray(audioUrl)
    ? audioUrl.filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
    : typeof audioUrl === 'string' && audioUrl.trim()
      ? [audioUrl.trim()]
      : []

  for (const url of candidates) {
    try {
      const audio = new Audio(url)
      activeAudio = audio
      await audio.play()
      return
    } catch {
      // Try the next source, then fall through to TTS.
    }
  }

  if (!('speechSynthesis' in window)) return

  const utterance = new SpeechSynthesisUtterance(cleaned)
  utterance.lang = accent === 'uk' ? 'en-GB' : 'en-US'
  utterance.rate = rate
  utterance.pitch = 1.05
  const voice = pickBestVoice(await loadVoices(), accent)
  if (voice) utterance.voice = voice
  window.speechSynthesis.speak(utterance)
}

export async function speakWord(
  word: Pick<Word, 'expression' | 'audioUk' | 'audioUs'>,
  accent: SpeechAccent,
): Promise<void> {
  const stored = accent === 'uk' ? word.audioUk : word.audioUs
  await speakText(
    word.expression,
    accent,
    wordPronunciationUrls(word.expression, accent, stored),
  )
}

export async function speakExample(text: string, accent: SpeechAccent = 'uk'): Promise<void> {
  await speakText(text, accent)
}

/** @deprecated Prefer speakWord with an explicit accent. */
export async function speakVocabulary(
  item: Pick<Word, 'expression' | 'audioUk' | 'audioUs'> & { audioUrl?: string },
): Promise<void> {
  await speakText(item.expression, 'uk', item.audioUk ?? item.audioUrl)
}
