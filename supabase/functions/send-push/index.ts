import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push'

const SB_URL        = Deno.env.get('SUPABASE_URL')!
const SB_KEY        = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC  = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_MAILTO  = Deno.env.get('VAPID_MAILTO') ?? 'mailto:admin@example.com'

webpush.setVapidDetails(VAPID_MAILTO, VAPID_PUBLIC, VAPID_PRIVATE)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors() })

  // サービスロールキーによる内部認証
  const auth = req.headers.get('Authorization') ?? ''
  if (auth !== `Bearer ${SB_KEY}`) return json({ error: 'Unauthorized' }, 401)

  const { title, body, sender_user_id, recipient_user_id, replier_id } = await req.json()
  const sb = createClient(SB_URL, SB_KEY)

  let query = sb.from('push_subscriptions').select('*')
  if (recipient_user_id) query = query.eq('user_id', recipient_user_id)
  else if (sender_user_id) query = query.neq('user_id', sender_user_id)

  const { data: subs } = await query
  if (!subs?.length) return json({ ok: true, sent: 0 })

  const payload = JSON.stringify({
    title: title ?? 'Notre Endroit',
    body: body ?? '',
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
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}
