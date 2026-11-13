import { createPluggyHandler } from './handler.ts'

Deno.serve(createPluggyHandler({
  SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
  SUPABASE_ANON_KEY: Deno.env.get('SUPABASE_ANON_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  PLUGGY_CLIENT_ID: Deno.env.get('PLUGGY_CLIENT_ID'),
  PLUGGY_CLIENT_SECRET: Deno.env.get('PLUGGY_CLIENT_SECRET'),
  LORO_ALLOWED_ORIGINS: Deno.env.get('LORO_ALLOWED_ORIGINS'),
}))
