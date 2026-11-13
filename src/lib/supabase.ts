import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Without credentials the app runs in demo mode: sample data, stored in this browser only. */
export const isSupabaseConfigured = Boolean(url && anonKey)
export const supabaseUrl = url ?? ''
export const supabaseAnonKey = anonKey ?? ''

export const supabase: SupabaseClient | null = isSupabaseConfigured ? createClient(url!, anonKey!) : null
