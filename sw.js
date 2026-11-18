// 2026-11-19: Notre の Web ポータルを閉じた（Notre は iOS アプリで使う）。
// 以前ホーム画面に追加した PWA が古い Notre の画面をキャッシュから出し続けないように、
// この Service Worker は「キャッシュを消して、自分を登録解除して、開いているトップ画面を読み直す」だけをする。
// fetch / push のハンドラは持たない（すべてネットワークから読む）。

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys()
      await Promise.all(keys.map(k => caches.delete(k)))
    } catch { /* 無視 */ }
    try { await self.registration.unregister() } catch { /* 無視 */ }
    try {
      const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of list) {
        // 1回だけ読み直す。古い Notre のページは開くと sw.js をまた登録することがあるので、
        // 読み直した URL に印（sw-reset）をつけて、2回目からは読み直さない（無限に読み直さないため）
        const u = new URL(client.url)
        if (u.origin !== self.location.origin || u.searchParams.has('sw-reset')) continue
        if (u.pathname !== '/' && u.pathname !== '/index.html') u.searchParams.set('sw-reset', '1')
        try { await client.navigate(u.href) } catch { /* 無視 */ }
      }
    } catch { /* 無視 */ }
  })())
})
