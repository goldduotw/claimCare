import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// This 'createBrowserClient' is what actually talks to the browser 
// to save the 'sb-' cookies you are missing.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

export const loginWithGoogle = async () => {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      // This MUST match one of the Redirect URLs in your dashboard exactly
      redirectTo: `${window.location.origin}/auth/callback`,
    }
  })
}