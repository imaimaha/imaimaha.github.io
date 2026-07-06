const EMOJIS = ['❤️', '😊', '💨', '😫', '👍']

self.addEventListener('push', event => {
  if (!event.data) return
  let payload = {}
  try { payload = event.data.json() } catch { payload = { body: event.data.text() } }

  const { title = 'Notre Endroit', body = '', url = '/', replier_id = '' } = payload

  const options = {
    body,
    icon: '/icon.svg',
    badge: '/badge.svg',
    vibrate: [200, 100, 200],
    requireInteraction: true,
    data: { url, replier_id },
    // 絵文字クイックリプライは replier_id がある時だけ（従来のLINE用）
    ...(replier_id ? { actions: EMOJIS.map((e, i) => ({ action: `r${i}`, title: e })) } : {}),
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()

  const idx = parseInt(event.action?.replace('r', '') ?? '-1', 10)
  if (idx >= 0 && idx < EMOJIS.length && event.notification.data?.replier_id) {
    const emoji = EMOJIS[idx]
    const replierId = event.notification.data.replier_id
    event.waitUntil(
      fetch('https://qivnfiqyjfajlzbdqodd.supabase.co/functions/v1/line-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender_id: replierId, target: 'group', message: emoji }),
      }).catch(() => {})
    )
    return
  }

  const targetUrl = event.notification.data?.url || '/'
  const fullUrl = targetUrl.startsWith('http') ? targetUrl : `https://imaimaha.github.io${targetUrl}`
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      // 既に開いているウィンドウがあれば targetUrl に navigate してフォーカス
      const existing = cs.find(c => c.url.startsWith('https://imaimaha.github.io'))
      if (existing) {
        return existing.navigate(fullUrl).then(() => existing.focus()).catch(() => existing.focus())
      }
      return clients.openWindow(fullUrl)
    })
  )
})
