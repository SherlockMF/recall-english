import { cleanup, render } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { VoiceMessageBubble } from './VoiceMessageBubble'

afterEach(() => { cleanup(); vi.restoreAllMocks() })
it('retains the audio source through React StrictMode effect cleanup', () => {
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined)
  const view = render(<StrictMode><VoiceMessageBubble message={{ id: 'user-1', role: 'user', text: '', final: false, interrupted: false, audioUrl: 'blob:recording', duration: 2, status: 'sent' }} onPlay={vi.fn()} onError={vi.fn()} /></StrictMode>)
  expect(view.container.querySelector('audio')).toHaveAttribute('src', 'blob:recording')
})
