/** Serializes any structured-cloneable payload to JSON off the main thread. */
self.onmessage = (event: MessageEvent<{ value: unknown; space?: number }>) => {
  ;(self as unknown as Worker).postMessage(JSON.stringify(event.data.value, null, event.data.space))
}
