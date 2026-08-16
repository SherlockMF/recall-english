import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import type { LearningTrack, SessionTask, VocabularyItem } from '../domain/types'
import { StudySession } from './StudySession'

const item: VocabularyItem = {
  id: 'cash-flow-cash-movement',
  expression: 'cash flow',
  lemma: 'cash flow',
  senseKey: 'cash-movement',
  zhGloss: '现金流',
  enDefinition: 'money moving into and out of a business',
  partOfSpeech: 'noun phrase',
  acceptedZhAnswers: ['现金流量'],
  acceptedEnVariants: ['cashflow'],
  examples: [{ en: 'We monitor cash flow every week.', zh: '我们每周监控现金流。' }],
  collocations: ['positive cash flow', 'manage cash flow'],
  listSlugs: ['finance', 'accounting'],
  category: 'finance',
  source: 'seed',
  priority: 1,
  status: 'active',
  usagePrompts: [
    {
      id: 'cash-flow-cloze',
      type: 'cloze',
      prompt: 'We monitor _____ every week.',
      answer: 'cash flow',
      modelAnswer: 'We monitor cash flow every week.',
      checkpoints: ['cash flow'],
    },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const track: LearningTrack = {
  id: 'cash-flow-cash-movement:receptive',
  itemId: item.id,
  type: 'receptive',
  due: '2026-01-01T00:00:00.000Z',
  stability: 0,
  difficulty: 0,
  elapsedDays: 0,
  scheduledDays: 0,
  reps: 0,
  lapses: 0,
  state: 0,
  unlocked: true,
}

const task: SessionTask = {
  id: 'task-1',
  itemId: item.id,
  trackId: track.id,
  trackType: 'receptive',
  isNew: true,
}

describe('StudySession', () => {
  it('requires free recall before revealing the target meaning', async () => {
    const user = userEvent.setup()
    const onRate = vi.fn().mockResolvedValue(undefined)

    render(
      <StudySession
        evaluate={(_task, _item, answer) => ({
          rating: answer === '现金流' ? 'good' : 'again',
          matched: answer === '现金流',
        })}
        initialTasks={[task]}
        items={[item]}
        mode="core"
        onExit={vi.fn()}
        onFinish={vi.fn()}
        onRate={onRate}
        tracks={[track]}
        usableThisWeek={0}
      />,
    )

    expect(screen.getByRole('heading', { name: 'cash flow' })).toBeInTheDocument()
    expect(screen.queryByText('现金流', { exact: true })).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('你记得的中文意思'), '现金流')
    await user.click(screen.getByRole('button', { name: /提交回忆/ }))

    expect(screen.getAllByText('现金流', { exact: true }).length).toBeGreaterThan(0)
    expect(screen.getByText('We monitor cash flow every week.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /想起来了/ }))
    expect(onRate).toHaveBeenCalledWith(
      task,
      'good',
      expect.objectContaining({ answer: '现金流', hintLevel: 0 }),
    )
    expect(await screen.findByText('今天的记忆已经重新连上。')).toBeInTheDocument()
  })

  it('forces a revealed answer to be rated again', async () => {
    const user = userEvent.setup()
    const onRate = vi.fn().mockResolvedValue(undefined)
    render(
      <StudySession
        evaluate={() => ({ rating: 'again', matched: false })}
        initialTasks={[task]}
        items={[item]}
        mode="core"
        onExit={vi.fn()}
        onFinish={vi.fn()}
        onRate={onRate}
        tracks={[track]}
        usableThisWeek={0}
      />,
    )

    await user.click(screen.getByRole('button', { name: '想不起来' }))
    expect(screen.getByRole('button', { name: /想起来了/ })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /忘记了/ }))
    expect(onRate).toHaveBeenCalledWith(
      task,
      'again',
      expect.objectContaining({ hintLevel: 3 }),
    )
  })

  it('advances to the next card before a slow save finishes', async () => {
    const user = userEvent.setup()
    let resolveRate!: () => void
    const onRate = vi.fn().mockImplementation(() => new Promise<void>((resolve) => {
      resolveRate = resolve
    }))
    const secondTask: SessionTask = {
      ...task,
      id: 'task-2',
      trackId: 'track-2',
    }
    const secondTrack: LearningTrack = {
      ...track,
      id: 'track-2',
    }

    render(
      <StudySession
        evaluate={() => ({ rating: 'good', matched: true })}
        initialTasks={[task, secondTask]}
        items={[item]}
        mode="core"
        onExit={vi.fn()}
        onFinish={vi.fn()}
        onRate={onRate}
        tracks={[track, secondTrack]}
        usableThisWeek={0}
      />,
    )

    await user.type(screen.getByLabelText('你记得的中文意思'), '现金流')
    await user.click(screen.getByRole('button', { name: /提交回忆/ }))
    await user.click(screen.getByRole('button', { name: /想起来了/ }))

    expect(await screen.findByText('2 / 2')).toBeInTheDocument()
    expect(onRate).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: /想起来了/ })).not.toBeInTheDocument()

    resolveRate()
    await Promise.resolve()
  })

  it('shows rules feedback immediately while a slow evaluate is still refining', async () => {
    const user = userEvent.setup()
    let resolveEvaluate!: (result: { rating: 'hard'; matched: true; feedbackZh: string }) => void
    const evaluate = vi.fn().mockImplementation((
      _task: SessionTask,
      _item: VocabularyItem,
      _answer: string,
      _hint: number,
      _revealed: boolean,
      _ms: number,
      options?: { onInterim?: (result: { rating: 'again'; matched: false }) => void },
    ) => {
      options?.onInterim?.({ rating: 'again', matched: false })
      return new Promise((resolve) => {
        resolveEvaluate = resolve
      })
    })

    render(
      <StudySession
        evaluate={evaluate}
        initialTasks={[task]}
        items={[item]}
        mode="core"
        onExit={vi.fn()}
        onFinish={vi.fn()}
        onRate={vi.fn()}
        tracks={[track]}
        usableThisWeek={0}
      />,
    )

    await user.type(screen.getByLabelText('你记得的中文意思'), '资金流动')
    await user.click(screen.getByRole('button', { name: /提交回忆/ }))

    expect(await screen.findByText('现在忘记很正常')).toBeInTheDocument()
    expect(screen.queryByText('判分中…')).not.toBeInTheDocument()

    resolveEvaluate({ rating: 'hard', matched: true, feedbackZh: '意思接近了。' })
    expect(await screen.findByText('意思接近了。')).toBeInTheDocument()
    expect(screen.getByText('接近了，再加固一次')).toBeInTheDocument()
  })

  it('keeps a failed save visible and retries it without clearing later cards', async () => {
    const user = userEvent.setup()
    let shouldFail = true
    const onRate = vi.fn().mockImplementation(async () => {
      if (shouldFail) throw new Error('disk full')
    })
    const secondTask: SessionTask = {
      ...task,
      id: 'task-2',
      trackId: 'track-2',
    }
    const secondTrack: LearningTrack = {
      ...track,
      id: 'track-2',
    }

    render(
      <StudySession
        evaluate={() => ({ rating: 'good', matched: true })}
        initialTasks={[task, secondTask]}
        items={[item]}
        mode="core"
        onExit={vi.fn()}
        onFinish={vi.fn()}
        onRate={onRate}
        tracks={[track, secondTrack]}
        usableThisWeek={0}
      />,
    )

    await user.type(screen.getByLabelText('你记得的中文意思'), '现金流')
    await user.click(screen.getByRole('button', { name: /提交回忆/ }))
    await user.click(screen.getByRole('button', { name: /想起来了/ }))

    expect(await screen.findByText(/1 条复习结果未保存/)).toBeInTheDocument()
    expect(await screen.findByText('2 / 2')).toBeInTheDocument()

    shouldFail = false
    await user.click(screen.getByRole('button', { name: '重试保存' }))
    expect(await screen.findByText('2 / 2')).toBeInTheDocument()
    await vi.waitFor(() => {
      expect(screen.queryByText(/复习结果未保存/)).not.toBeInTheDocument()
    })
    expect(onRate).toHaveBeenCalledTimes(2)
  })

  it('blocks answering while usage prompts are still being generated', async () => {
    const user = userEvent.setup()
    let resolveEnsure!: (item: VocabularyItem) => void
    const ensureUsageItem = vi.fn().mockImplementation(() => new Promise<VocabularyItem>((resolve) => {
      resolveEnsure = resolve
    }))
    const usageTask: SessionTask = {
      id: 'task-usage',
      itemId: item.id,
      trackId: `${item.id}:usage`,
      trackType: 'usage',
      isNew: false,
      promptIndex: 0,
    }
    const usageTrack: LearningTrack = {
      ...track,
      id: `${item.id}:usage`,
      type: 'usage',
    }
    const sparseItem: VocabularyItem = {
      ...item,
      usagePrompts: [],
    }

    render(
      <StudySession
        ensureUsageItem={ensureUsageItem}
        evaluate={() => ({ rating: 'good', matched: true })}
        initialTasks={[usageTask]}
        items={[sparseItem]}
        mode="extension"
        onExit={vi.fn()}
        onFinish={vi.fn()}
        onRate={vi.fn()}
        tracks={[usageTrack]}
        usableThisWeek={0}
      />,
    )

    expect(await screen.findByText('正在生成使用题…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /准备题目/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: '想不起来' })).toBeDisabled()

    resolveEnsure({
      ...sparseItem,
      usagePrompts: item.usagePrompts,
    })
    expect(await screen.findByRole('button', { name: '想不起来' })).toBeEnabled()
    expect(screen.getByRole('button', { name: /提交回忆/ })).toBeDisabled()
  })
})
