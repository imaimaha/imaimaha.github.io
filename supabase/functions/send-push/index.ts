import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push'

const SB_URL        = Deno.env.get('SUPABASE_URL')!
const SB_KEY        = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SB_ANON       = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const VAPID_PUBLIC  = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_MAILTO  = Deno.env.get('VAPID_MAILTO') ?? 'mailto:admin@example.com'

webpush.setVapidDetails(VAPID_MAILTO, VAPID_PUBLIC, VAPID_PRIVATE)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors() })

  const auth = req.headers.get('Authorization') ?? ''
  const isService = auth === `Bearer ${SB_KEY}`

  // 認証されたユーザーのIDを取得（クライアント経由の場合）
  let authenticatedUid: string | null = null
  if (!isService) {
    if (!auth.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)
    try {
      const userSb = createClient(SB_URL, SB_ANON, { global: { headers: { Authorization: auth } } })
      const { data: { user }, error } = await userSb.auth.getUser()
      if (error || !user) return json({ error: 'Invalid JWT' }, 401)
      authenticatedUid = user.id
    } catch (e) {
      return json({ error: 'Auth check failed' }, 401)
    }
  }

  const body = await req.json()
  const { title, body: msgBody, url, sender_user_id, recipient_user_id, replier_id } = body

  // クライアント経由の場合は sender を強制的に認証ユーザーに上書き（なりすまし防止）
  const effectiveSender = isService ? sender_user_id : authenticatedUid

  const sb = createClient(SB_URL, SB_KEY)

  let query = sb.from('push_subscriptions').select('*')
  if (recipient_user_id) query = query.eq('user_id', recipient_user_id)
  else if (effectiveSender) query = query.neq('user_id', effectiveSender)

  const { data: subs } = await query
  if (!subs?.length) return json({ ok: true, sent: 0 })

  const payload = JSON.stringify({
    title: title ?? 'Notre Endroit',
    body: msgBody ?? '',
    url: url ?? '/',
    replier_id: replier_id ?? null,
  })

  let sent = 0
  await Promise.all(subs.map(async (sub: Record<string, unknown>) => {
    try {
      await webpush.sendNotification(sub.subscription as webpush.PushSubscription, payload)
      sent++
    } catch (e: unknown) {
      const status = (e as { statusCode?: number }).statusCode
      if (status === 410 || status === 404) {
        await sb.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }))

  return json({ ok: true, sent })
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors() },
  })
}

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}
