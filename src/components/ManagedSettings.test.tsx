import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { SettingsDialog } from './SettingsDialog'
import { DEFAULT_SETTINGS } from '../domain/types'

afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals() })

it('shows managed service status without exposing either provider credential editor', async () => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'test-publishable')
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ managed: true, configured: true, model: 'qwen3.8-omni-flash-realtime', maxSeconds: null }))))
  render(<SettingsDialog settings={DEFAULT_SETTINGS} vocabularyCount={1} attemptCount={0} onClose={vi.fn()} onSave={vi.fn()} onExport={vi.fn()} onImport={vi.fn()} onExportVocabulary={vi.fn()} onImportVocabulary={vi.fn()} />)
  expect(screen.queryByLabelText('DeepSeek API Key')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('千问 API Key')).not.toBeInTheDocument()
  expect(await screen.findByText('千问语音已配置')).toBeInTheDocument()
  expect(screen.getByText(/当前账号的本机缓存/)).toBeInTheDocument()
})
