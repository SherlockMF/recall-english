import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Icon } from './Icon'

export interface MicrophoneIndicatorHandle { update: (level: number) => void }
export const MicrophoneIndicator = forwardRef<MicrophoneIndicatorHandle, { enabled: boolean; label: string; confirmation?: string }>(function MicrophoneIndicator({ enabled, label, confirmation }, ref) {
  const root = useRef<HTMLDivElement>(null)
  const [heard, setHeard] = useState(false)
  useEffect(() => {
    if (!enabled) {
      root.current?.style.setProperty('--mic-level', '0')
      root.current?.setAttribute('aria-valuenow', '0')
      setHeard(false)
    }
  }, [enabled])
  useImperativeHandle(ref, () => ({ update(level) {
    const value = enabled ? Math.min(1, Math.max(0, level)) : 0
    root.current?.style.setProperty('--mic-level', String(value))
    root.current?.setAttribute('aria-valuenow', String(Math.round(value * 100)))
    setHeard(value > 0.04)
  } }), [enabled])
  return <div className="voice-microphone-indicator" data-enabled={enabled}>
    <Icon name="mic" size={19} />
    <div className="voice-level-bars" role="meter" aria-label="麦克风输入音量" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0} ref={root}>{[0, 1, 2, 3, 4].map((index) => <i key={index} />)}</div>
    <span role="status">{enabled && heard ? '麦克风检测到声音' : label}{confirmation && <small>{confirmation}</small>}</span>
  </div>
})
