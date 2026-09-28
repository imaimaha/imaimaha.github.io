import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SB_URL = Deno.env.get('SUPABASE_URL')!
const SB_KEY = (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!
const SB_ANON = Deno.env.get('SB_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const PROXY_SECRET = Deno.env.get('OLLAMA_PROXY_SECRET') ?? ''

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)
  let uid: string
  try {
    const userSb = createClient(SB_URL, SB_ANON, { global: { headers: { Authorization: auth } } })
    const { data: { user }, error } = await userSb.auth.getUser()
    if (error || !user) return json({ error: 'Invalid JWT' }, 401)
    uid = user.id
  } catch {
    return json({ error: 'Auth failed' }, 401)
  }

  const { entry_id } = await req.json().catch(() => ({}))
  if (!entry_id) return json({ error: 'entry_id required' }, 400)

  const sb = createClient(SB_URL, SB_KEY)

  const { data: entry, error: fetchErr } = await sb
    .from('diary_entries').select('id, user_id, mood, body').eq('id', entry_id).maybeSingle()
  if (fetchErr || !entry) return json({ error: 'entry not found' }, 404)
  if (entry.user_id !== uid) return json({ error: 'forbidden' }, 403)
  if (!entry.body) return json({ ok: false, error: 'empty body' })

  const { data: setting } = await sb.from('settings').select('value').eq('key', 'ollama_tunnel_url').maybeSingle()
  const tunnelUrl = setting?.value
  if (!tunnelUrl || !PROXY_SECRET) return json({ ok: false, error: 'ローカルAI未設定' })

  const prompt =
    `あなたは優しい相棒AI。以下の日記への一言コメントを日本語で書いて。\n` +
    `条件: 20〜40文字程度、共感的で温かいトーン、絵文字は最大1つまで、前置きや説明なしでコメント本文だけを返すこと。\n\n` +
    `きもち: ${entry.mood || 'なし'}\n日記:\n${entry.body}`

  let comment: string
  try {
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), 45000)
    const res = await fetch(`${tunnelUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${PROXY_SECRET}` },
      body: JSON.stringify({ model: 'qwen2.5-coder:7b', prompt, stream: false }),
      signal: ac.signal,
    })
    clearTimeout(t)
    if (!res.ok) return json({ ok: false, error: `ollama proxy HTTP ${res.status}` })
    const data = await res.json()
    comment = String(data.response || '').trim().slice(0, 200)
    if (!comment) return json({ ok: false, error: 'empty response' })
  } catch (e) {
    return json({ ok: false, error: `ローカルPCに繋がらなかった: ${String(e)}` })
  }

  const { error: updErr } = await sb.from('diary_entries').update({ ai_comment: comment }).eq('id', entry_id)
  if (updErr) return json({ ok: false, error: updErr.message })

  return json({ ok: true, comment })
})
