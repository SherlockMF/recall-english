import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { afterEach, beforeEach } from 'vitest'
import App from './App'
import { clearDatabase, closeDatabase } from './lib/db'

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

    expect(await screen.findByText('15 分钟核心训练', {}, { timeout: 10_000 })).toBeInTheDocument()
    expect(screen.getByText('0 / 96')).toBeInTheDocument()
    expect(screen.getByText('0 / 60')).toBeInTheDocument()
    expect(screen.getByText('0 / 28')).toBeInTheDocument()
    expect(screen.getByText('0 / 63')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /开始今天的训练/ }))
    expect(await screen.findByText('核心训练')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '想不起来' })).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  }, 15_000)

  it('opens all three primary sections', async () => {
    const user = userEvent.setup()
    render(<StrictMode><App /></StrictMode>)
    await screen.findByText('15 分钟核心训练', {}, { timeout: 10_000 })

    const addButtons = screen.getAllByRole('button', { name: '添加' })
    await user.click(addButtons[0])
    expect(await screen.findByText('把今天遇到的词，变成明天能想起的表达。')).toBeInTheDocument()

    const libraryButtons = screen.getAllByRole('button', { name: '词库' })
    await user.click(libraryButtons[0])
    expect(await screen.findByText('词库不是收藏夹，是你的表达工具箱。')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('240')).toBeInTheDocument())
  }, 15_000)
})
