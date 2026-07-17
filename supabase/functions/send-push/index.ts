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

  const body = await req.json().catch(() => ({}))

  // ask_reply: SW からの「行っていい？」返答。認証不要（replier_id 宛にのみ送信）
  if (body.ask_reply && body.replier_id) {
    const sb = createClient(SB_URL, SB_KEY)
    return await sendToUser(sb, body.replier_id, {
      title: body.title ?? 'Notre Endroit',
      body: body.body ?? '',
      url: body.url ?? '/status.html',
    }, VAPID_MAILTO, VAPID_PUBLIC, VAPID_PRIVATE)
  }

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

  const { title, body: msgBody, url, sender_user_id, recipient_user_id, replier_id, ask_ok, kind } = body
  const effectiveSender = isService ? sender_user_id : authenticatedUid

  const sb = createClient(SB_URL, SB_KEY)
  let query = sb.from('push_subscriptions').select('*')
  if (recipient_user_id) query = query.eq('user_id', recipient_user_id)
  else if (effectiveSender) query = query.neq('user_id', effectiveSender)

  const { data: subs, error: qErr } = await query
  if (qErr) return json({ error: 'query failed: ' + qErr.message }, 500)

  // 通知履歴に記録（お知らせセンター用）—— サブスクの有無に関わらず、
  // recipient が確定できる場合は必ずログを残す。
  // 戻り値の Map<recipient_user_id, notif_id> を push payload に載せて
  // 通知タップ時に該当行を既読化する
  const notifMap = await logNotifications(sb, {
    title: title ?? 'Notre Endroit',
    body: msgBody ?? '',
    url: url ?? '/',
    sender_id: effectiveSender ?? null,
    recipient_user_id: recipient_user_id ?? null,
    exclude_user_id: recipient_user_id ? null : (effectiveSender ?? null),
    kind: kind ?? null,
  })

  if (!subs?.length) return json({ ok: true, sent: 0 })

  // 受信者ごとの通知設定を尊重: kind を OFF にしている人にはプッシュしない
  // (お知らせセンターの履歴 notifications_log は上で既に記録済みなので残る)
  let sendSubs = subs
  if (kind) {
    const { data: prefs } = await sb.from('notification_prefs')
      .select('user_id').eq('kind', kind).eq('enabled', false)
    const disabled = new Set((prefs ?? []).map((p: any) => p.user_id))
    if (disabled.size) sendSubs = subs.filter((s: any) => !disabled.has(s.user_id))
  }

  if (!sendSubs.length) return json({ ok: true, sent: 0 })

  const sent = await pushToSubs(sb, sendSubs, {
    title: title ?? 'Notre Endroit',
    body: msgBody ?? '',
    url: url ?? '/',
    replier_id: replier_id ?? null,
    ask_ok: ask_ok ?? false,
  }, notifMap, VAPID_MAILTO, VAPID_PUBLIC, VAPID_PRIVATE)
  if (typeof sent === 'string') return json({ error: sent }, 500)

  return json({ ok: true, sent })
}

// お知らせログに insert。recipient_user_id が指定されていればその人に、
// されてなければ exclude_user_id 以外の全ユーザー (通常は相手) に記録
async function logNotifications(
  sb: ReturnType<typeof import('https://esm.sh/@supabase/supabase-js@2').createClient>,
  msg: {
    title: string; body: string; url: string;
    sender_id: string | null;
    recipient_user_id: string | null;
    exclude_user_id: string | null;
    kind: string | null;
  }
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  try {
    let recipients: string[] = []
    if (msg.recipient_user_id) {
      recipients = [msg.recipient_user_id]
    } else {
      let q = sb.from('profiles').select('id')
      if (msg.exclude_user_id) q = q.neq('id', msg.exclude_user_id)
      const { data: profs } = await q
      recipients = (profs ?? []).map((p: any) => p.id).filter(Boolean)
    }
    if (!recipients.length) return map
    const rows = recipients.map(uid => ({
      user_id: uid,
      sender_id: msg.sender_id,
      title: msg.title,
      body: msg.body,
      url: msg.url,
      kind: msg.kind,
    }))
    const { data: inserted } = await sb.from('notifications_log').insert(rows).select('id, user_id')
    ;(inserted ?? []).forEach((r: any) => {
      if (r?.user_id && r?.id) map.set(String(r.user_id), String(r.id))
    })
  } catch (e) {
    console.error('[send-push] notifications_log insert failed:', e)
    // ログ失敗はプッシュ本体には影響させない
  }
  return map
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

// ask_reply 用: 指定 user_id にのみ push 送信
async function sendToUser(
  sb: ReturnType<typeof import('https://esm.sh/@supabase/supabase-js@2').createClient>,
  userId: string,
  msg: { title: string; body: string; url: string },
  vapidMailto: string, vapidPub: string, vapidPriv: string,
): Promise<Response> {
  const { data: subs } = await sb.from('push_subscriptions').select('*').eq('user_id', userId)
  if (!subs?.length) return json({ ok: true, sent: 0 })
  const sent = await pushToSubs(sb, subs, { ...msg, replier_id: null, ask_ok: false }, new Map(), vapidMailto, vapidPub, vapidPriv)
  if (typeof sent === 'string') return json({ error: sent }, 500)
  return json({ ok: true, sent })
}

// 購読リストに push 送信。成功数 or エラー文字列を返す
// notifMap: recipient_user_id -> notifications_log.id （sw.js が既読化に使う）
async function pushToSubs(
  sb: ReturnType<typeof import('https://esm.sh/@supabase/supabase-js@2').createClient>,
  subs: Record<string, unknown>[],
  payload: { title: string; body: string; url: string; replier_id: unknown; ask_ok: unknown },
  notifMap: Map<string, string>,
  vapidMailto: string, vapidPub: string, vapidPriv: string,
): Promise<number | string> {
  const webpushMod = await import('npm:web-push')
  const webpush = (webpushMod as any).default ?? webpushMod
  try {
    webpush.setVapidDetails(vapidMailto, vapidPub, vapidPriv)
  } catch (e: any) {
    return 'vapid setup failed: ' + (e?.message ?? String(e))
  }
  let sent = 0
  await Promise.all(subs.map(async (sub) => {
    try {
      const notif_id = notifMap.get(String((sub as any).user_id)) ?? null
      const perSubPayload = notif_id ? { ...payload, notif_id } : payload
      await webpush.sendNotification((sub as any).subscription, JSON.stringify(perSubPayload))
      sent++
    } catch (e: any) {
      if (e?.statusCode === 410 || e?.statusCode === 404) {
        await sb.from('push_subscriptions').delete().eq('id', (sub as any).id)
      }
    }
  }))
  return sent
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
