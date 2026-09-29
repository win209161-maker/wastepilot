import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables')
}

// Using untyped client to avoid conflicts with computed columns (balance GENERATED ALWAYS AS)
// Runtime types are correct; TypeScript generics can be added back once DB is stable
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
