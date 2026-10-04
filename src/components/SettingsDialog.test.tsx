import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../domain/types'
import { SettingsDialog } from './SettingsDialog'

afterEach(cleanup)

it('saves a shared daily budget and permits review-only days', async () => {
  const user = userEvent.setup()
  const save = vi.fn().mockResolvedValue(undefined)
  render(<SettingsDialog
    settings={DEFAULT_SETTINGS} vocabularyCount={0} attemptCount={0}
    onClose={vi.fn()} onSave={save} onExport={vi.fn()} onExportVocabulary={vi.fn()}
    onImport={vi.fn()} onImportVocabulary={vi.fn()}
  />)
  const minutes = screen.getByRole('spinbutton', { name: '每日学习分钟' })
  await user.clear(minutes)
  await user.type(minutes, '20')
  const words = screen.getByRole('spinbutton', { name: '每日新表达上限' })
  await user.clear(words)
  await user.type(words, '0')
  await user.click(screen.getByRole('button', { name: '保存设置' }))
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ dailyMinutes: 20, newItemsPerDay: 0 }))
})

it('rejects invalid budgets without saving or silently rounding', async () => {
  const user = userEvent.setup()
  const save = vi.fn()
  render(<SettingsDialog
    settings={DEFAULT_SETTINGS} vocabularyCount={0} attemptCount={0}
    onClose={vi.fn()} onSave={save} onExport={vi.fn()} onExportVocabulary={vi.fn()}
    onImport={vi.fn()} onImportVocabulary={vi.fn()}
  />)
  const minutes = screen.getByRole('spinbutton', { name: '每日学习分钟' })
  await user.clear(minutes)
  await user.type(minutes, '4.5')
  await user.click(screen.getByRole('button', { name: '保存设置' }))
  expect(save).not.toHaveBeenCalled()
  expect(screen.getByText('学习时长须为 5—120 的整数，新表达上限须为 0—100 的整数。')).toBeInTheDocument()
})

it('refreshes draft fields when a backup replaces the settings', () => {
  const props = {
    vocabularyCount: 0, attemptCount: 0, onClose: vi.fn(), onSave: vi.fn(),
    onExport: vi.fn(), onExportVocabulary: vi.fn(), onImport: vi.fn(), onImportVocabulary: vi.fn(),
  }
  const { rerender } = render(<SettingsDialog {...props} settings={DEFAULT_SETTINGS} />)
  rerender(<SettingsDialog {...props} settings={{ ...DEFAULT_SETTINGS, dailyMinutes: 40, newItemsPerDay: 12 }} />)
  expect(screen.getByRole('spinbutton', { name: '每日学习分钟' })).toHaveValue(40)
  expect(screen.getByRole('spinbutton', { name: '每日新表达上限' })).toHaveValue(12)
})
