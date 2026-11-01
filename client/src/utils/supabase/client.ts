import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
  (import.meta.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined) ||
  'https://kqabxdvxeuuenwkjzyar.supabase.co';

const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  (import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  '';

export const createClient = () => createSupabaseClient(supabaseUrl, supabaseAnonKey);
