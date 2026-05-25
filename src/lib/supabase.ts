import { createClient } from '@supabase/supabase-js'

const stripBom = (v: string) => v.charCodeAt(0) === 0xFEFF ? v.slice(1) : v

export const supabase = createClient(
  stripBom(process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''),
  stripBom(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '')
)
