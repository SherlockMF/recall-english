import { DEEPSEEK_API_KEY_STORAGE } from './constants'
import { isCloudEnabled } from '../cloud/config'

export function getDeepseekApiKey(): string {
  try {
    return (localStorage.getItem(DEEPSEEK_API_KEY_STORAGE) ?? '').trim()
  } catch {
    return ''
  }
}

export function setDeepseekApiKey(key: string): void {
  const cleaned = key.trim()
  if (!cleaned) {
    clearDeepseekApiKey()
    return
  }
  localStorage.setItem(DEEPSEEK_API_KEY_STORAGE, cleaned)
}

export function clearDeepseekApiKey(): void {
  try {
    localStorage.removeItem(DEEPSEEK_API_KEY_STORAGE)
  } catch {
    // ignore storage failures
  }
}

export function hasDeepseekApiKey(): boolean {
  return isCloudEnabled() || getDeepseekApiKey().length > 0
}
