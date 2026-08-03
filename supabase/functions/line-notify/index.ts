import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const LINE_TOKEN = Deno.env.get('LINE_CHANNEL_TOKEN')!
const SB_URL     = Deno.env.get('SUPABASE_URL')!
const SB_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() })
  }

  const { sender_id, message, target, quick_reply } = await req.json()

  if (!message) {
    return json({ error: 'message is required' }, 400)
  }

  const sb = createClient(SB_URL, SB_KEY)
  let to: string | null = null
  let partnerUserId: string | null = null

  // ⚠️ LINE 通知は「ふたり + bot の3人グループ」に一元化する (2026-08-04〜 ユーザー方針)。
  //   呼び出し側が target:'partner' を渡しても個人トークには送らずグループへ送る。
  //   グループID (settings.line_group_id) が未設定のときだけ個人トークにフォールバック
  const { data: groupSetting } = await sb
    .from('settings')
    .select('value')
    .eq('key', 'line_group_id')
    .maybeSingle()

  if (groupSetting?.value) {
    to = groupSetting.value
  } else if (sender_id) {
    console.warn('[line-notify] line_group_id が未設定のため個人トークに送信します')
    const { data: partner } = await sb
      .from('profiles')
      .select('id, line_user_id')
      .neq('id', sender_id)
      .single()
    if (!partner?.line_user_id) return json({ error: 'partner LINE User ID not registered' }, 404)
    to = partner.line_user_id
    partnerUserId = partner.id
  } else {
    return json({ error: 'no group configured and no sender_id' }, 400)
  }

  const lineMessage: Record<string, unknown> = { type: 'text', text: message }
  if (Array.isArray(quick_reply) && quick_reply.length > 0) {
    lineMessage.quickReply = {
      items: quick_reply.slice(0, 13).map((label: string) => ({
        type: 'action',
        action: { type: 'message', label: String(label).slice(0, 20), text: String(label) },
      })),
    }
  }

  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LINE_TOKEN}`,
    },
    body: JSON.stringify({
      to,
      messages: [lineMessage],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return json({ error: err }, 500)
  }

  // Web Push 通知（非同期・失敗しても無視）
  const pushPayload: Record<string, unknown> = {
    title: 'Notre Endroit',
    body: message,
    replier_id: sender_id ?? null,
  }
  // グループ送信時は partnerUserId が無い。sender_user_id を渡すと
  // send-push 側が「送信者以外」に配るので、結果は相手に届く形になる
  if (partnerUserId) {
    pushPayload.recipient_user_id = partnerUserId
  } else {
    pushPayload.sender_user_id = sender_id ?? null
  }
  fetch(`${SB_URL}/functions/v1/send-push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SB_KEY}`,
    },
    body: JSON.stringify(pushPayload),
  }).catch(() => {})

  return json({ ok: true })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  })
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}
