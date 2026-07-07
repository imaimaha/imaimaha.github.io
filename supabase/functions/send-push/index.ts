// send-push: 認証ユーザーからも service_role からも呼べる Web Push 送信関数
// OPTIONS はすぐ返す (preflight)。初期化を handler 内に遅延。

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors() })

  try {
    return await handle(req)
  } catch (e) {
    console.error('[send-push] unhandled:', e)
    return json({ error: 'Internal error: ' + (e?.message ?? String(e)) }, 500)
  }
})

async function handle(req: Request) {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')

  const SB_URL = Deno.env.get('SUPABASE_URL')!
  const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const SB_ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')!
  const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!
  const _vapidRaw = Deno.env.get('VAPID_MAILTO') ?? 'admin@example.com'
  const VAPID_MAILTO = _vapidRaw.startsWith('mailto:') ? _vapidRaw : `mailto:${_vapidRaw}`

  const auth = req.headers.get('Authorization') ?? ''
  // 旧JWT形式(role=service_role) と 新 sb_secret_ 形式のどちらでも service_role として扱う
  const isService = isServiceAuth(auth, SB_KEY)

  let authenticatedUid: string | null = null
  if (!isService) {
    if (!auth.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)
    try {
      const userSb = createClient(SB_URL, SB_ANON, { global: { headers: { Authorization: auth } } })
      const { data: { user }, error } = await userSb.auth.getUser()
      if (error || !user) return json({ error: 'Invalid JWT: ' + (error?.message ?? 'no user') }, 401)
      authenticatedUid = user.id
    } catch (e) {
      return json({ error: 'Auth check failed: ' + (e?.message ?? String(e)) }, 401)
    }
  }

  const body = await req.json().catch(() => ({}))
  const { title, body: msgBody, url, sender_user_id, recipient_user_id, replier_id } = body
  const effectiveSender = isService ? sender_user_id : authenticatedUid

  const sb = createClient(SB_URL, SB_KEY)
  let query = sb.from('push_subscriptions').select('*')
  if (recipient_user_id) query = query.eq('user_id', recipient_user_id)
  else if (effectiveSender) query = query.neq('user_id', effectiveSender)

  const { data: subs, error: qErr } = await query
  if (qErr) return json({ error: 'query failed: ' + qErr.message }, 500)
  if (!subs?.length) return json({ ok: true, sent: 0 })

  // web-push を遅延ロード（モジュール初期化を handler 内に）
  const webpushMod = await import('npm:web-push')
  const webpush = (webpushMod as any).default ?? webpushMod
  try {
    webpush.setVapidDetails(VAPID_MAILTO, VAPID_PUBLIC, VAPID_PRIVATE)
  } catch (e) {
    return json({ error: 'vapid setup failed: ' + (e?.message ?? String(e)) }, 500)
  }

  const payload = JSON.stringify({
    title: title ?? 'Notre Endroit',
    body: msgBody ?? '',
    url: url ?? '/',
    replier_id: replier_id ?? null,
  })

  let sent = 0
  await Promise.all(subs.map(async (sub: Record<string, unknown>) => {
    try {
      await webpush.sendNotification(sub.subscription, payload)
      sent++
    } catch (e: any) {
      const status = e?.statusCode
      if (status === 410 || status === 404) {
        await sb.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }))

  return json({ ok: true, sent })
}

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

// service_role 判定: 新形式 sb_secret_ or 旧JWT(role=service_role) 両対応
function isServiceAuth(auth: string, sbKey: string): boolean {
  if (auth === `Bearer ${sbKey}`) return true
  const token = auth.replace(/^Bearer\s+/i, '').trim()
  if (!token) return false
  const parts = token.split('.')
  if (parts.length !== 3) return false
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const pad = '='.repeat((4 - b64.length % 4) % 4)
    const payload = JSON.parse(atob(b64 + pad))
    return payload?.role === 'service_role' && payload?.iss === 'supabase'
  } catch { return false }
}
