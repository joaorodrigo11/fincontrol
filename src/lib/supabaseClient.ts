import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

let client: SupabaseClient<Database> | undefined

export function getSupabaseClient(): SupabaseClient<Database> {
  if (client) return client

  const { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY } = import.meta.env
  if (!VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY) {
    throw new Error(
      'Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.local.',
    )
  }

  let supabaseUrl: URL
  try {
    supabaseUrl = new URL(VITE_SUPABASE_URL)
  } catch {
    throw new Error('VITE_SUPABASE_URL precisa ser uma URL válida do projeto Supabase.')
  }

  if (
    (supabaseUrl.protocol !== 'https:' && supabaseUrl.hostname !== 'localhost') ||
    supabaseUrl.pathname !== '/' ||
    supabaseUrl.search ||
    supabaseUrl.hash
  ) {
    throw new Error(
      'VITE_SUPABASE_URL deve ser a URL base do projeto, sem caminhos como /rest/v1.',
    )
  }

  client = createClient<Database>(supabaseUrl.origin, VITE_SUPABASE_ANON_KEY)
  return client
}
