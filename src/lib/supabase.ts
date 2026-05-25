import { createClient } from '@supabase/supabase-js'

const e = (key: string) => {
  const v = process.env[key] ?? ''
  return v.charCodeAt(0) === 0xFEFF ? v.slice(1) : v
}

export const supabase = createClient(
  e('NEXT_PUBLIC_SUPABASE_URL'),
  e('NEXT_PUBLIC_SUPABASE_ANON_KEY')
)
