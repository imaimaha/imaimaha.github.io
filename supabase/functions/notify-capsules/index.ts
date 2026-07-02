import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SB_URL = Deno.env.get('SUPABASE_URL')!
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return res(null, 204)

  const auth = req.headers.get('Authorization') ?? ''
  if (auth !== `Bearer ${SB_KEY}`) return res({ error: 'Unauthorized' }, 401)

  const sb = createClient(SB_URL, SB_KEY)
  const now = new Date().toISOString()

  // 開封日時を過ぎたのにまだ通知していないカプセルを取得
  const { data: capsules, error } = await sb
    .from('time_capsules')
    .select('id, sender_id')
    .eq('line_notified', false)
    .lte('open_at', now)

  if (error) return res({ error: error.message }, 500)
  if (!capsules || capsules.length === 0) return res({ ok: true, notified: 0 })

  // 同じ送信者の複数カプセルは1通知にまとめる
  const bySender = new Map<string, string[]>()
  for (const c of capsules) {
    if (!bySender.has(c.sender_id)) bySender.set(c.sender_id, [])
    bySender.get(c.sender_id)!.push(c.id)
  }

  let notified = 0
  for (const [senderId, ids] of bySender) {
    const lineRes = await fetch(`${SB_URL}/functions/v1/line-notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SB_KEY}`,
      },
      body: JSON.stringify({
        sender_id: senderId,
        target: 'partner',
        message: `🎁 タイムカプセルが届きました！\nNotre Endroit を開いてみてください ✨`,
      }),
    })
    if (lineRes.ok || lineRes.status === 404) {
      // 404 = パートナーのLINE未登録でも通知済みにする（無限リトライ防止）
      await sb.from('time_capsules').update({ line_notified: true }).in('id', ids)
      notified += ids.length
    }
  }

  return res({ ok: true, notified })
})

function res(data: unknown, status = 200) {
  return new Response(data ? JSON.stringify(data) : null, {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
