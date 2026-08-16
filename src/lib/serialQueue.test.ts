import { describe, expect, it, vi } from 'vitest'

import { createSerialQueue } from './serialQueue'

describe('createSerialQueue', () => {
  it('runs tasks strictly in order even when started together', async () => {
    const enqueue = createSerialQueue()
    const order: number[] = []
    let releaseFirst!: () => void
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })

    const first = enqueue(async () => {
      await firstGate
      order.push(1)
      return 'a'
    })
    const second = enqueue(async () => {
      order.push(2)
      return 'b'
    })

    releaseFirst()
    await expect(first).resolves.toBe('a')
    await expect(second).resolves.toBe('b')
    expect(order).toEqual([1, 2])
  })

  it('keeps the chain alive after a rejected task', async () => {
    const enqueue = createSerialQueue()
    const failed = enqueue(async () => {
      throw new Error('boom')
    })
    const ok = enqueue(async () => 'recovered')

    await expect(failed).rejects.toThrow('boom')
    await expect(ok).resolves.toBe('recovered')
  })

  it('does not start the next task until the previous settles', async () => {
    const enqueue = createSerialQueue()
    const secondStart = vi.fn()
    let releaseFirst!: () => void
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })

    const first = enqueue(async () => {
      await firstGate
    })
    const second = enqueue(async () => {
      secondStart()
    })

    await Promise.resolve()
    expect(secondStart).not.toHaveBeenCalled()
    releaseFirst()
    await first
    await second
    expect(secondStart).toHaveBeenCalledTimes(1)
  })
})
