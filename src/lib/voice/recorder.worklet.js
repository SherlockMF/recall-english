class RecallRecorder extends AudioWorkletProcessor {
  constructor() {
    super()
    this.recording = true
    this.buffer = new Float32Array(2048)
    this.offset = 0
    this.port.onmessage = ({ data }) => {
      if (data !== 'stop') return
      this.recording = false
      if (this.offset) this.port.postMessage(this.buffer.slice(0, this.offset))
      this.port.postMessage('stopped')
    }
  }
  process(inputs) {
    const input = inputs[0]?.[0]
    if (!this.recording || !input) return true
    for (const sample of input) {
      this.buffer[this.offset++] = sample
      if (this.offset === this.buffer.length) {
        this.port.postMessage(this.buffer.slice())
        this.offset = 0
      }
    }
    return true
  }
}
registerProcessor('recall-recorder', RecallRecorder)
