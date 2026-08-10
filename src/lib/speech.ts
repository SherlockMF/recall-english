import type { SpeechAccent, Word } from '../domain/types'

let activeAudio: HTMLAudioElement | undefined

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

function pickVoice(accent: SpeechAccent) {
  if (!('speechSynthesis' in window)) return undefined
  const voices = window.speechSynthesis.getVoices()
  const prefix = accent === 'uk' ? 'en-gb' : 'en-us'
  return voices.find((voice) => voice.lang.toLowerCase().startsWith(prefix))
}

export async function speakText(
  text: string,
  accent: SpeechAccent,
  audioUrl?: string,
  rate = 0.88,
): Promise<void> {
  const cleaned = text.trim()
  if (!cleaned) return

  stopAllSpeech()

  if (audioUrl) {
    try {
      const audio = new Audio(audioUrl)
      activeAudio = audio
      await audio.play()
      return
    } catch {
      // Fall through to TTS when remote audio fails.
    }
  }

  if (!('speechSynthesis' in window)) return

  const utterance = new SpeechSynthesisUtterance(cleaned)
  utterance.lang = accent === 'uk' ? 'en-GB' : 'en-US'
  utterance.rate = rate
  const voice = pickVoice(accent)
  if (voice) utterance.voice = voice
  window.speechSynthesis.speak(utterance)
}

export async function speakWord(
  word: Pick<Word, 'expression' | 'audioUk' | 'audioUs'>,
  accent: SpeechAccent,
): Promise<void> {
  const audioUrl = accent === 'uk' ? word.audioUk : word.audioUs
  await speakText(word.expression, accent, audioUrl)
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
