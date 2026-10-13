import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { VoiceServiceStatus } from './VoiceServiceStatus'

let configured: boolean
let request: ReturnType<typeof vi.fn>
beforeEach(() => {
  configured = false
  request = vi.fn(async (_url, options) => {
    if (options?.method === 'PUT') configured = true
    if (options?.method === 'DELETE') configured = false
    return new Response(JSON.stringify({ configured, model: 'qwen3.8-omni-flash-realtime', maxSeconds: null }))
  })
  vi.stubGlobal('fetch', request)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers() })

it('saves from settings, clears typed secrets, and clears the saved configuration', async () => {
  const user = userEvent.setup()
  render(<VoiceServiceStatus />)
  const badge = screen.getByLabelText('千问 Key 状态')
  await waitFor(() => expect(badge).toHaveTextContent('未配置'))
  await user.type(screen.getByLabelText('千问 API Key'), 'fake-ui-test-key')
  await user.type(screen.getByLabelText('北京业务空间 ID'), 'test-workspace')
  expect(badge).toHaveTextContent('待保存')
  await user.click(screen.getByRole('button', { name: '保存口语配置' }))
  await screen.findByText('已保存口语配置，下次连接时生效。')
  expect(request).toHaveBeenCalledWith('/api/voice/config', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ apiKey: 'fake-ui-test-key', workspaceId: 'test-workspace' }) }))
  expect(screen.getByLabelText('千问 API Key')).toHaveValue('')
  expect(screen.getByLabelText('北京业务空间 ID')).toHaveValue('')
  expect(screen.getByLabelText('千问 API Key')).toHaveAttribute('type', 'password')
  await screen.findByText('千问语音已配置')
  expect(badge).toHaveTextContent('已保存')
  await user.click(screen.getByRole('button', { name: '清除口语配置' }))
  await screen.findByText('已清除口语配置。')
  await waitFor(() => expect(request).toHaveBeenCalledWith('/api/voice/config', expect.objectContaining({ method: 'DELETE' })))
  await screen.findByText('语音服务尚未配置')
  expect(badge).toHaveTextContent('未配置')
})

it('reports failed saves without claiming success or clearing the draft', async () => {
  const user = userEvent.setup()
  request.mockImplementation(async (_url, options) => new Response(JSON.stringify(options?.method === 'PUT' ? { error: { message: '无法保存本机配置。' } } : { configured: false, model: 'qwen3.8-omni-flash-realtime', maxSeconds: null }), { status: options?.method === 'PUT' ? 500 : 200 }))
  render(<VoiceServiceStatus />)
  await user.type(screen.getByLabelText('千问 API Key'), 'fake-ui-test-key')
  await user.type(screen.getByLabelText('北京业务空间 ID'), 'test-workspace')
  await user.click(screen.getByRole('button', { name: '保存口语配置' }))
  await screen.findByText('无法保存本机配置。')
  expect(screen.getByLabelText('千问 Key 状态')).toHaveTextContent('需检查')
  expect(screen.getByLabelText('千问 API Key')).toHaveValue('fake-ui-test-key')
  expect(screen.queryByText('已保存口语配置，下次连接时生效。')).not.toBeInTheDocument()
})

it('lets the user retry a timed-out save', async () => {
  vi.useFakeTimers()
  request.mockImplementation(async (_url, options) => {
    if (options?.method === 'PUT') return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))))
    return new Response(JSON.stringify({ configured: false, model: 'qwen3.8-omni-flash-realtime', maxSeconds: null }))
  })
  render(<VoiceServiceStatus />)
  fireEvent.change(screen.getByLabelText('千问 API Key'), { target: { value: 'fake-ui-test-key' } })
  fireEvent.change(screen.getByLabelText('北京业务空间 ID'), { target: { value: 'test-workspace' } })
  fireEvent.click(screen.getByRole('button', { name: '保存口语配置' }))
  await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
  expect(screen.getByText('更新口语配置超时，请重新检查服务状态后重试。')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '保存口语配置' })).toBeEnabled()
  expect(screen.getByLabelText('千问 API Key')).toHaveValue('fake-ui-test-key')
})

it('aborts pending credential submission when the settings are closed', async () => {
  const user = userEvent.setup()
  let signal: AbortSignal | undefined
  request.mockImplementation(async (_url, options) => {
    if (options?.method === 'PUT') return new Promise((_resolve, reject) => {
      signal = options.signal
      options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    })
    return new Response(JSON.stringify({ configured: false, model: 'qwen3.8-omni-flash-realtime', maxSeconds: null }))
  })
  const { unmount } = render(<VoiceServiceStatus />)
  await user.type(screen.getByLabelText('千问 API Key'), 'fake-ui-test-key')
  await user.type(screen.getByLabelText('北京业务空间 ID'), 'test-workspace')
  await user.click(screen.getByRole('button', { name: '保存口语配置' }))
  unmount()
  expect(signal?.aborted).toBe(true)
})
