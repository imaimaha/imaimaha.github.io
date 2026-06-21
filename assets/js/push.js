const _VAPID_PUB = 'BPiU1n7YLx_aazNZ1DtFKoxjg21_n6Yfi_jdPpR3ja2vpTQn8Kb5ukqCeDwIR94etciUSRgUPeCbhQxsX9Vy1d8'

function _urlB64ToUint8(b64) {
  const pad = '='.repeat((4 - b64.length % 4) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

async function _saveSub(sub) {
  if (typeof _sb === 'undefined') throw new Error('Supabaseクライアント未初期化')
  const { data: { session } } = await _sb.auth.getSession()
  if (!session) throw new Error('未ログイン状態')
  const { error } = await _sb.from('push_subscriptions').upsert({
    user_id: session.user.id,
    endpoint: sub.endpoint,
    subscription: sub.toJSON(),
  }, { onConflict: 'user_id,endpoint', ignoreDuplicates: false })
  if (error) throw new Error('DB保存失敗: ' + error.message)
}

async function requestPush() {
  if (!('Notification' in window)) {
    alert('❌ 通知非対応です。\nSafariでホーム画面に追加して開いてください。')
    return
  }

  // iOSはユーザータップ直後に許可を求めないと無視される
  let perm = Notification.permission
  if (perm === 'default') perm = await Notification.requestPermission()

  if (perm === 'denied') {
    alert('🚫 通知が拒否されています。\n\niOS設定 → アプリ名「Notre」→ 通知 をオンにしてください。')
    return
  }
  if (perm !== 'granted') {
    alert('⚠️ 通知が許可されませんでした。')
    return
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    alert('❌ プッシュ通知非対応。\nSafariのホーム画面追加版で開いてください。')
    return
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js')
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, r) => setTimeout(() => r(new Error('SWタイムアウト(8秒)')), 8000)),
    ])

    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: _urlB64ToUint8(_VAPID_PUB),
      })
    }
    await _saveSub(sub)

    const banner = document.getElementById('push-banner')
    if (banner) banner.style.display = 'none'
    alert('✅ 通知が有効になりました！')
  } catch (e) {
    alert('❌ ' + (e?.message ?? String(e)))
  }
}

async function initPushUI() {
  const banner = document.getElementById('push-banner')
  const info   = document.getElementById('push-debug-info')
  if (!banner) return

  const notifOk = 'Notification' in window
  const swOk    = 'serviceWorker' in navigator
  const pushOk  = 'PushManager' in window
  const perm    = notifOk ? Notification.permission : 'unsupported'

  if (info) info.textContent = `perm:${perm} SW:${swOk} Push:${pushOk}`

  // すでに許可済み → バナーなしで購読を更新
  if (notifOk && perm === 'granted' && swOk && pushOk) {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      let sub = await reg.pushManager.getSubscription()
      if (!sub) sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: _urlB64ToUint8(_VAPID_PUB),
      })
      await _saveSub(sub)
    } catch (e) { console.debug('[push]', e?.message) }
    return
  }

  // 常にバナーを表示（状態に関わらず）
  banner.style.display = 'flex'
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPushUI)
} else {
  initPushUI()
}
