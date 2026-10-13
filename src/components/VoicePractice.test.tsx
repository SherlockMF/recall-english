import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { VoicePractice } from './VoicePractice'
import { VoiceSession } from '../lib/voice/session'

vi.mock('../lib/voice/session', async (original) => {
  const actual = await original<typeof import('../lib/voice/session')>()
  return { ...actual, VoiceSession: vi.fn(function (this: Record<string, unknown>, options: { onChange: (state: unknown) => void }) {
    this.start = vi.fn(async () => options.onChange({ ...actual.EMPTY_VOICE_SNAPSHOT, phase: 'ready' }))
    this.end = vi.fn(() => options.onChange({ ...actual.EMPTY_VOICE_SNAPSHOT, phase: 'ended', notice: '本次对话已结束。' }))
    this.setMuted = vi.fn()
    this.pause = vi.fn(() => options.onChange({ ...actual.EMPTY_VOICE_SNAPSHOT, phase: 'paused', elapsedSeconds: 15 }))
    this.resume = vi.fn(async () => options.onChange({ ...actual.EMPTY_VOICE_SNAPSHOT, phase: 'ready', elapsedSeconds: 15 }))
    this.requestHelp = vi.fn()
  }) }
})

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('VoicePractice', () => {
  it('offers pause and resume without starting another practice or allowing preparation edits', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ configured: true, model: 'qwen3.8-omni-flash-realtime', maxSeconds: null }))))
    const user = userEvent.setup()
    render(<VoicePractice items={[]} accent="uk" />)
    await user.click(screen.getByRole('button', { name: /实时畅聊/ }))
    await screen.findByText('千问语音已配置')
    await user.click(screen.getByRole('button', { name: '开始对话' }))
    await user.click(screen.getByRole('button', { name: '暂停对话' }))
    expect(screen.getByText('对话已暂停，麦克风已关闭')).toBeInTheDocument()
    expect(screen.getByLabelText('已练习 15 秒')).toHaveTextContent('0:15')
    expect(screen.getByRole('button', { name: '中文解释' })).toBeDisabled()
    expect(screen.getByRole('textbox', { name: /场景说明/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: '切换模式' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '继续对话' }))
    expect(screen.getByRole('button', { name: '暂停对话' })).toBeEnabled()
    expect(VoiceSession).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: '暂停对话' }))
    await user.click(screen.getByRole('button', { name: '结束对话' }))
    expect(screen.getByRole('button', { name: '重新开始对话' })).toBeEnabled()
  })
  it('explains missing server configuration without requesting microphone permission', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ configured: false, model: 'qwen3.8-omni-flash-realtime', maxSeconds: null }))))
    render(<VoicePractice items={[]} accent="uk" />)
    await userEvent.click(screen.getByRole('button', { name: /实时畅聊/ }))
    expect(await screen.findByText(/语音服务尚未配置/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /开始对话/ })).toBeDisabled()
    expect(VoiceSession).not.toHaveBeenCalled()
  })

  it('offers all scenarios and releases the call when navigating away', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ configured: true, model: 'qwen3.8-omni-flash-realtime', maxSeconds: null }))))
    const user = userEvent.setup()
    const view = render(<VoicePractice items={[]} accent="us" />)
    await user.click(screen.getByRole('button', { name: /实时畅聊/ }))
    await screen.findByText('千问语音已配置')
    await user.click(screen.getByRole('button', { name: /商务沟通/ }))
    await user.type(screen.getByRole('textbox', { name: /场景说明/ }), '与客户协商交货日期')
    await user.click(screen.getByRole('button', { name: /开始对话/ }))
    expect(VoiceSession).toHaveBeenCalledWith(expect.objectContaining({ scenario: 'business', accent: 'us', scenarioDescription: '与客户协商交货日期' }))
    expect(screen.getByRole('textbox', { name: /场景说明/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: '结束对话' })).toBeInTheDocument()
    const call = vi.mocked(VoiceSession).mock.instances[0]
    view.unmount()
    expect(call.end).toHaveBeenCalledTimes(1)
  })

  it('chooses a mode without opening the microphone and preserves preparation when switching', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ configured: true }))))
    const user = userEvent.setup()
    render(<VoicePractice items={[]} accent="uk" />)
    expect(screen.getByRole('button', { name: /实时畅聊/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /语音消息/ })).toBeInTheDocument()
    expect(VoiceSession).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /实时畅聊/ }))
    await user.click(screen.getByRole('button', { name: /商务沟通/ }))
    await user.type(screen.getByRole('textbox', { name: /场景说明/ }), '介绍我的创业想法')
    await user.selectOptions(screen.getByRole('combobox'), 'advanced')
    await user.click(screen.getByRole('button', { name: '切换模式' }))
    await user.click(screen.getByRole('button', { name: /语音消息/ }))
    expect(screen.getByRole('button', { name: /商务沟通/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('combobox')).toHaveValue('advanced')
    expect(screen.getByRole('textbox', { name: /场景说明/ })).toHaveValue('介绍我的创业想法')
    expect(VoiceSession).not.toHaveBeenCalled()
  })

  it('keeps a separate description for each category and permits an empty custom scene', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ configured: true, model: 'qwen3.8-omni-flash-realtime', maxSeconds: null }))))
    const user = userEvent.setup()
    render(<VoicePractice items={[]} accent="uk" />)
    await user.click(screen.getByRole('button', { name: /实时畅聊/ }))
    expect(screen.getByText(/例如：点餐、问路、购物/)).toBeInTheDocument()
    const field = screen.getByRole('textbox', { name: /场景说明/ })
    expect(field).toHaveAttribute('maxlength', '500')
    await user.type(field, '我在机场问路')
    await user.click(screen.getByRole('button', { name: /自定义/ }))
    expect(field).toHaveValue('')
    await user.type(field, '聊我喜欢的科幻电影')
    await user.click(screen.getByRole('button', { name: /日常生活/ }))
    expect(field).toHaveValue('我在机场问路')
    await user.click(screen.getByRole('button', { name: /自定义/ }))
    expect(field).toHaveValue('聊我喜欢的科幻电影')
    await user.clear(field)
    await screen.findByText('千问语音已配置')
    await user.click(screen.getByRole('button', { name: /开始对话/ }))
    expect(VoiceSession).toHaveBeenCalledWith(expect.objectContaining({ scenario: 'custom', scenarioDescription: '' }))
  })
})
