import { createClient } from '@supabase/supabase-js'

/**
 * Server-side Supabase client with service role key.
 * Use this in API routes that need write access or auth verification.
 */
export function createSupabaseServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}
