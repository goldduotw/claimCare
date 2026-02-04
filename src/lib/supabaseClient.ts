import { createClient } from '@supabase/supabase-js'

// Use your actual Project URL and Anon Key here
// const supabaseUrl = 'https://ozrktytvrrtmmomvwhay.supabase.co'
// const supabaseAnonKey = 'sb_publishable_Ayzhl7Yg0hkiynf_b4ObUA_9H4H01bc'
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// The login logic that talks to Supabase first
export const loginWithGoogle = async () => {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'https://MBA.goldduo.com'
    }
  })
}