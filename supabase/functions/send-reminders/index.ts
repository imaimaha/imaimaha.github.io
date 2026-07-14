import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SB_URL = Deno.env.get('SUPABASE_URL')!
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// JST 基準の日付 (YYYY-MM-DD)
function jstDateStr(d = new Date()): string {
  const jstMs = d.getTime() + 9 * 60 * 60 * 1000
  return new Date(jstMs).toISOString().split('T')[0]
}
function jstMondayStr(d = new Date()): string {
  const jstMs = d.getTime() + 9 * 60 * 60 * 1000
  const jd = new Date(jstMs)
  const dow = jd.getUTCDay()
  const daysSinceMon = (dow + 6) % 7
  jd.setUTCDate(jd.getUTCDate() - daysSinceMon)
  return jd.toISOString().split('T')[0]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors() })

  // service_role でのみ呼べる（pg_cron 経由）。新旧 API キー両対応
  const auth = req.headers.get('Authorization') ?? ''
  if (!isServiceAuth(auth, SB_KEY)) return json({ error: 'Unauthorized' }, 401)

  const { kind } = await req.json()
  if (!kind) return json({ error: 'kind is required' }, 400)

  const sb = createClient(SB_URL, SB_KEY)
  const today = jstDateStr()
  let sent = 0
  let skipped = 0

  // 各ユーザーごとに条件を判定して push
  const { data: profiles } = await sb.from('profiles').select('id, emoji, name')
  if (!profiles) return json({ error: 'profiles fetch failed' }, 500)

  for (const p of profiles) {
    // 既送信チェック
    const { data: prevSent } = await sb.from('notifications_sent')
      .select('id').eq('user_id', p.id).eq('kind', kind).eq('date_str', today).maybeSingle()
    if (prevSent) { skipped++; continue }

    let shouldNotify = false
    let title = 'Notre Endroit'
    let body = ''
    let url = '/'

    if (kind === 'status_1719' || kind === 'status_1901') {
      // 今日の status が未登録なら通知
      const { data: st } = await sb.from('status').select('user_id').eq('user_id', p.id).maybeSingle()
      if (!st) {
        shouldNotify = true
        body = kind === 'status_1719'
          ? `${p.emoji} 今日の帰宅時間まだ登録してないよ！`
          : `${p.emoji} 遅くない？帰宅時間まだ未登録だよ⏰`
        url = '/status.html'
      }

    } else if (kind === 'quiz_evening') {
      const { data: qa } = await sb.from('quiz_answers')
        .select('id').eq('user_id', p.id).eq('date_str', today).maybeSingle()
      if (!qa) {
        shouldNotify = true
        body = `${p.emoji} 今日のクイズまだ答えてないよ！ +10pt`
        url = '/quiz.html'
      }

    } else if (kind === 'capsule_morning') {
      const nowIso = new Date().toISOString()
      const { data: caps } = await sb.from('time_capsules')
        .select('id').eq('recipient_id', p.id).eq('is_opened', false).lte('open_at', nowIso).limit(1)
      if (caps && caps.length > 0) {
        shouldNotify = true
        body = `🎁 未開封のタイムカプセルがあるよ`
        url = '/time_capsule.html'
      }

    } else if (kind === 'bingo_saturday') {
      // 今週のビンゴのチェック数が想定より少ないなら通知
      const weekKey = jstMondayStr()
      const { data: card } = await sb.from('bingo_sessions')
        .select('checks').eq('user_id', p.id).eq('mode', 'weekly').eq('date_str', weekKey).maybeSingle()
      const cnt = card?.checks?.length ?? 0
      if (cnt < 8) {
        shouldNotify = true
        body = `🎯 今週のビンゴ ${cnt}マス済み。週末までに集めよう`
        url = '/bingo.html'
      }

    } else if (kind === 'color_saturday') {
      const weekKey = jstMondayStr()
      const { data: hunt } = await sb.from('color_hunts')
        .select('photos').eq('user_id', p.id).eq('mode', 'weekly').eq('week_key', weekKey).maybeSingle()
      const cnt = (hunt?.photos ?? []).length
      if (cnt < 4) {
        shouldNotify = true
        body = `🎨 今週のカラーハント ${cnt}/8。まだ半分！`
        url = '/color_hunting.html'
      }

    } else if (kind === 'gauge_low') {
      // effective gauge < 30 で通知（減衰計算）
      const { data: g } = await sb.from('closer_gauge')
        .select('gauge, updated_at').eq('user_id', p.id).maybeSingle()
      if (g) {
        const elapsed = Date.now() - new Date(g.updated_at).getTime()
        const factor = Math.max(0, 1 - elapsed / (24 * 60 * 60 * 1000))
        const eff = Math.round((g.gauge ?? 0) * factor)
        if (eff < 30) {
          shouldNotify = true
          body = `✨ ゲージが ${eff}% まで下がってるよ`
          url = '/closer.html'
        }
      }

    } else if (kind === 'status_5min_before' || kind === 'status_arrival') {
      // このユーザーの帰宅予定 finish_time (HH:MM) と現在時刻(JST)を比較
      // 5分前: 自分にのみ / 時刻ちょうど: 自分と相手の両方に Push
      const { data: st } = await sb.from('status').select('finish_time').eq('user_id', p.id).maybeSingle()
      if (!st?.finish_time) { skipped++; continue }
      const [fh, fm] = st.finish_time.split(':').map(Number)
      const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000)
      const nowMin = jstNow.getUTCHours() * 60 + jstNow.getUTCMinutes()
      const finishMin = fh * 60 + fm
      const targetMin = kind === 'status_5min_before' ? finishMin - 5 : finishMin
      const diff = nowMin - targetMin
      if (Math.abs(diff) > 3) { skipped++; continue }

      const partner = profiles.find(x => x.id !== p.id)
      const timeStr = `${String(fh).padStart(2,'0')}:${String(fm).padStart(2,'0')}`

      // 送信先: 自分は必ず含める。時刻ちょうどのみパートナーにも送る
      const targets: Array<{ id: string, forPartner: boolean }> = [{ id: p.id, forPartner: false }]
      if (kind === 'status_arrival' && partner) {
        targets.push({ id: partner.id, forPartner: true })
      }

      const tTitle = kind === 'status_5min_before' ? '⏰ もうすぐ帰宅時間' : '🏠 帰宅時間になりました'
      let anySent = false
      for (const t of targets) {
        const tBody = t.forPartner
          ? (kind === 'status_5min_before'
              ? `${p.emoji} ${p.name} の予定時刻 ${timeStr} まであと5分`
              : `${p.emoji} ${p.name} の予定時刻 ${timeStr} になりました`)
          : (kind === 'status_5min_before'
              ? `予定時刻 ${timeStr} まであと5分だよ`
              : `予定時刻 ${timeStr} になったよ`)
        const res = await fetch(`${SB_URL}/functions/v1/send-push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SB_KEY}`,
          },
          body: JSON.stringify({
            title: tTitle,
            body: tBody,
            url: '/status.html',
            recipient_user_id: t.id,
            kind: 'status',
          }),
        })
        if (res.ok) { sent++; anySent = true }
      }
      if (anySent) {
        await sb.from('notifications_sent').insert({
          user_id: p.id, kind, date_str: today,
        })
      } else {
        skipped++
      }
      continue
    } else if (kind === 'anniversary') {
      // 記念日カウントダウン（毎朝2:05 JST に判定）
      const START = new Date('2025-11-22T02:00:00+09:00')
      const now = new Date()
      const next = new Date(START)
      next.setUTCFullYear(now.getUTCFullYear())
      if (next <= now) next.setUTCFullYear(now.getUTCFullYear() + 1)
      const daysToNext = Math.ceil((next.getTime() - now.getTime()) / 86400000)
      const nYear = next.getUTCFullYear() - START.getUTCFullYear()
      const totalDays = Math.floor((now.getTime() - START.getTime()) / 86400000)
      let msg = ''
      let bonusPt = 0
      if (daysToNext === 0) { msg = `💖 記念日おめでとう！ ${nYear}周年 ✨ +100pt`; bonusPt = 100 }
      else if (daysToNext === 1) msg = `💖 明日はふたりの ${nYear}周年！`
      else if (daysToNext === 7) msg = `💕 記念日まであと1週間`
      else if (daysToNext === 30) msg = `💕 記念日まであと1ヶ月`
      else if (totalDays > 0 && totalDays % 30 === 0) { msg = `💕 一緒になって ${totalDays} 日目 +30pt`; bonusPt = 30 }
      if (msg) {
        shouldNotify = true
        body = msg
        url = '/'
        // ポイントボーナス付与
        if (bonusPt > 0) {
          await sb.from('points').insert({
            user_id: p.id, amount: bonusPt,
            reason: daysToNext === 0 ? 'anniversary_bonus' : 'monthly_milestone',
          })
        }
      }
    }

    if (shouldNotify) {
      const res = await fetch(`${SB_URL}/functions/v1/send-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SB_KEY}`,
        },
        body: JSON.stringify({
          title,
          body,
          url,
          recipient_user_id: p.id,
        }),
      })
      if (res.ok) {
        sent++
        await sb.from('notifications_sent').insert({
          user_id: p.id, kind, date_str: today,
        })
      }
    } else {
      skipped++
    }
  }

  return json({ ok: true, kind, sent, skipped })
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
