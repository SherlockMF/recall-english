import { afterEach, describe, expect, it, vi } from 'vitest'
import { pcm16, wavBlob, microphoneLevel, VoiceRecorder, monitorMicrophone } from './audio'

afterEach(() => vi.unstubAllGlobals())

describe('voice audio', () => {
  it('resamples and clips PCM to signed little endian 16 kHz', () => {
    const bytes = pcm16(new Float32Array([1, 1, -2, -2]), 32000)
    const view = new DataView(bytes.buffer)
    expect(bytes.length).toBe(4)
    expect(view.getInt16(0, true)).toBe(32767)
    expect(view.getInt16(2, true)).toBe(-32768)
  })
  it('builds a replayable WAV header with the actual sample rate', async () => {
    const blob = wavBlob(new Uint8Array([0, 0, 1, 0]), 24000)
    const buffer = await new Promise<ArrayBuffer>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.readAsArrayBuffer(blob)
    })
    const bytes = new Uint8Array(buffer)
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('RIFF')
    expect(new DataView(bytes.buffer).getUint32(24, true)).toBe(24000)
    expect(new DataView(bytes.buffer).getUint32(40, true)).toBe(4)
  })
  it('reports silence as zero and increases with recorded amplitude', () => {
    expect(microphoneLevel(new Float32Array(20))).toBe(0)
    expect(microphoneLevel(new Float32Array(20).fill(0.1))).toBeGreaterThan(0.2)
    expect(microphoneLevel(new Float32Array(20).fill(1))).toBe(1)
  })
  it('stops a microphone that arrives after recording was cancelled', async () => {
    const close = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('AudioContext', class { resume = vi.fn().mockResolvedValue(undefined); close = close })
    let grant: (value: MediaStream) => void = () => undefined
    const getUserMedia = vi.fn(() => new Promise<MediaStream>((resolve) => { grant = resolve }))
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
    const recorder = new VoiceRecorder(vi.fn())
    const started = recorder.start()
    await vi.waitFor(() => expect(getUserMedia).toHaveBeenCalled())
    recorder.cancel()
    const stop = vi.fn()
    grant({ getTracks: () => [{ stop }] } as unknown as MediaStream)
    await started
    expect(stop).toHaveBeenCalledOnce()
    expect(close).toHaveBeenCalledOnce()
  })
  it('flushes the final recorded chunk before producing PCM and closes all resources', async () => {
    const stop = vi.fn(), close = vi.fn().mockResolvedValue(undefined), disconnect = vi.fn()
    const stream = { getTracks: () => [{ stop }] }
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) } })
    const connection = { connect: vi.fn(), disconnect }
    vi.stubGlobal('AudioContext', class {
      sampleRate = 16000; destination = {}; audioWorklet = { addModule: vi.fn().mockResolvedValue(undefined) }
      resume = vi.fn().mockResolvedValue(undefined); close = close
      createMediaStreamSource = () => connection
      createGain = () => ({ ...connection, gain: { value: 1 } })
    })
    vi.stubGlobal('AudioWorkletNode', class {
      connect = vi.fn(); disconnect = disconnect
      port = { onmessage: null as ((event: { data: Float32Array | string }) => void) | null, postMessage: () => {
        this.port.onmessage?.({ data: new Float32Array(16000).fill(.1) })
        this.port.onmessage?.({ data: 'stopped' })
      } }
    })
    const recorder = new VoiceRecorder(vi.fn())
    await recorder.start()
    expect((await recorder.finish()).length).toBe(32000)
    expect(stop).toHaveBeenCalledOnce(); expect(close).toHaveBeenCalledOnce()
    expect(disconnect).toHaveBeenCalledTimes(3)
  })
  it('meters only a live enabled track and cancels its animation on cleanup', () => {
    const track = { enabled: true, readyState: 'live' }, close = vi.fn().mockResolvedValue(undefined)
    let frame: FrameRequestCallback = () => undefined
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback) => { frame = callback; return 1 }))
    const cancel = vi.fn(); vi.stubGlobal('cancelAnimationFrame', cancel)
    vi.stubGlobal('AudioContext', class {
      resume = vi.fn().mockResolvedValue(undefined); close = close
      createMediaStreamSource = () => ({ connect: vi.fn(), disconnect: vi.fn() })
      createAnalyser = () => ({ fftSize: 512, getFloatTimeDomainData: (values: Float32Array) => values.fill(.1), disconnect: vi.fn() })
    })
    const level = vi.fn()
    const cleanup = monitorMicrophone({ getAudioTracks: () => [track] } as unknown as MediaStream, level)
    frame(100); expect(level.mock.calls.at(-1)?.[0]).toBeGreaterThan(.2)
    track.enabled = false; frame(200); expect(level).toHaveBeenLastCalledWith(0)
    cleanup(); expect(close).toHaveBeenCalledOnce(); expect(cancel).toHaveBeenCalledWith(1)
  })
})
