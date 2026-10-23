import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { cloudConfig } from './config'

let client: SupabaseClient | undefined
export function getCloudClient() {
  if (!client) {
    const { url, key } = cloudConfig()
    client = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  }
  return client
}
