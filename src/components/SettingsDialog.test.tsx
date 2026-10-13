import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../domain/types'
import { SettingsDialog } from './SettingsDialog'
import { clearDeepseekApiKey, getDeepseekApiKey } from '../lib/llm/config'

afterEach(() => { cleanup(); vi.restoreAllMocks(); clearDeepseekApiKey() })

it('saves a DeepSeek key directly and retains it when the dialog is reopened', async () => {
  const user = userEvent.setup()
  const save = vi.fn()
  const close = vi.fn()
  const props = {
    settings: DEFAULT_SETTINGS, vocabularyCount: 0, attemptCount: 0,
    onClose: close, onSave: save, onExport: vi.fn(), onExportVocabulary: vi.fn(), onImport: vi.fn(), onImportVocabulary: vi.fn(),
  }
  const { unmount } = render(<SettingsDialog {...props} />)
  await user.type(screen.getByLabelText('DeepSeek API Key'), 'fake-direct-save-key')
  await user.click(screen.getByRole('button', { name: '保存 DeepSeek Key' }))
  expect(screen.getByLabelText('DeepSeek Key 状态')).toHaveTextContent('已保存')
  expect(screen.getByText('已保存 DeepSeek API Key。')).toBeInTheDocument()
  expect(getDeepseekApiKey()).toBe('fake-direct-save-key')
  expect(save).not.toHaveBeenCalled()
  expect(close).not.toHaveBeenCalled()
  unmount()
  render(<SettingsDialog {...props} />)
  expect(screen.getByLabelText('DeepSeek Key 状态')).toHaveTextContent('已保存')
  expect(screen.getByLabelText('DeepSeek API Key')).toHaveValue('fake-direct-save-key')
})

it('reports browser storage failures without marking the DeepSeek draft as saved', async () => {
  const user = userEvent.setup()
  render(<SettingsDialog
    settings={DEFAULT_SETTINGS} vocabularyCount={0} attemptCount={0}
    onClose={vi.fn()} onSave={vi.fn()} onExport={vi.fn()} onExportVocabulary={vi.fn()} onImport={vi.fn()} onImportVocabulary={vi.fn()}
  />)
  await user.type(screen.getByLabelText('DeepSeek API Key'), 'fake-storage-failure-key')
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError') })
  await user.click(screen.getByRole('button', { name: '保存 DeepSeek Key' }))
  expect(screen.getByLabelText('DeepSeek Key 状态')).toHaveTextContent('需检查')
  expect(screen.getByText('无法更新 DeepSeek Key，请检查浏览器存储权限后重试。')).toBeInTheDocument()
  expect(screen.getByLabelText('DeepSeek API Key')).toHaveValue('fake-storage-failure-key')
})

it('distinguishes a drafted DeepSeek key from saved and cleared configuration', async () => {
  const user = userEvent.setup()
  render(<SettingsDialog
    settings={DEFAULT_SETTINGS} vocabularyCount={0} attemptCount={0}
    onClose={vi.fn()} onSave={vi.fn().mockResolvedValue(undefined)} onExport={vi.fn()} onExportVocabulary={vi.fn()}
    onImport={vi.fn()} onImportVocabulary={vi.fn()}
  />)
  const badge = screen.getByLabelText('DeepSeek Key 状态')
  expect(badge).toHaveTextContent('未配置')
  await user.type(screen.getByLabelText('DeepSeek API Key'), 'fake-status-test-key')
  expect(badge).toHaveTextContent('待保存')
  await user.click(screen.getByRole('button', { name: '保存设置' }))
  expect(badge).toHaveTextContent('已保存')
  await user.click(screen.getByRole('button', { name: '清除 API Key' }))
  expect(badge).toHaveTextContent('未配置')
})

it('saves lexical level and adaptive mode, resets their history only when they change', async () => {
  const user = userEvent.setup()
  const save = vi.fn().mockResolvedValue(undefined)
  render(<SettingsDialog settings={DEFAULT_SETTINGS} vocabularyCount={0} attemptCount={0}
    onClose={vi.fn()} onSave={save} onExport={vi.fn()} onExportVocabulary={vi.fn()} onImport={vi.fn()} onImportVocabulary={vi.fn()} />)
  await user.click(screen.getByRole('button', { name: '保存设置' }))
  expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ vocabularyLevel: 'B1', adaptiveDifficulty: true, difficultyResetAt: undefined }))
  await user.selectOptions(screen.getByLabelText('起始词汇难度'), 'C1')
  await user.click(screen.getByLabelText('根据学习表现自动调整'))
  await user.click(screen.getByRole('button', { name: '保存设置' }))
  expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ vocabularyLevel: 'C1', adaptiveDifficulty: false, difficultyResetAt: expect.any(String) }))
})

it('permits review-only days without requiring a time target', async () => {
  const user = userEvent.setup()
  const save = vi.fn().mockResolvedValue(undefined)
  render(<SettingsDialog
    settings={DEFAULT_SETTINGS} vocabularyCount={0} attemptCount={0}
    onClose={vi.fn()} onSave={save} onExport={vi.fn()} onExportVocabulary={vi.fn()}
    onImport={vi.fn()} onImportVocabulary={vi.fn()}
  />)
  expect(screen.queryByRole('spinbutton', { name: '每日学习分钟' })).not.toBeInTheDocument()
  const words = screen.getByRole('spinbutton', { name: '每日新表达数量' })
  await user.clear(words)
  await user.type(words, '0')
  await user.click(screen.getByRole('button', { name: '保存设置' }))
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ dailyMinutes: DEFAULT_SETTINGS.dailyMinutes, newItemsPerDay: 0 }))
})

it('rejects invalid new-word counts without saving or silently rounding', async () => {
  const user = userEvent.setup()
  const save = vi.fn()
  render(<SettingsDialog
    settings={DEFAULT_SETTINGS} vocabularyCount={0} attemptCount={0}
    onClose={vi.fn()} onSave={save} onExport={vi.fn()} onExportVocabulary={vi.fn()}
    onImport={vi.fn()} onImportVocabulary={vi.fn()}
  />)
  const words = screen.getByRole('spinbutton', { name: '每日新表达数量' })
  await user.clear(words)
  await user.type(words, '4.5')
  await user.click(screen.getByRole('button', { name: '保存设置' }))
  expect(save).not.toHaveBeenCalled()
  expect(screen.getByText('新表达数量须为 0—100 的整数。')).toBeInTheDocument()
})

it('refreshes draft fields when a backup replaces the settings', () => {
  const props = {
    vocabularyCount: 0, attemptCount: 0, onClose: vi.fn(), onSave: vi.fn(),
    onExport: vi.fn(), onExportVocabulary: vi.fn(), onImport: vi.fn(), onImportVocabulary: vi.fn(),
  }
  const { rerender } = render(<SettingsDialog {...props} settings={DEFAULT_SETTINGS} />)
  rerender(<SettingsDialog {...props} settings={{ ...DEFAULT_SETTINGS, dailyMinutes: 40, newItemsPerDay: 12 }} />)
  expect(screen.queryByRole('spinbutton', { name: '每日学习分钟' })).not.toBeInTheDocument()
  expect(screen.getByRole('spinbutton', { name: '每日新表达数量' })).toHaveValue(12)
})
