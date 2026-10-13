import { act, cleanup, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, expect, it } from 'vitest'
import { MicrophoneIndicator, type MicrophoneIndicatorHandle } from './MicrophoneIndicator'

afterEach(cleanup)
it('shows actual input level separately from server recognition and resets on mute', () => {
  const ref = createRef<MicrophoneIndicatorHandle>()
  const view = render(<MicrophoneIndicator ref={ref} enabled label="等待你说话" confirmation="AI 正在听你说" />)
  act(() => ref.current?.update(0.6))
  expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '60')
  expect(screen.getByText('麦克风检测到声音')).toBeInTheDocument()
  expect(screen.getByText('AI 正在听你说')).toBeInTheDocument()
  view.rerender(<MicrophoneIndicator ref={ref} enabled={false} label="麦克风已静音" />)
  expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '0')
  act(() => ref.current?.update(0.8))
  expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '0')
})
