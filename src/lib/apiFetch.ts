let tokenProvider: (() => Promise<string | null>) | null = null

export function setApiTokenProvider(provider: typeof tokenProvider) {
  tokenProvider = provider
}

export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const provider = tokenProvider
  if (!provider) return fetch(path, options)
  if (!path.startsWith('/api/') || path.startsWith('//')) throw new Error('仅允许同源 API 请求。')
  const token = await provider()
  if (!token || tokenProvider !== provider) throw new Error('登录已失效，请重新登录。')
  const headers = new Headers(options?.headers)
  headers.set('Authorization', `Bearer ${token}`)
  return fetch(path, { ...options, headers })
}
