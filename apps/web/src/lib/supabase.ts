import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const FUNCTIONS_BASE = `${supabaseUrl}/functions/v1`

export async function callFunction<T = unknown>(
  name: string,
  body?: Record<string, unknown>,
  opts: { auth?: boolean } = { auth: false },
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${supabaseAnonKey}`,
  }
  if (opts.auth) {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (token) headers.Authorization = `Bearer ${token}`
  }
  const res = await fetch(`${FUNCTIONS_BASE}/${name}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body || {}),
  })
  const json = await res.json()
  if (!res.ok && json?.ok === false) throw new Error(json.error || res.statusText)
  if (!res.ok) throw new Error(json.error || json.message || res.statusText)
  return json as T
}
