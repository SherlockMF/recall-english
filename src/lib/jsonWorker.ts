/**
 * JSON.stringify on a worker thread so serializing a large library snapshot
 * never blocks the UI. Falls back to the main thread where workers are
 * unavailable (jsdom tests, very old browsers).
 */
export function stringifyOffMainThread(value: unknown, space?: number): Promise<string> {
  if (typeof Worker === 'undefined') {
    return Promise.resolve(JSON.stringify(value, null, space))
  }
  return new Promise((resolve, reject) => {
    let worker: Worker
    try {
      worker = new Worker(new URL('./exportWorker.ts', import.meta.url), { type: 'module' })
    } catch {
      resolve(JSON.stringify(value, null, space))
      return
    }
    worker.onmessage = (event: MessageEvent<string>) => {
      worker.terminate()
      resolve(event.data)
    }
    worker.onerror = (event) => {
      worker.terminate()
      reject(new Error(event.message || '导出序列化失败。'))
    }
    // oxlint-disable-next-line require-post-message-target-origin -- worker-scope postMessage has no targetOrigin parameter
    worker.postMessage({ value, space })
  })
}
