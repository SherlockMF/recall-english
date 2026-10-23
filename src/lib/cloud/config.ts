export function isCloudEnabled() {
  return Boolean(import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)
}

export function cloudConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  if (!url || !key) throw new Error('云端登录配置不完整，请联系管理员。')
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:' && !(import.meta.env.DEV && ['localhost', '127.0.0.1'].includes(parsed.hostname))) throw new Error('云端登录地址必须使用 HTTPS。')
  return { url: parsed.origin, key }
}
