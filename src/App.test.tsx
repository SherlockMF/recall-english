import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { afterEach, beforeEach } from 'vitest'
import App from './App'
import { clearDatabase, closeDatabase, putSettings, putStudyTimeEntry } from './lib/db'
import { DEFAULT_SETTINGS } from './domain/types'

describe('App integration', () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  afterEach(async () => {
    cleanup()
    await closeDatabase()
  })

  it('seeds the local library and starts a no-choice recall session', async () => {
    const user = userEvent.setup()
    render(<StrictMode><App /></StrictMode>)

    expect(await screen.findByText('15 分钟每日计划', {}, { timeout: 20_000 })).toBeInTheDocument()
    expect(screen.getByText('看见学习证据')).toBeInTheDocument()
    expect(screen.getByText('日常生活')).toBeInTheDocument()
    expect(screen.getByText('商业英语')).toBeInTheDocument()
    expect(screen.getByText('金融会计')).toBeInTheDocument()
    expect(screen.getByText('0 / 3041')).toBeInTheDocument()
    expect(screen.getByText('0 / 2351')).toBeInTheDocument()
    expect(screen.getByText('0 / 2113')).toBeInTheDocument()
    expect(screen.getByLabelText('学习进度：已开始 0，双向可回忆 0，词库 7497')).toBeInTheDocument()
    expect(screen.getByText('学习进度')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /开始今天的训练/ }))
    expect(screen.getByRole('button', { name: '想不起来' })).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  }, 30_000)

  it('opens all three primary sections', async () => {
    const user = userEvent.setup()
    render(<StrictMode><App /></StrictMode>)
    await screen.findByText('15 分钟每日计划', {}, { timeout: 20_000 })

    const addButtons = screen.getAllByRole('button', { name: '添加' })
    await user.click(addButtons[0])
    expect(await screen.findByText('把今天遇到的词，变成明天能想起的表达。')).toBeInTheDocument()

    const libraryButtons = screen.getAllByRole('button', { name: '词库' })
    await user.click(libraryButtons[0])
    expect(await screen.findByText('词库不是收藏夹，是你的表达工具箱。')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('7497')).toBeInTheDocument(), { timeout: 20_000 })
  }, 30_000)

  it('uses saved time from both kinds of practice in one displayed and executable daily plan', async () => {
    const user = userEvent.setup()
    const now = new Date()
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    await putSettings({ ...DEFAULT_SETTINGS, dailyMinutes: 20, newItemsPerDay: 2 })
    for (const [sessionId, activeMs] of [['core', 480_000], ['application', 420_000]] as const) {
      await putStudyTimeEntry({ id: `${sessionId}:${localDate}`, sessionId, localDate, activeMs, updatedAt: now.toISOString() })
    }
    render(<StrictMode><App /></StrictMode>)
    expect(await screen.findByText('20 分钟每日计划', {}, { timeout: 20_000 })).toBeInTheDocument()
    expect(screen.getByText('已学习 15 分钟 · 今日剩余 5 分钟')).toBeInTheDocument()
    expect(screen.getByLabelText('预计 3 分钟，共 4 道练习')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /开始今天的训练/ }))
    expect(screen.getByRole('button', { name: '想不起来' })).toBeInTheDocument()
  }, 30_000)
})
