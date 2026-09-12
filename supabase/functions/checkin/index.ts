// 今ここチェックインの一括処理 (2026-09-12〜)
// 背景: 以前はページ内 JS が「Nominatim 逆引き → insert → 初訪問pt → 通知」を順にやっていて、
//       途中で別ページへ移動すると処理ごと消えてチェックインが登録されなかった。
//       クライアントは座標を keepalive fetch で1発投げるだけにし、残りは全部ここで完結させる。
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

  const { lat, lng, note } = await req.json().catch(() => ({}))
  if (typeof lat !== 'number' || typeof lng !== 'number') return json({ error: 'lat/lng required' }, 400)

  const sb = createClient(SB_URL, SB_KEY)

  // 1. 町名の逆引き (失敗しても続行。タイムアウト5秒)
  let place_name: string | null = null
  try {
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), 5000)
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ja`,
      { headers: { 'Accept-Language': 'ja', 'User-Agent': 'notre-endroit/1.0 (private app)' }, signal: ac.signal },
    )
    clearTimeout(t)
    const addr = (await res.json())?.address
    place_name = addr?.suburb || addr?.neighbourhood || addr?.quarter
      || addr?.city_district || addr?.city || addr?.town || addr?.village || null
  } catch (_) { /* 地名なしで登録 */ }

  // 2. チェックイン登録
  const { error: insErr } = await sb.from('location_checkins').insert({
    user_id: uid, lat, lng, place_name, note: note || null,
  })
  if (insErr) return json({ error: 'insert failed: ' + insErr.message }, 500)

  // 3. はじめての町なら +5pt (util.js: awardFirstVisit と同じ判定。insert 後に数えて1件なら初)
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

  // 4. 相手に Push (失敗してもチェックイン自体は成立)
  try {
    const { data: profs } = await sb.from('profiles').select('id, name, emoji')
    const me = profs?.find((p: { id: string }) => p.id === uid)
    const partner = profs?.find((p: { id: string }) => p.id !== uid)
    if (me && partner) {
      const body = `${me.emoji} ${me.name} が今ここにいるよ${place_name ? '（' + place_name + '）' : ''}${note ? '「' + note + '」' : ''}`
      await fetch(`${SB_URL}/functions/v1/send-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SB_KEY}` },
        body: JSON.stringify({
          title: first_visit ? '🆕 はじめての町にいるよ' : '📍 今ここにいるよ',
          body, url: '/location.html', kind: 'location',
          recipient_user_id: partner.id, sender_user_id: uid,
        }),
      })
    }
  } catch (e) {
    console.error('[checkin] 通知失敗:', e)
  }

  return json({ ok: true, place_name, first_visit })
})
