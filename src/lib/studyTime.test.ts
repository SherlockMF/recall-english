import { describe, expect, it } from 'vitest'
import { StudyClock } from './studyTime'

describe('StudyClock', () => {
  it('splits monotonic active time at local midnight and keeps cumulative totals', () => {
    const start = new Date(2026, 8, 10, 23, 59, 50).getTime()
    const clock = new StudyClock('s1')
    clock.sample(start, 0, true)
    clock.sample(start + 20_000, 20_000, true)
    expect(clock.entries().map(({ localDate, activeMs }) => ({ localDate, activeMs }))).toEqual([
      { localDate: '2026-09-10', activeMs: 10_000 },
      { localDate: '2026-09-11', activeMs: 10_000 },
    ])
    clock.sample(start + 20_000, 20_000, false)
    expect(clock.totalMs).toBe(20_000)
  })

  it('excludes blocked intervals and pauses after 120 seconds without activity', () => {
    const clock = new StudyClock('s1')
    clock.sample(0, 0, true)
    clock.sample(30_000, 30_000, false)
    clock.sample(50_000, 50_000, true)
    clock.sample(65_000, 65_000, true)
    expect(clock.totalMs).toBe(45_000)
    clock.sample(200_000, 200_000, true)
    expect(clock.totalMs).toBe(100_000)
    expect(clock.idle).toBe(true)
    clock.interact(200_000, 200_000, true)
    clock.sample(210_000, 210_000, true)
    expect(clock.totalMs).toBe(110_000)
  })
})
