import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { DailyPlan } from '../lib/scheduler'
import type { LearningStats } from '../lib/learningStats'
import { TodayView } from './TodayView'

afterEach(cleanup)

it('renders the actual plan counts and elapsed time without a time limit', () => {
  const plan = {
    tasks: [], localDate: '2026-09-10', dailyMinutes: 20, usedMs: 900_000,
    remainingMs: 300_000, estimatedMinutes: 2.75, newItemCount: 0,
    reviewItemCount: 2, reviewTaskCount: 1, usageTaskCount: 1, totalTasks: 2,
    introducedToday: 5, remainingNewItems: 0, overflowDueCount: 4,
    reasons: ['今日新表达上限已用完。'],
  } satisfies DailyPlan
  const stats = {
    evidenceByItemId: new Map(), introducedToday: 5, practicedItems: 8,
    taskCount: 12, attemptCount: 15, activeMs: 900_000, recallCount: 3,
    retainedCount: 1, applicationCount: 2, delayedRecall: { total: 0, correct: 0, rate: null },
  } satisfies LearningStats
  render(<TodayView now={new Date('2026-09-10T10:00:00Z')} plan={plan} stats={stats}
    tracks={[]} mapProgress={{ started: 8, usable: 3, total: 100 }} recentWords={[]}
    onStart={vi.fn()} />)
  expect(screen.getByText('今日学习计划')).toBeInTheDocument()
  expect(screen.getByLabelText('预计 2.75 分钟，共 2 道练习')).toBeInTheDocument()
  expect(screen.getByText('今日已学习 15 分钟 · 按自己的节奏完成')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /继续学习 5 分钟/ })).not.toBeInTheDocument()
  expect(screen.getByText('今日新表达上限已用完。')).toBeInTheDocument()
  expect(screen.getByText('仍有 4 道到期练习未安排')).toBeInTheDocument()
  expect(screen.queryByText(/谨慎增加/)).not.toBeInTheDocument()
})
