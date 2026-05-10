import { createClient } from '@supabase/supabase-js';

// Strip trailing slashes and /rest/v1 suffix — common copy-paste mistake from Supabase dashboard
function cleanSupabaseUrl(raw: string | undefined): string {
  if (!raw) return '';
  // Remove /rest/v1, /rest/v1/ and any trailing slashes
  return raw.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
}

const supabaseUrl = cleanSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || supabaseUrl.includes('your_supabase')) {
  console.error(
    '[Mino] NEXT_PUBLIC_SUPABASE_URL is not configured — set it in .env.local'
  );
}

/**
 * Browser client — uses anon key, safe for client components
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Server-side admin client — uses service role key
 * ONLY import in server-side code (API routes, Server Components)
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
