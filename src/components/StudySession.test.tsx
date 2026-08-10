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
})
