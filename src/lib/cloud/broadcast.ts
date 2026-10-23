interface ChangeNotice { accountId: string; source: string; nonce: string }

export function createCloudBroadcast(accountId: string, onRemoteChange: () => void): { notify(): void; close(): void } {
  const name = `recall-cloud:changed:${accountId}`
  const source = crypto.randomUUID()
  let closed = false
  let channel: BroadcastChannel | undefined
  const receive = (value: unknown) => {
    if (closed || !value || typeof value !== 'object') return
    const notice = value as Partial<ChangeNotice>
    if (notice.accountId === accountId && typeof notice.source === 'string' && notice.source !== source && typeof notice.nonce === 'string') onRemoteChange()
  }
  const onMessage = (event: MessageEvent) => receive(event.data)
  const onStorage = (event: StorageEvent) => {
    if (event.key !== name || !event.newValue) return
    let value: unknown
    try { value = JSON.parse(event.newValue) }
    catch { return }
    receive(value)
  }
  try {
    if (typeof window.BroadcastChannel === 'function') {
      channel = new window.BroadcastChannel(name)
      channel.addEventListener('message', onMessage)
    }
  } catch { channel = undefined }
  if (!channel) window.addEventListener('storage', onStorage)
  return {
    notify() {
      if (closed) return
      const notice: ChangeNotice = { accountId, source, nonce: crypto.randomUUID() }
      // Notifications are optional; browser storage restrictions must not fail a saved write.
      try {
        // oxlint-disable-next-line require-post-message-target-origin -- BroadcastChannel has no targetOrigin argument.
        if (channel) channel.postMessage(notice)
        else window.localStorage.setItem(name, JSON.stringify(notice))
      } catch { /* The next normal sync still reads the persisted database. */ }
    },
    close() {
      if (closed) return
      closed = true
      if (channel) {
        channel.removeEventListener('message', onMessage)
        channel.close()
      } else window.removeEventListener('storage', onStorage)
    },
  }
}
