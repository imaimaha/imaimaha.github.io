import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from 'https://deno.land/std@0.177.0/node/crypto.ts'

const LINE_SECRET = Deno.env.get('LINE_CHANNEL_SECRET')!
const LINE_TOKEN  = Deno.env.get('LINE_CHANNEL_TOKEN')!
const SB_URL      = Deno.env.get('SUPABASE_URL')!
const SB_KEY      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

function sendPush(payload: Record<string, unknown>) {
  fetch(`${SB_URL}/functions/v1/send-push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SB_KEY}`,
    },
    body: JSON.stringify(payload),
  }).catch(() => {})
}

Deno.serve(async (req) => {
  const body = await req.text()
  const sb = createClient(SB_URL, SB_KEY)

  await sb.from('settings').upsert({ key: 'last_request', value: new Date().toISOString() })

  // LINE 署名検証
  const sig = req.headers.get('x-line-signature') ?? ''
  const hmac = createHmac('sha256', LINE_SECRET)
  hmac.update(body)
  const expected = hmac.digest('base64')
  if (sig !== expected) {
    await sb.from('settings').upsert({ key: 'last_sig_fail', value: new Date().toISOString() })
    return new Response('Unauthorized', { status: 401 })
  }

  const parsed = JSON.parse(body)
  const { events } = parsed

  await sb.from('settings').upsert({
    key: 'last_webhook',
    value: JSON.stringify({ ts: new Date().toISOString(), events: (events ?? []).map((e: Record<string,unknown>) => ({ type: e.type, src: e.source })) })
  })

  for (const event of events ?? []) {
    const sourceType  = event.source?.type
    const lineUserId  = event.source?.userId
    const groupId     = event.source?.groupId

    // グループメッセージ → グループID保存 + Web Push送信
    if (sourceType === 'group' && groupId) {
      await sb.from('settings').upsert({ key: 'line_group_id', value: groupId })

      if (event.type === 'message' && event.message?.type === 'text' && lineUserId) {
        const { data: senderProfile } = await sb
          .from('profiles')
          .select('id, name, emoji')
          .eq('line_user_id', lineUserId)
          .single()
        sendPush({
          title: senderProfile ? `${senderProfile.emoji} ${senderProfile.name}` : 'Notre Endroit',
          body: event.message.text,
          sender_user_id: senderProfile?.id ?? null,
          replier_id: senderProfile?.id ?? null,
        })
      }
      continue
    }

    // 個人チャット: follow または message → line_user_id を登録
    if (!lineUserId) continue
    if (event.type !== 'follow' && event.type !== 'message') continue

    const { data: profiles } = await sb
      .from('profiles')
      .select('id, name, line_user_id')

    const alreadyRegistered = profiles?.some(p => p.line_user_id === lineUserId)
    if (alreadyRegistered) {
      // 登録済み → 1対1メッセージをWeb Pushで転送
      if (event.type === 'message' && event.message?.type === 'text') {
        const senderProfile = profiles?.find(p => p.line_user_id === lineUserId)
        const recipientProfile = profiles?.find(p => p.line_user_id !== lineUserId)
        if (recipientProfile) {
          sendPush({
            title: senderProfile ? `${senderProfile.emoji} ${senderProfile.name}` : 'Notre Endroit',
            body: event.message.text,
            recipient_user_id: recipientProfile.id,
            replier_id: senderProfile?.id ?? null,
          })
        }
      }
      continue
    }

    const unregistered = profiles?.find(p => !p.line_user_id)
    if (unregistered) {
      await sb
        .from('profiles')
        .update({ line_user_id: lineUserId })
        .eq('id', unregistered.id)

      await fetch('https://api.line.me/v2/bot/message/reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${LINE_TOKEN}`,
        },
        body: JSON.stringify({
          replyToken: event.replyToken,
          messages: [{
            type: 'text',
            text: `✅ ${unregistered.name} として Notre Endroit と連携しました！`,
          }],
        }),
      })
    }
  }

  return new Response('OK')
})
