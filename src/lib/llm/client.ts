import {
  DEEPSEEK_API_BASE,
  DEEPSEEK_CHAT_PATH,
  DEEPSEEK_MODEL,
  DEEPSEEK_TIMEOUT_MS,
} from './constants'
import { getDeepseekApiKey } from './config'

export type LlmErrorCode =
  | 'missing-key'
  | 'timeout'
  | 'http'
  | 'invalid-response'
  | 'aborted'
  | 'network'

export class LlmError extends Error {
  readonly code: LlmErrorCode
  readonly status?: number

  constructor(code: LlmErrorCode, message: string, status?: number) {
    super(message)
    this.name = 'LlmError'
    this.code = code
    this.status = status
  }
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatJsonOptions {
  messages: ChatMessage[]
  signal?: AbortSignal
  timeoutMs?: number
  /** Extra attempts after a retryable failure (429 / 5xx / network). Default 0. */
  retries?: number
}

function isRetryable(error: unknown): boolean {
  if (!(error instanceof LlmError)) return false
  if (error.code === 'network') return true
  if (error.code !== 'http') return false
  return error.status === 429 || (error.status !== undefined && error.status >= 500)
}

export async function chatJson(options: ChatJsonOptions): Promise<unknown> {
  const attempts = Math.max(0, options.retries ?? 0) + 1
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt))
      if (options.signal?.aborted) {
        throw new LlmError('aborted', '请求已取消。')
      }
    }
    try {
      return await chatJsonOnce(options)
    } catch (error) {
      if (attempt === attempts - 1 || !isRetryable(error)) throw error
    }
  }
  throw new LlmError('network', 'DeepSeek 请求失败。')
}

async function chatJsonOnce(options: ChatJsonOptions): Promise<unknown> {
  const apiKey = getDeepseekApiKey()
  if (!apiKey) {
    throw new LlmError('missing-key', '未配置 DeepSeek API Key。')
  }

  const timeoutMs = options.timeoutMs ?? DEEPSEEK_TIMEOUT_MS
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  options.signal?.addEventListener('abort', onAbort, { once: true })
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${DEEPSEEK_API_BASE}${DEEPSEEK_CHAT_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: options.messages,
        response_format: { type: 'json_object' },
        thinking: { type: 'disabled' },
        stream: false,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      let detail = `DeepSeek 请求失败（${response.status}）。`
      try {
        const payload = await response.json() as { error?: { message?: string } }
        if (payload.error?.message) detail = payload.error.message
      } catch {
        // ignore body parse errors
      }
      throw new LlmError('http', detail, response.status)
    }

    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string | null } }>
    }
    const content = payload.choices?.[0]?.message?.content
    if (typeof content !== 'string' || !content.trim()) {
      throw new LlmError('invalid-response', 'DeepSeek 返回了空内容。')
    }

    try {
      return JSON.parse(content) as unknown
    } catch {
      throw new LlmError('invalid-response', 'DeepSeek 返回的 JSON 无法解析。')
    }
  } catch (error) {
    if (error instanceof LlmError) throw error
    if (options.signal?.aborted) {
      throw new LlmError('aborted', '请求已取消。')
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new LlmError(
        'timeout',
        'DeepSeek 请求超时。可能是网络较慢或 Key/代理异常，请稍后重试；也可手动填写并选择使用场景。',
      )
    }
    throw new LlmError(
      'network',
      error instanceof Error ? error.message : '网络错误，无法调用 DeepSeek。',
    )
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', onAbort)
  }
}
