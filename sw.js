const EMOJIS = ['❤️', '😊', '💨', '😫', '👍']

self.addEventListener('push', event => {
  if (!event.data) return
  let payload = {}
  try { payload = event.data.json() } catch { payload = { body: event.data.text() } }

  const { title = 'Notre Endroit', body = '', replier_id = '' } = payload

  const options = {
    body,
    icon: '/icon.svg',
    badge: '/badge.svg',
    vibrate: [200, 100, 200],
    requireInteraction: true,
    data: { replier_id },
    actions: EMOJIS.map((e, i) => ({ action: `r${i}`, title: e })),
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()

  const idx = parseInt(event.action?.replace('r', '') ?? '-1', 10)
  if (idx >= 0 && idx < EMOJIS.length) {
    const emoji = EMOJIS[idx]
    const replierId = event.notification.data?.replier_id
    event.waitUntil(
      fetch('https://qivnfiqyjfajlzbdqodd.supabase.co/functions/v1/line-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender_id: replierId, target: 'group', message: emoji }),
      }).catch(() => {})
    )
    return
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      const found = cs.find(c => c.url.startsWith('https://imaimaha.github.io'))
      return found ? found.focus() : clients.openWindow('https://imaimaha.github.io/')
    })
  )
})
