import { describe, expect, it } from 'vitest'
import { pickBestVoice, scoreVoice } from './speech'

function voice(
  overrides: Partial<Pick<SpeechSynthesisVoice, 'lang' | 'name' | 'localService'>>,
): Pick<SpeechSynthesisVoice, 'lang' | 'name' | 'localService'> {
  return {
    lang: 'en-US',
    name: 'Generic',
    localService: true,
    ...overrides,
  }
}

describe('speech voice selection', () => {
  it('prefers matching accent language', () => {
    expect(scoreVoice(voice({ lang: 'en-GB', name: 'Daniel' }), 'uk')).toBeGreaterThan(
      scoreVoice(voice({ lang: 'en-US', name: 'Samantha' }), 'uk'),
    )
  })

  it('prefers natural-sounding voice names', () => {
    const plain = scoreVoice(voice({ lang: 'en-US', name: 'Microsoft David' }), 'us')
    const natural = scoreVoice(voice({ lang: 'en-US', name: 'Microsoft Aria Online (Natural)' }), 'us')
    expect(natural).toBeGreaterThan(plain)
  })

  it('picks the highest scoring voice', () => {
    const voices = [
      voice({ lang: 'en-US', name: 'Compact' }),
      voice({ lang: 'en-US', name: 'Google US English', localService: true }),
      voice({ lang: 'en-GB', name: 'Daniel' }),
    ] as SpeechSynthesisVoice[]
    expect(pickBestVoice(voices, 'us')?.name).toBe('Google US English')
    expect(pickBestVoice(voices, 'uk')?.name).toBe('Daniel')
  })
})
