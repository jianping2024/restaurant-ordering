import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

export type PrintAgentSessionTokens = {
  access_token: string;
  refresh_token: string;
};

/**
 * Mint a Supabase Auth session for the print_agent user without knowing the password
 * (Admin generateLink + verifyOtp).
 */
export async function mintPrintAgentSession(
  admin: SupabaseClient,
  email: string,
): Promise<PrintAgentSessionTokens | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return null;
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });

  if (linkError || !linkData?.properties?.hashed_token) {
    console.error('print_agent mint: generateLink failed', linkError?.message);
    return null;
  }

  const verifyClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: sessionData, error: verifyError } = await verifyClient.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'email',
  });

  if (verifyError || !sessionData.session?.access_token || !sessionData.session.refresh_token) {
    console.error('print_agent mint: verifyOtp failed', verifyError?.message);
    return null;
  }

  return {
    access_token: sessionData.session.access_token,
    refresh_token: sessionData.session.refresh_token,
  };
}

export function printAgentAnonKey(): string | null {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return key && key.length > 0 ? key : null;
}
