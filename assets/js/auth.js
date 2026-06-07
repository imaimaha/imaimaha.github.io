const SUPABASE_URL = 'https://qivnfiqyjfajlzbdqodd.supabase.co'
const SUPABASE_KEY = 'sb_publishable_PR_chyGmNVRJJ24eVqlqYg_CGAOjfpx'

const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)

async function requireAuth() {
  const { data: { session } } = await client.auth.getSession()
  if (!session) {
    window.location.href = '/login.html'
  }
  return session
}

async function logout() {
  await client.auth.signOut()
  window.location.href = '/login.html'
}
