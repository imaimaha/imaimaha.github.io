// 今ここチェックインの一括処理 (2026-09-12〜)
// 背景: 以前はページ内 JS が「Nominatim 逆引き → insert → 初訪問pt → 通知」を順にやっていて、
//       途中で別ページへ移動すると処理ごと消えてチェックインが登録されなかった。
//       クライアントは座標を keepalive fetch で1発投げるだけにし、残りは全部ここで完結させる。
//
// 2026-09-27追記: Nominatim への逆引きリクエストを Supabase Edge Function (Deno Deploy) の
// IPから行うと "Access Denied" で常に弾かれるようになった(おそらく共有IPが乱用扱いされて
// ブロックされた)ため、逆引きはクライアント側(実ユーザーのIP)で行う2段階方式に変更した:
//   ① { lat, lng, note } … 即座に place_name=null で登録だけ済ませる(離脱しても残る、従来通り)
//   ② { id, place_name } … ①のidに対してクライアント側で解決した町名を後から書き込み、
//                           そのタイミングで初訪問pt・相手への通知を行う
// ②は①より後に走るベストエフォートなので、離脱で②が届かなければ「町名なし・通知なし」に
// なるだけで①(チェックイン自体)は必ず残る。
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SB_URL = Deno.env.get('SUPABASE_URL')!
const SB_KEY = (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!
const SB_ANON = Deno.env.get('SB_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? ''

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  // 呼び出したユーザーを特定 (purchase-shop-item と同じ方式)
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

  const body = await req.json().catch(() => ({}))
  const sb = createClient(SB_URL, SB_KEY)

  // ── ② 町名だけ後から書き込むモード ──
  if (body.id) {
    const place_name: string | null = body.place_name || null
    const { data: row, error: updErr } = await sb.from('location_checkins')
      .update({ place_name })
      .eq('id', body.id).eq('user_id', uid)
      .select('id, note').maybeSingle()
    if (updErr || !row) return json({ error: updErr?.message || 'row not found' }, 404)

    // はじめての町なら +5pt (insert 後に数えて1件なら初)
    let first_visit = false
    if (place_name) {
      const { count } = await sb.from('location_checkins')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', uid).eq('place_name', place_name)
      if ((count ?? 0) === 1) {
        const { error: ptErr } = await sb.from('points').insert({ user_id: uid, amount: 5, reason: 'location_first_visit' })
        first_visit = !ptErr
      }
    }

    // 相手に Push (失敗してもチェックイン自体は成立)
    try {
      const { data: profs } = await sb.from('profiles').select('id, name, emoji')
      const me = profs?.find((p: { id: string }) => p.id === uid)
      const partner = profs?.find((p: { id: string }) => p.id !== uid)
      if (me && partner) {
        const pushBody = `${me.emoji} ${me.name} が今ここにいるよ${place_name ? '（' + place_name + '）' : ''}${row.note ? '「' + row.note + '」' : ''}`
        await fetch(`${SB_URL}/functions/v1/send-push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SB_KEY}` },
          body: JSON.stringify({
            title: first_visit ? '🆕 はじめての町にいるよ' : '📍 今ここにいるよ',
            body: pushBody, url: '/location.html', kind: 'location',
            recipient_user_id: partner.id, sender_user_id: uid,
          }),
        })
      }
    } catch (e) {
      console.error('[checkin] 通知失敗:', e)
    }

    return json({ ok: true, id: row.id, place_name, first_visit })
  }

  // ── ① 即座に登録するモード ──
  const { lat, lng, note } = body
  if (typeof lat !== 'number' || typeof lng !== 'number') return json({ error: 'lat/lng required' }, 400)

  const { data: inserted, error: insErr } = await sb.from('location_checkins')
    .insert({ user_id: uid, lat, lng, place_name: null, note: note || null })
    .select('id').single()
  if (insErr) return json({ error: 'insert failed: ' + insErr.message }, 500)

  return json({ ok: true, id: inserted.id, place_name: null, first_visit: false })
})
