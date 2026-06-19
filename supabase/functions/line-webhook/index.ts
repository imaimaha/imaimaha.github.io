import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from 'https://deno.land/std@0.177.0/node/crypto.ts'

const LINE_SECRET = Deno.env.get('LINE_CHANNEL_SECRET')!
const LINE_TOKEN  = Deno.env.get('LINE_CHANNEL_TOKEN')!
const SB_URL      = Deno.env.get('SUPABASE_URL')!
const SB_KEY      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  const body = await req.text()

  // LINE 署名検証
  const sig = req.headers.get('x-line-signature') ?? ''
  const hmac = createHmac('sha256', LINE_SECRET)
  hmac.update(body)
  const expected = hmac.digest('base64')
  if (sig !== expected) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { events } = JSON.parse(body)
  const sb = createClient(SB_URL, SB_KEY)

  for (const event of events ?? []) {
    const lineUserId = event.source?.userId
    if (!lineUserId) continue

    if (event.type === 'follow' || event.type === 'message') {
      // LINE User ID をプロフィールに保存（display name で照合）
      // まずそのユーザーの表示名を取得
      const profileRes = await fetch(`https://api.line.me/v2/bot/profile/${lineUserId}`, {
        headers: { Authorization: `Bearer ${LINE_TOKEN}` },
      })
      const lineProfile = await profileRes.json()
      const displayName: string = lineProfile.displayName ?? ''

      // Supabase の profiles に line_user_id をまだ持っていない行を更新
      // 表示名ではなく、全 profiles に line_user_id がなければ保留リストに追加
      const { data: profiles } = await sb
        .from('profiles')
        .select('id, name, line_user_id')

      // すでに登録済みならスキップ
      const alreadyRegistered = profiles?.some(p => p.line_user_id === lineUserId)
      if (alreadyRegistered) continue

      // line_user_id が未登録のプロフィールに順番に割り当て
      const unregistered = profiles?.find(p => !p.line_user_id)
      if (unregistered) {
        await sb
          .from('profiles')
          .update({ line_user_id: lineUserId })
          .eq('id', unregistered.id)

        // 登録完了メッセージを返信
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
  }

  return new Response('OK')
})
