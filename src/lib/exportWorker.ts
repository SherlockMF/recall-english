/** Serializes any structured-cloneable payload to JSON off the main thread. */
// Worker-scope postMessage has no targetOrigin parameter; the rule targets window.postMessage.
self.addEventListener('message', (event: MessageEvent<{ value: unknown; space?: number }>) => {
  // oxlint-disable-next-line require-post-message-target-origin -- DedicatedWorkerGlobalScope has no targetOrigin argument.
  ;(self as unknown as Worker).postMessage(JSON.stringify(event.data.value, null, event.data.space))
})
