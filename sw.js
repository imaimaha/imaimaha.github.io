// SW 更新をすばやく反映させる
self.addEventListener('install', event => { self.skipWaiting() })
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()) })

const EMOJIS = ['❤️', '😊', '💨', '😫', '👍']
const ASK_ACTIONS = [
  { action: 'ok',    title: 'いいよ ✅' },
  { action: 'ng',    title: 'きびしい 🚫' },
  { action: 'maybe', title: '仕事の進み次第 🤔' },
]
const ASK_LABELS = { ok: 'いいよ ✅', ng: 'きびしい 🚫', maybe: '仕事の進み次第 🤔' }

self.addEventListener('push', event => {
  if (!event.data) return
  let payload = {}
  try { payload = event.data.json() } catch { payload = { body: event.data.text() } }

  const { title = 'Notre Endroit', body = '', url = '/', replier_id = '', ask_ok = false, notif_id = '' } = payload

  const actions = ask_ok ? ASK_ACTIONS
    : (replier_id ? EMOJIS.map((e, i) => ({ action: `r${i}`, title: e })) : [])

  const options = {
    body,
    icon: '/icon.svg',
    badge: '/badge.svg',
    vibrate: [200, 100, 200],
    requireInteraction: true,
    data: { url, replier_id, ask_ok, notif_id },
    ...(actions.length ? { actions } : {}),
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()

  const { ask_ok, replier_id, url, notif_id } = event.notification.data ?? {}

  // 「行っていい？」3択返答
  if (ask_ok && event.action && replier_id) {
    const label = ASK_LABELS[event.action] ?? event.action
    event.waitUntil(
      fetch('https://qivnfiqyjfajlzbdqodd.supabase.co/functions/v1/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ask_reply: true,
          replier_id,
          title: label,
          body: 'パートナーが返答しました',
          url: '/status.html',
        }),
      }).catch(() => {})
    )
    return
  }

  // 旧 LINE 絵文字クイックリプライ（後方互換）
  const idx = parseInt(event.action?.replace('r', '') ?? '-1', 10)
  if (idx >= 0 && idx < EMOJIS.length && replier_id && !ask_ok) {
    event.waitUntil(
      fetch('https://qivnfiqyjfajlzbdqodd.supabase.co/functions/v1/line-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender_id: replier_id, target: 'group', message: EMOJIS[idx] }),
      }).catch(() => {})
    )
    return
  }

  const targetUrl = url || '/'
  // 通知タップで既読化するため notif_id をクエリに載せる。ページ側 (header.js) が既読化＋URL クリーンアップ
  const withNotif = notif_id
    ? targetUrl + (targetUrl.includes('?') ? '&' : '?') + `notif_id=${encodeURIComponent(notif_id)}`
    : targetUrl
  const fullUrl = withNotif.startsWith('http') ? withNotif : `https://imaimaha.github.io${withNotif}`
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      const existing = cs.find(c => c.url.startsWith('https://imaimaha.github.io'))
      if (existing) {
        return existing.navigate(fullUrl).then(() => existing.focus()).catch(() => existing.focus())
      }
      return clients.openWindow(fullUrl)
    })
  )
})
