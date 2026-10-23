import { BroadcastChannel as NodeBroadcastChannel } from 'node:worker_threads'
import { afterEach, expect, it, vi } from 'vitest'
import { createCloudBroadcast } from './broadcast'

const instances: ReturnType<typeof createCloudBroadcast>[] = []
const create = (account: string, callback = vi.fn()) => {
  const instance = createCloudBroadcast(account, callback)
  instances.push(instance)
  return { ...instance, callback }
}

afterEach(() => {
  for (const instance of instances.splice(0)) instance.close()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})

it('notifies other instances of the same account without echoing or crossing accounts', async () => {
  vi.stubGlobal('BroadcastChannel', NodeBroadcastChannel)
  const first = create('account-a')
  const second = create('account-a')
  const other = create('account-b')
  first.notify()
  await vi.waitFor(() => expect(second.callback).toHaveBeenCalledTimes(1))
  expect(first.callback).not.toHaveBeenCalled()
  expect(other.callback).not.toHaveBeenCalled()
  second.notify()
  await vi.waitFor(() => expect(first.callback).toHaveBeenCalledTimes(1))
  expect(second.callback).toHaveBeenCalledTimes(1)
  expect(other.callback).not.toHaveBeenCalled()
})

it('stops receiving and publishing notifications after close', async () => {
  vi.stubGlobal('BroadcastChannel', NodeBroadcastChannel)
  const first = create('account-a')
  const second = create('account-a')
  second.close()
  second.notify()
  first.notify()
  await new Promise(resolve => setTimeout(resolve, 30))
  expect(first.callback).not.toHaveBeenCalled()
  expect(second.callback).not.toHaveBeenCalled()
})

it('falls back to account-checked storage events without notification loops', () => {
  vi.stubGlobal('BroadcastChannel', undefined)
  const first = create('account-a')
  const second = create('account-a')
  const other = create('account-b')
  const setItem = vi.spyOn(Storage.prototype, 'setItem')
  first.notify()
  expect(setItem).toHaveBeenCalledTimes(1)
  const [key, newValue] = setItem.mock.calls[0]
  expect(Object.keys(JSON.parse(newValue)).sort()).toEqual(['accountId', 'nonce', 'source'])
  window.dispatchEvent(new StorageEvent('storage', { key, newValue, storageArea: localStorage }))
  expect(first.callback).not.toHaveBeenCalled()
  expect(second.callback).toHaveBeenCalledTimes(1)
  expect(other.callback).not.toHaveBeenCalled()
  expect(setItem).toHaveBeenCalledTimes(1)
  const wrongAccount = JSON.stringify({ ...JSON.parse(newValue), accountId: 'account-b', source: 'another-instance' })
  window.dispatchEvent(new StorageEvent('storage', { key, newValue: wrongAccount, storageArea: localStorage }))
  window.dispatchEvent(new StorageEvent('storage', { key, newValue: '{', storageArea: localStorage }))
  expect(first.callback).not.toHaveBeenCalled()
  expect(second.callback).toHaveBeenCalledTimes(1)
  expect(other.callback).not.toHaveBeenCalled()
  second.close()
  window.dispatchEvent(new StorageEvent('storage', { key, newValue, storageArea: localStorage }))
  expect(second.callback).toHaveBeenCalledTimes(1)
})

it('keeps existing local records intact when storage notifications are unavailable', () => {
  vi.stubGlobal('BroadcastChannel', undefined)
  localStorage.setItem('existing-local-record', 'saved')
  const first = create('account-a')
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Storage blocked', 'SecurityError') })
  expect(() => first.notify()).not.toThrow()
  expect(localStorage.getItem('existing-local-record')).toBe('saved')
  expect(first.callback).not.toHaveBeenCalled()
})

it('uses the storage fallback when constructing BroadcastChannel fails', () => {
  vi.stubGlobal('BroadcastChannel', function UnavailableBroadcastChannel() { throw new Error('Unavailable') })
  const setItem = vi.spyOn(Storage.prototype, 'setItem')
  const first = create('account-a')
  expect(() => first.notify()).not.toThrow()
  expect(setItem).toHaveBeenCalledTimes(1)
})
